/**
 * TUI Component Tests
 * Tests for markdown rendering, layout utilities, and theme
 * 
 * Run with: node --experimental-vm-modules node_modules/jest/bin/jest.js tests/
 * Or: npm test (if configured in package.json)
 */

import { describe, test, expect } from '@jest/globals';
import { computeLayoutMode, truncateText, calculateViewport, getTextWidth } from '../bin/tui-layout.mjs';
import { theme } from '../bin/tui-theme.mjs';

// ═══════════════════════════════════════════════════════════════
// LAYOUT UTILITY TESTS
// ═══════════════════════════════════════════════════════════════

describe('Layout Utilities', () => {
    describe('computeLayoutMode', () => {
        test('returns wide mode for columns >= 120', () => {
            const result = computeLayoutMode(120, 40);
            expect(result.mode).toBe('wide');
            expect(result.sidebarWidth).toBeGreaterThan(0);
        });

        test('returns medium mode for columns 90-119', () => {
            const result = computeLayoutMode(100, 40);
            expect(result.mode).toBe('medium');
        });

        test('returns narrow mode for columns 60-89', () => {
            const result = computeLayoutMode(80, 40);
            expect(result.mode).toBe('narrow');
            expect(result.sidebarWidth).toBe(0); // collapsed by default
        });

        test('returns tiny mode for columns < 60', () => {
            const result = computeLayoutMode(50, 40);
            expect(result.mode).toBe('tiny');
        });

        test('returns tiny mode for rows < 20', () => {
            const result = computeLayoutMode(100, 15);
            expect(result.mode).toBe('tiny');
        });

        test('handles null dimensions with defaults', () => {
            const result = computeLayoutMode(null, null);
            expect(result.cols).toBe(80);
            expect(result.rows).toBe(24);
        });
    });

    describe('truncateText', () => {
        test('returns empty string for empty input', () => {
            expect(truncateText('', 10)).toBe('');
            expect(truncateText(null, 10)).toBe('');
        });

        test('returns original text if shorter than width', () => {
            expect(truncateText('hello', 10)).toBe('hello');
        });

        test('truncates text longer than width', () => {
            const result = truncateText('hello world', 8);
            expect(result.length).toBeLessThanOrEqual(8);
        });
    });

    describe('calculateViewport', () => {
        test('calculates viewport height correctly', () => {
            const layout = { rows: 40, cols: 100, mode: 'wide' };
            const viewport = calculateViewport(layout, {
                headerRows: 2,
                inputRows: 4,
                thinkingRows: 0,
                marginsRows: 2
            });
            expect(viewport.viewHeight).toBe(32); // 40 - 2 - 4 - 0 - 2
            expect(viewport.maxMessages).toBeGreaterThan(0);
        });

        test('ensures minimum viewport height', () => {
            const layout = { rows: 10, cols: 100, mode: 'wide' };
            const viewport = calculateViewport(layout, {
                headerRows: 5,
                inputRows: 5,
                thinkingRows: 5,
                marginsRows: 5
            });
            expect(viewport.viewHeight).toBeGreaterThanOrEqual(4);
        });
    });
});

// ═══════════════════════════════════════════════════════════════
// THEME TESTS
// ═══════════════════════════════════════════════════════════════

describe('Theme System', () => {
    test('has required color properties', () => {
        expect(theme.colors).toBeDefined();
        expect(theme.colors.fg).toBeDefined();
        expect(theme.colors.muted).toBeDefined();
        expect(theme.colors.success).toBeDefined();
        expect(theme.colors.error).toBeDefined();
        expect(theme.colors.warning).toBeDefined();
        expect(theme.colors.info).toBeDefined();
    });

    test('has spacing tokens', () => {
        expect(theme.spacing).toBeDefined();
        expect(theme.spacing.xs).toBeDefined();
        expect(theme.spacing.sm).toBeDefined();
        expect(theme.spacing.md).toBeDefined();
    });

    test('has border styles', () => {
        expect(theme.borders).toBeDefined();
        expect(theme.borders.single).toBeDefined();
        expect(theme.borders.round).toBeDefined();
    });

    test('has icon definitions', () => {
        expect(theme.icons).toBeDefined();
        expect(theme.icons.prompt).toBeDefined();
        expect(theme.icons.bullet).toBeDefined();
    });
});

