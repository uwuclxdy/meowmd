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

        this.setupEventListeners();
        this.setupResizer();
        this.setupScrollHandler();
        this.setupScrollToTop();
        this.setupDrawer();
        this.updatePreview(); // Initial preview update
    }

    setupEventListeners() {
        this.input.addEventListener('input', () => this.updatePreview());
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

    setupScrollHandler() {
        let ticking = false;
        const logo = document.getElementById('logo');

        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    const scrollTop = document.documentElement.scrollTop;
                    const heroHeight = this.hero.offsetHeight;
                    const navbarHeight = this.navbar.offsetHeight;
                    const uiChangeThreshold = heroHeight * 0.05;

                    // Logo/navbar visibility
                    if (scrollTop > uiChangeThreshold) {
                        logo.classList.add('navbar-mode');
                        this.navbar.style.opacity = '1';
                    } else {
                        logo.classList.remove('navbar-mode');
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
