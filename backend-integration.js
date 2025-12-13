const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

class OpenCodeBackend {
    constructor() {
        this.opencodePath = null;
        this.isInitialized = false;
        this.currentSession = null;
        this.processes = new Map();
    }

    async initialize() {
        try {
            const isWindows = os.platform() === 'win32';
            const binName = isWindows ? 'opencode.exe' : 'opencode';

            // Try to find opencode binary in various locations
            const possiblePaths = [
                path.join(__dirname, 'bin', binName),
                path.join(__dirname, binName),
                binName, // Assume it's in PATH
                path.join(os.homedir(), '.opencode', binName),
                path.join(process.env.LOCALAPPDATA || (process.env.HOME + '/.local/share'), 'OpenCode', binName)
            ];

            for (const opencodePath of possiblePaths) {
                try {
                    await fs.access(opencodePath);
                    this.opencodePath = opencodePath;
                    console.log(`✅ Found OpenCode at: ${opencodePath}`);
                    break;
                } catch (err) {
                    // Continue to next path
                }
            }

            if (!this.opencodePath) {
                throw new Error('OpenCode binary not found. Please ensure opencode.exe is available.');
            }

            // Test if OpenCode is working (direct call without initialization check)
            await this.testOpenCode();
            this.isInitialized = true;
            console.log('✅ OpenCode backend initialized successfully');

            return true;
        } catch (error) {
            console.error('❌ Failed to initialize OpenCode backend:', error.message);
            return false;
        }
    }

