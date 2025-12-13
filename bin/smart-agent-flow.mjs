/**
 * Smart Agent Flow - Multi-Agent Routing System
 * 
 * Enables Qwen to:
 * 1. Read available agents (names, roles, capabilities)
 * 2. Use multiple agents in a single task by delegating sub-tasks
 * 3. Merge results back into the main response
 * 
 * Components:
 * - Agent Registry: Available agents with metadata
 * - Orchestrator: Decides which agents to use
 * - Router: Routes sub-tasks to agents
 * - Merger: Combines agent outputs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══════════════════════════════════════════════════════════════
// AGENT REGISTRY
// ═══════════════════════════════════════════════════════════════

/**
 * Built-in agents with their capabilities
 */
const BUILTIN_AGENTS = {
    build: {
        id: 'build',
        name: 'Build Agent',
        role: 'Full-stack development',
        capabilities: ['coding', 'debugging', 'implementation', 'refactoring'],
        whenToUse: 'General development tasks, implementing features, fixing bugs',
        priority: 1
    },
    plan: {
        id: 'plan',
        name: 'Planning Agent',
        role: 'Architecture and planning',
        capabilities: ['architecture', 'design', 'task-breakdown', 'estimation'],
        whenToUse: 'Complex features requiring upfront design, multi-step tasks',
        priority: 2
    },
    test: {
        id: 'test',
        name: 'Testing Agent',
        role: 'Quality assurance',
        capabilities: ['unit-tests', 'integration-tests', 'test-strategy', 'coverage'],
        whenToUse: 'Writing tests, improving coverage, test-driven development',
        priority: 3
    },
    docs: {
        id: 'docs',
        name: 'Documentation Agent',
        role: 'Technical writing',
        capabilities: ['documentation', 'comments', 'readme', 'api-docs'],
        whenToUse: 'Writing docs, improving comments, creating READMEs',
        priority: 4
    },
    security: {
        id: 'security',
        name: 'Security Reviewer',
        role: 'Security analysis',
        capabilities: ['vulnerability-scan', 'auth-review', 'input-validation', 'secrets'],
        whenToUse: 'Auth changes, handling sensitive data, security-critical code',
        priority: 5
    },
    refactor: {
        id: 'refactor',
        name: 'Refactoring Agent',
        role: 'Code improvement',
        capabilities: ['cleanup', 'optimization', 'patterns', 'technical-debt'],
        whenToUse: 'Improving code quality, reducing tech debt, applying patterns',
        priority: 6
    }
};

// ═══════════════════════════════════════════════════════════════
// ORCHESTRATOR CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const DEFAULT_CONFIG = {
    enabled: true,
    maxAgentsPerRequest: 3,
    maxTokensPerAgent: 2000,
    mergeStrategy: 'advisory', // 'advisory' = main model merges, 'sequential' = chain outputs
    autoDetect: true, // Automatically detect when to use multiple agents
};

// ═══════════════════════════════════════════════════════════════
// SMART AGENT FLOW CLASS
// ═══════════════════════════════════════════════════════════════

