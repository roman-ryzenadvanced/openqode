class OpenQodeTUI {
    constructor() {
        this.terminal = null;
        this.currentLine = '';
        this.cursorPosition = 0;
        this.history = [];
        this.historyIndex = -1;
        this.isProcessing = false;
        this.currentModel = 'qwen/coder-model';

        // Check localStorage immediately for auth state
        const token = localStorage.getItem('openqode_token');
        this.isAuthenticated = !!token;

        this.init();
    }

    init() {
        this.createTerminal();
        this.setupEventListeners();
        this.showWelcome();
        // Check and update auth status (will also update from API)
        this.checkAuthentication();
    }

    createTerminal() {
        const tuiView = document.getElementById('tui-view');
        if (!tuiView) {
            console.error('TUI view container not found');
            return;
        }

        tuiView.innerHTML = `
            <div class="terminal-container">
                <div class="terminal-header">
                    <span class="terminal-title">OpenQode TUI v1.01 - ${this.currentModel}</span>
                    <div class="terminal-controls">
                        <button class="terminal-btn minimize">_</button>
                        <button class="terminal-btn maximize">□</button>
                        <button class="terminal-btn close">×</button>
                    </div>
                </div>
                <div class="terminal-body">
                    <div class="terminal-output" id="terminal-output"></div>
                    <div class="terminal-input-line">
                        <span class="terminal-prompt">OpenQode></span>
                        <span class="terminal-input" id="terminal-input" contenteditable="true" spellcheck="false"></span>
                        <span class="terminal-cursor" id="terminal-cursor">█</span>
                    </div>
                </div>
                <div class="terminal-status-bar">
                    <span class="status-item" id="auth-status">🔒 Not Authenticated</span>
                    <span class="status-item" id="model-status">Model: ${this.currentModel}</span>
                    <span class="status-item" id="connection-status">🟢 Connected</span>
                </div>
            </div>
        `;

        this.terminal = {
            output: document.getElementById('terminal-output'),
            input: document.getElementById('terminal-input'),
            cursor: document.getElementById('terminal-cursor'),
            authStatus: document.getElementById('auth-status'),
            modelStatus: document.getElementById('model-status'),
            connectionStatus: document.getElementById('connection-status')
        };

        // Start cursor blink
        this.startCursorBlink();
    }

    setupEventListeners() {
        // Terminal input events
        this.terminal.input.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.terminal.input.addEventListener('input', (e) => this.handleInput(e));
        this.terminal.input.addEventListener('click', () => this.setCursorPosition());

        // Terminal control buttons
        document.querySelector('.terminal-btn.close').addEventListener('click', () => {
            if (confirm('Are you sure you want to exit OpenQode TUI?')) {
                this.printLine('Goodbye! 👋');
                setTimeout(() => window.close(), 1000);
            }
        });

        // Focus terminal input when clicking anywhere in terminal
        document.querySelector('.terminal-body').addEventListener('click', () => {
            this.terminal.input.focus();
        });

        // Prevent context menu in terminal
        this.terminal.input.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    handleKeyDown(e) {
        if (this.isProcessing) {
            e.preventDefault();
            return;
        }

        switch (e.key) {
            case 'Enter':
                e.preventDefault();
                this.executeCommand();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.navigateHistory(-1);
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.navigateHistory(1);
                break;
            case 'ArrowLeft':
                // Allow natural left arrow movement
                break;
            case 'ArrowRight':
                // Allow natural right arrow movement
                break;
            case 'Tab':
                e.preventDefault();
                this.handleTabCompletion();
                break;
            case 'c':
                if (e.ctrlKey) {
                    e.preventDefault();
                    this.handleCtrlC();
                }
                break;
            case 'l':
                if (e.ctrlKey) {
                    e.preventDefault();
                    this.clearTerminal();
                }
                break;
            case 'Home':
                e.preventDefault();
                this.setCursorPosition(0);
                break;
            case 'End':
                e.preventDefault();
                this.setCursorPosition(this.currentLine.length);
                break;
        }
    }

    handleInput(e) {
        this.currentLine = this.terminal.input.textContent;
        this.cursorPosition = this.getCursorPosition();
    }

    executeCommand() {
        const command = this.currentLine.trim();
        if (!command) {
            this.newLine();
            return;
        }

        // Add to history
        this.history.push(command);
        this.historyIndex = this.history.length;

        // Echo command
        this.printLine(`OpenQode> ${command}`);

        // Process command
        this.processCommand(command);

        // Clear input
        this.currentLine = '';
        this.terminal.input.textContent = '';
        this.cursorPosition = 0;
    }

    async processCommand(command) {
        this.isProcessing = true;
        this.showProcessing(true);

        try {
            const [cmd, ...args] = command.toLowerCase().split(' ');

            switch (cmd) {
                case 'help':
                    this.showHelp();
                    break;
                case 'clear':
                case 'cls':
                    this.clearTerminal();
                    break;
                case 'auth':
                    await this.handleAuth(args);
                    break;
                case 'model':
                    this.handleModel(args);
                    break;
                case 'status':
                    this.showStatus();
                    break;
                case 'exit':
                case 'quit':
                    this.handleExit();
                    break;
                case 'chat':
                case 'ask':
                    await this.handleChat(args.join(' '));
                    break;
                case 'lakeview':
                    this.toggleLakeview();
                    break;
                case 'thinking':
                    this.toggleSequentialThinking();
                    break;
                case 'session':
                    this.handleSession(args);
                    break;
                default:
                    // Treat as chat message
                    await this.handleChat(command);
            }
        } catch (error) {
            this.printLine(`❌ Error: ${error.message}`, 'error');
        } finally {
            this.isProcessing = false;
            this.showProcessing(false);
            this.newLine();
        }
    }

    async handleAuth(args) {
        const subcommand = args[0];

        switch (subcommand) {
            case 'login':
                await this.authenticate();
                break;
            case 'logout':
                this.logout();
                break;
            case 'status':
                this.showAuthStatus();
                break;
            default:
                this.printLine('Usage: auth [login|logout|status]');
        }
    }

    async authenticate() {
        this.printLine('🔐 Initiating Qwen authentication...');

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider: 'qwen' })
            });

            const data = await response.json();

            if (data.success) {
                if (data.alreadyAuthenticated) {
                    this.isAuthenticated = true;
                    this.updateAuthStatus();
                    this.printLine('✅ Already authenticated with Qwen!');
                } else if (data.requiresDeviceCode) {
                    // Device Code Flow
                    this.printLine('🔐 Device Code Flow initiated');
                    this.printLine(`📋 Go to: ${data.verificationUri}`);
                    this.printLine(`🔢 Enter code: ${data.userCode}`);
                    this.printLine(`⏱️ Code expires in ${Math.floor(data.expiresIn / 60)} minutes`);

                    // Open verification URL
                    window.open(data.verificationUriComplete || data.verificationUri, '_blank');

                    // Poll for completion
                    this.printLine('⏳ Waiting for authentication completion...');
                    this.pollForAuthCompletion();
                } else {
                    this.isAuthenticated = true;
                    this.updateAuthStatus();
                    this.printLine('✅ Successfully authenticated with Qwen!');
                }
            } else {
                this.printLine(`❌ Authentication failed: ${data.error}`);
            }
        } catch (error) {
            this.printLine(`❌ Authentication error: ${error.message}`);
        }
    }

    async pollForAuthCompletion() {
        const checkAuth = async () => {
            try {
                const response = await fetch('/api/auth/status');
                const data = await response.json();

                if (data.authenticated) {
                    this.isAuthenticated = true;
                    this.updateAuthStatus();
                    this.printLine('✅ Authentication completed successfully!');
                    return true;
                }
            } catch (error) {
                // Continue polling
            }
            return false;
        };

        // Poll every 5 seconds for up to 15 minutes
        let attempts = 0;
        const maxAttempts = 180;
        const poll = setInterval(async () => {
            attempts++;
            if (await checkAuth() || attempts >= maxAttempts) {
                clearInterval(poll);
                if (attempts >= maxAttempts && !this.isAuthenticated) {
                    this.printLine('⏰ Authentication timed out. Please try again.');
                }
            }
        }, 5000);
    }

    logout() {
        this.isAuthenticated = false;
        this.updateAuthStatus();
        this.printLine('🔓 Logged out successfully');
    }

    showAuthStatus() {
        if (this.isAuthenticated) {
            this.printLine('✅ Authenticated with Qwen');
        } else {
            this.printLine('❌ Not authenticated');
        }
    }

    handleModel(args) {
        if (args.length === 0) {
            this.printLine(`Current model: ${this.currentModel}`);
            return;
        }

        const model = args.join(' ');
        const validModels = [
            'qwen/coder-model',
            'qwen/chat-model',
            'gpt-4',
            'gpt-3.5-turbo'
        ];

        if (validModels.includes(model)) {
            this.currentModel = model;
            this.updateModelStatus();
            this.printLine(`✅ Model changed to: ${model}`);
        } else {
            this.printLine('❌ Invalid model. Available models:');
            validModels.forEach(m => this.printLine(`  - ${m}`));
        }
    }

    async handleChat(message) {
        // Check auth - either flag or localStorage token
        const token = localStorage.getItem('openqode_token');
        if (!this.isAuthenticated && !token && this.currentModel.startsWith('qwen')) {
            this.printLine('❌ Please authenticate first: auth login');
            return;
        }

        this.printLine(`🤖 (${this.currentModel}) Processing...`);

        try {
            // Get auth token from localStorage (same as GUI view)
            const token = localStorage.getItem('openqode_token');

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message,
                    model: this.currentModel,
                    token: token,
                    features: this.features || {}
                })
            });

            const data = await response.json();

            if (data.success) {
                // Update auth status since we got a successful response
                this.isAuthenticated = true;
                this.updateAuthStatus();

                this.printLine('');
                this.printLine(data.response, 'ai-response');
            } else {
                if (data.needsReauth) {
                    this.isAuthenticated = false;
                    this.updateAuthStatus();
                    this.printLine('❌ Session expired. Please authenticate again: auth login');
                } else {
                    this.printLine(`❌ Error: ${data.error}`);
                }
            }
        } catch (error) {
            this.printLine(`❌ Chat error: ${error.message}`);
        }
    }

    showHelp() {
        const helpText = `
📖 OpenQode TUI Commands:

Authentication:
  auth login     - Authenticate with Qwen
  auth logout    - Logout from current session
  auth status    - Show authentication status

Model Management:
  model [name]   - Set or show current model
  Available models: qwen/coder-model, qwen/chat-model, gpt-4, gpt-3.5-turbo

Chat & Interaction:
  chat [message] - Send message to AI
  ask [question] - Ask question to AI
  (any text)     - Direct chat message

Features:
  lakeview       - Toggle Lakeview mode
  thinking       - Toggle Sequential Thinking
  session [cmd]  - Manage chat sessions

Terminal:
  clear/cls      - Clear terminal
  help           - Show this help
  status         - Show system status
  exit/quit      - Exit OpenQode

Navigation:
  ↑/↓           - Navigate command history
  Tab           - Auto-completion
  Ctrl+C        - Cancel current operation
  Ctrl+L        - Clear terminal
        `;

        this.printLine(helpText);
    }

    showStatus() {
        const status = `
📊 OpenQode Status:
  Version: v1.01 Preview Edition
  Model: ${this.currentModel}
  Auth: ${this.isAuthenticated ? '✅ Authenticated' : '❌ Not Authenticated'}
  Connection: 🟢 Connected
  History: ${this.history.length} commands
        `;
        this.printLine(status);
    }

    toggleLakeview() {
        const isEnabled = !this.features?.lakeview;
        if (!this.features) this.features = {};
        this.features.lakeview = isEnabled;
        this.printLine(`🌊 Lakeview mode ${isEnabled ? 'enabled' : 'disabled'}`);
    }

    toggleSequentialThinking() {
        const isEnabled = !this.features?.sequentialThinking;
        if (!this.features) this.features = {};
        this.features.sequentialThinking = isEnabled;
        this.printLine(`🧠 Sequential Thinking ${isEnabled ? 'enabled' : 'disabled'}`);
    }

    handleSession(args) {
        const command = args[0];

        switch (command) {
            case 'new':
                this.createNewSession();
                break;
            case 'list':
                this.listSessions();
                break;
            case 'switch':
                this.switchSession(args[1]);
                break;
            default:
                this.printLine('Usage: session [new|list|switch <name>]');
        }
    }

    createNewSession() {
        const sessionName = `session_${Date.now()}`;
        this.printLine(`✅ Created new session: ${sessionName}`);
    }

    listSessions() {
        this.printLine('📁 Available sessions:');
        this.printLine('  - default');
        this.printLine('  - session_1234567890');
    }

    switchSession(name) {
        if (name) {
            this.printLine(`🔄 Switched to session: ${name}`);
        } else {
            this.printLine('❌ Please provide session name');
        }
    }

    handleExit() {
        this.printLine('👋 Thank you for using OpenQode!');
        setTimeout(() => {
            if (confirm('Exit OpenQode TUI?')) {
                window.close();
            }
        }, 1000);
    }

    handleCtrlC() {
        if (this.isProcessing) {
            this.isProcessing = false;
            this.showProcessing(false);
            this.printLine('^C', 'cancel');
            this.newLine();
        } else {
            this.currentLine = '';
            this.terminal.input.textContent = '';
            this.cursorPosition = 0;
        }
    }

    handleTabCompletion() {
        // Simple tab completion for commands
        const commands = ['help', 'clear', 'auth', 'model', 'status', 'exit', 'quit', 'chat', 'ask', 'lakeview', 'thinking', 'session'];
        const currentInput = this.currentLine.toLowerCase();

        const matches = commands.filter(cmd => cmd.startsWith(currentInput));

        if (matches.length === 1) {
            this.currentLine = matches[0];
            this.terminal.input.textContent = matches[0];
            this.setCursorPosition(matches[0].length);
        } else if (matches.length > 1) {
            this.printLine(`\nPossible completions: ${matches.join(', ')}`);
        }
    }

    navigateHistory(direction) {
        if (direction === -1 && this.historyIndex > 0) {
            this.historyIndex--;
        } else if (direction === 1 && this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
        } else {
            return;
        }

        this.currentLine = this.history[this.historyIndex] || '';
        this.terminal.input.textContent = this.currentLine;
        this.setCursorPosition(this.currentLine.length);
    }

    printLine(text, className = '') {
        const line = document.createElement('div');
        line.className = `terminal-line ${className}`;

        // Detect and convert file paths to clickable links
        const processedText = this.parseFilePathsAndLinks(text);
        line.innerHTML = processedText;

        this.terminal.output.appendChild(line);
        this.scrollToBottom();
    }

    parseFilePathsAndLinks(text) {
        // Escape HTML first
        let escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // Match Windows paths (C:\...) and Unix paths (/path/...)
        const pathRegex = /([A-Za-z]:\\[^\s<>"'`]+|\/[^\s<>"'`]+\.[a-zA-Z0-9]+)/g;

        escaped = escaped.replace(pathRegex, (match) => {
            const fileName = match.split(/[\/\\]/).pop();
            const folderPath = match.substring(0, match.lastIndexOf('\\') || match.lastIndexOf('/'));

            return `<span class="file-link-container">
                <a href="#" class="file-link" data-path="${match}" onclick="window.openQodeTUI?.openFile('${match.replace(/\\/g, '\\\\')}'); return false;">📄 ${fileName}</a>
                <button class="folder-btn" onclick="window.openQodeTUI?.openFolder('${folderPath.replace(/\\/g, '\\\\')}'); return false;" title="Open folder">📁</button>
            </span>`;
        });

        // Also match backtick-wrapped paths
        escaped = escaped.replace(/`([^`]+\.[a-zA-Z0-9]+)`/g, (match, path) => {
            if (path.includes('\\') || path.includes('/')) {
                const fileName = path.split(/[\/\\]/).pop();
                const folderPath = path.substring(0, path.lastIndexOf('\\') || path.lastIndexOf('/'));
                return `<span class="file-link-container">
                    <a href="#" class="file-link" data-path="${path}" onclick="window.openQodeTUI?.openFile('${path.replace(/\\/g, '\\\\')}'); return false;">📄 ${fileName}</a>
                    <button class="folder-btn" onclick="window.openQodeTUI?.openFolder('${folderPath.replace(/\\/g, '\\\\')}'); return false;" title="Open folder">📁</button>
                </span>`;
            }
            return `<code class="inline-code">${path}</code>`;
        });

        return escaped;
    }

    openFile(filePath) {
        // Try to open file in new tab (works for HTML files)
        if (filePath.endsWith('.html') || filePath.endsWith('.htm')) {
            window.open(`file:///${filePath.replace(/\\/g, '/')}`, '_blank');
        } else {
            // For other files, show path and copy to clipboard
            this.printLine(`📋 Path copied: ${filePath}`, 'success');
            navigator.clipboard.writeText(filePath);
        }
    }

    openFolder(folderPath) {
        // Copy folder path to clipboard and show message
        navigator.clipboard.writeText(folderPath);
        this.printLine(`📋 Folder path copied: ${folderPath}`, 'success');
        this.printLine('Paste in File Explorer to open folder', 'info');
    }

    newLine() {
        const line = document.createElement('div');
        line.className = 'terminal-line';
        this.terminal.output.appendChild(line);
        this.scrollToBottom();
    }

    clearTerminal() {
        this.terminal.output.innerHTML = '';
        this.showWelcome();
    }

    showWelcome() {
        // Use separate lines for cleaner display
        this.printLine('');
        this.printLine('  ╔═══════════════════════════════════════════════╗', 'welcome-border');
        this.printLine('  ║     🚀 OpenQode TUI v1.01 Preview             ║', 'welcome-title');
        this.printLine('  ║     OpenCode + Qwen Integration               ║', 'welcome-subtitle');
        this.printLine('  ╚═══════════════════════════════════════════════╝', 'welcome-border');
        this.printLine('');
        this.printLine('  Welcome to OpenQode! Type "help" for commands.', 'welcome-text');
        this.printLine('');
    }

    showProcessing(show) {
        if (show) {
            this.terminal.connectionStatus.textContent = '🟡 Processing...';
        } else {
            this.terminal.connectionStatus.textContent = '🟢 Connected';
        }
    }

    updateAuthStatus() {
        if (this.isAuthenticated) {
            this.terminal.authStatus.textContent = '✅ Authenticated';
        } else {
            this.terminal.authStatus.textContent = '🔒 Not Authenticated';
        }
    }

    updateModelStatus() {
        this.terminal.modelStatus.textContent = `Model: ${this.currentModel}`;
        document.querySelector('.terminal-title').textContent = `OpenQode TUI v1.01 - ${this.currentModel}`;
    }

    startCursorBlink() {
        setInterval(() => {
            this.terminal.cursor.style.opacity =
                this.terminal.cursor.style.opacity === '0' ? '1' : '0';
        }, 500);
    }

    setCursorPosition(position) {
        if (position !== undefined) {
            this.cursorPosition = Math.max(0, Math.min(position, this.currentLine.length));
        }

        // Create a selection to position cursor
        const selection = window.getSelection();
        const range = document.createRange();
        const textNode = this.terminal.input.firstChild || this.terminal.input;

        if (textNode.nodeType === Node.TEXT_NODE) {
            range.setStart(textNode, this.cursorPosition);
            range.setEnd(textNode, this.cursorPosition);
        } else {
            range.selectNodeContents(this.terminal.input);
            range.collapse(false);
        }

        selection.removeAllRanges();
        selection.addRange(range);
    }

    getCursorPosition() {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return 0;

        const range = selection.getRangeAt(0);
        const textNode = this.terminal.input.firstChild;

        if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return 0;

        return range.startOffset;
    }

    scrollToBottom() {
        this.terminal.output.scrollTop = this.terminal.output.scrollHeight;
    }

    async checkAuthentication() {
        try {
            // First check if GUI already has a token (shared auth state)
            const token = localStorage.getItem('openqode_token');

            const response = await fetch('/api/auth/status');
            const data = await response.json();

            // Consider authenticated if either API says so OR we have a valid token
            this.isAuthenticated = data.authenticated || !!token;
            this.updateAuthStatus();

            if (this.isAuthenticated) {
                this.printLine('✅ Authenticated with Qwen');
            }
        } catch (error) {
            // Fallback: check localStorage token
            const token = localStorage.getItem('openqode_token');
            this.isAuthenticated = !!token;
            this.updateAuthStatus();
        }
    }
}

// Initialize TUI when page loads, but only create instance
document.addEventListener('DOMContentLoaded', () => {
    // Don't auto-initialize TUI, wait for user to switch to TUI view
    window.createOpenQodeTUI = () => {
        if (!window.openQodeTUI) {
            window.openQodeTUI = new OpenQodeTUI();
        }
        return window.openQodeTUI;
    };
});