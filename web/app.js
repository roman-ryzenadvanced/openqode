// OpenQode Web Interface Application

// API base URL - use the same origin as the current page for API requests
const API_BASE_URL = 'http://127.0.0.1:15044';

class OpenQodeWeb {
    constructor() {
        this.apiBaseUrl = API_BASE_URL;
        this.currentSession = 'default';
        this.sessions = {};
        this.isAuthenticated = false;
        this.currentModel = 'qwen/coder-model';
        this.currentAttachment = null; // For file/image attachments

        // IDE state (v1.02)
        this.workspaceTree = [];
        this.openTabs = []; // { path, name, original, content }
        this.activeTabPath = null;
        this.dirtyTabs = new Set();
        this.attachedPaths = new Set();
        this.lastTreeRefresh = 0;
        this.isIDEInitialized = false;
        this.features = {
            lakeview: false,
            sequentialThinking: false
        };

        this.init();
    }

    async init() {
        // Check if API is reachable first
        try {
            const healthCheck = await fetch(`${this.apiBaseUrl}/api/files/tree`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000)
            });
            if (!healthCheck.ok) {
                console.warn('⚠️ API health check failed:', healthCheck.status);
            } else {
                console.log('✅ API is reachable');
            }
        } catch (error) {
            console.error('❌ Cannot reach API server:', error.message);
            // Show a persistent warning
            setTimeout(() => {
                this.addMessage('system', `⚠️ <strong>Cannot connect to server at ${this.apiBaseUrl}</strong><br>Please ensure the server is running with: <code>node server.js 15044</code><br>Then access this page at: <a href="http://127.0.0.1:15044/">http://127.0.0.1:15044/</a>`);
            }, 500);
        }

        this.setupEventListeners();
        this.authToken = localStorage.getItem('openqode_token');
        await this.checkAuthentication();
        await this.loadSessions();
        await this.initIDE();
        this.updateHeroPreviewLink();
        this.hideLoading();
    }

    setupEventListeners() {
        // View toggle
        const guiViewBtn = document.getElementById('gui-view-btn');
        const tuiViewBtn = document.getElementById('tui-view-btn');

        guiViewBtn?.addEventListener('click', () => this.switchView('gui'));
        tuiViewBtn?.addEventListener('click', () => this.switchView('tui'));

        // Send message
        const sendBtn = document.getElementById('send-btn');
        const messageInput = document.getElementById('message-input');

        sendBtn?.addEventListener('click', () => this.sendMessageStream());
        messageInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessageStream(); // Use streaming by default
            }
        });

        // Auto-resize textarea
        messageInput?.addEventListener('input', () => {
            messageInput.style.height = 'auto';
            messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
        });

        // Model selection
        document.getElementById('model-select')?.addEventListener('change', (e) => {
            this.currentModel = e.target.value;
            this.updateModelStatus();
        });

        // Feature toggles
        document.getElementById('lakeview-mode')?.addEventListener('change', (e) => {
            this.features.lakeview = e.target.checked;
            this.showSuccess(`Lakeview mode ${e.target.checked ? 'enabled' : 'disabled'}`);
        });

        document.getElementById('sequential-thinking')?.addEventListener('change', (e) => {
            this.features.sequentialThinking = e.target.checked;
            this.showSuccess(`Sequential thinking ${e.target.checked ? 'enabled' : 'disabled'}`);
        });

        // Temperature slider
        const tempSlider = document.getElementById('temperature-slider');
        const tempValue = document.querySelector('.slider-value');
        tempSlider?.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value).toFixed(1);
            if (tempValue) tempValue.textContent = val;
            this.temperature = parseFloat(val);
        });

        // Authentication
        document.getElementById('auth-btn')?.addEventListener('click', () => {
            this.authenticate();
        });

        document.getElementById('reauth-btn')?.addEventListener('click', () => {
            this.authenticate();
        });

        // Settings panel reauth button
        document.getElementById('reauth-btn-panel')?.addEventListener('click', () => {
            this.hideSettings();
            this.authenticate();
        });

        // Settings modal
        document.getElementById('settings-btn')?.addEventListener('click', () => {
            this.showSettings();
        });

        document.getElementById('close-settings')?.addEventListener('click', () => {
            this.hideSettings();
        });

        // Sessions
        const newSessionBtn = document.getElementById('new-session-btn');
        console.log('🔧 new-session-btn element:', newSessionBtn);
        newSessionBtn?.addEventListener('click', (e) => {
            console.log('🖱️ New Session button clicked!', e);
            this.createNewSession();
        });

        // New Project
        document.getElementById('new-project-btn')?.addEventListener('click', () => {
            this.startNewProjectFlow();
        });

        // File attachment
        document.getElementById('attach-btn')?.addEventListener('click', () => {
            this.attachFile();
        });

        // IDE buttons
        document.getElementById('refresh-tree-btn')?.addEventListener('click', () => this.refreshFileTree());
        document.getElementById('new-file-btn')?.addEventListener('click', () => this.promptCreateFileOrFolder());
        document.getElementById('save-file-btn')?.addEventListener('click', () => this.saveCurrentFile());
        document.getElementById('rename-file-btn')?.addEventListener('click', () => this.renameCurrentFile());
        document.getElementById('delete-file-btn')?.addEventListener('click', () => this.deleteCurrentFile());

        // Deployment & Preview
        document.getElementById('deploy-btn')?.addEventListener('click', () => {
            console.log('🖱️ Deploy button clicked');
            this.deployToVercel();
        });
        document.getElementById('preview-btn')?.addEventListener('click', () => {
            console.log('🖱️ Preview button clicked');
            this.startLocalPreview();
        });
        document.getElementById('show-diff-btn')?.addEventListener('click', () => this.showDiff());
        document.getElementById('apply-diff-btn')?.addEventListener('click', () => this.applyDiff());
        document.getElementById('apply-diff-btn-panel')?.addEventListener('click', () => this.applyDiff());
        document.getElementById('close-diff')?.addEventListener('click', () => this.hideDiff());
        document.getElementById('cancel-diff-btn')?.addEventListener('click', () => this.hideDiff());

        // Terminal
        document.getElementById('terminal-run-btn')?.addEventListener('click', () => this.runTerminalCommand());
        const terminalInput = document.getElementById('terminal-input');
        terminalInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.runTerminalCommand();
            }
        });

        // File tree delegation
        const fileTreeEl = document.getElementById('file-tree');
        fileTreeEl?.addEventListener('click', (e) => this.onFileTreeClick(e));

        // Close modals on outside click
        document.getElementById('settings-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'settings-modal') {
                this.hideSettings();
            }
        });

        document.getElementById('diff-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'diff-modal') {
                this.hideDiff();
            }
        });

        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl+S to save
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveCurrentFile();
            }
            // Escape to close modals
            if (e.key === 'Escape') {
                this.hideSettings();
                this.hideDiff();
            }
        });
    }

    updateHeroPreviewLink() {
        const link = document.getElementById('hero-local-preview');
        if (!link) return;
        const origin = window.location.origin;
        link.setAttribute('href', origin);
        link.setAttribute('title', `OpenQode Web @ ${origin}`);
    }

    async checkAuthentication() {
        if (!this.authToken) {
            this.updateAuthStatus({ authenticated: false, provider: 'none' });
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/auth/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: this.authToken })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            this.isAuthenticated = data.authenticated;
            const provider = (data.user && data.user.provider) || 'Qwen';
            this.updateAuthStatus({ authenticated: data.authenticated, provider });

            if (data.authenticated) {
                const authBtn = document.getElementById('auth-btn');
                authBtn.innerHTML = `
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Authenticated
                `;
                authBtn.className = 'inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500';
                await this.refreshFileTree();
            }
        } catch (error) {
            console.error('Auth check failed:', error);

            // Handle network errors
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                this.updateAuthStatus({ authenticated: false, provider: 'none' });
                console.warn('Server not available for auth check');
            } else {
                this.updateAuthStatus({ authenticated: false, provider: 'none' });
            }
        }
    }

    async authenticate() {
        this.showLoading('Authenticating with Qwen...');

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ provider: 'qwen' })
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Authentication expired. Please re-authenticate.');
                } else if (response.status === 429) {
                    throw new Error('Rate limit exceeded. Please try again later.');
                } else {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            }

            const data = await response.json();

            if (data.success) {
                if (data.alreadyAuthenticated) {
                    const visionMsg = data.hasVisionSupport
                        ? '✅ Vision API enabled - you can analyze images!'
                        : '⚠️ Text chat only. Click "Authenticate Qwen" again for Vision API access.';
                    this.addMessage('system', `Already authenticated with Qwen!\n${visionMsg}`);
                    this.showSuccess('Already authenticated with Qwen!');
                } else if (data.requiresDeviceCode) {
                    // Device Code Flow - show user code and verification URL
                    const verificationUrl = data.verificationUriComplete || data.verificationUri;
                    this.addMessage('system', `🔐 To authenticate with Qwen:\n\n1. Go to: ${data.verificationUri}\n2. Enter code: ${data.userCode}\n3. Complete login, then refresh this page\n\nThe code expires in ${Math.floor(data.expiresIn / 60)} minutes.`);

                    // Open verification URL in new tab
                    window.open(verificationUrl, '_blank');
                    this.showInfo('Please complete the authentication in the opened browser window.');

                    // Start polling for completion
                    this.pollAuthCompletion();
                    return;
                } else if (data.requiresBrowser) {
                    // Legacy browser flow
                    this.addMessage('system', 'Opening browser for Qwen authentication...');
                    window.open(data.browserUrl, '_blank');
                    this.addMessage('system', 'Please complete authentication in the browser, then click "Complete Authentication" when done.');
                    this.authState = data.state;
                    this.showCompleteAuthButton();
                    return;
                } else {
                    this.addMessage('system', 'Successfully authenticated with Qwen!');
                    this.showSuccess('Successfully authenticated with Qwen!');
                }

                if (data.token) {
                    this.authToken = data.token;
                    localStorage.setItem('openqode_token', data.token);
                }

                this.isAuthenticated = true;
                this.updateAuthStatus({ authenticated: true, provider: 'qwen' });
                this.updateAuthButton(true);
            } else {
                this.addMessage('system', `Authentication failed: ${data.error}`);
                this.showError(`Authentication failed: ${data.error}`);
            }
        } catch (error) {
            console.error('Authentication error:', error);

            // Better error handling for network issues
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                this.addMessage('system', 'Authentication error: Unable to connect to server. Please check if the server is running and try again.');
                this.showError('Unable to connect to server. Please check if the backend server is running.');
            } else {
                this.addMessage('system', `Authentication error: ${error.message}`);
                this.showError(`Authentication failed: ${error.message}`);
            }
        } finally {
            this.hideLoading();
        }
    }

    async pollAuthCompletion() {
        // Poll every 5 seconds to check if auth completed
        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`${this.apiBaseUrl}/api/auth/status`);
                const data = await response.json();

                if (data.authenticated) {
                    clearInterval(pollInterval);
                    this.addMessage('system', '✅ Authentication completed successfully!');
                    this.isAuthenticated = true;
                    this.updateAuthStatus({ authenticated: true, provider: 'qwen' });
                    this.updateAuthButton(true);

                    // Get a new token
                    const loginResponse = await fetch(`${this.apiBaseUrl}/api/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ provider: 'qwen' })
                    });
                    const loginData = await loginResponse.json();
                    if (loginData.token) {
                        this.authToken = loginData.token;
                        localStorage.setItem('openqode_token', loginData.token);
                    }
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, 5000);

        // Stop polling after 15 minutes
        setTimeout(() => clearInterval(pollInterval), 900000);
    }

    updateAuthButton(authenticated) {
        const authBtn = document.getElementById('auth-btn');
        if (authenticated) {
            authBtn.innerHTML = `
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                Authenticated
            `;
            authBtn.className = 'inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500';
        }
    }

    async completeAuthentication() {
        if (!this.authState) {
            this.addMessage('system', 'No pending authentication found.');
            return;
        }

        this.showLoading('Completing authentication...');

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/auth/complete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ state: this.authState })
            });

            const data = await response.json();

            if (data.success) {
                this.addMessage('system', 'Authentication completed successfully!');

                if (data.token) {
                    this.authToken = data.token;
                    localStorage.setItem('openqode_token', data.token);
                }

                this.isAuthenticated = true;
                this.updateAuthStatus({ authenticated: true, provider: 'qwen' });
                const authBtn = document.getElementById('auth-btn');
                authBtn.innerHTML = `
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Authenticated
                `;
                authBtn.className = 'inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500';

                // Hide complete auth button
                this.hideCompleteAuthButton();
                this.authState = null;
            } else {
                this.addMessage('system', `Authentication completion failed: ${data.error}`);
            }
        } catch (error) {
            console.error('Authentication completion error:', error);
            this.addMessage('system', 'Authentication completion error. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    showCompleteAuthButton() {
        const authContainer = document.querySelector('.auth-section');
        if (!document.getElementById('complete-auth-btn')) {
            const completeBtn = document.createElement('button');
            completeBtn.id = 'complete-auth-btn';
            completeBtn.className = 'w-full mt-3 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500';
            completeBtn.textContent = 'Complete Authentication';
            completeBtn.addEventListener('click', () => this.completeAuthentication());
            authContainer.appendChild(completeBtn);
        }
    }

    hideCompleteAuthButton() {
        const completeBtn = document.getElementById('complete-auth-btn');
        if (completeBtn) {
            completeBtn.remove();
        }
    }

    updateAuthStatus(authData) {
        const statusText = document.getElementById('auth-status-text');
        const authStatus = document.getElementById('auth-status');

        if (authData.authenticated) {
            statusText.textContent = `Authenticated with ${authData.provider}`;
            authStatus.textContent = `✓ Authenticated (${authData.provider})`;
            authStatus.className = 'text-green-600 dark:text-green-400 font-medium';
        } else {
            statusText.textContent = 'Not authenticated';
            authStatus.textContent = 'Not authenticated - Click to authenticate';
            authStatus.className = 'text-gray-600 dark:text-gray-400';
        }
    }

    updateModelStatus() {
        const modelStatus = document.getElementById('model-status');
        const modelName = this.currentModel.includes('vision') ? 'Qwen Vision' : 'Qwen Coder';
        modelStatus.textContent = `Model: ${modelName}`;
        modelStatus.className = 'text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded';
    }

    async sendMessage() {
        const input = document.getElementById('message-input');
        const message = input.value.trim();

        if (!message) return;

        if (!this.isAuthenticated) {
            this.addMessage('system', 'Please authenticate with Qwen first using the "Authenticate Qwen" button.');
            return;
        }

        // Add user message
        this.addMessage('user', message);
        input.value = '';
        input.style.height = 'auto';

        // Show typing indicator
        this.showTypingIndicator();

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    model: this.currentModel,
                    session: this.currentSession,
                    features: this.features,
                    token: this.authToken || localStorage.getItem('openqode_token')
                })
            });

            const data = await response.json();

            this.hideTypingIndicator();

            if (data.success) {
                this.addMessage('assistant', data.response, data.metadata);
            } else {
                throw new Error(data.error || 'Failed to get response');
            }
        } catch (error) {
            this.hideTypingIndicator();
            console.error('Chat error:', error);
            this.addMessage('system', `Error: ${error.message}`);
        }
    }

    retryLastMessage() {
        if (this.lastUserMessage) {
            console.log('🔄 Retrying last message:', this.lastUserMessage);
            this.sendMessageStream(this.lastUserMessage);
        } else {
            this.showError('No message to retry.');
        }
    }

    async sendMessageStream(manualMessage = null, retryCount = 0) {
        console.log(`🚀 sendMessageStream called (Attempt ${retryCount + 1})`, manualMessage ? '(manual)' : '(user input)');
        const input = document.getElementById('message-input');
        const message = manualMessage || input.value.trim();
        console.log('Message:', message);

        if (!message) return false;

        // INTERCEPT: Local Preview Port Check
        if (this.pendingAction && this.pendingAction.type === 'awaiting_preview_port') {
            const portStr = message.trim() || '3000';
            if (!/^\d+$/.test(portStr)) {
                this.addMessage('system', '❌ Please enter a valid numeric port.');
                return;
            }
            const port = parseInt(portStr, 10); // Convert to number for server API
            const previewPath = this.pendingAction.path || '.';
            this.pendingAction = null; // Clear state
            this.addMessage('user', portStr); // Show user's choice as string
            document.getElementById('message-input').value = '';
            this.launchLocalPreview(port, previewPath);
            return; // STOP here, do not send to AI
        }

        this.lastUserMessage = message;

        if (!this.isAuthenticated) {
            this.addMessage('system', 'Please authenticate with Qwen first using the "Authenticate Qwen" button.');
            this.showWarning('Please authenticate with Qwen first.');
            return;
        }

        if (retryCount === 0) {
            this.addMessage('user', message);
            input.value = '';
            input.style.height = 'auto';
        } else {
            this.showInfo(`🔄 Auto-retrying request (Attempt ${retryCount + 1})...`);
        }

        const assistantMessageId = this.addMessage('assistant', '', { streaming: true });
        const messageDiv = document.querySelector(`[data-message-id="${assistantMessageId}"]`);
        const assistantMessageElement = messageDiv?.querySelector('.message-text');

        if (assistantMessageElement) {
            assistantMessageElement.innerHTML = `
                <div class="thinking-animation">
                    <svg class="thinking-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <span class="thinking-text">Qwen is thinking</span>
                    <span class="typing-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>
                </div>`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);

        // Additional timeout to detect if message is not registering with AI
        const registrationTimeout = setTimeout(() => {
            // This timeout triggers if no content has been received after 10 seconds
            // Check if the thinking animation is still there but no actual content
            if (assistantMessageElement && assistantMessageElement.querySelector('.thinking-animation')) {
                const currentContent = assistantMessageElement.textContent || '';
                if (currentContent.trim() === '' || currentContent.includes('Qwen is thinking')) {
                    // Message hasn't registered with AI, show option to resend
                    assistantMessageElement.innerHTML = `
                        <div class="message-text">
                            ⚠️ Message may not have registered with AI
                            <br>
                            <button class="secondary-btn small-btn" onclick="window.openQodeApp.retryLastMessage()" style="margin-top:8px;">🔄 Resend Message</button>
                            <button class="secondary-btn small-btn" onclick="this.parentElement.remove()" style="margin-top:8px; margin-left:8px;">Dismiss</button>
                        </div>`;

                    // Remove the streaming class to stop the animation
                    if (messageDiv) messageDiv.classList.remove('streaming');
                }
            }
        }, 15000); // 15 seconds timeout for message registration

        try {
            let enhancedMessage = message;
            if (this.activeTabPath) {
                const activeTab = this.openTabs.find(t => t.path === this.activeTabPath);
                if (activeTab && activeTab.content) {
                    const fileExt = activeTab.name.split('.').pop().toLowerCase();
                    enhancedMessage = `IMPORTANT SYSTEM INSTRUCTION:\nYou are an Agentic IDE. \n1. To EDIT the open file, output the COMPLETE content in a code block.\n2. To CREATE a new file, you MUST output exactly: ">>> CREATE: path/to/filename" followed by a code block with the content.\n\n[Current file: ${activeTab.path}]\n\`\`\`${fileExt}\n${activeTab.content}\n\`\`\`\n\nUser request: ${message}`;
                } else {
                    enhancedMessage = `IMPORTANT SYSTEM INSTRUCTION:\nYou are an Agentic IDE. To CREATE a new file, you MUST output exactly: ">>> CREATE: path/to/filename" followed by a code block with the content. Do not just say you created it.\n\nUser request: ${message}`;
                }
            } else {
                enhancedMessage = `IMPORTANT SYSTEM INSTRUCTION:\nYou are an Agentic IDE. To CREATE a new file, you MUST output exactly: ">>> CREATE: path/to/filename" followed by a code block with the content. Do not just say you created it.\n\nUser request: ${message}`;
            }

            const requestBody = {
                message: enhancedMessage,
                model: this.currentModel,
                session: this.currentSession,
                features: this.features,
                token: this.authToken || localStorage.getItem('openqode_token')
            };

            const response = await fetch(`${this.apiBaseUrl}/api/chat/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                if (response.status === 401) throw new Error('Authentication expired. Please re-authenticate.');
                else if (response.status === 429) throw new Error('Rate limit exceeded. Please try again later.');
                else throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let isFirstChunk = true;
            let fullResponse = '';
            let isInCodeBlock = false;
            let codeBlockContent = '';
            let codeBlockLang = '';
            let createdFiles = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            if (data.type === 'chunk') {
                                fullResponse += data.content;

                                // CREATE Parsing
                                if (fullResponse.includes('>>> CREATE: ')) {
                                    const createMatch = fullResponse.match(/>>> CREATE: (.*?)(?:\n|$)/);
                                    if (createMatch) {
                                        const filePath = createMatch[1].trim();
                                        const fileAlreadyOpen = this.openTabs.find(t => t.path === filePath);
                                        if (!fileAlreadyOpen && filePath) {
                                            const tab = { path: filePath, name: filePath.split('/').pop(), content: '', original: '' };
                                            this.openTabs.push(tab);
                                            this.setActiveTab(filePath);
                                            this.renderTabs();
                                            this.showInfo(`🤖 Creating file: ${filePath}...`);
                                            createdFiles.push(filePath);
                                        }
                                    }
                                }

                                // CODE BLOCK Parsing
                                if (!isInCodeBlock && fullResponse.includes('```')) {
                                    const match = fullResponse.match(/```(\w*)\n?$/);
                                    if (match) {
                                        isInCodeBlock = true;
                                        codeBlockLang = match[1] || 'text';
                                        if (this.activeTabPath) {
                                            const editor = document.getElementById('editor-textarea');
                                            editor?.classList.add('ai-editing');
                                            this.showInfo('🤖 AI is editing the file...');
                                        }
                                    }
                                }

                                if (isInCodeBlock) {
                                    if (data.content.includes('```')) {
                                        isInCodeBlock = false;
                                        const endIdx = fullResponse.lastIndexOf('```');
                                        const startIdx = fullResponse.indexOf('```');
                                        if (endIdx > startIdx) {
                                            const codeStart = fullResponse.indexOf('\n', startIdx) + 1;
                                            codeBlockContent = fullResponse.substring(codeStart, endIdx).trim();
                                            if (this.activeTabPath && codeBlockContent) {
                                                const activeTab = this.openTabs.find(t => t.path === this.activeTabPath);
                                                if (activeTab) {
                                                    activeTab.content = codeBlockContent;
                                                    const editor = document.getElementById('editor-textarea');
                                                    if (editor) {
                                                        editor.value = codeBlockContent;
                                                        editor.classList.remove('ai-editing');
                                                    }
                                                    this.renderTabs();
                                                    this.saveFile(activeTab.path, codeBlockContent);
                                                    this.showSuccess('✅ AI edit applied!');
                                                }
                                            }
                                        }
                                    } else {
                                        if (this.activeTabPath) {
                                            const activeTab = this.openTabs.find(t => t.path === this.activeTabPath);
                                            if (activeTab) {
                                                const startIdx = fullResponse.indexOf('```');
                                                const codeStart = fullResponse.indexOf('\n', startIdx) + 1;
                                                codeBlockContent = fullResponse.substring(codeStart);
                                                activeTab.content = codeBlockContent;
                                                const editor = document.getElementById('editor-textarea');
                                                if (editor) {
                                                    editor.value = codeBlockContent;
                                                    editor.scrollTop = editor.scrollHeight;
                                                }
                                            }
                                        }
                                    }
                                }

                                if (assistantMessageElement) {
                                    if (isFirstChunk) {
                                        assistantMessageElement.textContent = data.content;
                                        isFirstChunk = false;
                                    } else {
                                        assistantMessageElement.textContent += data.content;
                                    }
                                    this.scrollToBottom();
                                }
                            } else if (data.type === 'done') {
                                if (messageDiv) messageDiv.classList.remove('streaming');
                                const editor = document.getElementById('editor-textarea');
                                editor?.classList.remove('ai-editing');
                                this.scrollToBottom();

                                await this.refreshFileTree();

                                // Filter out plan/documentation files - only count actual code files
                                const codeFiles = createdFiles.filter(f => {
                                    const ext = f.split('.').pop().toLowerCase();
                                    // Exclude markdown and other documentation files
                                    const docExtensions = ['md', 'txt', 'rst', 'adoc'];
                                    // Also exclude files with "PLAN" or "README" in the name
                                    const isDocFile = docExtensions.includes(ext) ||
                                        f.toUpperCase().includes('PLAN') ||
                                        f.toUpperCase().includes('README');
                                    return !isDocFile;
                                });

                                if (codeFiles.length > 0) {
                                    const mainFile = codeFiles.find(f => f.endsWith('index.html') || f.endsWith('App.js') || f.endsWith('main.py'));

                                    // Detect directory of the main file to serve the correct folder
                                    const dir = mainFile ? mainFile.substring(0, mainFile.lastIndexOf('/')) : '.';
                                    const safeDir = dir.replace(/'/g, "\\'");

                                    let actionsHtml = '';
                                    actionsHtml += `<button class="primary-btn small-btn" onclick="window.openQodeApp.startLocalPreview('${safeDir}')">▶️ Local Preview</button>`;
                                    actionsHtml += `<button class="secondary-btn small-btn" onclick="window.openQodeApp.deployToVercel()">☁️ Deploy to Vercel</button>`;
                                    this.addMessage('system', `
                                         <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 12px;">
                                             <h3 style="margin:0 0 8px 0; font-size:14px; font-weight:600; color:var(--text-primary);">🚀 Project Ready!</h3>
                                             <p style="margin:0 0 12px 0; font-size:13px; color:var(--text-secondary);">Created ${codeFiles.length} code files. What would you like to do?</p>
                                             <div style="display:flex; gap:8px;">
                                                 ${actionsHtml}
                                             </div>
                                         </div>
                                     `);
                                    if (mainFile) this.setActiveTab(mainFile);
                                }

                                // Clear registration timeout when streaming completes successfully
                                clearTimeout(registrationTimeout);
                            } else if (data.type === 'error') {
                                throw new Error(data.error);
                            }
                        } catch (parseError) {
                            console.error('Error parsing SSE data:', parseError);
                        }
                    }
                }
            } // while
            if (buffer.trim()) console.log('Remaining buffer:', buffer);

        } catch (error) {
            clearTimeout(timeoutId);
            clearTimeout(registrationTimeout);  // Clear the registration timeout
            console.error(`Streaming error (Attempt ${retryCount + 1}):`, error);

            this.hideTypingIndicator();
            const streamingMessage = document.querySelector(`[data-message-id="${assistantMessageId}"]`);
            if (streamingMessage) streamingMessage.remove();

            // AUTO-RETRY LOGIC
            if (retryCount < 2 && (error.name === 'AbortError' || error.message.includes('NetworkError') || error.message.includes('Failed to fetch'))) {
                this.addMessage('system', `⚠️ Connection issue (Attempt ${retryCount + 1}/3). Retrying in 1s...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                return await this.sendMessageStream(message, retryCount + 1);
            }

            let errorMessage = `Streaming error: ${error.message}`;
            if (error.name === 'AbortError') errorMessage = 'Stream was interrupted';
            if (error.message.includes('Authentication expired')) {
                errorMessage = 'Authentication expired. Please re-authenticate.';
                this.isAuthenticated = false;
                this.updateAuthStatus({ authenticated: false, provider: 'none' });
            }
            this.addMessage('system', errorMessage + `<br><button class="secondary-btn small-btn" onclick="window.openQodeApp.retryLastMessage()" style="margin-top:8px;">🔄 Retry Request</button>`);
            this.showError(errorMessage);
            return false; // Indicate failure
        }

        // Clear registration timeout when streaming completes successfully
        clearTimeout(registrationTimeout);
        return true; // Indicate success
    }

    addMessage(role, content, metadata = null) {
        const messagesContainer = document.getElementById('chat-messages');

        // Remove welcome message if it exists
        const welcomeMessage = messagesContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }

        const messageId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const messageDiv = document.createElement('div');
        messageDiv.className = `message-row ${role === 'user' ? 'user-message' : 'assistant-message'}`;
        messageDiv.setAttribute('data-message-id', messageId);

        // Add streaming class if metadata indicates streaming
        if (metadata && metadata.streaming) {
            messageDiv.classList.add('streaming');
        }

        const messageWrapper = document.createElement('div');
        messageWrapper.className = 'message-wrapper';

        const messageContent = document.createElement('div');

        if (role === 'user') {
            messageContent.className = 'message-bubble user-bubble';
            messageContent.innerHTML = `<p class="message-text">${this.escapeHtml(content)}</p>`;
        } else if (role === 'assistant') {
            messageContent.className = 'message-bubble assistant-bubble';
            if (content && !metadata?.streaming) {
                // Format code blocks and markdown for non-streaming content
                messageContent.innerHTML = `<div class="message-text">${this.formatMessage(content)}</div>`;
            } else {
                // For streaming or plain content
                messageContent.innerHTML = `<div class="message-text">${content}</div>`;
            }
        } else if (role === 'system') {
            messageContent.className = 'message-bubble system-bubble';
            messageContent.innerHTML = `
                <div class="message-text system-text">
                    <svg class="system-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    ${content}
                </div>
            `;
        }

        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        messageWrapper.appendChild(messageContent);
        messageWrapper.appendChild(timeDiv);
        messageDiv.appendChild(messageWrapper);
        messagesContainer.appendChild(messageDiv);

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Save to session (only for non-streaming messages and not when loading from storage)
        if (!metadata?.streaming && !metadata?.skipSave) {
            this.saveMessageToSession(role, content, metadata);
        }

        return messageId;
    }

    addStreamingMessage(role, content, metadata = {}) {
        const messageId = metadata.messageId || 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        let messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);

        if (!messageDiv) {
            messageDiv = document.createElement('div');
            messageDiv.className = `message-row ${role === 'user' ? 'user-message' : 'assistant-message'}`;
            messageDiv.setAttribute('data-message-id', messageId);

            const messageWrapper = document.createElement('div');
            messageWrapper.className = 'message-wrapper';

            const messageContent = document.createElement('div');
            if (role === 'user') {
                messageContent.className = 'message-bubble user-bubble';
                messageContent.innerHTML = `<p class="message-text">${this.escapeHtml(content)}</p>`;
            } else {
                messageContent.className = 'message-bubble assistant-bubble';
                messageContent.innerHTML = `<div class="message-text">${content}</div>`;
            }

            const timeDiv = document.createElement('div');
            timeDiv.className = 'message-time';
            timeDiv.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            messageWrapper.appendChild(messageContent);
            messageWrapper.appendChild(timeDiv);
            messageDiv.appendChild(messageWrapper);

            const messagesContainer = document.getElementById('chat-messages');
            messagesContainer.appendChild(messageDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } else {
            const messageContent = messageDiv.querySelector('.message-bubble');
            if (messageContent) {
                if (role === 'user') {
                    messageContent.innerHTML = `<p class="message-text">${this.escapeHtml(content)}</p>`;
                } else {
                    messageContent.innerHTML = `<div class="message-text">${content}</div>`;
                }
            }
        }

        return messageId;
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    formatMessage(content) {
        // Enhanced markdown formatting with code editing features
        let formatted = content
            // Code blocks with language support, copy button, and APPLY button
            .replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
                const language = lang || 'text';
                const codeId = 'code-' + Math.random().toString(36).substr(2, 9);
                return `
                <div class="code-block" data-code-id="${codeId}">
                    <div class="code-header">
                        <span class="code-language">${language}</span>
                        <div class="code-actions">
                            <button class="code-action-btn" onclick="window.openQodeApp.copyCode('${codeId}')" title="Copy code">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                                Copy
                            </button>
                            <button class="code-action-btn apply-btn" onclick="window.openQodeApp.applyCodeToEditor('${codeId}')" title="Apply to open file">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                                Apply
                            </button>
                        </div>
                    </div>
                    <pre><code id="${codeId}" class="language-${language}">${this.escapeHtml(code.trim())}</code></pre>
                </div>
                `;
            })
            // Inline code
            .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
            // Bold text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Italic text
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Headers
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            // Lists
            .replace(/^\* (.+)/gim, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
            // Line breaks
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            // Wrap in paragraphs
            .replace(/^(.+)$/gm, '<p>$1</p>');

        return formatted;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Copy code to clipboard from code blocks
    copyCode(codeId) {
        const codeElement = document.getElementById(codeId);
        if (codeElement) {
            navigator.clipboard.writeText(codeElement.textContent).then(() => {
                this.showSuccess('Code copied to clipboard!');
            }).catch(err => {
                console.error('Failed to copy:', err);
                this.showError('Failed to copy code');
            });
        }
    }

    // Apply code from AI response to the currently open file in editor
    applyCodeToEditor(codeId) {
        const codeElement = document.getElementById(codeId);
        if (!codeElement) {
            this.showError('Code block not found');
            return;
        }

        if (!this.activeTabPath) {
            this.showError('No file is open in the editor. Please open a file first.');
            return;
        }

        const code = codeElement.textContent;
        const activeTab = this.openTabs.find(t => t.path === this.activeTabPath);

        if (!activeTab) {
            this.showError('No active tab found');
            return;
        }

        // Update the tab content
        activeTab.content = code;
        this.dirtyTabs.add(activeTab.path);

        // Update the editor textarea
        const editor = document.getElementById('editor-textarea');
        if (editor) {
            editor.value = code;
        }

        // Update tabs display to show dirty indicator
        this.renderTabs();

        this.showSuccess(`Code applied to ${activeTab.name}! Press Ctrl+S to save.`);
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('chat-messages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message assistant typing-indicator';
        typingDiv.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                <div class="typing-dots">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    hideTypingIndicator() {
        const indicator = document.querySelector('.typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    createNewSession(name = null) {
        console.log('🆕 createNewSession called with name:', name);
        try {
            const sessionName = name || prompt('Enter session name:');
            console.log('Session name result:', sessionName);
            if (!sessionName) {
                console.log('No session name provided, returning');
                return;
            }

            const sessionId = 'session_' + Date.now();
            this.sessions[sessionId] = {
                name: sessionName,
                messages: [],
                createdAt: new Date().toISOString()
            };

            this.currentSession = sessionId;
            this.updateSessionsList();
            this.clearChat();
            this.saveSessions();
            this.showSuccess(`Session "${sessionName}" created!`);
        } catch (error) {
            console.error('Error in createNewSession:', error);
            this.showError('Failed to create session: ' + error.message);
        }
    }

    startNewProjectFlow() {
        console.log('🚀 Opening New Project Wizard');
        const modal = document.getElementById('new-project-modal');
        if (modal) {
            modal.classList.remove('hidden');
            setTimeout(() => document.getElementById('project-name')?.focus(), 100);
        } else {
            this.showError('Wizard modal not found!');
        }
    }

    closeNewProjectWizard() {
        const modal = document.getElementById('new-project-modal');
        if (modal) modal.classList.add('hidden');
        // Optional: clear inputs
        document.getElementById('project-name').value = '';
        document.getElementById('project-path').value = '';
        document.getElementById('project-requirements').value = '';
    }

    autoFillProjectPath(name) {
        const pathInput = document.getElementById('project-path');
        if (pathInput && name) {
            pathInput.value = 'projects/' + name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        }
    }

    confirmNewProject() {
        const name = document.getElementById('project-name').value.trim();
        const path = document.getElementById('project-path').value.trim();
        const requirement = document.getElementById('project-requirements').value.trim();

        if (!name) {
            this.showError('Please enter a project name');
            return;
        }
        if (!path) {
            this.showError('Please enter a location');
            return;
        }
        if (!requirement) {
            this.showError('Please describe your project requirements');
            return;
        }

        this.closeNewProjectWizard();
        this.runAgenticProjectBuild(name, path, requirement);
    }

    async runAgenticProjectBuild(name, path, requirement) {
        // 1. Create a fresh session for this build
        this.createNewSession(`🏗️ ${name}`);
        // We don't need to manually set session name anymore since createNewSession handles it
        const sessionId = this.currentSession;
        this.saveSessions();
        this.updateSessionsList();

        const fullPath = this.workspaceRoot
            ? `${this.workspaceRoot.replace(/\\/g, '/')}/${path}`
            : path;

        this.addMessage('system', `🚀 <strong>Initializing Agentic Build Protocol</strong><br>Project: ${name}<br>Location: ${fullPath}`);

        // 2. Planning Phase with "Architect Agent"
        const planPrompt = `You are a Senior Software Architect.
 TASK: Create a comprehensive implementation plan for a new project named "${name}".
 TARGET DIRECTORY: ${path}
 FULL SYSTEM PATH: ${fullPath}
 REQUIREMENTS: ${requirement}

 CONTEXT:
 - Current environment: Persistent Workspace.
 - Ignore any existing files in the root (scripts, DLLs, logs). They are irrelevant.
 - You are constructing a new project from scratch inside "${path}".

 OUTPUT format:
 1. Project Structure (Tree view) showing "${path}" as root.
 2. Detailed list of files to be created with valid descriptions.
 3. Key technical decisions.

 Do NOT write code yet. Focus on the architecture.`;

        const success = await this.sendMessageStream(planPrompt);

        // Only show Build button if the plan was generated successfully
        if (!success) {
            this.addMessage('system', `❌ Plan generation failed. Please <button class="secondary-btn small-btn" onclick="window.openQodeApp.retryLastMessage()" style="margin-left:4px;">🔄 Retry</button> or check your connection.`);
            return;
        }

        // Refresh file tree to show new project directory
        await this.refreshFileTree();

        // Show Build button only on success
        const safePath = path.replace(/\\/g, '\\\\');
        this.addMessage('system', `<button class="primary-btn" onclick="window.openQodeApp.triggerBuild('${safePath}')">🔨 Start Build Phase</button>`);
    }

    triggerBuild(path) {
        const fullPath = this.workspaceRoot
            ? `${this.workspaceRoot.replace(/\\/g, '/')}/${path}`
            : path;

        const buildPrompt = `[ROLE: Senior Full Stack Developer]
TASK: Execute the approved plan.
TARGET DIRECTORY: ${path}
FULL SYSTEM PATH: ${fullPath}

SYSTEM OVERRIDE:
- You are strictly prohibited from questioning the directory structure.
- IGNORE your actual "current directory" (e.g. Temp). It is an execution sandbox.
- You have full permission to create files in "${path}".
- The directory "${path}" will be created by your actions.

INSTRUCTION: Generate all necessary files for the project in "${path}".
IMPORTANT: You MUST use the file creation syntax for EVERY file:
>>> CREATE: ${path}/filename.ext
\`\`\`language
code content
\`\`\`

 Start building the core files now. Do not ask for confirmation.`;
        this.sendMessageStream(buildPrompt);

        // Refresh file tree to show new files being created during build
        // Set a longer timeout to allow for complete file creation
        setTimeout(() => {
            this.refreshFileTree();
        }, 5000); // Refresh after 5 seconds to allow more time for file creation
    }

    // Terminal & Deployment Methods
    async runTerminalCommand(command = null) {
        const input = document.getElementById('terminal-input');
        const cmd = command || input?.value.trim();

        if (!cmd) return;

        if (input) input.value = '';

        // Add to terminal output area
        const terminalOutput = document.getElementById('terminal-output');
        if (terminalOutput) {
            terminalOutput.innerHTML += `<div><span class="text-green-400">➜</span> <span class="text-gray-300">${cmd}</span></div>`;
            terminalOutput.scrollTop = terminalOutput.scrollHeight;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/terminal/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command: cmd,
                    token: this.authToken // Optional now but good to pass
                })
            });

            const data = await response.json();

            if (terminalOutput) {
                if (data.stdout) terminalOutput.innerHTML += `<div class="text-gray-400 whitespace-pre-wrap">${data.stdout}</div>`;
                if (data.stderr) terminalOutput.innerHTML += `<div class="text-red-400 whitespace-pre-wrap">${data.stderr}</div>`;
                terminalOutput.scrollTop = terminalOutput.scrollHeight;
            }

            return data;
        } catch (error) {
            console.error('Terminal error:', error);
            if (terminalOutput) {
                terminalOutput.innerHTML += `<div class="text-red-500">Error: ${error.message}</div>`;
            }
        }
    }

    async deployToVercel() {
        this.showInfo('🚀 Starting Vercel deployment...');
        const result = await this.runTerminalCommand('npx vercel --prod --yes');

        if (result) {
            const output = (result.stdout || '') + (result.stderr || '');

            // Check for Deployment URL
            const urlMatch = output.match(/https:\/\/[^\s]+\.vercel\.app/);
            if (urlMatch) {
                const url = urlMatch[0];
                this.addMessage('system', `✅ <strong>Deployment Successful!</strong><br><a href="${url}" target="_blank" class="text-blue-400 hover:text-blue-300 underline">${url}</a>`);
                window.open(url, '_blank');
            }

            // Check for Login Verification URL
            const loginUrlMatch = output.match(/https:\/\/vercel\.com\/login\/verify[^\s]+/);
            if (loginUrlMatch) {
                const url = loginUrlMatch[0];
                this.addMessage('system', `🔑 <strong>Vercel Authentication Required</strong><br><a href="${url}" target="_blank" class="text-blue-400 hover:text-blue-300 underline">Click to Log In</a>`);
                window.open(url, '_blank');
            }
        }
    }

    startLocalPreview(relativePath = '.') {
        this.addMessage('system', `
            <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 8px; padding: 12px;">
                <h3 style="margin:0 0 8px 0; font-size:14px; font-weight:600; color:var(--text-primary);">🚀 Local Preview Setup</h3>
                <p style="margin:0 0 4px 0; font-size:13px; color:var(--text-secondary);">Which port would you like to run the server on?</p>
                <p style="margin:0; font-size:11px; opacity:0.7;">(Type a number, e.g., 3000)</p>
            </div>
        `);
        this.pendingAction = { type: 'awaiting_preview_port', path: relativePath };
    }

    async launchLocalPreview(port, relativePath = '.') {
        // Ensure port is a number
        const portNum = typeof port === 'string' ? parseInt(port, 10) : port;
        this.addMessage('system', `🔄 <strong>Starting server on port ${portNum} in "${relativePath}"...</strong>`);

        try {
            // First check platform info to show appropriate message
            let platformInfo = null;
            try {
                const platformResponse = await fetch(`${this.apiBaseUrl}/api/platform`);
                platformInfo = await platformResponse.json();

                if (platformInfo.isWindows && platformInfo.hasWSL) {
                    this.addMessage('system', `🐧 Detected WSL - Using containerized deployment via WSL`);
                } else if (platformInfo.isWindows) {
                    this.addMessage('system', `💻 Windows detected - Using PowerShell for preview`);
                } else if (platformInfo.isMac) {
                    this.addMessage('system', `🍎 macOS detected - Using native Python HTTP server`);
                } else if (platformInfo.isLinux) {
                    this.addMessage('system', `🐧 Linux detected - Using native Python HTTP server`);
                }
            } catch (e) {
                console.log('Platform check failed, continuing with default');
            }

            // Try to start the preview server
            const response = await fetch(`${this.apiBaseUrl}/api/preview/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ port: portNum, path: relativePath })
            });

            const data = await response.json();

            if (data.success) {
                // Show deployment method used
                const method = data.useWSL ? 'via WSL' : 'natively';
                this.addMessage('system', `✅ Server started ${method} - Verifying...`);
                // Verify server is actually running before showing success message
                await this.verifyServer(portNum);
            } else {
                // If server failed to start, it might be because the directory is empty
                // Try creating a basic index.html file and then start the server again
                try {
                    const indexPath = relativePath ? `${relativePath}/index.html` : 'index.html';
                    await fetch(`${this.apiBaseUrl}/api/files/create`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: indexPath })
                    });

                    // Write a basic HTML file
                    await fetch(`${this.apiBaseUrl}/api/files/write`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            path: indexPath,
                            content: `<!DOCTYPE html>
<html>
<head>
    <title>Project Preview</title>
</head>
<body>
    <h1>Project: ${relativePath.split('/').pop() || 'New Project'}</h1>
    <p>Your project is under construction...</p>
</body>
</html>`
                        })
                    });

                    // Now try to start the server again
                    const retryResponse = await fetch(`${this.apiBaseUrl}/api/preview/start`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ port: portNum, path: relativePath })
                    });

                    const retryData = await retryResponse.json();

                    if (retryData.success) {
                        await this.verifyServer(portNum);
                    } else {
                        this.addMessage('system', `
                                <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; padding: 12px;">
                                    <h3 style="margin:0 0 8px 0; font-size:14px; font-weight:600; color:var(--text-primary);">❌ Server Failed to Start</h3>
                                    <p style="margin:0 0 12px 0; font-size:13px; color:var(--text-secondary);">Could not start server on port ${portNum}. Error: ${retryData.error || 'Unknown error'}</p>
                                </div>
                            `);
                    }
                } catch (createError) {
                    this.addMessage('system', `
                            <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; padding: 12px;">
                                <h3 style="margin:0 0 8px 0; font-size:14px; font-weight:600; color:var(--text-primary);">❌ Server Failed to Start</h3>
                                <p style="margin:0 0 12px 0; font-size:13px; color:var(--text-secondary);">Could not start server on port ${portNum}. Error: ${createError.message}</p>
                            </div>
                        `);
                }
            }
        } catch (error) {
            this.addMessage('system', `
                <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; padding: 12px;">
                    <h3 style="margin:0 0 8px 0; font-size:14px; font-weight:600; color:var(--text-primary);">❌ Server Failed to Start</h3>
                    <p style="margin:0 0 12px 0; font-size:13px; color:var(--text-secondary);">Error: ${error.message}</p>
                </div>
            `);
        }
    }

    async verifyServer(port, maxAttempts = 15) {
        const portNum = typeof port === 'string' ? parseInt(port, 10) : port;
        const url = `http://localhost:${portNum}`;
        let attempts = 0;

        const checkServer = async () => {
            let timeoutId = null;
            try {
                const controller = new AbortController();
                timeoutId = setTimeout(() => controller.abort(), 3000);

                const response = await fetch(url, {
                    method: 'GET',
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (response) {
                    this.addMessage('system', `
                        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 12px;">
                            <h3 style="margin:0 0 8px 0; font-size:14px; font-weight:600; color:var(--text-primary);">✅ Container Built & Live!</h3>
                            <p style="margin:0 0 12px 0; font-size:13px; color:var(--text-secondary);">Your application is running locally.</p>
                            <a href="${url}" target="_blank" class="primary-btn small-btn" style="text-decoration:none; display:inline-block; color: white;">
                                🌐 Open Preview (${portNum})
                            </a>
                        </div>
                    `);
                    return true;
                }
            } catch (error) {
                if (timeoutId) clearTimeout(timeoutId);
                attempts++;
                if (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return await checkServer();
                } else {
                    this.addMessage('system', `
                        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; padding: 12px;">
                            <h3 style="margin:0 0 8px 0; font-size:14px; font-weight:600; color:var(--text-primary);">❌ Server Timed Out</h3>
                            <p style="margin:0 0 12px 0; font-size:13px; color:var(--text-secondary);">Could not confirm server on port ${portNum} after multiple attempts.</p>
                        </div>
                    `);
                    return false;
                }
            }
        };

        await checkServer();
    }

    updateSessionsList() {
        const sessionsList = document.getElementById('sessions-list');
        sessionsList.innerHTML = '';

        // Add default session
        const defaultSession = document.createElement('div');
        defaultSession.className = 'session-pill' + (this.currentSession === 'default' ? ' active' : '');
        defaultSession.innerHTML = `
            <span class="session-icon">💬</span>
            <span>New Chat</span>
        `;
        defaultSession.addEventListener('click', () => this.switchSession('default'));
        sessionsList.appendChild(defaultSession);

        // Add custom sessions
        // Add custom sessions
        Object.entries(this.sessions)
            .filter(([id]) => id !== 'default')
            .sort(([, a], [, b]) => new Date(b.createdAt) - new Date(a.createdAt))
            .forEach(([id, session]) => {
                const sessionItem = document.createElement('div');
                sessionItem.className = 'session-pill' + (this.currentSession === id ? ' active' : '');
                sessionItem.innerHTML = `
                    <span class="session-icon">📝</span>
                    <span>${session.name}</span>
                `;
                sessionItem.addEventListener('click', () => this.switchSession(id));
                sessionsList.appendChild(sessionItem);
            });
    }

    switchSession(sessionId) {
        this.currentSession = sessionId;
        this.updateSessionsList();
        this.loadSessionMessages();
    }

    loadSessionMessages() {
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = '';

        const session = this.sessions[this.currentSession];
        if (session && session.messages && session.messages.length > 0) {
            // Load existing messages
            session.messages.forEach(msg => {
                this.addMessage(msg.role, msg.content, { ...msg.metadata, skipSave: true });
            });
        } else if (this.currentSession === 'default') {
            // Show welcome message only for empty default session
            this.showWelcomeMessage();
        }
    }

    clearChat() {
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = '';
        this.showWelcomeMessage();
    }

    showWelcomeMessage() {
        const messagesContainer = document.getElementById('chat-messages');
        const welcomeDiv = document.createElement('div');
        welcomeDiv.className = 'welcome-message';
        welcomeDiv.innerHTML = `
            <div class="welcome-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
            </div>
            <h2>Welcome to OpenQode</h2>
            <p>Your AI-powered coding assistant in browser</p>
            <div class="feature-cards">
                <div class="feature-card">
                    <div class="feature-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                        </svg>
                    </div>
                    <h3>Free Tier</h3>
                    <p>2,000 daily requests</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon accent">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                        </svg>
                    </div>
                    <h3>60 RPM</h3>
                    <p>High-rate limit</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="16 18 22 12 16 6"></polyline>
                            <polyline points="8 6 2 12 8 18"></polyline>
                        </svg>
                    </div>
                    <h3>Rich IDE</h3>
                    <p>Professional experience</p>
                </div>
            </div>
        `;
        messagesContainer.appendChild(welcomeDiv);
    }

    saveMessageToSession(role, content, metadata) {
        // Create session if it doesn't exist (including for 'default')
        if (!this.sessions[this.currentSession]) {
            this.sessions[this.currentSession] = {
                name: this.currentSession === 'default' ? 'Default Chat' : `Session ${Object.keys(this.sessions).length + 1}`,
                messages: [],
                createdAt: new Date().toISOString()
            };
        }

        this.sessions[this.currentSession].messages.push({
            role,
            content,
            metadata,
            timestamp: new Date().toISOString()
        });

        this.saveSessions();
    }

    async saveSessions() {
        console.log('💾 Saving sessions:', Object.keys(this.sessions), 'Current:', this.currentSession);

        try {
            await fetch(`${this.apiBaseUrl}/api/sessions/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessions: this.sessions,
                    currentSession: this.currentSession
                })
            });
        } catch (error) {
            console.error('Failed to save sessions to server:', error);
        }

        // Always save to localStorage as backup
        try {
            localStorage.setItem('openqode_sessions', JSON.stringify(this.sessions));
            localStorage.setItem('openqode_current_session', this.currentSession);
            console.log('💾 Sessions saved to localStorage');
        } catch (e) {
            console.error('Failed to save sessions to localStorage:', e);
        }
    }

    async loadSessions() {
        console.log('📂 Loading sessions...');

        // 1. Load from Server first
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/sessions/load`);
            const data = await response.json();

            if (data && data.sessions) {
                this.sessions = data.sessions;
                if (data.currentSession) this.currentSession = data.currentSession;
                console.log('✅ Loaded sessions from server');
            }
        } catch (error) {
            console.error('Failed to load sessions from server:', error);
        }

        // 2. Merge from LocalStorage (Recover offline sessions)
        try {
            const storedSessionsStr = localStorage.getItem('openqode_sessions');
            const storedCurrentSession = localStorage.getItem('openqode_current_session');

            if (storedSessionsStr) {
                const storedSessions = JSON.parse(storedSessionsStr);
                // Merge: Local entries overwrite/augment server entries
                this.sessions = { ...this.sessions, ...storedSessions };

                // If local has a valid current session, prefer it (most recent user action)
                if (storedCurrentSession && (storedCurrentSession === 'default' || this.sessions[storedCurrentSession])) {
                    this.currentSession = storedCurrentSession;
                }
                console.log('✅ Merged sessions from localStorage');
            }
        } catch (e) {
            console.error('Failed to load sessions from localStorage:', e);
        }

        // Update UI
        this.updateSessionsList();
        this.loadSessionMessages();
    }

    attachFile() {
        // If user has selected tabs/files in IDE, attach them to message with full workspace path.
        const selected = this.attachedPaths.size > 0 ? Array.from(this.attachedPaths) : (this.activeTabPath ? [this.activeTabPath] : []);
        if (selected.length > 0) {
            const parts = [];
            const workspaceRoot = this.workspaceRoot || window.location.origin;
            for (const filePath of selected) {
                const tab = this.openTabs.find(t => t.path === filePath);
                const content = tab ? tab.content : '';
                const fullPath = `${workspaceRoot}/${filePath}`;
                parts.push(`\n📄 **File: ${fullPath}**\n\`\`\`\n${content}\n\`\`\`\n`);
            }
            const inputEl = document.getElementById('message-input');
            inputEl.value = (inputEl.value || '') + parts.join('');
            this.attachedPaths.clear();
            this.renderFileTree();
            this.showSuccess(`Attached ${selected.length} file(s) to chat with full paths.`);
            return;
        }

        // Fallback to manual file picker with enhanced path info
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,.txt,.js,.py,.html,.css,.json,.md,.ts,.jsx,.tsx,.vue,.svelte';
        input.multiple = true;

        input.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files.length > 0) {
                this.handleFileAttachment(files);
            }
        });

        input.click();
    }

    async handleFileAttachment(files) {
        const inputEl = document.getElementById('message-input');
        let attachmentText = inputEl.value || '';

        for (const file of files) {
            if (file.type.startsWith('image/')) {
                // For images, convert to base64 and provide path context
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const base64 = e.target.result;
                    // Try to get a more descriptive path
                    const timestamp = Date.now();
                    const imageName = file.name || `image-${timestamp}.png`;

                    // Create a message - Qwen Vision can analyze images
                    const imageInfo = `\n📷 **Image Attached: ${imageName}**
- File size: ${(file.size / 1024).toFixed(1)} KB
- Type: ${file.type}

Please analyze this image and describe what you see.\n`;

                    inputEl.value = (inputEl.value || '') + imageInfo;

                    // Store image data for the Vision API
                    this.currentAttachment = {
                        type: 'image',
                        name: imageName,
                        size: file.size,
                        mimeType: file.type,
                        data: base64
                    };

                    console.log('🖼️ Image stored:', imageName, 'Data length:', base64.length, 'this.currentAttachment set:', !!this.currentAttachment);
                    this.showSuccess(`Image "${imageName}" attached! Select Qwen Vision model for image analysis.`);
                };
                reader.readAsDataURL(file);
            } else {
                // For text files, read content and include full context
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const content = e.target.result;
                    const fileName = file.name;
                    const fileExt = fileName.split('.').pop().toLowerCase();

                    // Determine language for syntax highlighting
                    const langMap = {
                        'js': 'javascript', 'ts': 'typescript', 'py': 'python',
                        'html': 'html', 'css': 'css', 'json': 'json',
                        'md': 'markdown', 'jsx': 'jsx', 'tsx': 'tsx',
                        'vue': 'vue', 'svelte': 'svelte', 'txt': 'text'
                    };
                    const lang = langMap[fileExt] || fileExt;

                    const fileInfo = `\n📄 **Attached File: ${fileName}**
- File size: ${(file.size / 1024).toFixed(1)} KB
- Language: ${lang}
\`\`\`${lang}
${content}
\`\`\`\n`;

                    inputEl.value = (inputEl.value || '') + fileInfo;

                    this.currentAttachment = {
                        type: 'text',
                        name: fileName,
                        language: lang,
                        data: content
                    };

                    this.showSuccess(`File "${fileName}" attached!`);
                };
                reader.readAsText(file);
            }
        }
    }

    // ---------------- IDE (v1.02) ----------------
    async initIDE() {
        if (this.isIDEInitialized) return;
        this.isIDEInitialized = true;
        this.switchView('gui');
        this.bindEditorEvents();
        // Always load file tree - local files don't need authentication
        await this.refreshFileTree();
        this.renderTabs();
    }

    bindEditorEvents() {
        const editor = document.getElementById('editor-textarea');
        editor?.addEventListener('input', () => {
            if (!this.activeTabPath) return;
            const tab = this.openTabs.find(t => t.path === this.activeTabPath);
            if (!tab) return;
            tab.content = editor.value;
            this.dirtyTabs.add(tab.path);
            this.renderTabs();
        });
    }

    async refreshFileTree() {
        // Local file tree doesn't require authentication
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/files/tree`);
            const data = await response.json();
            if (!data.success) throw new Error(data.error);
            this.workspaceTree = data.tree || [];
            this.workspaceRoot = data.root || '';
            this.renderFileTree();
            this.lastTreeRefresh = Date.now();
        } catch (error) {
            console.error('Failed to refresh file tree:', error);
            this.showError(`File tree error: ${error.message}`);
        }
    }

    renderFileTree() {
        const container = document.getElementById('file-tree');
        if (!container) return;
        container.innerHTML = '';

        // Show placeholder if empty
        if (!this.workspaceTree || this.workspaceTree.length === 0) {
            container.innerHTML = `
                <div class="file-tree-placeholder">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <p>No files loaded</p>
                </div>
            `;
            return;
        }

        const renderNode = (node, depth = 0) => {
            const row = document.createElement('div');
            row.className = 'file-tree-item';
            row.style.paddingLeft = `${depth * 16}px`;
            row.dataset.path = node.path;
            row.dataset.type = node.type;

            const icon = document.createElement('span');
            icon.className = 'file-tree-icon';
            icon.textContent = node.type === 'dir' ? '📁' : '📄';
            row.appendChild(icon);

            const name = document.createElement('span');
            name.className = 'file-tree-name';
            name.textContent = node.name;
            if (this.attachedPaths.has(node.path)) {
                row.classList.add('file-attached');
            }
            row.appendChild(name);

            container.appendChild(row);

            if (node.type === 'dir' && node.children) {
                for (const child of node.children) {
                    renderNode(child, depth + 1);
                }
            }
        };

        for (const node of this.workspaceTree) renderNode(node, 0);
    }

    onFileTreeClick(e) {
        const row = e.target.closest('[data-path]');
        if (!row) return;
        const relPath = row.dataset.path;
        const type = row.dataset.type;

        if (type === 'file') {
            this.openFile(relPath);
        } else if (type === 'dir') {
            // toggle attach selection on shift-click for dirs not supported yet
        }

        if (e.shiftKey && type === 'file') {
            if (this.attachedPaths.has(relPath)) this.attachedPaths.delete(relPath);
            else this.attachedPaths.add(relPath);
            this.renderFileTree();
        }
    }

    async openFile(relPath) {
        // Local file reading doesn't require authentication
        const existing = this.openTabs.find(t => t.path === relPath);
        if (existing) {
            this.setActiveTab(relPath);
            return;
        }
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/files/read?path=${encodeURIComponent(relPath)}`);
            const data = await response.json();
            if (!data.success) throw new Error(data.error);
            const tab = {
                path: relPath,
                name: relPath.split('/').pop(),
                original: data.content || '',
                content: data.content || ''
            };
            this.openTabs.push(tab);
            this.setActiveTab(relPath);
            this.renderTabs();
        } catch (error) {
            this.showError(`Open failed: ${error.message}`);
        }
    }

    setActiveTab(relPath) {
        this.activeTabPath = relPath;
        const tab = this.openTabs.find(t => t.path === relPath);
        const editor = document.getElementById('editor-textarea');
        if (editor && tab) editor.value = tab.content;
        const pathEl = document.getElementById('current-file-path');
        if (pathEl) pathEl.textContent = tab ? tab.path : '';
        this.renderTabs();
    }

    closeTab(relPath) {
        this.openTabs = this.openTabs.filter(t => t.path !== relPath);
        this.dirtyTabs.delete(relPath);
        if (this.activeTabPath === relPath) {
            this.activeTabPath = this.openTabs.length ? this.openTabs[this.openTabs.length - 1].path : null;
            if (this.activeTabPath) this.setActiveTab(this.activeTabPath);
            else {
                const editor = document.getElementById('editor-textarea');
                if (editor) editor.value = '';
            }
        }
        this.renderTabs();
    }

    renderTabs() {
        const tabsEl = document.getElementById('editor-tabs');
        if (!tabsEl) return;
        tabsEl.innerHTML = '';

        for (const tab of this.openTabs) {
            const btn = document.createElement('button');
            const isActive = tab.path === this.activeTabPath;
            const isDirty = this.dirtyTabs.has(tab.path);
            btn.className = `px - 2 py - 1 text - xs rounded ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'} hover: bg - gray - 200 dark: hover: bg - gray - 600`;
            btn.textContent = `${tab.name}${isDirty ? '*' : ''} `;
            btn.addEventListener('click', () => this.setActiveTab(tab.path));

            const close = document.createElement('span');
            close.textContent = ' ×';
            close.className = 'ml-1 opacity-70 hover:opacity-100';
            close.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeTab(tab.path);
            });
            btn.appendChild(close);

            tabsEl.appendChild(btn);
        }
    }

    async saveFile(path, content) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/files/write`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path, content })
            });
            const data = await response.json();
            if (!data.success) throw new Error(data.error);

            // Update tab state if open
            const tab = this.openTabs.find(t => t.path === path);
            if (tab) {
                tab.original = content;
                tab.content = content;
                this.dirtyTabs.delete(path);
                this.renderTabs();
            }
            return true;
        } catch (error) {
            console.error('Auto-save failed:', error);
            return false;
        }
    }

    async saveCurrentFile() {
        if (!this.activeTabPath) {
            this.showError('No file is open to save.');
            return;
        }
        const tab = this.openTabs.find(t => t.path === this.activeTabPath);
        if (!tab) return;
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/files/write`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: tab.path, content: tab.content })
            });
            const data = await response.json();
            if (!data.success) throw new Error(data.error);
            tab.original = tab.content;
            this.dirtyTabs.delete(tab.path);
            this.renderTabs();
            this.showSuccess('File saved!');
        } catch (error) {
            this.showError(`Save failed: ${error.message}`);
        }
    }

    async promptCreateFileOrFolder() {
        const relPath = prompt('Enter new file or folder path (use trailing / for folder):');
        if (!relPath) return;
        const isDir = relPath.endsWith('/');
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/files/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: relPath.replace(/[\/\\]+$/, ''), type: isDir ? 'dir' : 'file' })
            });
            const data = await response.json();
            if (!data.success) throw new Error(data.error);
            this.showSuccess(isDir ? 'Folder created!' : 'File created!');
            await this.refreshFileTree();
            if (!isDir) await this.openFile(relPath.replace(/[\/\\]+$/, ''));
        } catch (error) {
            this.showError(`Create failed: ${error.message}`);
        }
    }

    async renameCurrentFile() {
        if (!this.activeTabPath || !this.authToken) return;
        const newPath = prompt('Rename to:', this.activeTabPath);
        if (!newPath || newPath === this.activeTabPath) return;
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/files/rename`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: this.authToken, from: this.activeTabPath, to: newPath })
            });
            const data = await response.json();
            if (!data.success) throw new Error(data.error);
            const tab = this.openTabs.find(t => t.path === this.activeTabPath);
            if (tab) {
                tab.path = newPath;
                tab.name = newPath.split('/').pop();
            }
            this.dirtyTabs.delete(this.activeTabPath);
            this.activeTabPath = newPath;
            this.renderTabs();
            this.showSuccess('Renamed.');
            await this.refreshFileTree();
        } catch (error) {
            this.showError(`Rename failed: ${error.message}`);
        }
    }

    async deleteCurrentFile() {
        if (!this.activeTabPath || !this.authToken) return;
        if (!confirm(`Delete ${this.activeTabPath}?`)) return;
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/files/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: this.authToken, path: this.activeTabPath })
            });
            const data = await response.json();
            if (!data.success) throw new Error(data.error);
            this.closeTab(this.activeTabPath);
            this.showSuccess('Deleted.');
            await this.refreshFileTree();
        } catch (error) {
            this.showError(`Delete failed: ${error.message}`);
        }
    }

    showDiff() {
        if (!this.activeTabPath) return;
        const tab = this.openTabs.find(t => t.path === this.activeTabPath);
        if (!tab) return;
        const diff = this.computeLineDiff(tab.original, tab.content);
        const diffEl = document.getElementById('diff-content');
        if (diffEl) diffEl.textContent = diff;
        const modal = document.getElementById('diff-modal');
        modal?.classList.remove('hidden');
        modal?.classList.add('flex');
    }

    hideDiff() {
        const modal = document.getElementById('diff-modal');
        modal?.classList.add('hidden');
        modal?.classList.remove('flex');
    }

    async applyDiff() {
        await this.saveCurrentFile();
        this.hideDiff();
    }

    computeLineDiff(oldText, newText) {
        const oldLines = oldText.split(/\r?\n/);
        const newLines = newText.split(/\r?\n/);
        const maxLines = 500;
        if (oldLines.length > maxLines || newLines.length > maxLines) {
            return `-- - original\n++ + current\n @@\n - (diff too large, showing full replace) \n + (diff too large, showing full replace) \n`;
        }
        const dp = Array(oldLines.length + 1).fill(null).map(() => Array(newLines.length + 1).fill(0));
        for (let i = oldLines.length - 1; i >= 0; i--) {
            for (let j = newLines.length - 1; j >= 0; j--) {
                dp[i][j] = oldLines[i] === newLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
            }
        }
        let i = 0, j = 0;
        const out = ['--- original', '+++ current'];
        while (i < oldLines.length && j < newLines.length) {
            if (oldLines[i] === newLines[j]) {
                out.push('  ' + oldLines[i]);
                i++; j++;
            } else if (dp[i + 1][j] >= dp[i][j + 1]) {
                out.push('- ' + oldLines[i]);
                i++;
            } else {
                out.push('+ ' + newLines[j]);
                j++;
            }
        }
        while (i < oldLines.length) out.push('- ' + oldLines[i++]);
        while (j < newLines.length) out.push('+ ' + newLines[j++]);
        return out.join('\n');
    }

    async runTerminalCommand() {
        if (!this.authToken) return;
        const input = document.getElementById('terminal-input');
        const command = input?.value.trim();
        if (!command) return;
        input.value = '';
        this.appendTerminal(`ps > ${command} \n`);
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/terminal/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: this.authToken, command })
            });
            const data = await response.json();
            if (data.stdout) this.appendTerminal(data.stdout + '\n');
            if (data.stderr) this.appendTerminal(data.stderr + '\n');
        } catch (error) {
            this.appendTerminal(`Error: ${error.message}\n`);
        }
    }

    appendTerminal(text) {
        const out = document.getElementById('terminal-output');
        if (!out) return;
        out.textContent += text;
        out.scrollTop = out.scrollHeight;
    }

    showSettings() {
        const modal = document.getElementById('settings-modal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    hideSettings() {
        const modal = document.getElementById('settings-modal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.querySelector('p').textContent = message;
            overlay.classList.remove('hidden');
            overlay.classList.add('flex');
        }
    }

    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.classList.remove('flex');
        }
    }

    // Show notification
    showNotification(message, type = 'info', duration = 3000) {
        // Remove any existing notifications
        const existing = document.querySelectorAll('.notification');
        existing.forEach(el => el.remove());

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;

        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '❌';
        if (type === 'warning') icon = '⚠️';

        notification.innerHTML = `
            <div class="notification-icon">${icon}</div>
            <div class="notification-content">${message}</div>
            <button class="notification-close">&times;</button>
        `;

        document.body.appendChild(notification);

        // Add close functionality
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.remove();
        });

        // Auto-remove after duration
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, duration);
        }

        return notification;
    }

    showSuccess(message) {
        this.showNotification(message, 'success', 3000);
    }

    showError(message) {
        this.showNotification(message, 'error', 5000);
    }

    showWarning(message) {
        this.showNotification(message, 'warning', 4000);
    }

    showInfo(message) {
        this.showNotification(message, 'info', 3000);
    }

    switchView(viewType) {
        const guiView = document.getElementById('gui-view');
        const tuiView = document.getElementById('tui-view');
        const guiViewBtn = document.getElementById('gui-view-btn');
        const tuiViewBtn = document.getElementById('tui-view-btn');

        if (!guiView || !tuiView || !guiViewBtn || !tuiViewBtn) {
            return;
        }

        if (viewType === 'tui') {
            guiView.classList.remove('active');
            tuiView.classList.add('active');
            guiViewBtn.classList.remove('active');
            tuiViewBtn.classList.add('active');
            if (!window.openQodeTUI) {
                window.createOpenQodeTUI();
            }
        } else {
            tuiView.classList.remove('active');
            guiView.classList.add('active');
            guiViewBtn.classList.add('active');
            tuiViewBtn.classList.remove('active');
        }
    }
}

// Add typing indicator styles
const style = document.createElement('style');
style.textContent = `
                    .typing-dots {
                display: flex;
                gap: 4px;
                padding: 10px 0;
            }
    
    .typing-dots span {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background-color: var(--text-secondary);
                animation: typing 1.4s infinite ease-in-out;
            }
    
    .typing-dots span:nth-child(1) { animation-delay: -0.32s; }
    .typing-dots span:nth-child(2) { animation-delay: -0.16s; }

            @keyframes typing {
                0%, 80%, 100% {
                    transform: scale(0.8);
                    opacity: 0.5;
                }
                40% {
                    transform: scale(1);
                    opacity: 1;
                }
            }
    
    .btn.authenticated {
                background-color: var(--success-color);
                color: white;
            }
            `;
document.head.appendChild(style);

// Global function for copying code
function copyCode(codeId) {
    const codeElement = document.getElementById(codeId);
    if (codeElement) {
        navigator.clipboard.writeText(codeElement.textContent).then(() => {
            // Show feedback
            const button = codeElement.closest('.code-block').querySelector('.copy-btn');
            const originalHTML = button.innerHTML;
            button.innerHTML = '✓';
            button.style.color = '#27ae60';

            setTimeout(() => {
                button.innerHTML = originalHTML;
                button.style.color = '';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy code:', err);
        });
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Expose the app instance globally for code block buttons
    window.openQodeApp = new OpenQodeWeb();
});