    async testOpenCode() {
        return new Promise((resolve, reject) => {
            const child = spawn(this.opencodePath, ['--version'], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: __dirname,
                env: {
                    ...process.env,
                    OPENCODE_NO_TELEMETRY: '1',
                    OPENCODE_LOG_LEVEL: 'ERROR',
                    FORCE_COLOR: '0'  // Disable ANSI color codes
                }
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                if (code === 0) {
                    resolve({ success: true, stdout: this.stripAnsiCodes(stdout).trim() });
                } else {
                    reject(new Error(`OpenCode test failed with code ${code}: ${this.stripAnsiCodes(stderr)}`));
                }
            });

            child.on('error', (error) => {
                reject(error);
            });

            // Set timeout
            const timeout = setTimeout(() => {
                child.kill('SIGTERM');
                reject(new Error('OpenCode test timed out'));
            }, 10000);

            child.on('close', () => {
                clearTimeout(timeout);
            });
        });
    }

    async executeCommand(args, options = {}) {
        if (!this.isInitialized) {
            throw new Error('OpenCode backend not initialized');
        }

        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const child = spawn(this.opencodePath, args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: options.cwd || __dirname,
                env: {
                    ...process.env,
                    OPENCODE_NO_TELEMETRY: '1',
                    OPENCODE_LOG_LEVEL: 'ERROR',
                    FORCE_COLOR: '0'  // Disable ANSI color codes
                },
                ...options
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                const duration = Date.now() - startTime;
                resolve({
                    code,
                    stdout: this.stripAnsiCodes(stdout).trim(),
                    stderr: this.stripAnsiCodes(stderr).trim(),
                    duration,
                    command: `${this.opencodePath} ${args.join(' ')}`
                });
            });

            child.on('error', (error) => {
                reject(error);
            });

            // Set timeout
            if (options.timeout) {
                setTimeout(() => {
                    child.kill('SIGTERM');
                    reject(new Error(`Command timed out after ${options.timeout}ms`));
                }, options.timeout);
            }
        });
    }

    async checkAuth(provider = 'qwen') {
        try {
            // First check if credentials exist
            const result = await this.executeCommand(['auth', 'list']);
            const hasCredentials = result.stdout.includes(provider);

            if (!hasCredentials) {
                return {
                    authenticated: false,
                    details: 'No credentials found'
                };
            }

            // Actually test the token by making a simple request
            // Try running a minimal command to verify the token works
            try {
                const testResult = await this.executeCommand(['run', '-m', `${provider}/coder-model`, 'ping'], {
                    timeout: 15000 // 15 seconds timeout for token test
                });

                // Check if the response indicates token error
                const output = testResult.stdout + testResult.stderr;
                if (output.includes('invalid access token') || output.includes('token expired') || output.includes('unauthorized')) {
                    return {
                        authenticated: false,
                        tokenExpired: true,
                        details: 'Token expired or invalid'
                    };
                }

                return {
                    authenticated: true,
                    details: result.stdout
                };
            } catch (testError) {
                // If test fails, might still be authenticated but network issue
                return {
                    authenticated: true, // Assume true to not block, actual call will fail gracefully
                    details: result.stdout,
                    warning: 'Could not verify token validity'
                };
            }
        } catch (error) {
            return {
                authenticated: false,
                error: error.message
            };
        }
    }

    async authenticate(provider = 'qwen') {
        try {
            // For Qwen, we open the browser for OAuth
            if (provider === 'qwen') {
                // First try to logout to clear old tokens
                try {
                    await this.executeCommand(['auth', 'logout', 'qwen'], { timeout: 5000 });
                } catch (e) {
                    // Ignore logout errors
                }

                // Open qwen.ai for manual authentication
                // The user needs to login at https://chat.qwen.ai and we'll use oauth
                return {
                    success: true,
                    requiresBrowser: true,
                    browserUrl: 'https://chat.qwen.ai',
                    message: 'Please login at https://chat.qwen.ai in your browser, then click "Complete Auth"'
                };
            }

            throw new Error(`Unsupported provider: ${provider}`);
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    buildRunArgs(message, model = 'qwen/coder-model', options = {}) {
        const args = ['run'];

        if (options.lakeview) {
            args.push('--lakeview');
        }

        if (options.sequentialThinking) {
            args.push('--think');
        }

        args.push('-m', model);
        args.push(message);

        return args;
    }

    async sendMessage(message, model = 'qwen/coder-model', options = {}) {
        try {
            // Use buildRunArgs to pass message directly as argument (non-interactive mode)
            const args = this.buildRunArgs(message, model, options);

            const sessionId = `session_${Date.now()}`;
            this.currentSession = sessionId;

            return new Promise((resolve, reject) => {
                let child = null;
                let response = '';
                let errorOutput = '';
                let timeoutHandle = null;
                let settled = false;

                const cleanup = () => {
                    if (timeoutHandle) {
                        clearTimeout(timeoutHandle);
                        timeoutHandle = null;
                    }
                    if (this.processes.has(sessionId)) {
                        const proc = this.processes.get(sessionId);
                        if (proc && !proc.killed) {
                            try {
                                proc.kill('SIGTERM');
                            } catch (e) {
                                // Process might already be dead
                            }
                        }
                        this.processes.delete(sessionId);
                    }
                    if (this.currentSession === sessionId) {
                        this.currentSession = null;
                    }
                };

                const finalize = (action) => {
                    if (settled) return;
                    settled = true;
                    cleanup();
                    action();
                };

                try {
                    child = spawn(this.opencodePath, args, {
                        stdio: ['pipe', 'pipe', 'pipe'],
                        cwd: __dirname,
                        env: {
                            ...process.env,
                            OPENCODE_NO_TELEMETRY: '1',
                            OPENCODE_LOG_LEVEL: 'ERROR',
                            FORCE_COLOR: '0'
                        }
                    });

                    child.stdout.on('data', (data) => {
                        response += data.toString();
                    });

                    child.stderr.on('data', (data) => {
                        errorOutput += data.toString();
                    });

                    child.on('close', (code) => {
                        finalize(() => {
                            // Clean up ANSI codes from response
                            const cleanResponse = this.stripAnsiCodes(response.trim());

                            if (code === 0 || cleanResponse.length > 0) {
                                resolve({
                                    success: true,
                                    response: cleanResponse,
                                    model,
                                    sessionId
                                });
                            } else {
                                resolve({
                                    success: false,
                                    error: this.stripAnsiCodes(errorOutput) || `Process exited with code ${code}`,
                                    model,
                                    sessionId
                                });
                            }
                        });
                    });

                    child.on('error', (error) => {
                        finalize(() => reject(error));
                    });

                    this.processes.set(sessionId, child);

                    // Timeout - default 60 seconds for AI responses
                    timeoutHandle = setTimeout(() => {
                        if (child && !child.killed) {
                            child.kill('SIGTERM');
                        }
                        finalize(() => reject(new Error('Message processing timed out')));
                    }, options.timeout || 60000);

                } catch (error) {
                    finalize(() => reject(error));
                }
            });

        } catch (error) {
            return {
                success: false,
                error: error.message,
                model
            };
        }
    }

    async getAvailableModels() {
        try {
            const result = await this.executeCommand(['--help']);
            // Parse the help output to extract available models
            // This is a simplified approach - in reality, you might need to parse more carefully
            const models = [
                'qwen/coder-model',
                'qwen/vision-model',
                'gpt-4',
                'gpt-3.5-turbo'
            ];

            return {
                success: true,
                models
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                models: []
            };
        }
    }

    async getStatus() {
        try {
            const authStatus = await this.checkAuth();
            const versionResult = await this.executeCommand(['--version']);

            return {
                initialized: this.isInitialized,
                opencodePath: this.opencodePath,
                version: versionResult.stdout,
                auth: authStatus,
                currentSession: this.currentSession
            };
        } catch (error) {
            return {
                initialized: false,
                error: error.message
            };
        }
    }

    async sendMessageStream(message, model = 'qwen/coder-model', options = {}) {
        const args = this.buildRunArgs(message, model, options);
        const sessionId = `session_${Date.now()}`;
        this.currentSession = sessionId;

        return new Promise((resolve, reject) => {
            let child = null;
            let response = '';
            let errorOutput = '';
            let timeoutHandle = null;
            let settled = false;

            const cleanup = () => {
                if (timeoutHandle) {
                    clearTimeout(timeoutHandle);
                    timeoutHandle = null;
                }
                if (this.processes.has(sessionId)) {
                    const proc = this.processes.get(sessionId);
                    if (proc && !proc.killed) {
                        try {
                            proc.kill('SIGTERM');
                        } catch (e) {
                            // Process might already be dead
                        }
                    }
                    this.processes.delete(sessionId);
                }
                if (this.currentSession === sessionId) {
                    this.currentSession = null;
                }
            };

            const finalize = (action) => {
                if (settled) return;
                settled = true;
                cleanup();
                action();
            };

            try {
                child = spawn(this.opencodePath, args, {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    cwd: __dirname,
                    env: {
                        ...process.env,
                        OPENCODE_NO_TELEMETRY: '1',
                        OPENCODE_LOG_LEVEL: 'ERROR',
                        FORCE_COLOR: '0'
                    }
                });

                child.stdout.on('data', (data) => {
                    let chunk = data.toString();
                    chunk = this.stripAnsiCodes(chunk);
                    response += chunk;
                    if (options.onChunk) {
                        options.onChunk(chunk);
                    }
                });

                child.stderr.on('data', (data) => {
                    const errorData = data.toString();
                    errorOutput += errorData;
                    if (options.onError) {
                        options.onError(this.stripAnsiCodes(errorData));
                    }
                });

                child.on('close', (code) => {
                    finalize(() => {
                        if (code === 0) {
                            resolve({
                                success: true,
                                response: response.trim(),
                                sessionId
                            });
                        } else {
                            reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
                        }
                    });
                });

                child.on('error', (error) => {
                    finalize(() => reject(error));
                });

                this.processes.set(sessionId, child);

                const timeoutMs = options.timeout || 300000; // Default to 5 minutes for AI responses
                timeoutHandle = setTimeout(() => {
                    if (child && !child.killed) {
                        child.kill('SIGTERM');
                    }
                    finalize(() => reject(new Error(`Stream timed out after ${timeoutMs}ms`)));
                }, timeoutMs);
            } catch (error) {
                finalize(() => reject(error));
            }
        });
    }

    async cleanup() {
        // Kill any running processes
        for (const [sessionId, process] of this.processes) {
            try {
                process.kill('SIGTERM');
            } catch (error) {
                // Process might already be dead
            }
        }
        this.processes.clear();
        this.currentSession = null;
    }

    stripAnsiCodes(str) {
        // Comprehensive regular expression to match ANSI escape codes and terminal control sequences
        return str.replace(/[\u001b\u009b][\[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]|[\u001b\u009b][c-u w-y]|\u001b\][^\u0007]*\u0007/g, '');
    }
}

module.exports = OpenCodeBackend;
