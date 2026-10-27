import { showToast, initSidebar, initCodeCopy } from './ui.js';

(() => {
    'use strict';

    const $ = (sel) => document.querySelector(sel);
    const storage = {
        get(k) {
            try { return localStorage.getItem(k); } catch { return null; }
        },
        set(k, v) {
            try { localStorage.setItem(k, v); } catch { /* private mode */ }
        },
        remove(k) {
            try { localStorage.removeItem(k); } catch { /* private mode */ }
        },
    };

    /* ---------- app ---------- */
    const input = $('#markdownInput');
    const preview = $('#previewContent');
    const previewBody = $('#previewBody');
    const resizer = $('#resizer');
    const inputPane = $('#inputPane');
    const previewPane = $('#previewPane');
    const editorContainer = $('#editorContainer');
    const modeBtns = Array.from(document.querySelectorAll('.tabs-boxed-wrap .tab-box'));
    const scrollSyncBtn = $('#scrollSyncBtn');
    const copyMdBtn = $('#copyMdBtn');
    const downloadMdBtn = $('#downloadMdBtn');
    const tocContent = $('#tocContent');
    const sidebarEl = $('#sidebar');
    const scrollToTopBtn = $('#scrollToTop');
    const titleInput = $('#titleInput');
    const editorHighlight = $('#editorHighlight');
    const editorHighlightCode = $('#editorHighlightCode');
    const editorHighlightWrap = $('.editor-highlight-wrap');
    const wordCountEl = $('#wordCount');

    const DEFAULT_MARKDOWN = `# markdown goes here~

## some stuff you can do
- **bold** and *italic* text
- [links](https://example.com)
- \`code\` and blocks
- > quotes, tables, lists

\`\`\`js
// syntax highlighting works
const editor = 'pretty neat';
console.log(editor);
\`\`\`

just start typing :3`;

    /* ---------- persistence ---------- */
    const session = {
        get(k) {
            try { return sessionStorage.getItem(k); } catch { return null; }
        },
        set(k, v) {
            try { sessionStorage.setItem(k, v); } catch { /* private mode */ }
        },
    };
    function getTabId() {
        let id = session.get('meowmd_tab_id');
        if (id) return id;
        id = 'tab_' + Math.random().toString(36).slice(2, 11) + '_' + Date.now();
        session.set('meowmd_tab_id', id);
        return id;
    }

    function clearOrphanedTabs() {
        const WEEK = 7 * 24 * 60 * 60 * 1000;
        try {
            const now = Date.now();
            const byTab = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const m = key && /^meowmd_(content|title|mtime)_(.+)$/.exec(key);
                if (!m) continue;
                if (!byTab[m[2]]) byTab[m[2]] = [];
                byTab[m[2]].push(key);
            }
            Object.keys(byTab).forEach((id) => {
                if (id === tabId) return;
                const mtime = parseInt(storage.get(`meowmd_mtime_${id}`), 10);
                if (Number.isFinite(mtime) && now - mtime <= WEEK) return;
                byTab[id].forEach((k) => storage.remove(k));
            });
        } catch { /* private mode */ }
    }
    const tabId = getTabId();
    clearOrphanedTabs();

    function touch() {
        storage.set(`meowmd_mtime_${tabId}`, String(Date.now()));
    }

    const saved = storage.get(`meowmd_content_${tabId}`);
    if (saved !== null && saved !== undefined) {
        input.value = saved;
    } else {
        input.value = DEFAULT_MARKDOWN;
    }

    const savedTitle = storage.get(`meowmd_title_${tabId}`);
    if (savedTitle) {
        titleInput.value = savedTitle;
        document.title = `${savedTitle} - meowmd`;
    }

    titleInput.addEventListener('input', () => {
        const customTitle = titleInput.value.trim();
        if (customTitle) {
            document.title = `${customTitle} - meowmd`;
            storage.set(`meowmd_title_${tabId}`, customTitle);
        } else {
            document.title = 'meowmd - a tiny markdown viewer + editor';
            storage.remove(`meowmd_title_${tabId}`);
        }
        touch();
    });

    function updateWordCount() {
        if (!wordCountEl) return;
        const text = input.value;
        const words = (text.trim().match(/\S+/g) || []).length;
        const chars = text.length;
        wordCountEl.textContent = `${words} ${words === 1 ? 'word' : 'words'} · ${chars} ${chars === 1 ? 'char' : 'chars'}`;
    }

    let autosaveTimer = null;
    function flushAutosave() {
        clearTimeout(autosaveTimer);
        autosaveTimer = null;
        storage.set(`meowmd_content_${tabId}`, input.value);
        touch();
    }
    input.addEventListener('input', () => {
        renderPreview();
        renderEditorHighlight();
        syncEditorHighlightScroll();
        updateWordCount();
        clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(() => {
            storage.set(`meowmd_content_${tabId}`, input.value);
            touch();
        }, 800);
    });
    window.addEventListener('pagehide', flushAutosave);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushAutosave();
    });

    function setInputRange(text, start, end, selStart, selEnd) {
        input.setRangeText(text, start, end, 'end');
        input.setSelectionRange(selStart, selEnd);
        input.focus();
        input.dispatchEvent(new Event('input'));
    }

    function wrapSelection(before, after, placeholder) {
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const selected = input.value.slice(start, end);
        if (selected) {
            setInputRange(before + selected + after, start, end,
                start + before.length, start + before.length + selected.length);
        } else {
            setInputRange(before + placeholder + after, start, end,
                start + before.length, start + before.length + placeholder.length);
        }
    }

    function applyLink() {
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const selected = input.value.slice(start, end);
        if (selected) {
            setInputRange(`[${selected}](url)`, start, end, start + 1, start + 1 + selected.length);
        } else {
            setInputRange('[text](url)', start, end, start + 7, start + 10);
        }
    }

    function applyInlineCode() {
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const selected = input.value.slice(start, end);
        if (selected && selected.includes('\n')) {
            setInputRange('```\n' + selected + '\n```', start, end,
                start + 4, start + 4 + selected.length);
        } else if (selected) {
            setInputRange('`' + selected + '`', start, end, start + 1, start + 1 + selected.length);
        } else {
            setInputRange('`code`', start, end, start + 1, start + 5);
        }
    }

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            storage.set(`meowmd_content_${tabId}`, input.value);
            touch();
            showToast('success', 'saved', 'autosaved to this browser');
            return;
        }
        if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || document.activeElement !== input) return;
        const k = e.key.toLowerCase();
        if (k === 'b') {
            e.preventDefault();
            wrapSelection('**', '**', 'text');
        } else if (k === 'i') {
            e.preventDefault();
            wrapSelection('*', '*', 'text');
        } else if (k === 'k') {
            e.preventDefault();
            applyLink();
        } else if (e.key === '`' || e.code === 'Backquote') {
            e.preventDefault();
            applyInlineCode();
        }
    });

    /* ---------- editor highlight ---------- */
    function renderEditorHighlight() {
        if (!editorHighlightCode || !window.Prism || !Prism.languages.markdown) {
            editorHighlightWrap.classList.add('no-highlight');
            return;
        }
        let html;
        try {
            html = Prism.highlight(input.value, Prism.languages.markdown, 'markdown');
        } catch {
            html = escapeHtml(input.value);
        }
        editorHighlightCode.innerHTML = html;
        editorHighlightWrap.classList.remove('no-highlight');
    }

    function syncEditorHighlightScroll() {
        if (!editorHighlight) return;
        editorHighlight.scrollTop = input.scrollTop;
        editorHighlight.scrollLeft = input.scrollLeft;
    }

    input.addEventListener('scroll', syncEditorHighlightScroll, { passive: true });
    const themeObserver = new MutationObserver(() => {
        renderEditorHighlight();
        renderMermaidOnThemeChange();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    /* ---------- rendering ---------- */
    const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));

    const collapsedBlocks = new Set();

    const LANGUAGE_ALIASES = {
        'objective-c': 'objectivec',
        'vbnet': 'visual-basic',
        'vb.net': 'visual-basic',
    };
    function normalizeLanguage(lang) {
        if (!lang) return 'text';
        const l = lang.toLowerCase()
            .replace(/^language-/, '')
            .replace(/\b#/g, 'sharp')
            .replace(/\b\+\+/g, 'pp');
        return LANGUAGE_ALIASES[l] || l;
    }
    function aliasLanguage(alias, target) {
        if (window.Prism && Prism.languages[target]) {
            Prism.languages[alias] = Prism.languages[target];
        }
    }

    function processCodeBlocks(html) {
        return html.replace(/<pre><code(?: class="language-([\w+#.-]+)")?>([\s\S]*?)<\/code><\/pre>/g,
            (match, lang, codeHtml) => {
                const language = normalizeLanguage(lang);
                const text = escapeHtml(decodeHtml(codeHtml));
                const collapsed = collapsedBlocks.has(text);
                return `<div class="code-block">
                    <div class="code-head" role="button" tabindex="0" aria-expanded="${!collapsed}"
                        aria-label="${collapsed ? 'expand' : 'collapse'} code block (${language})">
                        <svg class="collapse-arrow${collapsed ? ' collapsed' : ''}" aria-hidden="true"><use href="#i-chevron-down"/></svg>
                        <span class="language-label">${language}</span>
                    </div>
                    <div class="code-body code-content${collapsed ? ' collapsed' : ''}" data-raw="${text}"${collapsed ? ' style="max-height:0px"' : ''}>
                        <button class="code-copy" type="button" aria-label="copy code">
                            <svg class="icon-copy" aria-hidden="true"><use href="#i-copy"/></svg>
                            <svg class="icon-check" hidden aria-hidden="true"><use href="#i-check"/></svg>
                        </button>
                        <pre><code class="language-${language}">${text}</code></pre>
                    </div>
                </div>`;
            });
    }

    function decodeHtml(s) {
        const el = document.createElement('span');
        return s.replace(/&(#\d+|#x[\da-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (ent) => {
            el.innerHTML = ent;
            return el.textContent;
        });
    }

    function wrapTables(root) {
        root.querySelectorAll('table').forEach((table) => {
            if (table.closest('.table-wrap')) return;
            const wrap = document.createElement('div');
            wrap.className = 'table-wrap';
            table.parentNode.insertBefore(wrap, table);
            wrap.appendChild(table);
        });
    }

    function renderPreview() {
        const markdown = input.value;
        if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
            previewBody.innerHTML = '<p>editor libraries failed to load. hard refresh?</p>';
            return;
        }
        let html;
        try {
            html = marked.parse(markdown);
        } catch (err) {
            previewBody.innerHTML = '<p>could not parse markdown.</p>';
            return;
        }
        previewBody.innerHTML = processCodeBlocks(DOMPurify.sanitize(html, { FORBID_ATTR: ['style'] }));
        wrapTables(previewBody);
        if (window.Prism) {
            previewBody.querySelectorAll('pre code[class*="language-"]').forEach((block) => {
                if (block.classList.contains('language-mermaid')) return;
                Prism.highlightElement(block);
            });
        }
        buildCallouts(previewBody);
        buildToc();
        wireTaskLists();
        renderMermaidBlocks();
        initCodeCopy();
    }

    function buildCallouts(root) {
        const types = {
            NOTE: ['info', 'Note'],
            TIP: ['success', 'Tip'],
            IMPORTANT: ['info', 'Important'],
            WARNING: ['warning', 'Warning'],
            CAUTION: ['danger', 'Caution'],
        };
        root.querySelectorAll('blockquote').forEach((bq) => {
            const first = bq.firstElementChild;
            if (!first || first.tagName !== 'P') return;
            const textNode = first.firstChild;
            if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;
            const m = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i.exec(textNode.textContent);
            if (!m) return;
            const [semantic, label] = types[m[1].toUpperCase()];
            const rest = textNode.textContent.slice(m[0].length).replace(/^\s+/, '');
            if (rest) {
                textNode.textContent = rest;
            } else {
                textNode.remove();
                if (!first.childNodes.length) first.remove();
            }
            const callout = document.createElement('div');
            callout.className = `callout callout-${semantic}`;
            const glyph = { info: 'i-info', success: 'i-success', warning: 'i-warning', danger: 'i-error' }[semantic] || 'i-info';
            const icon = document.createElement('span');
            icon.className = 'callout-icon';
            icon.innerHTML = `<svg aria-hidden="true"><use href="#${glyph}"/></svg>`;
            const panel = document.createElement('div');
            const title = document.createElement('div');
            title.className = 'callout-title';
            title.textContent = label;
            const body = document.createElement('div');
            body.className = 'callout-body';
            while (bq.firstChild) body.appendChild(bq.firstChild);
            panel.appendChild(title);
            panel.appendChild(body);
            callout.appendChild(icon);
            callout.appendChild(panel);
            bq.replaceWith(callout);
        });
    }

    function slugifyHeading(text) {
        return text.toLowerCase().trim()
            .replace(/[^\p{L}\p{N}\s-]/gu, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function addHeadingAnchor(heading) {
        if (heading.querySelector('.heading-anchor')) return;
        const btn = document.createElement('button');
        btn.className = 'btn btn-icon btn-sm heading-anchor';
        btn.type = 'button';
        btn.setAttribute('aria-label', 'copy link to this heading');
        btn.innerHTML = '<svg aria-hidden="true"><use href="#i-copy"/></svg>';
        btn.addEventListener('click', () => {
            const anchor = location.href.split('#')[0] + '#' + heading.id;
            copyText(anchor).then(() => {
                showToast('success', 'link copied', '#' + heading.id);
            }, () => {
                showToast('danger', 'copy failed', 'clipboard access was denied');
            });
        });
        heading.appendChild(btn);
    }

    /* the drawer's own row-close wiring runs once at ui.js init, before the
       first buildToc: the rows are rebuilt per keystroke, so the page closes
       the drawer itself on a row tap */
    function closeDrawer() {
        if (window.innerWidth > 768) return;
        sidebarEl.classList.remove('open');
        document.getElementById('sidebar-overlay')?.classList.remove('open');
        document.getElementById('hamburger-btn')?.setAttribute('aria-expanded', 'false');
    }

    function buildToc() {
        const headings = Array.from(previewBody.querySelectorAll('h1, h2, h3'))
            .filter((h) => !h.closest('section.footnotes'));
        const items = [];

        if (headings.length === 0) {
            tocContent.innerHTML = '<p class="toc-empty">start typing to see headings...</p>';
            return;
        }

        const usedIds = new Set();
        headings.forEach((heading) => {
            if (!heading.id) {
                const base = slugifyHeading(heading.textContent) || 'section';
                let id = base;
                let n = 1;
                while (usedIds.has(id)) id = `${base}-${n++}`;
                heading.id = id;
            }
            usedIds.add(heading.id);
            const level = parseInt(heading.tagName.charAt(1), 10);
            const text = heading.textContent.trim();
            addHeadingAnchor(heading);
            const btn = document.createElement('button');
            btn.className = `nav-item toc-level-${level}`;
            btn.type = 'button';
            const span = document.createElement('span');
            span.textContent = text;
            btn.appendChild(span);
            btn.addEventListener('click', () => {
                closeDrawer();
                const hRect = heading.getBoundingClientRect();
                const pRect = preview.getBoundingClientRect();
                const scrollTarget = hRect.top - pRect.top + preview.scrollTop - 48;
                preview.scrollTo({ top: scrollTarget, behavior: 'smooth' });
            });
            items.push({ el: heading, link: btn, level });
        });

        tocContent.innerHTML = '';
        items.forEach((it) => tocContent.appendChild(it.link));

        tocItems = items;
        // rows are rebuilt per keystroke, so each build wires the new rows' dots
        initSidebar();
        updateTocActive();
    }

    function updateTocActive() {
        let active = null;
        const previewRect = preview.getBoundingClientRect();
        tocItems.forEach((it) => {
            const rect = it.el.getBoundingClientRect();
            if (rect.top <= previewRect.top + 120 && rect.bottom >= previewRect.top) {
                if (!active || rect.top <= active.el.getBoundingClientRect().top) active = it;
            }
        });
        const current = tocContent.querySelector('.nav-item.active');
        if (current) {
            current.classList.remove('active');
            current.removeAttribute('aria-current');
        }
        if (active) {
            active.link.classList.add('active');
            active.link.setAttribute('aria-current', 'true');
        }
    }

    let tocItems = [];
    let tocScrollQueued = false;
    preview.addEventListener('scroll', () => {
        if (!tocScrollQueued) {
            tocScrollQueued = true;
            requestAnimationFrame(() => {
                tocScrollQueued = false;
                if (tocItems.length) updateTocActive();
            });
        }
    }, { passive: true });

    /* ---------- code blocks ---------- */
    preview.addEventListener('click', (e) => {
        const header = e.target.closest('.code-head');
        if (header) toggleCodeBlock(header);
    });

    preview.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const header = e.target.closest('.code-head');
        if (!header) return;
        e.preventDefault();
        toggleCodeBlock(header);
    });

    function toggleCodeBlock(header) {
        const block = header.closest('.code-block');
        const content = block.querySelector('.code-content');
        const arrow = header.querySelector('.collapse-arrow');
        const raw = content.dataset.raw || '';
        const collapsed = content.classList.toggle('collapsed');
        if (collapsed) {
            collapsedBlocks.add(raw);
        } else {
            collapsedBlocks.delete(raw);
        }
        arrow.classList.toggle('collapsed', collapsed);
        header.setAttribute('aria-expanded', String(!collapsed));
        const language = header.querySelector('.language-label')?.textContent || '';
        header.setAttribute('aria-label', `${collapsed ? 'expand' : 'collapse'} code block (${language})`);
        content.style.maxHeight = collapsed ? '0px' : content.scrollHeight + 'px';
    }

    /* ---------- sidebar collapse (desktop) ---------- */
    /* ui.js's controller owns the .rail class on click; it ran first (this
       module imports it), so this listener observes the new state, persists
       it and re-labels the button in the page's own voice */
    const sidebarToggle = $('#sidebarToggle');
    if (sidebarToggle) {
        const syncSidebarToggle = () => {
            const folded = sidebarEl.classList.contains('rail');
            sidebarToggle.setAttribute('aria-expanded', String(!folded));
            sidebarToggle.setAttribute('aria-label', folded ? 'show contents' : 'hide contents');
        };
        sidebarEl.classList.toggle('rail', storage.get('meowmd_sidebar') === 'collapsed');
        syncSidebarToggle();
        sidebarToggle.addEventListener('click', () => {
            storage.set('meowmd_sidebar', sidebarEl.classList.contains('rail') ? 'collapsed' : 'open');
            syncSidebarToggle();
        });
    }

    /* ---------- view modes ---------- */
    const MODES = ['split', 'markdown', 'preview'];
    let currentMode = 'split';
    let savedEditorTop = 0;
    let savedPreviewTop = 0;
    function applyMode(mode) {
        if (!MODES.includes(mode)) mode = 'split';
        if (currentMode !== 'preview') savedEditorTop = input.scrollTop;
        if (currentMode !== 'markdown') savedPreviewTop = preview.scrollTop;
        currentMode = mode;
        editorContainer.dataset.mode = mode;
        if (mode !== 'split') {
            inputPane.style.width = '';
        } else {
            const savedSplit = storage.get('meowmd_split');
            if (savedSplit) inputPane.style.width = savedSplit;
        }
        modeBtns.forEach((btn) => {
            const active = btn.dataset.mode === mode;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-pressed', String(active));
        });
        input.scrollTop = savedEditorTop;
        preview.scrollTop = savedPreviewTop;
        syncEditorHighlightScroll();
        storage.set('meowmd_mode', mode);
    }
    modeBtns.forEach((btn) => {
        btn.addEventListener('click', () => applyMode(btn.dataset.mode));
    });

    /* ---------- export ---------- */
    function slugifyTitle(s) {
        return s.toLowerCase().trim()
            .replace(/[^\p{L}\p{N}\s-]/gu, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
    copyMdBtn.addEventListener('click', () => {
        copyText(input.value).then(() => {
            showToast('success', 'copied', 'markdown copied to clipboard');
        }, () => {
            showToast('danger', 'copy failed', 'clipboard access was denied');
        });
    });
    downloadMdBtn.addEventListener('click', () => {
        const name = slugifyTitle(titleInput.value) || 'untitled';
        const blob = new Blob([input.value], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name + '.md';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast('success', 'downloaded', a.download);
    });

    /* ---------- drag-drop .md ---------- */
    const isFileDrag = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
    document.addEventListener('dragover', (e) => {
        if (isFileDrag(e)) e.preventDefault();
    });
    document.addEventListener('drop', (e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        if (!e.target.closest('.editor-shell')) return;
        const file = Array.from(e.dataTransfer.files).find((f) => /\.(md|markdown)$/i.test(f.name));
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            if (input.value.trim() !== '' && !window.confirm('replace the current document with this file?')) return;
            input.value = reader.result;
            titleInput.value = file.name.replace(/\.(md|markdown)$/i, '');
            titleInput.dispatchEvent(new Event('input'));
            input.dispatchEvent(new Event('input'));
        };
        reader.readAsText(file);
    });

    /* ---------- task lists ---------- */
    function taskListLineIndexes(md) {
        const lines = md.split('\n');
        const indexes = [];
        let inFence = false;
        lines.forEach((line, i) => {
            if (/^\s*(```|~~~)/.test(line)) {
                inFence = !inFence;
                return;
            }
            if (!inFence && /^\s*(?:>\s*)*(?:[-*+]|\d+\.)\s+\[[ xX]\]/.test(line)) indexes.push(i);
        });
        return indexes;
    }
    function wireTaskLists() {
        const indexes = taskListLineIndexes(input.value);
        previewBody.querySelectorAll('input[type="checkbox"]').forEach((box, i) => {
            const lineIdx = indexes[i];
            if (lineIdx === undefined) return;
            box.disabled = false;
            box.removeAttribute('disabled');
            box.addEventListener('click', () => {
                const lines = input.value.split('\n');
                lines[lineIdx] = lines[lineIdx].replace(/\[[ xX]\]/, box.checked ? '[x]' : '[ ]');
                input.value = lines.join('\n');
                input.dispatchEvent(new Event('input'));
            });
        });
    }

    /* ---------- scroll sync ---------- */
    let scrollSyncActive = storage.get('meowmd_scrollsync') === 'on';
    let scrollSyncSuppress = null;
    scrollSyncBtn.classList.toggle('active', scrollSyncActive);
    scrollSyncBtn.setAttribute('aria-pressed', String(scrollSyncActive));
    scrollSyncBtn.addEventListener('click', () => {
        scrollSyncActive = !scrollSyncActive;
        scrollSyncBtn.classList.toggle('active', scrollSyncActive);
        scrollSyncBtn.setAttribute('aria-pressed', String(scrollSyncActive));
        storage.set('meowmd_scrollsync', scrollSyncActive ? 'on' : 'off');
    });
    function mirrorScroll(source, target) {
        const srcMax = source.scrollHeight - source.clientHeight;
        const tgtMax = target.scrollHeight - target.clientHeight;
        if (srcMax <= 0 || tgtMax <= 0) return;
        scrollSyncSuppress = target;
        target.scrollTop = (source.scrollTop / srcMax) * tgtMax;
        setTimeout(() => { if (scrollSyncSuppress === target) scrollSyncSuppress = null; }, 80);
    }
    function handleScrollSync(e) {
        if (!scrollSyncActive) return;
        if (e.target === scrollSyncSuppress) return;
        if (e.target === input) mirrorScroll(input, preview);
        else if (e.target === preview) mirrorScroll(preview, input);
    }
    input.addEventListener('scroll', handleScrollSync, { passive: true });
    preview.addEventListener('scroll', handleScrollSync, { passive: true });

    /* ---------- resizer ---------- */
    let resizing = false;
    function persistSplit() {
        storage.set('meowmd_split', inputPane.style.width);
    }
    resizer.addEventListener('pointerdown', (e) => {
        resizing = true;
        resizer.setPointerCapture(e.pointerId);
        document.body.classList.add('resizing');
        e.preventDefault();
    });
    document.addEventListener('pointermove', (e) => {
        if (!resizing) return;
        const rect = editorContainer.getBoundingClientRect();
        let pct = ((e.clientX - rect.left) / rect.width) * 100;
        pct = Math.max(20, Math.min(80, pct));
        inputPane.style.width = pct + '%';
    });
    document.addEventListener('pointerup', () => {
        if (!resizing) return;
        resizing = false;
        document.body.classList.remove('resizing');
        persistSplit();
    });
    resizer.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        let pct = parseFloat(String(inputPane.style.width).replace('%', '')) || 50;
        pct += e.key === 'ArrowRight' ? 2 : -2;
        pct = Math.max(20, Math.min(80, pct));
        inputPane.style.width = pct + '%';
        persistSplit();
    });

    /* ---------- scroll-to-top ---------- */
    scrollToTopBtn.addEventListener('click', () => {
        preview.scrollTo({ top: 0, behavior: 'smooth' });
    });
    preview.addEventListener('scroll', () => {
        scrollToTopBtn.classList.toggle('visible', preview.scrollTop > 400);
    }, { passive: true });

    /* ---------- clipboard ---------- */
    function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        return Promise.reject(new Error('clipboard unavailable'));
    }

    /* ---------- toast ---------- */
    /* showToast and removeToast come from ui.js, the system's own builder */

    /* ---------- footnotes ---------- */
    if (window.marked && window.markedFootnote) {
        marked.use(markedFootnote());
    }

    /* ---------- mermaid ---------- */
    let mermaidLoading = null;
    let mermaidInitializedTheme = null;
    const mermaidCache = new Map();      // theme+source -> sanitized svg
    const mermaidInflight = new Map();   // theme+source -> Promise<sanitized svg>

    /* no prism grammar exists for mermaid; stub it so the editor's markdown
       grammar does not ask the autoloader for prism-mermaid (which 404s) */
    if (window.Prism) Prism.languages.mermaid = {};

    function mermaidTheme() {
        return document.documentElement.dataset.theme === 'light' ? 'default' : 'dark';
    }
    function mermaidKey(source) {
        return mermaidTheme() + '\u0000' + source;
    }

    function loadMermaid() {
        if (window.mermaid) return Promise.resolve(window.mermaid);
        if (mermaidLoading) return mermaidLoading;
        mermaidLoading = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'vendor/mermaid.min.js';
            s.onload = () => resolve(window.mermaid);
            s.onerror = () => {
                mermaidLoading = null;
                reject(new Error('mermaid failed to load'));
            };
            document.head.appendChild(s);
        });
        return mermaidLoading;
    }

    function ensureMermaidInitialized() {
        return loadMermaid().then((m) => {
            const theme = mermaidTheme();
            if (mermaidInitializedTheme !== theme) {
                m.initialize({
                    startOnLoad: false,
                    securityLevel: 'strict',
                    theme,
                    fontFamily: '"Onest", ui-sans-serif, system-ui, sans-serif',
                    themeVariables: { background: 'transparent' },
                });
                mermaidInitializedTheme = theme;
            }
            return m;
        });
    }

    function hashString(s) {
        let h = 0;
        for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
        return (h >>> 0).toString(36);
    }

    /* the copy button lives inside .code-content, so the diagram replaces the
       source block beside it and never the whole container */
    function mountMermaid(content, svg) {
        content.querySelector('.mermaid-diagram')?.remove();
        content.querySelector('pre')?.remove();
        const diagram = document.createElement('div');
        diagram.className = 'mermaid-diagram';
        diagram.innerHTML = svg;
        content.appendChild(diagram);
        content.classList.add('mermaid-rendered');
    }

    async function renderMermaidBlock(block) {
        const content = block.querySelector('.code-content');
        const source = (content && content.dataset.raw) || '';
        if (!source.trim()) return;
        const key = mermaidKey(source);
        if (mermaidCache.has(key)) {
            mountMermaid(content, mermaidCache.get(key));
            return;
        }
        let inflight = mermaidInflight.get(key);
        if (!inflight) {
            inflight = ensureMermaidInitialized()
                .then((m) => m.render('mmd-' + hashString(source), source))
                .then(({ svg }) => DOMPurify.sanitize(svg, {
                    USE_PROFILES: { svg: true, svgFilters: true },
                    FORBID_TAGS: ['script', 'foreignObject'],
                }))
                .then((clean) => {
                    mermaidCache.set(key, clean);
                    mermaidInflight.delete(key);
                    return clean;
                }, (err) => {
                    mermaidInflight.delete(key);
                    throw err;
                });
            mermaidInflight.set(key, inflight);
        }
        try {
            mountMermaid(content, await inflight);
        } catch (err) {
            content.classList.remove('mermaid-rendered');
        }
    }

    function renderMermaidBlocks() {
        let found = false;
        previewBody.querySelectorAll('.code-block').forEach((block) => {
            const label = block.querySelector('.language-label');
            if (!label || label.textContent.trim().toLowerCase() !== 'mermaid') return;
            found = true;
            renderMermaidBlock(block);
        });
        return found;
    }

    function renderMermaidOnThemeChange() {
        if (mermaidInitializedTheme === null && !mermaidCache.size) return;
        mermaidInitializedTheme = null;
        renderMermaidBlocks();
    }

    /* ---------- init ---------- */
    if (window.Prism && Prism.plugins && Prism.plugins.autoloader) {
        Prism.plugins.autoloader.languages_path = 'vendor/prism/components/';
    }
    Object.keys(LANGUAGE_ALIASES).forEach((alias) => aliasLanguage(alias, LANGUAGE_ALIASES[alias]));
    applyMode(storage.get('meowmd_mode') || 'split');
    renderPreview();
    renderEditorHighlight();
    updateWordCount();
})();
