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
    const toggleEditorBtn = $('#toggleEditorBtn');
    const toggleWidthBtn = $('#toggleWidthBtn');
    const tocContent = $('#tocContent');
    const tocGroup = $('#tocGroup');
    const navIndicator = $('#navIndicator');
    const hamburgerBtn = $('#hamburgerBtn');
    const overlay = $('#overlay');
    const tocSidebar = $('#tocSidebar');
    const scrollToTopBtn = $('#scrollToTop');
    const titleInput = $('#titleInput');
    const toastStack = $('#toastStack');

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
        const navType = performance.getEntriesByType('navigation')[0]?.type;
        if (navType === 'navigate') {
            const id = 'tab_' + Math.random().toString(36).slice(2, 11) + '_' + Date.now();
            session.set('meowmd_tab_id', id);
            return id;
        }
        let id = session.get('meowmd_tab_id');
        if (!id) {
            id = 'tab_' + Math.random().toString(36).slice(2, 11) + '_' + Date.now();
            session.set('meowmd_tab_id', id);
        }
        return id;
    }
    const tabId = getTabId();

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
    });

    let autosaveTimer = null;
    input.addEventListener('input', () => {
        renderPreview();
        clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(() => {
            storage.set(`meowmd_content_${tabId}`, input.value);
        }, 800);
    });

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            storage.set(`meowmd_content_${tabId}`, input.value);
            showToast('success', 'saved', 'autosaved to this browser');
        }
    });

    /* ---------- rendering ---------- */
    const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));

    function processCodeBlocks(html) {
        return html.replace(/<pre><code(?: class="language-(\w+)")?>([\s\S]*?)<\/code><\/pre>/g,
            (match, lang, codeHtml) => {
                const language = lang || 'text';
                const raw = escapeHtml(decodeHtml(codeHtml));
                return `<div class="code-block">
                    <div class="code-header" role="button" tabindex="0" aria-expanded="true"
                        aria-label="collapse code block (${language})">
                        <div class="code-header-left">
                            <span class="collapse-arrow"></span>
                            <span class="language-label">${language}</span>
                        </div>
                        <button class="copy-button" type="button" title="copy code" aria-label="copy code">
                            <svg class="copy-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                                stroke-width="1.5"><rect x="5.5" y="5.5" width="9" height="9"/><path d="M10.5 5.5v-3h-9v9h3"/></svg>
                        </button>
                    </div>
                    <div class="code-content" data-raw="${raw}">
                        <pre><code class="language-${language}">${codeHtml}</code></pre>
                    </div>
                </div>`;
            });
    }

    function decodeHtml(s) {
        const ta = document.createElement('textarea');
        ta.innerHTML = s;
        return ta.value;
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
        preview.innerHTML = processCodeBlocks(DOMPurify.sanitize(html));
        if (window.Prism) {
            preview.querySelectorAll('pre code[class*="language-"]').forEach((block) => {
                Prism.highlightElement(block);
            });
        }
        buildToc();
    }

    function buildToc() {
        const headings = Array.from(preview.querySelectorAll('h1, h2, h3'));
        const items = [];

        if (headings.length === 0) {
            tocContent.innerHTML = '<p class="toc-empty">start typing to see headings...</p>';
            navIndicator.style.opacity = '0';
            return;
        }

        headings.forEach((heading, index) => {
            heading.id = `heading-${index}`;
            const level = parseInt(heading.tagName.charAt(1), 10);
            const text = heading.textContent.trim();
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
            navigator.clipboard.writeText(raw).then(() => {
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
        const collapsed = content.classList.toggle('collapsed');
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

    /* ---------- editor toggle ---------- */
    toggleEditorBtn.addEventListener('click', () => {
        const isHidden = inputPane.classList.toggle('hidden');
        previewPane.classList.toggle('full-width', isHidden);
        resizer.classList.toggle('hidden', isHidden);
        if (isHidden) {
            toggleWidthBtn.classList.remove('hidden');
            toggleEditorBtn.title = 'show editor';
            toggleEditorBtn.setAttribute('aria-label', 'show editor');
        } else {
            toggleWidthBtn.classList.add('hidden');
            previewPane.classList.remove('narrow-width');
            toggleEditorBtn.title = 'hide editor';
            toggleEditorBtn.setAttribute('aria-label', 'hide editor');
        }
    });

    toggleWidthBtn.addEventListener('click', () => {
        const narrow = previewPane.classList.toggle('narrow-width');
        toggleWidthBtn.title = narrow ? 'expand preview' : 'narrow preview';
    });

    /* ---------- resizer ---------- */
    let resizing = false;
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
    });
    resizer.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const rect = editorContainer.getBoundingClientRect();
        let pct = parseFloat(inputPane.style.width) || 50;
        pct += e.key === 'ArrowRight' ? 2 : -2;
        pct = Math.max(20, Math.min(80, pct));
        inputPane.style.width = pct + '%';
    });

    /* ---------- scroll-to-top ---------- */
    scrollToTopBtn.addEventListener('click', () => {
        preview.scrollTo({ top: 0, behavior: 'smooth' });
    });
    preview.addEventListener('scroll', () => {
        scrollToTopBtn.classList.toggle('visible', preview.scrollTop > 400);
    }, { passive: true });

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
                <div class="toast-title">${title}</div>
                <div class="toast-msg">${msg}</div>
            </div>
            <button class="toast-close" type="button" aria-label="dismiss">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4l8 8M12 4l-8 8"/></svg>
            </button>`;
        t.querySelector('.toast-close').addEventListener('click', () => removeToast(t));
        toastStack.appendChild(t);
        setTimeout(() => removeToast(t), 4000);
    }
    function removeToast(t) {
        if (!t || !t.parentNode) return;
        t.classList.add('removing');
        setTimeout(() => t.remove(), 120);
    }

    /* ---------- init ---------- */
    if (window.Prism && Prism.plugins && Prism.plugins.autoloader) {
        Prism.plugins.autoloader.languages_path = 'vendor/prism/components/';
    }
    renderPreview();
})();
