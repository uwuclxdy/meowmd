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

    /* ---------- theme ---------- */
    const themeToggleBtns = document.querySelectorAll('.theme-toggle');
    function setTheme(t) {
        document.documentElement.dataset.theme = t;
        storage.set('meowmd_theme', t);
    }
    setTheme(storage.get('meowmd_theme') === 'light' ? 'light' : 'dark');
    themeToggleBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
            setTheme(next);
        });
    });

    /* ---------- app ---------- */
    const input = $('#markdownInput');
    const preview = $('#previewContent');
    const resizer = $('#resizer');
    const inputPane = $('#inputPane');
    const previewPane = $('#previewPane');
    const editorContainer = $('#editorContainer');
    const modeBtns = Array.from(document.querySelectorAll('.mode-switch .tab-box'));
    const toggleWidthBtn = $('#toggleWidthBtn');
    const scrollSyncBtn = $('#scrollSyncBtn');
    const copyMdBtn = $('#copyMdBtn');
    const downloadMdBtn = $('#downloadMdBtn');
    const tocContent = $('#tocContent');
    const tocGroup = $('#tocGroup');
    const navIndicator = $('#navIndicator');
    const hamburgerBtn = $('#hamburgerBtn');
    const overlay = $('#overlay');
    const tocSidebar = $('#tocSidebar');
    const scrollToTopBtn = $('#scrollToTop');
    const titleInput = $('#titleInput');
    const toastStack = $('#toastStack');
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
                    <div class="code-header" role="button" tabindex="0" aria-expanded="${!collapsed}"
                        aria-label="${collapsed ? 'expand' : 'collapse'} code block (${language})">
                        <div class="code-header-left">
                            <span class="collapse-arrow${collapsed ? ' collapsed' : ''}"></span>
                            <span class="language-label">${language}</span>
                        </div>
                        <button class="copy-button" type="button" title="copy code" aria-label="copy code">
                            <svg class="copy-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                                stroke-width="1.5"><rect x="5.5" y="5.5" width="9" height="9"/><path d="M10.5 5.5v-3h-9v9h3"/></svg>
                        </button>
                    </div>
                    <div class="code-content${collapsed ? ' collapsed' : ''}" data-raw="${text}"${collapsed ? ' style="max-height:0px"' : ''}>
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

    function renderPreview() {
        const markdown = input.value;
        if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
            preview.innerHTML = '<p>editor libraries failed to load. hard refresh?</p>';
            return;
        }
        let html;
        try {
            html = marked.parse(markdown);
        } catch (err) {
            preview.innerHTML = '<p>could not parse markdown.</p>';
            return;
        }
        preview.innerHTML = processCodeBlocks(DOMPurify.sanitize(html, { FORBID_ATTR: ['style'] }));
        if (window.Prism) {
            preview.querySelectorAll('pre code[class*="language-"]').forEach((block) => {
                if (block.classList.contains('language-mermaid')) return;
                Prism.highlightElement(block);
            });
        }
        buildCallouts(preview);
        buildToc();
        wireTaskLists();
        renderMermaidBlocks();
    }

    function buildCallouts(preview) {
        const types = {
            NOTE: ['info', 'Note'],
            TIP: ['success', 'Tip'],
            IMPORTANT: ['info', 'Important'],
            WARNING: ['warning', 'Warning'],
            CAUTION: ['danger', 'Caution'],
        };
        preview.querySelectorAll('blockquote').forEach((bq) => {
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
            const title = document.createElement('div');
            title.className = 'callout-title';
            title.textContent = label;
            const body = document.createElement('div');
            body.className = 'callout-body';
            while (bq.firstChild) body.appendChild(bq.firstChild);
            callout.appendChild(title);
            callout.appendChild(body);
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
        btn.className = 'heading-anchor';
        btn.type = 'button';
        btn.title = 'copy link to this heading';
        btn.setAttribute('aria-label', 'copy link to this heading');
        btn.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6.7 8.7a3.3 3.3 0 0 0 5 .4l2-2a3.3 3.3 0 0 0-4.7-4.7L7.9 3.5"/><path d="M9.3 7.3a3.3 3.3 0 0 0-5-.4l-2 2a3.3 3.3 0 0 0 4.7 4.7l1.1-1.1"/></svg>';
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

    function buildToc() {
        const headings = Array.from(preview.querySelectorAll('h1, h2, h3'))
            .filter((h) => !h.closest('section.footnotes'));
        const items = [];

        if (headings.length === 0) {
            tocContent.innerHTML = '<p class="toc-empty">start typing to see headings...</p>';
            navIndicator.style.opacity = '0';
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
            const li = document.createElement('li');
            li.className = 'toc-item';
            const btn = document.createElement('button');
            btn.className = `toc-link toc-level-${level}`;
            btn.type = 'button';
            btn.textContent = text;
            btn.title = text;
            btn.addEventListener('click', () => {
                const hRect = heading.getBoundingClientRect();
                const pRect = preview.getBoundingClientRect();
                const scrollTarget = hRect.top - pRect.top + preview.scrollTop - 48;
                preview.scrollTo({ top: scrollTarget, behavior: 'smooth' });
            });
            li.appendChild(btn);
            items.push({ el: heading, link: btn, level });
        });

        tocContent.innerHTML = '';
        const ul = document.createElement('ul');
        ul.className = 'toc-list';
        items.forEach((it) => ul.appendChild(it.link.parentElement));
        tocContent.appendChild(ul);

        tocItems = items;
        positionNavIndicator();
    }

    function positionNavIndicator() {
        let active = null;
        const previewRect = preview.getBoundingClientRect();
        tocItems.forEach((it) => {
            const rect = it.el.getBoundingClientRect();
            if (rect.top <= previewRect.top + 120 && rect.bottom >= previewRect.top) {
                if (!active || rect.top <= active.el.getBoundingClientRect().top) active = it;
            }
        });
        const current = tocContent.querySelector('.toc-link.active');
        if (current) current.classList.remove('active');
        if (!active) {
            navIndicator.style.opacity = '0';
            return;
        }
        const linkRect = active.link.getBoundingClientRect();
        const groupRect = tocGroup.getBoundingClientRect();
        navIndicator.style.top = (linkRect.top - groupRect.top) + 'px';
        navIndicator.style.height = linkRect.height + 'px';
        navIndicator.style.opacity = '1';
        active.link.classList.add('active');
    }

    let tocItems = [];
    let tocScrollQueued = false;
    preview.addEventListener('scroll', () => {
        if (!tocScrollQueued) {
            tocScrollQueued = true;
            requestAnimationFrame(() => {
                tocScrollQueued = false;
                if (tocItems.length) positionNavIndicator();
            });
        }
    }, { passive: true });

    /* ---------- code blocks ---------- */
    preview.addEventListener('click', (e) => {
        const copyBtn = e.target.closest('.copy-button');
        if (copyBtn) {
            const content = copyBtn.closest('.code-block').querySelector('.code-content');
            const raw = content.dataset.raw || '';
            copyText(raw).then(() => {
                const original = copyBtn.innerHTML;
                copyBtn.innerHTML = '<svg class="copy-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 4L6 11l-3-3"/></svg>';
                copyBtn.classList.add('copied');
                setTimeout(() => {
                    copyBtn.innerHTML = original;
                    copyBtn.classList.remove('copied');
                }, 1800);
            }).catch(() => {
                showToast('danger', 'copy failed', 'clipboard access was denied');
            });
            return;
        }
        const header = e.target.closest('.code-header');
        if (header) toggleCodeBlock(header);
    });

    preview.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        if (e.target.closest('.copy-button')) return;
        const header = e.target.closest('.code-header');
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
        header.setAttribute('aria-label', `${collapsed ? 'expand' : 'collapse'} code block`);
        content.style.maxHeight = collapsed ? '0px' : content.scrollHeight + 'px';
    }

    /* ---------- TOC drawer (mobile) ---------- */
    function openDrawer() {
        tocSidebar.classList.add('open');
        overlay.classList.add('open');
        hamburgerBtn.setAttribute('aria-expanded', 'true');
    }
    function closeDrawer() {
        tocSidebar.classList.remove('open');
        overlay.classList.remove('open');
        hamburgerBtn.setAttribute('aria-expanded', 'false');
    }
    hamburgerBtn.addEventListener('click', () => {
        tocSidebar.classList.contains('open') ? closeDrawer() : openDrawer();
    });
    overlay.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && tocSidebar.classList.contains('open')) closeDrawer();
    });
    tocContent.addEventListener('click', (e) => {
        if (e.target.closest('.toc-link') && window.innerWidth <= 768) closeDrawer();
    });

    /* ---------- sidebar collapse (desktop) ---------- */
    const layoutEl = document.querySelector('.layout');
    const sidebarToggle = $('#sidebarToggle');
    if (sidebarToggle) {
        const setSidebarCollapsed = (collapsed) => {
            layoutEl.classList.toggle('sidebar-collapsed', collapsed);
            sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
            sidebarToggle.title = collapsed ? 'show table of contents' : 'hide table of contents';
            sidebarToggle.setAttribute('aria-label', collapsed ? 'show table of contents' : 'hide table of contents');
        };
        setSidebarCollapsed(storage.get('meowmd_sidebar') === 'collapsed');
        sidebarToggle.addEventListener('click', () => {
            const collapsed = layoutEl.classList.toggle('sidebar-collapsed');
            storage.set('meowmd_sidebar', collapsed ? 'collapsed' : 'open');
            setSidebarCollapsed(collapsed);
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
        const previewMode = mode === 'preview';
        toggleWidthBtn.classList.toggle('hidden', !previewMode);
        if (mode === 'split') previewPane.classList.remove('narrow-width');
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

    toggleWidthBtn.addEventListener('click', () => {
        const narrow = previewPane.classList.toggle('narrow-width');
        toggleWidthBtn.title = narrow ? 'expand preview' : 'narrow preview';
        toggleWidthBtn.setAttribute('aria-label', narrow ? 'expand preview' : 'narrow preview');
        toggleWidthBtn.setAttribute('aria-pressed', String(narrow));
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
        preview.querySelectorAll('input[type="checkbox"]').forEach((box, i) => {
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
    const toastIcons = {
        success: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><path d="M5 8l2 2 4-4"/></svg>',
        danger: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><path d="M10 6L6 10M6 6l4 4"/></svg>',
    };
    function showToast(type, title, msg) {
        const t = document.createElement('div');
        t.className = `toast toast-${type}`;
        t.innerHTML = `
            <div class="toast-icon" style="color:var(--${type === 'danger' ? 'danger' : 'success'})">${toastIcons[type]}</div>
            <div class="toast-body">
                <div class="toast-title"></div>
                <div class="toast-msg"></div>
            </div>
            <button class="toast-close" type="button" aria-label="dismiss">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4l8 8M12 4l-8 8"/></svg>
            </button>`;
        t.querySelector('.toast-title').textContent = title;
        t.querySelector('.toast-msg').textContent = msg;
        t.querySelector('.toast-close').addEventListener('click', () => removeToast(t));
        toastStack.appendChild(t);
        setTimeout(() => removeToast(t), 4000);
    }
    function removeToast(t) {
        if (!t || !t.parentNode) return;
        t.classList.add('removing');
        setTimeout(() => t.remove(), 120);
    }

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

    async function renderMermaidBlock(block) {
        const content = block.querySelector('.code-content');
        const source = (content && content.dataset.raw) || '';
        if (!source.trim()) return;
        const key = mermaidKey(source);
        if (mermaidCache.has(key)) {
            content.innerHTML = mermaidCache.get(key);
            content.classList.add('mermaid-rendered');
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
            const clean = await inflight;
            content.innerHTML = clean;
            content.classList.add('mermaid-rendered');
        } catch (err) {
            content.classList.remove('mermaid-rendered');
        }
    }

    function renderMermaidBlocks() {
        let found = false;
        preview.querySelectorAll('.code-block').forEach((block) => {
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
