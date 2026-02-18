class UwuMarkdown {
    constructor() {
        this.input = document.getElementById('markdownInput');
        this.preview = document.getElementById('previewContent');
        this.resizer = document.getElementById('resizer');
        this.inputPane = document.getElementById('inputPane');
        this.previewPane = document.getElementById('previewPane');
        this.tocDrawer = document.getElementById('tocDrawer');
        this.tocContent = document.getElementById('tocContent');
        this.hamburgerBtn = document.getElementById('hamburgerBtn');
        this.tocCloseBtn = document.getElementById('tocCloseBtn');
        this.overlay = document.getElementById('overlay');
        this.container = document.querySelector('.container');
        this.scrollToTopBtn = document.getElementById('scrollToTop');
        this.hero = document.getElementById('hero');
        this.navbar = document.getElementById('navbar');
        this.logoWrapper = document.getElementById('logoWrapper');
        this.toggleEditorBtn = document.getElementById('toggleEditorBtn');
        this.tabId = this.getOrCreateTabId();
        this.autoSaveInterval = null;
        this.titleInput = document.getElementById('titleInput');

        this.setupEventListeners();
        this.setupTitleInput();
        this.setupResizer();
        this.setupScrollHandler();
        this.setupScrollToTop();
        this.setupDrawer();
        this.setupAutoSave();
        this.restoreFromCookie();
        this.updatePreview();
        this.setupToggleEditor();

        // Remove loading state to reveal content
        this.container.dataset.loading = 'false';
        this.logoWrapper.dataset.loading = 'false';
    }

    getOrCreateTabId() {
        // Use performance API to detect navigation type
        const navType = performance.getEntriesByType('navigation')[0]?.type;

        // If this is a new navigation (not a reload or bfcache), generate fresh tabId
        // This handles: typing URL in new tab, clicking links, etc.
        if (navType === 'navigate') {
            const tabId = 'tab_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
            sessionStorage.setItem('meowmd_tab_id', tabId);
            return tabId;
        }

        // For reload (type 'reload') or bfcache restore (type 'back_forward'), keep existing tabId
        // This ensures content persists on refresh
        let tabId = sessionStorage.getItem('meowmd_tab_id');
        if (!tabId) {
            tabId = 'tab_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
            sessionStorage.setItem('meowmd_tab_id', tabId);
        }
        return tabId;
    }

    // localStorage helpers (better than cookies - larger storage limit)
    setStorage(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.warn('localStorage save failed:', e);
        }
    }

    getStorage(key) {
        return localStorage.getItem(key);
    }

    removeStorage(key) {
        localStorage.removeItem(key);
    }

    setupAutoSave() {
        // Clear existing interval to avoid duplicates
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        this.autoSaveInterval = setInterval(() => {
            const content = this.input.value;
            if (content) {
                this.setStorage(`meowmd_content_${this.tabId}`, content);
            }
        }, 1000);
    }

    restoreFromCookie() {
        const savedContent = this.getStorage(`meowmd_content_${this.tabId}`);
        if (savedContent !== null) {
            this.input.value = savedContent;
        }
    }

    setupTitleInput() {
        // Load saved title
        const savedTitle = this.getStorage(`meowmd_title_${this.tabId}`);
        if (savedTitle) {
            document.title = savedTitle;
            this.titleInput.value = savedTitle.replace(' - meowmd', '');
        }

        // Update title on input
        this.titleInput.addEventListener('input', () => {
            const customTitle = this.titleInput.value.trim();
            if (customTitle) {
                document.title = `${customTitle} - meowmd`;
                this.setStorage(`meowmd_title_${this.tabId}`, document.title);
            } else {
                document.title = 'meowmd - simple markdown editor';
                this.removeStorage(`meowmd_title_${this.tabId}`);
            }
        });
    }

    setupEventListeners() {
        this.input.addEventListener('input', () => this.updatePreview());

        // Ctrl+S to manually save
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                const content = this.input.value;
                if (content) {
                    this.setStorage(`meowmd_content_${this.tabId}`, content);
                    // Brief visual feedback
                    this.input.style.outline = '2px solid var(--primary)';
                    setTimeout(() => {
                        this.input.style.outline = '';
                    }, 300);
                }
            }
        });
    }

    setupScrollToTop() {
        this.scrollToTopBtn.addEventListener('click', () => {
            const heroHeight = this.hero.offsetHeight;
            const navbarHeight = this.navbar.offsetHeight;
            const scrollTarget = Math.max(0, heroHeight - navbarHeight);

            window.scrollTo({
                top: scrollTarget,
                behavior: 'smooth'
            });
        });
    }

    setupDrawer() {
        // Open drawer
        this.hamburgerBtn.addEventListener('click', () => {
            this.tocDrawer.classList.add('open');
            this.overlay.classList.add('active');
        });

        // Close drawer
        this.tocCloseBtn.addEventListener('click', () => {
            this.tocDrawer.classList.remove('open');
            this.overlay.classList.remove('active');
        });

        // Close drawer when clicking overlay
        this.overlay.addEventListener('click', () => {
            this.tocDrawer.classList.remove('open');
            this.overlay.classList.remove('active');
        });

        // Close drawer on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.tocDrawer.classList.remove('open');
                this.overlay.classList.remove('active');
            }
        });
    }

    setupToggleEditor() {
        this.toggleEditorBtn.addEventListener('click', () => {
            this.inputPane.classList.toggle('hidden');
            this.previewPane.classList.toggle('full-width');
            this.resizer.classList.toggle('hidden');

            // Update button icon
            const icon = this.toggleEditorBtn.querySelector('.toggle-editor-icon');
            if (this.inputPane.classList.contains('hidden')) {
                icon.innerHTML = '<path d="M21.7071 3.70711L16.4142 9H20C20.5523 9 21 9.44772 21 10C21 10.5523 20.5523 11 20 11H14.0007L13.997 11C13.743 10.9992 13.4892 10.9023 13.295 10.7092L13.2908 10.705C13.196 10.6096 13.1243 10.4999 13.0759 10.3828C13.0273 10.2657 13.0004 10.1375 13 10.003L13 10V4C13 3.44772 13.4477 3 14 3C14.5523 3 15 3.44772 15 4V7.58579L20.2929 2.29289C20.6834 1.90237 21.3166 1.90237 21.7071 2.29289C22.0976 2.68342 22.0976 3.31658 21.7071 3.70711Z" /><path d="M9 20C9 20.5523 9.44772 21 10 21C10.5523 21 11 20.5523 11 20V14.0007C11 13.9997 11 13.998 11 13.997C10.9992 13.7231 10.8883 13.4752 10.7092 13.295C10.7078 13.2936 10.7064 13.2922 10.705 13.2908C10.6096 13.196 10.4999 13.1243 10.3828 13.0759C10.2657 13.0273 10.1375 13.0004 10.003 13C10.002 13 10.001 13 10 13H4C3.44772 13 3 13.4477 3 14C3 14.5523 3.44772 15 4 15H7.58579L2.29289 20.2929C1.90237 20.6834 1.90237 21.3166 2.29289 21.7071C2.68342 22.0976 3.31658 22.0976 3.70711 21.7071L9 16.4142V20Z" />';
                this.toggleEditorBtn.title = 'show editor';
            } else {
                icon.innerHTML = '<path d="M21.7092 2.29502C21.8041 2.3904 21.8757 2.50014 21.9241 2.61722C21.9727 2.73425 21.9996 2.8625 22 2.997L22 3V9C22 9.55228 21.5523 10 21 10C20.4477 10 20 9.55228 20 9V5.41421L14.7071 10.7071C14.3166 11.0976 13.6834 11.0976 13.2929 10.7071C12.9024 10.3166 12.9024 9.68342 13.2929 9.29289L18.5858 4H15C14.4477 4 14 3.55228 14 3C14 2.44772 14.4477 2 15 2H20.9998C21.2749 2 21.5242 2.11106 21.705 2.29078L21.7092 2.29502Z" /><path d="M10.7071 14.7071L5.41421 20H9C9.55228 20 10 20.4477 10 21C10 21.5523 9.55228 22 9 22H3.00069L2.997 22C2.74301 21.9992 2.48924 21.9023 2.29502 21.7092L2.29078 21.705C2.19595 21.6096 2.12432 21.4999 2.07588 21.3828C2.02699 21.2649 2 21.1356 2 21V15C2 14.4477 2.44772 14 3 14C3.55228 14 4 14.4477 4 15V18.5858L9.29289 13.2929C9.68342 12.9024 10.3166 12.9024 10.7071 13.2929C11.0976 13.6834 11.0976 14.3166 10.7071 14.7071Z" />';
                this.toggleEditorBtn.title = 'hide editor';
            }
        });
    }

    setupScrollHandler() {
        let ticking = false;
        const logo = document.getElementById('logo');

        // Initialize logo state based on current scroll position
        const initLogoState = () => {
            const scrollTop = document.documentElement.scrollTop;
            if (scrollTop === 0) {
                logo.classList.remove('navbar-mode');
                this.titleInput.style.display = 'block';
                this.navbar.style.opacity = '0';
            } else {
                logo.classList.add('navbar-mode');
                this.titleInput.style.display = 'none';
                this.navbar.style.opacity = '1';
            }
        };

        // Run on page load to fix refresh with scroll position bug
        initLogoState();

        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    const scrollTop = document.documentElement.scrollTop;
                    const heroHeight = this.hero.offsetHeight;
                    const navbarHeight = this.navbar.offsetHeight;
                    const uiChangeThreshold = heroHeight * 0.05;

                    // Logo/navbar visibility - only show logo in hero mode when completely at top
                    if (scrollTop > 0) {
                        logo.classList.add('navbar-mode');
                        this.titleInput.style.display = 'none';
                        this.navbar.style.opacity = '1';
                    } else {
                        logo.classList.remove('navbar-mode');
                        this.titleInput.style.display = 'block';
                        this.navbar.style.opacity = '0';
                    }

                    // Scroll to top button visibility
                    if (scrollTop > heroHeight * 0.5) {
                        this.scrollToTopBtn.classList.add('visible');
                    } else {
                        this.scrollToTopBtn.classList.remove('visible');
                    }

                    // Update active TOC link
                    this.updateActiveTocLink();

                    ticking = false;
                });
                ticking = true;
            }
        });
    }

    updateActiveTocLink() {
        const headings = this.preview.querySelectorAll('h1, h2, h3');
        const tocLinks = this.tocContent.querySelectorAll('.toc-link');
        const scrollTop = window.scrollY;

        headings.forEach((heading, index) => {
            const rect = heading.getBoundingClientRect();
            const headingTop = rect.top + scrollTop;

            if (scrollTop >= headingTop - 100) {
                tocLinks.forEach(link => link.classList.remove('active'));
                if (tocLinks[index]) {
                    tocLinks[index].classList.add('active');
                }
            }
        });
    }

    setupResizer() {
        let isResizing = false;

        this.resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const containerRect = this.container.getBoundingClientRect();
            let newWidthPercent = ((e.clientX - containerRect.left) / containerRect.width) * 100;

            newWidthPercent = Math.max(20, Math.min(80, newWidthPercent));
            this.inputPane.style.width = `${newWidthPercent}%`;
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
            }
        });
    }

    updatePreview() {
        const markdown = this.input.value;
        if (!markdown.trim()) {
            // Render the default welcome message
            const defaultMarkdown = `# markdown goes here~

## some stuff you can do
- **bold** and *italic* text
- [links](https://example.com)
- \`code snippets\` and blocks
- > quotes look nice too
- tables, lists, whatever

\`\`\`js
// syntax highlighting works
const editor = 'pretty neat';
console.log(editor);
\`\`\`

just start typing :3`;

            const html = marked.parse(defaultMarkdown);
            this.preview.innerHTML = this.processCodeBlocks(html);
            this.generateTOC();
            this.highlightCode();
            this.tocContent.innerHTML = '<p class="toc-empty">start typing to see headings...</p>';
            return;
        }

        if (typeof marked === 'undefined') {
            this.preview.innerHTML = "<p>Error: 'marked' library not loaded.</p>";
            return;
        }

        const html = marked.parse(markdown);
        this.preview.innerHTML = this.processCodeBlocks(html);
        this.generateTOC();
        this.highlightCode();
    }

    generateTOC() {
        const headings = this.preview.querySelectorAll('h1, h2, h3');

        if (headings.length === 0) {
            this.tocContent.innerHTML = '<p class="toc-empty">no headings found</p>';
            return;
        }

        // Add IDs to headings
        headings.forEach((heading, index) => {
            const id = `heading-${index}`;
            heading.id = id;
        });

        // Generate TOC HTML
        let tocHtml = '<ul class="toc-list">';
        headings.forEach((heading, index) => {
            const level = parseInt(heading.tagName.charAt(1));
            const text = heading.textContent.trim();
            const id = `heading-${index}`;

            let levelClass = 'toc-level-1';
            if (level === 2) levelClass = 'toc-level-2';
            else if (level === 3) levelClass = 'toc-level-3';

            tocHtml += `
                <li class="toc-item">
                    <a class="toc-link ${levelClass}" data-target="${id}">
                        ${text}
                    </a>
                </li>
            `;
        });
        tocHtml += '</ul>';

        this.tocContent.innerHTML = tocHtml;

        // Add click handlers
        this.tocContent.querySelectorAll('.toc-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.dataset.target;
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    const offset = this.navbar.offsetHeight + 20;
                    const elementPosition = targetElement.getBoundingClientRect().top + window.scrollY;
                    window.scrollTo({
                        top: elementPosition - offset,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }

    processCodeBlocks(html) {
        return html.replace(
            /<pre><code(?: class="language-(\w+)")?>([\s\S]*?)<\/code><\/pre>/g,
            (match, language, codeContent) => {
                const lang = language || 'text';
                const attributeSafeCodeContent = codeContent.replace(/"/g, '"');
                return this.createCodeBlock(lang, codeContent, attributeSafeCodeContent); // Pass both for clarity
            }
        );
    }

    createCodeBlock(language, displayCodeContent, attributeRawCode) { // attributeRawCode is for data-raw-code
        const blockId = 'code-' + Math.random().toString(36).substring(2, 9);

        return `
        <div class="code-block">
            <div class="code-header" onclick="app.toggleCollapse('${blockId}')">
                <div class="code-header-left">
                    <div class="collapse-arrow" id="arrow-${blockId}"></div>
                    <span class="language-label">${language}</span>
                </div>
                <button class="copy-button" onclick="app.copyCode(this, event)" data-code-block-id="${blockId}" title="Copy code">
                    <svg class="copy-icon" viewBox="0 0 16 16">
                        <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path>
                        <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path>
                    </svg>
                </button>
            </div>
            <div class="code-content" id="content-${blockId}" data-raw-code="${attributeRawCode}">
                <pre><code class="language-${language}">${displayCodeContent}</code></pre>
            </div>
        </div>
    `;
    }

    highlightCode() {
        if (window.Prism) {
            document.querySelectorAll('.code-content pre code').forEach((block) => {
                Prism.highlightElement(block);
            });
        }
    }

    toggleCollapse(blockId) {
        const content = document.getElementById(`content-${blockId}`);
        const arrow = document.getElementById(`arrow-${blockId}`);

        if (!content || !arrow) return;

        content.classList.toggle('collapsed');
        arrow.classList.toggle('collapsed');

        if (content.classList.contains('collapsed')) {
            content.style.maxHeight = '0px';
        } else {
            requestAnimationFrame(() => {
                content.style.maxHeight = content.scrollHeight + 'px';
            });
        }
    }

    async copyCode(buttonElement, event) {
        event.stopPropagation();
        const blockId = buttonElement.dataset.codeBlockId;
        const contentElement = document.getElementById(`content-${blockId}`);

        if (!contentElement) {
            console.error('Code content not found for ID:', blockId);
            return;
        }

        const rawCode = contentElement.dataset.rawCode;

        if (rawCode === undefined || rawCode === null) {
            console.error('Raw code data attribute not found or empty for ID:', blockId);
            return;
        }

        // Decode HTML entities for clipboard
        const tempTextArea = document.createElement('textarea');
        tempTextArea.innerHTML = rawCode;
        const decodedCode = tempTextArea.value;

        try {
            await navigator.clipboard.writeText(decodedCode); // Use decoded code
            buttonElement.innerHTML = `
            <svg class="copy-icon" viewBox="0 0 16 16">
                <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 11.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
            </svg>
        `;
            buttonElement.classList.add('copied');

            setTimeout(() => {
                buttonElement.innerHTML = `
                <svg class="copy-icon" viewBox="0 0 16 16">
                    <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path>
                    <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path>
                </svg>
            `;
                buttonElement.classList.remove('copied');
            }, 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
            buttonElement.innerHTML = `
            <svg class="copy-icon" viewBox="0 0 16 16">
                <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path>
            </svg>
        `;
            setTimeout(() => {
                buttonElement.innerHTML = `
                <svg class="copy-icon" viewBox="0 0 16 16">
                    <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path>
                    <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path>
                </svg>
            `;
            }, 2000);
        }
    }
}

// Initialize the app
const app = new UwuMarkdown();

console.log('%c👋 hey there!', 'font-size: 20px; color: #E07B53; font-weight: bold;');
console.log('%cits not a bug, its a feature:', 'font-size: 12px; color: #a6adc8; font-style: italic;');