// ═══════════════════════════════════════════════════════════════
// STREAMING BUFFER TESTS
// ═══════════════════════════════════════════════════════════════

describe('Streaming Buffer', () => {
    // Note: These are conceptual tests - actual hook testing requires React testing library

    test('buffer module exports correctly', async () => {
        const { useStreamBuffer, useResizeDebounce } = await import('../bin/tui-stream-buffer.mjs');
        expect(typeof useStreamBuffer).toBe('function');
        expect(typeof useResizeDebounce).toBe('function');
    });
});

// ═══════════════════════════════════════════════════════════════
// MESSAGE PARSING TESTS
// ═══════════════════════════════════════════════════════════════
// Logic mirrored from flattenMessagesToBlocks in opencode-ink.mjs

const splitMessageContent = (content) => {
    // Regex captures: Code blocks OR [AGENT: Name] tags
    // Match code blocks (```...```) OR Agent tags ([AGENT: ...])
    return content.split(/(```[\s\S]*?```|\[AGENT:[^\]]+\])/g);
};

describe('Message Parsing', () => {
    test('splits agent tags correctly', () => {
        const input = "Thinking...\n[AGENT: Security]\nReviewing code...";
        const parts = splitMessageContent(input).filter(p => p.trim());

        expect(parts.length).toBeGreaterThan(1);
        expect(parts.some(p => p.includes('[AGENT: Security]'))).toBe(true);
    });

    test('interleaves agent tags and code blocks', () => {
        const input = "Start [AGENT: Planner] Plan:\n```text\nstep 1\n```\n[AGENT: Builder] Go.";
        const parts = splitMessageContent(input).filter(p => p.trim());

        // Expected: "Start", "[AGENT: Planner]", "Plan:", "```...```", "[AGENT: Builder]", "Go."
        expect(parts).toContain('[AGENT: Planner]');
        expect(parts).toContain('[AGENT: Builder]');
        const codeBlock = parts.find(p => p.startsWith('```'));
        expect(codeBlock).toBeDefined();
    });
});

// ═══════════════════════════════════════════════════════════════
// SMART AGENT FLOW TESTS
// ═══════════════════════════════════════════════════════════════

describe('Smart Agent Flow', () => {
    test('exports SmartAgentFlow class', async () => {
        const { SmartAgentFlow, getSmartAgentFlow } = await import('../bin/smart-agent-flow.mjs');
        expect(SmartAgentFlow).toBeDefined();
        expect(typeof getSmartAgentFlow).toBe('function');
    });

    test('getSmartAgentFlow returns singleton instance', async () => {
        const { getSmartAgentFlow } = await import('../bin/smart-agent-flow.mjs');
        const flow1 = getSmartAgentFlow();
        const flow2 = getSmartAgentFlow();
        expect(flow1).toBe(flow2);
    });

    test('has built-in agents', async () => {
        const { getSmartAgentFlow } = await import('../bin/smart-agent-flow.mjs');
        const flow = getSmartAgentFlow();
        const agents = flow.getAgents();
        expect(agents.length).toBeGreaterThanOrEqual(6);
        expect(agents.some(a => a.id === 'build')).toBe(true);
        expect(agents.some(a => a.id === 'plan')).toBe(true);
        expect(agents.some(a => a.id === 'test')).toBe(true);
    });

    test('analyzeRequest detects security patterns', async () => {
        const { getSmartAgentFlow } = await import('../bin/smart-agent-flow.mjs');
        const flow = getSmartAgentFlow();
        const result = flow.analyzeRequest('add authentication and password handling');
        expect(result.patterns).toContain('security-sensitive');
    });

    test('toggle enables/disables multi-agent mode', async () => {
        const { getSmartAgentFlow } = await import('../bin/smart-agent-flow.mjs');
        const flow = getSmartAgentFlow();
        flow.toggle(true);
        expect(flow.config.enabled).toBe(true);
        flow.toggle(false);
        expect(flow.config.enabled).toBe(false);
    });
});

console.log('✅ All test suites loaded successfully');