export class SmartAgentFlow {
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.agents = { ...BUILTIN_AGENTS };
        this.activeAgents = [];
        this.agentOutputs = [];
    }

    /**
     * Load custom agents from .opencode/agent directory
     */
    loadCustomAgents(projectPath) {
        const agentDir = path.join(projectPath, '.opencode', 'agent');
        if (!fs.existsSync(agentDir)) return;

        const files = fs.readdirSync(agentDir).filter(f => f.endsWith('.md'));
        for (const file of files) {
            const content = fs.readFileSync(path.join(agentDir, file), 'utf8');
            const name = path.basename(file, '.md');

            // Parse agent metadata from markdown frontmatter or content
            this.agents[name] = {
                id: name,
                name: this.extractTitle(content) || name,
                role: 'Custom agent',
                capabilities: this.extractCapabilities(content),
                whenToUse: this.extractWhenToUse(content),
                priority: 10,
                custom: true
            };
        }
    }

    extractTitle(content) {
        const match = content.match(/^#\s+(.+)$/m);
        return match ? match[1].trim() : null;
    }

    extractCapabilities(content) {
        const match = content.match(/capabilities?:?\s*(.+)/i);
        if (match) {
            return match[1].split(/[,;]/).map(c => c.trim().toLowerCase());
        }
        return ['general'];
    }

    extractWhenToUse(content) {
        const match = content.match(/when\s*to\s*use:?\s*(.+)/i);
        return match ? match[1].trim() : 'Custom agent for specialized tasks';
    }

    /**
     * Get all available agents
     */
    getAgents() {
        return Object.values(this.agents);
    }

    /**
     * Get agent by ID
     */
    getAgent(id) {
        return this.agents[id] || null;
    }

    /**
     * Analyze request to determine if multi-agent mode is beneficial
     */
    analyzeRequest(request) {
        if (!this.config.autoDetect || !this.config.enabled) {
            return { useMultiAgent: false, reason: 'Multi-agent mode disabled' };
        }

        const requestLower = request.toLowerCase();

        // Patterns that suggest multi-agent mode
        const patterns = {
            multiDiscipline: /\b(frontend|backend|database|api|ui|server|client)\b.*\b(and|with|plus)\b.*\b(frontend|backend|database|api|ui|server|client)\b/i,
            highRisk: /\b(auth|authentication|authorization|permission|password|secret|token|security)\b/i,
            largeRefactor: /\b(refactor|rewrite|restructure|reorganize)\b.*\b(entire|whole|all|complete)\b/i,
            needsReview: /\b(review|check|verify|validate|audit)\b.*\b(security|code|implementation)\b/i,
            needsPlanning: /\b(plan|design|architect|strategy)\b.*\b(before|first|then)\b/i,
            needsTests: /\b(test|coverage|tdd|unit test|integration)\b/i,
            needsDocs: /\b(document|readme|api docs|comments)\b/i
        };

        const detectedPatterns = [];
        const suggestedAgents = new Set(['build']); // Always include build

        if (patterns.multiDiscipline.test(requestLower)) {
            detectedPatterns.push('multi-discipline');
            suggestedAgents.add('plan');
        }
        if (patterns.highRisk.test(requestLower)) {
            detectedPatterns.push('security-sensitive');
            suggestedAgents.add('security');
        }
        if (patterns.largeRefactor.test(requestLower)) {
            detectedPatterns.push('large-refactor');
            suggestedAgents.add('refactor');
            suggestedAgents.add('plan');
        }
        if (patterns.needsReview.test(requestLower)) {
            detectedPatterns.push('needs-review');
            suggestedAgents.add('security');
        }
        if (patterns.needsPlanning.test(requestLower)) {
            detectedPatterns.push('needs-planning');
            suggestedAgents.add('plan');
        }
        if (patterns.needsTests.test(requestLower)) {
            detectedPatterns.push('needs-tests');
            suggestedAgents.add('test');
        }
        if (patterns.needsDocs.test(requestLower)) {
            detectedPatterns.push('needs-docs');
            suggestedAgents.add('docs');
        }

        // Use multi-agent if more than one pattern detected
        const useMultiAgent = suggestedAgents.size > 1 && detectedPatterns.length > 0;

        return {
            useMultiAgent,
            reason: useMultiAgent
                ? `Detected: ${detectedPatterns.join(', ')}`
                : 'Single-agent sufficient for this request',
            suggestedAgents: Array.from(suggestedAgents).slice(0, this.config.maxAgentsPerRequest),
            patterns: detectedPatterns
        };
    }

    /**
     * Start multi-agent flow for a request
     */
    startFlow(agentIds) {
        this.activeAgents = agentIds.map(id => this.agents[id]).filter(Boolean);
        this.agentOutputs = [];
        return this.activeAgents;
    }

    /**
     * Record agent output
     */
    recordOutput(agentId, output) {
        this.agentOutputs.push({
            agentId,
            agent: this.agents[agentId],
            output,
            timestamp: Date.now()
        });
    }

    /**
     * Get summary for UI display
     */
    getFlowStatus() {
        return {
            active: this.activeAgents.length > 0,
            agents: this.activeAgents.map(a => ({
                id: a.id,
                name: a.name,
                role: a.role
            })),
            outputs: this.agentOutputs.length,
            enabled: this.config.enabled
        };
    }

    /**
     * Build context for model about available agents
     */
    buildAgentContext() {
        const agents = this.getAgents();
        let context = `\n## Available Agents\n\nYou have access to the following specialized agents:\n\n`;

        for (const agent of agents) {
            context += `### ${agent.name} (${agent.id})\n`;
            context += `- **Role**: ${agent.role}\n`;
            context += `- **Capabilities**: ${agent.capabilities.join(', ')}\n`;
            context += `- **When to use**: ${agent.whenToUse}\n\n`;
        }

        context += `## Multi-Agent Guidelines\n\n`;
        context += `Use multiple agents when:\n`;
        context += `- The request spans multiple disciplines (UI + backend + DB + deployment)\n`;
        context += `- Risk is high (auth, permissions, data loss)\n`;
        context += `- Large refactor needed and you want a review pass\n\n`;
        context += `Do NOT use multiple agents when:\n`;
        context += `- Small changes or trivial questions\n`;
        context += `- User asked for speed or minimal output\n`;
        context += `- No clear benefit from additional perspectives\n`;

        return context;
    }

    /**
     * Toggle multi-agent mode
     */
    toggle(enabled = null) {
        if (enabled === null) {
            this.config.enabled = !this.config.enabled;
        } else {
            this.config.enabled = enabled;
        }
        return this.config.enabled;
    }

    /**
     * Reset flow state
     */
    reset() {
        this.activeAgents = [];
        this.agentOutputs = [];
    }
}

// Singleton instance
let smartAgentFlowInstance = null;

export function getSmartAgentFlow(config) {
    if (!smartAgentFlowInstance) {
        smartAgentFlowInstance = new SmartAgentFlow(config);
    }
    return smartAgentFlowInstance;
}

export default SmartAgentFlow;
