class UwuMarkdown {
    constructor() {
        this.input = document.getElementById('markdownInput');
        this.preview = document.getElementById('previewContent');
        this.resizer = document.getElementById('resizer');
        this.inputPane = document.querySelector('.input-pane');
        this.container = document.querySelector('.container');
        this.scrollToTopBtn = document.getElementById('scrollToTop');
        this.hero = document.getElementById('hero');
        this.navbar = document.getElementById('navbar'); // Store navbar reference

        // Scroll behavior state
        this.isScrolling = false; // True if a programmatic scroll is active
        this.hasSnapped = false;  // True if view is snapped to main content, false if in hero
        this.lastScrollTop = 0;

        this.setupEventListeners();
        this.setupResizer();
        this.setupScrollHandler();
        this.setupScrollToTop();
        this.updatePreview(); // Initial preview update
    }

    setupEventListeners() {
        this.input.addEventListener('input', () => this.updatePreview());
    }

    setupScrollToTop() {
        this.scrollToTopBtn.addEventListener('click', () => {
            this.scrollToTopInternal(); // Renamed to avoid conflict with potential future window.scrollToTop
        });
    }

    // Renamed to avoid potential conflicts and clarify internal use
    scrollToTopInternal() {
        const navbarHeight = this.navbar.offsetHeight;
        const heroHeight = this.hero.offsetHeight;
        const targetScrollPosition = heroHeight - navbarHeight;
        const scrollTarget = Math.max(0, targetScrollPosition);

        this.isScrolling = true;

        window.scrollTo({
            top: scrollTarget,
            behavior: 'smooth'
        });

        const scrollDuration = 800;
        setTimeout(() => {
            this.isScrolling = false;
            this.hasSnapped = true; // Snapped to main content area after scrolling up
            this.lastScrollTop = scrollTarget;
        }, scrollDuration);
    }

    setupScrollHandler() {
        let ticking = false;
        const logo = document.getElementById('logo');
        const scrollIndicator = document.getElementById('scrollIndicator');
        const scrollText = document.getElementById('scrollText');
        let hasTriggeredGoodBoy = false;

        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    const scrollTop = document.documentElement.scrollTop;
                    const heroHeight = this.hero.offsetHeight;
                    const navbarActualHeight = this.navbar.offsetHeight;

                    const uiChangeThreshold = heroHeight * 0.05;
                    const snapInitiationThreshold = heroHeight * 0.1;

                    if (scrollTop > snapInitiationThreshold && !hasTriggeredGoodBoy) {
                        hasTriggeredGoodBoy = true;
                        scrollText.textContent = 'good boy :3';
                        scrollText.style.textTransform = 'lowercase';
                        scrollText.style.fontSize = '1.2rem';

                        setTimeout(() => {
                            scrollIndicator.classList.add('slide-away');
                            setTimeout(() => {
                                scrollIndicator.classList.add('hidden');
                            }, 900);
                        }, 1000);
                    }

                    if (scrollTop <= snapInitiationThreshold * 0.3 && hasTriggeredGoodBoy) {
                        hasTriggeredGoodBoy = false;
                        scrollIndicator.classList.remove('hidden');
                        scrollIndicator.classList.remove('slide-away');
                        scrollIndicator.classList.add('slide-up');

                        setTimeout(() => {
                            scrollText.textContent = 'scroll down!';
                            scrollText.style.textTransform = 'uppercase';
                            scrollText.style.fontSize = '';
                            scrollIndicator.classList.remove('slide-up');
                        }, 600);
                    }

                    if (scrollTop > uiChangeThreshold) {
                        logo.classList.add('navbar-mode');
                        this.navbar.style.opacity = '1';
                    } else {
                        logo.classList.remove('navbar-mode');
                        this.navbar.style.opacity = '0';
                    }

                    if (scrollTop > heroHeight * 0.5) {
                        this.scrollToTopBtn.classList.add('visible');
                    } else {
                        this.scrollToTopBtn.classList.remove('visible');
                    }

                    this.handleViewSnapping(scrollTop, snapInitiationThreshold, heroHeight, navbarActualHeight);

                    this.lastScrollTop = scrollTop;
                    ticking = false;
                });
                ticking = true;
            }
        });
    }

    handleViewSnapping(scrollTop, snapInitiationThreshold, heroHeight, navbarHeight) {
        const contentSnapPosition = heroHeight - navbarHeight;

        if (!this.hasSnapped &&
            scrollTop > snapInitiationThreshold &&
            scrollTop < contentSnapPosition &&
            scrollTop > this.lastScrollTop &&
            !this.isScrolling) {

            this.isScrolling = true;
            // REMOVED: document.body.classList.add('scroll-disabled');

            window.scrollTo({
                top: contentSnapPosition,
                behavior: 'smooth'
            });

            setTimeout(() => {
                this.isScrolling = false;
                // REMOVED: document.body.classList.remove('scroll-disabled');
                this.hasSnapped = true;
            }, 800);
        }

        const reverseSnapTriggerPoint = contentSnapPosition - (heroHeight * 0.20);

        if (this.hasSnapped &&
            scrollTop < reverseSnapTriggerPoint &&
            scrollTop < this.lastScrollTop &&
            !this.isScrolling) {

            this.isScrolling = true;
            // REMOVED: document.body.classList.add('scroll-disabled');

            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });

            setTimeout(() => {
                this.isScrolling = false;
                // REMOVED: document.body.classList.remove('scroll-disabled');
                this.hasSnapped = false;
            }, 800);
        }

        if (this.hasSnapped && scrollTop < snapInitiationThreshold * 0.5 && !this.isScrolling) {
            this.hasSnapped = false;
        }
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
            this.preview.innerHTML = `
            <h1>Welcome to meowmd! ✨</h1>
            <p>Start typing your markdown in the left pane to see the magic happen~ (◕‿◕)</p>
            <h2>Features</h2>
            <ul>
                <li>Real-time markdown preview</li>
                <li>Collapsible code blocks with copy buttons</li>
                <li>Syntax highlighting</li>
                <li>Resizable panes</li>
                <li>Cute kawaii theme with GitHub styling~ ♡</li>
            </ul>
        `;
            return;
        }

        if (typeof marked === 'undefined') {
            this.preview.innerHTML = "<p>Error: 'marked' library not loaded.</p>";
            return;
        }

        const html = marked.parse(markdown);
        this.preview.innerHTML = this.processCodeBlocks(html);
        this.highlightCode();
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
