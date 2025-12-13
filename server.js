const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs').promises;
const crypto = require('crypto');
const os = require('os');
const { exec } = require('child_process');
const OpenCodeBackend = require('./backend-integration');
const { QwenOAuth } = require('./qwen-oauth');

const app = express();
const PORT = process.env.PORT || (process.argv[2] ? parseInt(process.argv[2]) : 15044);
const WORKSPACE_ROOT = path.resolve(process.env.OPENQODE_WORKSPACE_ROOT || __dirname);
const MAX_CMD_OUTPUT = 200 * 1024; // 200KB

// Initialize backends
const openCodeBackend = new OpenCodeBackend();
const qwenOAuth = new QwenOAuth();

// Initialize backend and start server
async function startServer() {
    try {
        console.log('Initializing OpenCode backend...');
        await openCodeBackend.initialize();

        // Load existing tokens
        await loadTokens();

        // Load existing sessions
        await loadSessionsFromDisk();

        // Check Qwen authentication status
        const qwenAuth = await openCodeBackend.checkAuth('qwen');
        console.log(`🔑 Qwen authentication status: ${qwenAuth.authenticated ? '✅ Authenticated' : '❌ Not authenticated'}`);

        // Start server
        console.log(`Attempting to start server on port ${PORT}...`);
        const server = app.listen(PORT, '0.0.0.0', async () => {
            console.log(`🚀 OpenQode Web Server running on http://localhost:${PORT}`);
            console.log(`📁 Serving files from: ${path.join(__dirname, 'web')}`);
            console.log(`🔐 Auth endpoints available at /api/auth/*`);
            console.log(`💬 Chat endpoint available at /api/chat`);
            console.log(`📂 Session management at /api/sessions/*`);
            console.log(`🔧 Server is listening and ready for connections`);

            // Warm up the qwen CLI to prevent "first message fails" issue
            console.log('🔥 Warming up Qwen CLI...');
            try {
                const warmupResult = await qwenOAuth.sendMessage('ping', 'qwen-coder-plus');
                if (warmupResult.success) {
                    console.log('✅ Qwen CLI warmed up and ready!');
                } else {
                    console.log('⚠️ Qwen CLI warmup returned error (may still work):', warmupResult.error);
                }
            } catch (warmupError) {
                console.log('⚠️ Qwen CLI warmup failed (may still work):', warmupError.message);
            }
        });

        server.on('error', (err) => {
            console.error('Server error:', err);
            console.error('Error code:', err.code);
            console.error('Error address:', err.address);
            console.error('Error port:', err.port);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Middleware - CORS configuration for cross-origin requests
app.use(cors({
    origin: true, // Allow all origins (for development)
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'web')));
app.use('/assist', express.static(path.join(__dirname, 'web-assist')));

// Storage with persistence
const sessions = new Map();
const authTokens = new Map();
const TOKEN_FILE = path.join(__dirname, 'tokens.json');

// Helper functions
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function validateToken(token) {
    return authTokens.has(token);
}

function resolveWorkspacePath(relPath = '') {
    const safeRel = relPath.replace(/^[\\/]+/, '');
    const full = path.resolve(WORKSPACE_ROOT, safeRel);
    if (!full.startsWith(WORKSPACE_ROOT)) {
        throw new Error('Path outside workspace');
    }
    return full;
}

async function buildTree(dir, baseRel = '') {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const nodes = [];
    for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        const rel = path.join(baseRel, entry.name);
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            nodes.push({
                type: 'dir',
                name: entry.name,
                path: rel.replace(/\\/g, '/'),
                children: await buildTree(full, rel)
            });
        } else {
            nodes.push({
                type: 'file',
                name: entry.name,
                path: rel.replace(/\\/g, '/')
            });
        }
    }
    nodes.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
    return nodes;
}

// Load existing tokens from file
async function loadTokens() {
    try {
        const data = await fs.readFile(TOKEN_FILE, 'utf8');
        const tokens = JSON.parse(data);
        // Restore tokens to Map
        Object.entries(tokens).forEach(([key, value]) => {
            authTokens.set(key, value);
        });
        console.log(`Loaded ${Object.keys(tokens).length} tokens from storage`);
    } catch (error) {
        console.log('No existing tokens found, starting fresh');
    }
}

// Save tokens to file
async function saveTokens() {
    try {
        const tokens = Object.fromEntries(authTokens);
        await fs.writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2));
    } catch (error) {
        console.error('Error saving tokens:', error);
    }
}

