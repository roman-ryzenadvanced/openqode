// Web Assist - TUI Companion
const API_BASE = 'http://127.0.0.1:15044';

class WebAssist {
    constructor() {
        this.currentFile = null;
        this.previewPort = null;
        this.vercelLoggedIn = false;
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadFileTree();
        await this.loadGitStatus();
        await this.checkVercelAuth();
    }

    bindEvents() {
        document.getElementById('refresh-btn').addEventListener('click', () => this.loadFileTree());
        document.getElementById('preview-btn').addEventListener('click', () => this.startPreview());
        document.getElementById('stop-preview-btn').addEventListener('click', () => this.stopPreview());
        document.getElementById('commit-btn').addEventListener('click', () => this.gitCommit());
        document.getElementById('push-btn').addEventListener('click', () => this.gitPush());
        document.getElementById('deploy-btn').addEventListener('click', () => this.deployVercel());
        document.getElementById('vercel-login-btn').addEventListener('click', () => this.vercelLogin());

        // File tree click delegation
        document.getElementById('file-tree').addEventListener('click', (e) => {
            const fileItem = e.target.closest('.file-item');
            if (fileItem && fileItem.dataset.type !== 'dir') {
                this.openFile(fileItem.dataset.path);
            }
        });
    }

    // === File Browser ===
    async loadFileTree() {
        const container = document.getElementById('file-tree');
        container.innerHTML = '<div class="loading">Loading...</div>';

        try {
            const response = await fetch(`${API_BASE}/api/files/tree`);
            const data = await response.json();

            if (data.success) {
                document.getElementById('project-path').textContent = `📂 ${data.root.split(/[/\\]/).pop()}`;
                container.innerHTML = this.renderTree(data.tree, 0);
            } else {
                container.innerHTML = '<div class="loading">Failed to load</div>';
            }
        } catch (error) {
            container.innerHTML = `<div class="loading">Error: ${error.message}</div>`;
        }
    }

    renderTree(items, depth) {
        if (!items || items.length === 0) return '';

        return items
            .filter(item => !item.name.startsWith('.') && item.name !== 'node_modules')
            .sort((a, b) => {
                if (a.type === 'dir' && b.type !== 'dir') return -1;
                if (a.type !== 'dir' && b.type === 'dir') return 1;
                return a.name.localeCompare(b.name);
            })
            .map(item => {
                const indent = '<span class="indent"></span>'.repeat(depth);
                const icon = item.type === 'dir' ? '📁' : this.getFileIcon(item.name);
                const className = `file-item ${item.type === 'dir' ? 'folder' : 'file'}`;

                let html = `<div class="${className}" data-path="${item.path}" data-type="${item.type}">
                    ${indent}${icon} ${item.name}
                </div>`;

                if (item.type === 'dir' && item.children) {
                    html += this.renderTree(item.children, depth + 1);
                }

                return html;
            })
            .join('');
    }

    getFileIcon(name) {
        const ext = name.split('.').pop().toLowerCase();
        const icons = {
            'html': '🌐', 'css': '🎨', 'js': '📜', 'ts': '📘',
            'json': '📋', 'md': '📝', 'py': '🐍', 'go': '🔵',
            'rs': '🦀', 'jpg': '🖼️', 'png': '🖼️', 'svg': '🎯'
        };
        return icons[ext] || '📄';
    }

