/**
 * AgentRail Component - "Pro" Protocol
 * Minimalist left-rail layout for messages (Claude Code / Codex CLI style)
 * 
 * @module ui/components/AgentRail
 */

import React from 'react';
import { Box, Text } from 'ink';

const h = React.createElement;

// ═══════════════════════════════════════════════════════════════
// ROLE COLORS - Color-coded vertical rail by role
// ═══════════════════════════════════════════════════════════════

export const RAIL_COLORS = {
    system: 'yellow',
    user: 'cyan',
    assistant: 'gray',
    error: 'red',
    thinking: 'magenta',
    tool: 'blue'
};

export const RAIL_ICONS = {
    system: 'ℹ',
    user: '❯',
    assistant: '◐',
    error: '!',
    thinking: '◌',
    tool: '⚙'
};

// ═══════════════════════════════════════════════════════════════
// SYSTEM MESSAGE - Compact single-line format
// ═══════════════════════════════════════════════════════════════

/**
 * SystemMessage - Compact system notification
 * Format: "ℹ SYSTEM: Message here"
 */
export const SystemMessage = ({ content, title = 'SYSTEM' }) => {
    return h(Box, { marginY: 0 },
        h(Text, { color: RAIL_COLORS.system }, `${RAIL_ICONS.system} `),
        h(Text, { color: RAIL_COLORS.system, bold: true }, `${title}: `),
        h(Text, { color: 'gray' }, content)
    );
};

// ═══════════════════════════════════════════════════════════════
// USER MESSAGE - Clean prompt style
// ═══════════════════════════════════════════════════════════════

/**
 * UserMessage - Clean prompt indicator
 * Format: "❯ user message"
 */
export const UserMessage = ({ content }) => {
    return h(Box, { marginTop: 1, marginBottom: 0 },
        h(Text, { color: RAIL_COLORS.user, bold: true }, `${RAIL_ICONS.user} `),
        h(Text, { color: 'white', wrap: 'wrap' }, content)
    );
};

// ═══════════════════════════════════════════════════════════════
// ASSISTANT MESSAGE - Left rail with content
// ═══════════════════════════════════════════════════════════════

/**
 * AssistantMessage - Rail-based layout (no box borders)
 * Uses vertical line instead of full border
 */
export const AssistantMessage = ({ content, isStreaming = false, children }) => {
    const railChar = isStreaming ? '┃' : '│';
    const railColor = isStreaming ? 'yellow' : RAIL_COLORS.assistant;

    return h(Box, {
        flexDirection: 'row',
        marginTop: 1,
        marginBottom: 1
    },
        // Left rail (vertical line)
        h(Box, {
            width: 2,
            flexShrink: 0,
            flexDirection: 'column'
        },
            h(Text, { color: railColor }, railChar)
        ),
        // Content area
        h(Box, {
            flexDirection: 'column',
            flexGrow: 1,
            paddingLeft: 1
        },
            children || h(Text, { wrap: 'wrap' }, content)
        )
    );
};

// ═══════════════════════════════════════════════════════════════
// THINKING INDICATOR - Dimmed spinner style
// ═══════════════════════════════════════════════════════════════

/**
 * ThinkingIndicator - Shows AI reasoning steps
 */
export const ThinkingIndicator = ({ steps = [] }) => {
    if (!steps || steps.length === 0) return null;

    return h(Box, {
        flexDirection: 'column',
        marginBottom: 1,
        paddingLeft: 2
    },
        h(Text, { color: RAIL_COLORS.thinking, dimColor: true },
            `${RAIL_ICONS.thinking} Thinking (${steps.length} steps)`),
        ...steps.slice(-3).map((step, i) =>
            h(Text, {
                key: i,
                color: 'gray',
                dimColor: true,
                wrap: 'truncate-end'
            }, `  ${step.slice(0, 60)}${step.length > 60 ? '...' : ''}`)
        )
    );
};

// ═══════════════════════════════════════════════════════════════
// ERROR MESSAGE - Red rail with error content
// ═══════════════════════════════════════════════════════════════

/**
 * ErrorMessage - Red-railed error display
 */
export const ErrorMessage = ({ content, title = 'Error' }) => {
    return h(Box, {
        flexDirection: 'row',
        marginTop: 1
    },
        h(Box, { width: 2, flexShrink: 0 },
            h(Text, { color: RAIL_COLORS.error }, '│')
        ),
        h(Box, { flexDirection: 'column', paddingLeft: 1 },
            h(Text, { color: RAIL_COLORS.error, bold: true }, `${RAIL_ICONS.error} ${title}`),
            h(Text, { color: RAIL_COLORS.error, wrap: 'wrap' }, content)
        )
    );
};

// ═══════════════════════════════════════════════════════════════
// MESSAGE WRAPPER - Auto-selects component by role
// ═══════════════════════════════════════════════════════════════

/**
 * MessageWrapper - Routes to correct component by role
 */
export const MessageWrapper = ({ role, content, meta, isStreaming, children }) => {
    switch (role) {
        case 'system':
            return h(SystemMessage, { content, title: meta?.title });
        case 'user':
            return h(UserMessage, { content });
        case 'assistant':
            return h(AssistantMessage, { content, isStreaming, children });
        case 'error':
            return h(ErrorMessage, { content, title: meta?.title });
        default:
            return h(Text, { wrap: 'wrap' }, content);
    }
};

export default {
    RAIL_COLORS,
    RAIL_ICONS,
    SystemMessage,
    UserMessage,
    AssistantMessage,
    ThinkingIndicator,
    ErrorMessage,
    MessageWrapper
};