const SESSIONS_FILE = path.join(__dirname, 'sessions.json');

// Load sessions from file
async function loadSessionsFromDisk() {
    try {
        const data = await fs.readFile(SESSIONS_FILE, 'utf8');
        const sessionStore = JSON.parse(data);
        // Restore sessions to Map (sessionId -> sessionData)
        Object.entries(sessionStore).forEach(([key, value]) => {
            sessions.set(key, value);
        });
        console.log(`Loaded sessions for ${Object.keys(sessionStore).length} store IDs`);
    } catch (error) {
        console.log('No existing sessions found, starting fresh');
    }
}

// Save sessions to file
async function saveSessionsToDisk() {
    try {
        const sessionStore = Object.fromEntries(sessions);
        await fs.writeFile(SESSIONS_FILE, JSON.stringify(sessionStore, null, 2));
    } catch (error) {
        console.error('Error saving sessions:', error);
    }
}

// Check if user is actually authenticated with Qwen
async function verifyQwenAuth() {
    try {
        const authStatus = await openCodeBackend.checkAuth('qwen');
        return authStatus.authenticated;
    } catch (error) {
        console.error('Error verifying Qwen auth:', error);
        return false;
    }
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

// Authentication endpoints
app.post('/api/auth/login', async (req, res) => {
    try {
        const { provider } = req.body;

        if (provider === 'qwen') {
            console.log('Starting Qwen Device Code Flow...');

            // Check if already authenticated with QwenOAuth
            const authStatus = await qwenOAuth.checkAuth();
            console.log('Qwen OAuth status:', authStatus);

            if (authStatus.authenticated) {
                console.log('User authenticated with Qwen:', authStatus.method);
                const token = generateToken();
                authTokens.set(token, {
                    provider: 'qwen',
                    status: 'authenticated',
                    method: authStatus.method,
                    hasVisionSupport: authStatus.hasVisionSupport || false,
                    createdAt: new Date().toISOString()
                });

                await saveTokens();

                return res.json({
                    success: true,
                    alreadyAuthenticated: true,
                    hasVisionSupport: authStatus.hasVisionSupport || false,
                    token,
                    user: {
                        id: 'qwen_user',
                        name: 'Qwen User',
                        provider: 'qwen'
                    }
                });
            }

            // Start Device Code Flow
            try {
                const deviceFlowData = await qwenOAuth.startDeviceFlow();
                console.log('Device flow started:', deviceFlowData);

                // Start polling in background
                qwenOAuth.pollForTokens().then(async (tokens) => {
                    console.log('Device flow completed - tokens received!');
                }).catch((error) => {
                    console.error('Device flow polling error:', error.message);
                });

                // Return the verification URL and user code
                res.json({
                    success: true,
                    requiresDeviceCode: true,
                    verificationUri: deviceFlowData.verificationUri,
                    verificationUriComplete: deviceFlowData.verificationUriComplete,
                    userCode: deviceFlowData.userCode,
                    expiresIn: deviceFlowData.expiresIn,
                    message: `Please go to ${deviceFlowData.verificationUri} and enter code: ${deviceFlowData.userCode}`
                });
            } catch (deviceError) {
                console.error('Device flow error:', deviceError);
                res.status(400).json({
                    success: false,
                    error: deviceError.message || 'Failed to start device authentication'
                });
            }
        } else {
            res.status(400).json({ success: false, error: 'Unsupported provider' });
        }
    } catch (error) {
        console.error('Auth login error:', error);
        res.status(500).json({ success: false, error: `Internal server error: ${error.message}` });
    }
});

app.get('/api/auth/callback', async (req, res) => {
    try {
        const { code, state } = req.query;

        if (!state || !authTokens.has(state)) {
            return res.status(400).send('Invalid state parameter');
        }

        // Simulate token exchange
        const token = generateToken();
        const userData = {
            id: 'user_' + Date.now(),
            name: 'OpenQode User',
            email: 'user@openqode.local',
            provider: 'qwen'
        };

        authTokens.set(token, {
            ...userData,
            status: 'authenticated',
            createdAt: new Date().toISOString()
        });

        authTokens.delete(state);

        // Redirect back to frontend with token
        res.redirect(`/#token=${token}`);
    } catch (error) {
        console.error('Auth callback error:', error);
        res.status(500).send('Authentication failed');
    }
});

app.post('/api/auth/status', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token || !validateToken(token)) {
            return res.json({ authenticated: false });
        }

        const userData = authTokens.get(token);

        // Verify actual Qwen authentication status
        if (userData && userData.provider === 'qwen') {
            const isActuallyAuthed = await verifyQwenAuth();
            if (!isActuallyAuthed) {
                // Remove invalid token
                authTokens.delete(token);
                await saveTokens();
                return res.json({ authenticated: false, error: 'Qwen authentication expired' });
            }
        }

        res.json({
            authenticated: true,
            user: {
                id: userData.id || 'qwen_user',
                name: userData.name || 'Qwen User',
                email: userData.email || 'user@openqode.local',
                provider: userData.provider
            }
        });
    } catch (error) {
        console.error('Auth status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Complete browser authentication
app.post('/api/auth/complete', async (req, res) => {
    try {
        const { state } = req.body;

        if (!state || !authTokens.has(state)) {
            return res.status(400).json({ success: false, error: 'Invalid state parameter' });
        }

        console.log('Completing authentication for state:', state);

        // Check if user completed browser auth
        const authStatus = await openCodeBackend.checkAuth('qwen');
        console.log('Post-browser auth status:', authStatus);

        if (authStatus.authenticated) {
            // Generate new authenticated token
            const token = generateToken();
            authTokens.set(token, {
                provider: 'qwen',
                status: 'authenticated',
                details: authStatus.details,
                createdAt: new Date().toISOString()
            });

            // Remove pending state
            authTokens.delete(state);

            await saveTokens();

            res.json({
                success: true,
                token,
                user: {
                    id: 'qwen_user',
                    name: 'Qwen User',
                    provider: 'qwen'
                }
            });
        } else {
            res.status(400).json({
                success: false,
                error: 'Authentication not completed. Please try again.'
            });
        }
    } catch (error) {
        console.error('Auth complete error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    try {
        const { token } = req.body;

        if (token && authTokens.has(token)) {
            authTokens.delete(token);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Auth logout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Chat endpoints
app.post('/api/chat', async (req, res) => {
    try {
        const { message, model, features, token } = req.body;

        if (!token || !validateToken(token)) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        console.log('📨 Chat request received:', { message: message?.substring(0, 50), model });

        // Use QwenOAuth to send message directly to Qwen API
        try {
            const result = await qwenOAuth.sendMessage(message, model || 'qwen-coder-plus');

            if (result.success) {
                res.json({
                    success: true,
                    response: result.response,
                    metadata: {
                        model: model || 'qwen-coder-plus',
                        timestamp: new Date().toISOString(),
                        features,
                        usage: result.usage
                    }
                });
            } else {
                res.json({
                    success: false,
                    error: result.error || 'Failed to get response from Qwen'
                });
            }
        } catch (qwenError) {
            console.error('Qwen API error:', qwenError.message);

            // If auth error, tell user to re-authenticate
            if (qwenError.message.includes('Authentication') || qwenError.message.includes('auth')) {
                return res.status(401).json({
                    success: false,
                    error: 'Session expired. Please re-authenticate with Qwen.',
                    needsReauth: true
                });
            }

            res.json({
                success: false,
                error: qwenError.message || 'Failed to get response from Qwen'
            });
        }
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ success: false, error: 'Failed to get response' });
    }
});

// Streaming chat endpoint
app.post('/api/chat/stream', async (req, res) => {
    try {
        const { message, model, features, token, attachment } = req.body;

        if (!token || !validateToken(token)) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        console.log('📨 Stream chat request received:', {
            message: message?.substring(0, 50),
            model,
            hasAttachment: !!attachment,
            attachmentType: attachment?.type,
            attachmentName: attachment?.name,
            hasImageData: !!attachment?.data
        });

        // Set headers for Server-Sent Events
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control'
        });

        // Prepare the message with attachment context
        let fullMessage = message;
        let imageData = null;

        if (attachment) {
            console.log('🔍 Attachment received:', {
                type: attachment.type,
                name: attachment.name,
                size: attachment.size,
                dataLength: attachment.data?.length
            });
            if (attachment.type === 'image') {
                // For images, include the base64 data for vision models
                imageData = attachment.data;
                console.log('📷 Image attachment extracted! Data starts with:', imageData?.substring(0, 50));
            } else if (attachment.type === 'text') {
                // For text files, the content is already in the message
                console.log('📄 Text attachment detected:', attachment.name);
            }
        } else {
            console.log('⚠️ No attachment in request body');
        }

        // Use qwenOAuth (non-streaming, but send as single chunk)
        try {
            // If we have an image, use vision model
            const effectiveModel = imageData ? 'qwen-vl-plus' : (model || 'qwen-coder-plus');
            const result = await qwenOAuth.sendMessage(fullMessage, effectiveModel, imageData);

            if (result.success) {
                // Send the response as a single chunk
                res.write(`data: ${JSON.stringify({ type: 'chunk', content: result.response })}\n\n`);
                res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
            } else {
                res.write(`data: ${JSON.stringify({ type: 'error', error: result.error || 'Failed to get response' })}\n\n`);
            }
        } catch (error) {
            console.error('Qwen stream error:', error.message);
            res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        }

        res.end();
    } catch (error) {
        console.error('Stream chat error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'Internal server error' })}\n\n`);
        res.end();
    }
});

// File system APIs (workspace-scoped)
// NOTE: Read-only operations (tree, read) work without auth for local-first experience
app.get('/api/files/tree', async (req, res) => {
    try {
        // Allow file tree without authentication - it's your local files
        const tree = await buildTree(WORKSPACE_ROOT, '');
        res.json({ success: true, root: WORKSPACE_ROOT, tree });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/files/read', async (req, res) => {
    try {
        // Allow file reading without authentication - it's your local files
        const { path: relPath } = req.query;
        const fullPath = resolveWorkspacePath(relPath);
        const content = await fs.readFile(fullPath, 'utf8');
        res.json({ success: true, path: relPath, content });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

app.post('/api/files/write', async (req, res) => {
    try {
        // Local file writing doesn't require authentication
        const { path: relPath, content } = req.body;
        const fullPath = resolveWorkspacePath(relPath);
        await fs.writeFile(fullPath, content ?? '', 'utf8');
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

app.post('/api/files/create', async (req, res) => {
    try {
        // Local file creation doesn't require authentication
        const { path: relPath, type } = req.body;
        const fullPath = resolveWorkspacePath(relPath);
        if (type === 'dir') {
            await fs.mkdir(fullPath, { recursive: true });
        } else {
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, '', 'utf8');
        }
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// CRITICAL: Write content to a file (used by AI file creation)
app.post('/api/files/write', async (req, res) => {
    try {
        const { path: relPath, content } = req.body;

        if (!relPath) {
            return res.status(400).json({ success: false, error: 'Missing file path' });
        }

        const fullPath = resolveWorkspacePath(relPath);

        // Ensure parent directory exists
        await fs.mkdir(path.dirname(fullPath), { recursive: true });

        // Write the file content
        await fs.writeFile(fullPath, content || '', 'utf8');

        console.log(`📝 File written: ${relPath}`);
        res.json({ success: true, path: relPath });
    } catch (error) {
        console.error('File write error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Upload file (saves to .uploads folder in workspace)
app.post('/api/files/upload', async (req, res) => {
    try {
        const { token, filename, data, type } = req.body;
        if (!token || !validateToken(token)) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(WORKSPACE_ROOT, '.uploads');
        await fs.mkdir(uploadsDir, { recursive: true });

        // Generate unique filename
        const timestamp = Date.now();
        const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
        const uniqueFilename = `${timestamp}-${safeFilename}`;
        const fullPath = path.join(uploadsDir, uniqueFilename);

        // Decode base64 data if it's an image
        if (type === 'image' && data.startsWith('data:')) {
            const base64Data = data.split(',')[1];
            await fs.writeFile(fullPath, Buffer.from(base64Data, 'base64'));
        } else {
            // Text content
            await fs.writeFile(fullPath, data, 'utf8');
        }

        const relativePath = `.uploads/${uniqueFilename}`;
        console.log(`📁 File uploaded: ${relativePath}`);

        res.json({
            success: true,
            path: relativePath,
            fullPath: fullPath,
            filename: uniqueFilename
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

app.post('/api/files/rename', async (req, res) => {
    try {
        const { token, from, to } = req.body;
        if (!token || !validateToken(token)) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const fullFrom = resolveWorkspacePath(from);
        const fullTo = resolveWorkspacePath(to);
        await fs.mkdir(path.dirname(fullTo), { recursive: true });
        await fs.rename(fullFrom, fullTo);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

app.post('/api/files/delete', async (req, res) => {
    try {
        const { token, path: relPath } = req.body;
        if (!token || !validateToken(token)) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const fullPath = resolveWorkspacePath(relPath);
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
            await fs.rm(fullPath, { recursive: true, force: true });
        } else {
            await fs.unlink(fullPath);
        }
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// Terminal/command run API (workspace-scoped)
app.post('/api/terminal/run', async (req, res) => {
    try {
        const { token, command, cwd = '' } = req.body;
        // Auth check removed for local terminal usage
        /* if (!token || !validateToken(token)) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        } */
        if (!command || typeof command !== 'string') {
            return res.status(400).json({ success: false, error: 'Missing command' });
        }
        const fullCwd = resolveWorkspacePath(cwd);
        exec(command, { cwd: fullCwd, timeout: 60000, windowsHide: true, maxBuffer: MAX_CMD_OUTPUT }, (err, stdout, stderr) => {
            res.json({
                success: !err,
                code: err?.code ?? 0,
                stdout: (stdout || '').slice(0, MAX_CMD_OUTPUT),
                stderr: (stderr || '').slice(0, MAX_CMD_OUTPUT)
            });
        });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// Session management endpoints
app.post('/api/sessions/save', async (req, res) => {
    try {
        // req.body contains { sessions: {...}, currentSession: "..." }
        const sessionData = req.body;
        const sessionId = 'default'; // In a real app, this would be user-specific

        sessions.set(sessionId, sessionData);
        await saveSessionsToDisk();

        res.json({ success: true });
    } catch (error) {
        console.error('Session save error:', error);
        res.status(500).json({ error: 'Failed to save sessions' });
    }
});

app.get('/api/sessions/load', async (req, res) => {
    try {
        const sessionId = 'default'; // In a real app, this would be user-specific
        const sessionData = sessions.get(sessionId) || { sessions: {}, currentSession: 'default' };

        res.json(sessionData);
    } catch (error) {
        console.error('Session load error:', error);
        res.status(500).json({ error: 'Failed to load sessions' });
    }
});

// File upload endpoint
app.post('/api/upload', async (req, res) => {
    try {
        const { file, filename, token } = req.body;

        if (!token || !validateToken(token)) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        // In a real implementation, you'd save the file to storage
        // For demo, we'll just acknowledge the upload
        res.json({
            success: true,
            filename,
            size: file ? file.length : 0
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ success: false, error: 'Upload failed' });
    }
});

// Preview server management endpoint with smart platform detection
app.post('/api/preview/start', async (req, res) => {
    try {
        const { port, path: relativePath = '.' } = req.body;

        if (!port || typeof port !== 'number') {
            return res.status(400).json({ success: false, error: 'Missing or invalid port' });
        }

        const fullCwd = resolveWorkspacePath(relativePath);

        // Check if directory exists, create if it doesn't
        try {
            await fs.access(fullCwd);
        } catch (err) {
            await fs.mkdir(fullCwd, { recursive: true });
        }

        const platform = os.platform();
        let command;
        let useWSL = false;

        if (platform === 'win32') {
            // Check if WSL is available
            try {
                const wslCheck = await new Promise((resolve) => {
                    exec('wsl --list --quiet', { timeout: 5000 }, (err, stdout) => {
                        resolve(!err && stdout.trim().length > 0);
                    });
                });
                useWSL = wslCheck;
            } catch (e) {
                useWSL = false;
            }

            if (useWSL) {
                // Convert Windows path to WSL path
                const wslPath = fullCwd.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '/mnt/$1').toLowerCase();
                console.log(`🐧 Using WSL for preview - Path: ${wslPath}`);
                // Use WSL to run a simple Python HTTP server (more reliable than npx on WSL)
                command = `wsl -e bash -c "cd '${wslPath}' && python3 -m http.server ${port} &"`;
            } else {
                // Fallback: Use PowerShell to run a simple HTTP server
                console.log(`💻 Using PowerShell for preview`);
                // Use Start-Process to run in background
                command = `powershell -Command "Start-Process -NoNewWindow -FilePath 'npx' -ArgumentList 'serve', '-l', '${port}', '${fullCwd.replace(/\\/g, '\\\\')}'"`;
            }
        } else {
            // Unix-like (Linux/Mac): Use Python's built-in HTTP server (more reliable)
            console.log(`🖥️ Using native Python HTTP server for preview`);
            command = `cd "${fullCwd}" && python3 -m http.server ${port} &`;
        }

        console.log(`📡 Starting preview server: ${command}`);

        exec(command, { cwd: fullCwd, timeout: 10000, windowsHide: true, maxBuffer: MAX_CMD_OUTPUT, shell: true }, (err, stdout, stderr) => {
            if (err && !useWSL) {
                // If npx/python failed, try a fallback
                console.error('Preview server start error:', err.message);
                res.json({
                    success: false,
                    error: err.message,
                    platform: platform,
                    useWSL: useWSL
                });
            } else {
                res.json({
                    success: true,
                    platform: platform,
                    useWSL: useWSL,
                    message: useWSL ? 'Started via WSL' : 'Started natively'
                });
            }
        });
    } catch (error) {
        console.error('Preview start error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Platform info endpoint
app.get('/api/platform', (req, res) => {
    const platform = os.platform();
    const info = {
        platform: platform,
        arch: os.arch(),
        release: os.release(),
        isWindows: platform === 'win32',
        isMac: platform === 'darwin',
        isLinux: platform === 'linux'
    };

    // Check for WSL on Windows
    if (platform === 'win32') {
        exec('wsl --list --quiet', { timeout: 3000 }, (err, stdout) => {
            info.hasWSL = !err && stdout.trim().length > 0;
            info.wslDistros = info.hasWSL ? stdout.trim().split('\n').filter(d => d.trim()) : [];
            res.json(info);
        });
    } else {
        info.hasWSL = false;
        res.json(info);
    }
});


// === Git Endpoints for Web Assist ===

// Git status
app.get('/api/git/status', async (req, res) => {
    try {
        exec('git status --porcelain && git branch --show-current', { cwd: WORKSPACE_ROOT }, (err, stdout, stderr) => {
            if (err) {
                return res.json({ success: false, error: 'Not a git repository' });
            }

            const lines = stdout.trim().split('\n');
            const branch = lines.pop() || 'main';
            const changes = lines.filter(l => l.trim()).length;

            res.json({ success: true, branch, changes });
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Git commit
app.post('/api/git/commit', async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ success: false, error: 'Commit message required' });
    }

    try {
        exec(`git add -A && git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: WORKSPACE_ROOT }, (err, stdout, stderr) => {
            if (err) {
                return res.json({ success: false, error: stderr || err.message });
            }
            res.json({ success: true, output: stdout });
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Git push
app.post('/api/git/push', async (req, res) => {
    try {
        exec('git push', { cwd: WORKSPACE_ROOT, timeout: 30000 }, (err, stdout, stderr) => {
            if (err) {
                return res.json({ success: false, error: stderr || err.message });
            }
            res.json({ success: true, output: stdout || stderr });
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Vercel auth status - check token file exists
app.get('/api/deploy/vercel/status', async (req, res) => {
    try {
        const homeDir = os.homedir();
        const tokenPath = path.join(homeDir, '.vercel', 'auth.json');

        try {
            const authData = await fs.readFile(tokenPath, 'utf-8');
            const auth = JSON.parse(authData);
            if (auth.token) {
                res.json({ loggedIn: true, user: 'authenticated' });
            } else {
                res.json({ loggedIn: false });
            }
        } catch (e) {
            res.json({ loggedIn: false });
        }
    } catch (error) {
        res.json({ loggedIn: false, error: error.message });
    }
});

// Vercel login - open terminal with interactive login
app.post('/api/deploy/vercel/login', async (req, res) => {
    const platform = os.platform();

    let terminalCmd;
    if (platform === 'win32') {
        // Windows: Open new cmd window with vercel login
        terminalCmd = 'start cmd /k "vercel login && echo. && echo Login complete! You can close this window."';
    } else if (platform === 'darwin') {
        // macOS: Open Terminal app
        terminalCmd = 'osascript -e \'tell app "Terminal" to do script "vercel login"\'';
    } else {
        // Linux: Try xterm
        terminalCmd = 'x-terminal-emulator -e "vercel login"';
    }

    exec(terminalCmd, { shell: true, cwd: WORKSPACE_ROOT }, (err) => {
        if (err) {
            res.json({
                success: false,
                error: 'Could not open terminal. Run "vercel login" manually.'
            });
        } else {
            res.json({
                success: true,
                message: 'Terminal opened! Complete login there, then click Deploy.'
            });
        }
    });
});

// Vercel deployment - check token file first
app.post('/api/deploy/vercel', async (req, res) => {
    try {
        const homeDir = os.homedir();
        const tokenPath = path.join(homeDir, '.vercel', 'auth.json');

        // Check if logged in
        let hasToken = false;
        try {
            const authData = await fs.readFile(tokenPath, 'utf-8');
            hasToken = !!JSON.parse(authData).token;
        } catch (e) {
            hasToken = false;
        }

        if (!hasToken) {
            return res.json({
                success: false,
                needsLogin: true,
                error: 'Run "vercel login" in terminal first'
            });
        }

        // Deploy
        exec('vercel --yes --prod', { cwd: WORKSPACE_ROOT, timeout: 180000 }, (err, stdout, stderr) => {
            if (err) {
                return res.json({ success: false, error: stderr || err.message });
            }
            const urlMatch = stdout.match(/https:\/\/[^\s]+\.vercel\.app/);
            res.json({ success: true, url: urlMatch ? urlMatch[0] : null });
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});


// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Start server
startServer();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down OpenQode Web Server...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down OpenQode Web Server...');
    process.exit(0);
});