    // === File Preview ===
    async openFile(path) {
        const editorTitle = document.getElementById('editor-title');
        const editorPath = document.getElementById('editor-path');
        const editorContent = document.getElementById('editor-content');

        editorTitle.textContent = '⏳ Loading...';
        editorPath.textContent = path;

        try {
            const response = await fetch(`${API_BASE}/api/files/read?path=${encodeURIComponent(path)}`);
            const data = await response.json();

            if (data.success) {
                const fileName = path.split(/[/\\]/).pop();
                const ext = fileName.split('.').pop();
                editorTitle.textContent = `${this.getFileIcon(fileName)} ${fileName}`;
                editorContent.innerHTML = `<code class="lang-${ext}">${this.escapeHtml(data.content)}</code>`;
                this.currentFile = path;

                // Highlight active file in tree
                document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
                document.querySelector(`.file-item[data-path="${path}"]`)?.classList.add('active');
            } else {
                editorTitle.textContent = '❌ Error';
                editorContent.innerHTML = `<code>${data.error || 'Failed to load file'}</code>`;
            }
        } catch (error) {
            editorTitle.textContent = '❌ Error';
            editorContent.innerHTML = `<code>${error.message}</code>`;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // === Live Preview ===
    async startPreview() {
        const port = parseInt(document.getElementById('port-input').value) || 3000;
        const statusEl = document.getElementById('preview-status');
        statusEl.textContent = 'Starting...';
        statusEl.className = 'status-message info';

        try {
            const response = await fetch(`${API_BASE}/api/preview/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ port, path: '.' })
            });

            const data = await response.json();

            if (data.success) {
                this.previewPort = port;
                const url = `http://localhost:${port}`;

                document.getElementById('preview-modal').classList.remove('hidden');
                document.getElementById('preview-link').href = url;

                setTimeout(() => {
                    document.getElementById('preview-frame').src = url;
                }, 1500);

                statusEl.textContent = `✅ ${url}`;
                statusEl.className = 'status-message success';
            } else {
                statusEl.textContent = `❌ ${data.error || 'Failed'}`;
                statusEl.className = 'status-message error';
            }
        } catch (error) {
            statusEl.textContent = `❌ ${error.message}`;
            statusEl.className = 'status-message error';
        }
    }

    stopPreview() {
        document.getElementById('preview-modal').classList.add('hidden');
        document.getElementById('preview-frame').src = 'about:blank';
        document.getElementById('preview-status').textContent = '';
        this.previewPort = null;
    }

    // === Git Operations ===
    async loadGitStatus() {
        try {
            const response = await fetch(`${API_BASE}/api/git/status`);
            const data = await response.json();

            if (data.success) {
                const statusEl = document.getElementById('git-status');
                const branch = data.branch || 'main';
                const changes = data.changes || 0;
                statusEl.textContent = `🌿 ${branch}${changes > 0 ? ` (${changes})` : ''}`;
            }
        } catch (error) {
            document.getElementById('git-status').textContent = '⚪ Git: --';
        }
    }

    async gitCommit() {
        const message = document.getElementById('commit-msg').value.trim();
        if (!message) {
            this.showStatus('commit-status', 'Enter message', 'error');
            return;
        }

        this.showStatus('commit-status', 'Committing...', 'info');

        try {
            const response = await fetch(`${API_BASE}/api/git/commit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            });

            const data = await response.json();

            if (data.success) {
                this.showStatus('commit-status', '✅ Done!', 'success');
                document.getElementById('commit-msg').value = '';
                await this.loadGitStatus();
            } else {
                this.showStatus('commit-status', `❌ ${data.error}`, 'error');
            }
        } catch (error) {
            this.showStatus('commit-status', `❌ ${error.message}`, 'error');
        }
    }

    async gitPush() {
        this.showStatus('push-status', 'Pushing...', 'info');

        try {
            const response = await fetch(`${API_BASE}/api/git/push`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();

            if (data.success) {
                this.showStatus('push-status', '✅ Pushed!', 'success');
            } else {
                // Check if auth needed
                if (data.error && data.error.includes('Authentication')) {
                    this.showStatus('push-status', '🔐 Auth required - use terminal', 'error');
                } else {
                    this.showStatus('push-status', `❌ ${data.error}`, 'error');
                }
            }
        } catch (error) {
            this.showStatus('push-status', `❌ ${error.message}`, 'error');
        }
    }

    // === Vercel Deployment ===
    async checkVercelAuth() {
        try {
            const response = await fetch(`${API_BASE}/api/deploy/vercel/status`);
            const data = await response.json();

            if (data.loggedIn) {
                this.vercelLoggedIn = true;
                document.getElementById('vercel-status').textContent = `▲ ${data.user || 'Logged in'}`;
                document.getElementById('vercel-login-btn').style.display = 'none';
            } else {
                this.vercelLoggedIn = false;
                document.getElementById('vercel-status').textContent = '▲ Not logged in';
                document.getElementById('vercel-login-btn').style.display = 'inline-block';
            }
        } catch (error) {
            document.getElementById('vercel-status').textContent = '▲ --';
        }
    }

    async vercelLogin() {
        this.showStatus('deploy-status', 'Opening Vercel login...', 'info');

        try {
            const response = await fetch(`${API_BASE}/api/deploy/vercel/login`, {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                if (data.url) {
                    window.open(data.url, '_blank');
                    this.showStatus('deploy-status', 'Complete login in browser', 'info');
                } else {
                    this.showStatus('deploy-status', '✅ Logged in!', 'success');
                    await this.checkVercelAuth();
                }
            } else {
                this.showStatus('deploy-status', `❌ ${data.error}`, 'error');
            }
        } catch (error) {
            this.showStatus('deploy-status', `❌ ${error.message}`, 'error');
        }
    }

    async deployVercel() {
        this.showStatus('deploy-status', 'Deploying...', 'info');

        try {
            const response = await fetch(`${API_BASE}/api/deploy/vercel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();

            if (data.success) {
                const url = data.url || 'Deployed!';
                this.showStatus('deploy-status', `✅ <a href="${url}" target="_blank">${url}</a>`, 'success');
            } else if (data.needsLogin) {
                this.showStatus('deploy-status', '🔐 Login required', 'error');
                document.getElementById('vercel-login-btn').style.display = 'inline-block';
            } else {
                this.showStatus('deploy-status', `❌ ${data.error}`, 'error');
            }
        } catch (error) {
            this.showStatus('deploy-status', `❌ ${error.message}`, 'error');
        }
    }

    // === Helpers ===
    showStatus(elementId, message, type) {
        const el = document.getElementById(elementId);
        el.innerHTML = message;
        el.className = `status-message ${type}`;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.webAssist = new WebAssist();
});
