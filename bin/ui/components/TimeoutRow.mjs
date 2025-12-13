/**
 * TimeoutRow Component - "Pro" Protocol
 * Interactive component for timeout recovery actions
 * 
 * @module ui/components/TimeoutRow
 */

import React from 'react';
import { Box, Text, useInput } from 'ink';

const { useState } = React;
const h = React.createElement;

// ═══════════════════════════════════════════════════════════════
// TIMEOUT ROW - Non-destructive timeout handling
// ═══════════════════════════════════════════════════════════════

/**
 * TimeoutRow Component
 * Displays interactive recovery options when a request times out
 * 
 * @param {Object} props
 * @param {Function} props.onRetry - Called when user selects Retry
 * @param {Function} props.onCancel - Called when user selects Cancel
 * @param {Function} props.onSaveLogs - Called when user selects Save Logs
 * @param {string} props.lastGoodText - Last successful text before timeout
 * @param {number} props.elapsedTime - Time elapsed before timeout (seconds)
 */
export const TimeoutRow = ({
    onRetry,
    onCancel,
    onSaveLogs,
    lastGoodText = '',
    elapsedTime = 120
}) => {
    const [selectedAction, setSelectedAction] = useState(0);
    const actions = [
        { key: 'r', label: '[R]etry', color: 'yellow', action: onRetry },
        { key: 'c', label: '[C]ancel', color: 'gray', action: onCancel },
        { key: 's', label: '[S]ave Logs', color: 'blue', action: onSaveLogs }
    ];

    // Handle keyboard input
    useInput((input, key) => {
        const lowerInput = input.toLowerCase();

        // Direct key shortcuts
        if (lowerInput === 'r' && onRetry) {
            onRetry();
            return;
        }
        if (lowerInput === 'c' && onCancel) {
            onCancel();
            return;
        }
        if (lowerInput === 's' && onSaveLogs) {
            onSaveLogs();
            return;
        }

        // Arrow key navigation
        if (key.leftArrow) {
            setSelectedAction(prev => Math.max(0, prev - 1));
        }
        if (key.rightArrow) {
            setSelectedAction(prev => Math.min(actions.length - 1, prev + 1));
        }

        // Enter to confirm selected action
        if (key.return) {
            const action = actions[selectedAction]?.action;
            if (action) action();
        }
    });

    return h(Box, {
        flexDirection: 'column',
        marginTop: 1,
        paddingLeft: 2
    },
        // Warning indicator
        h(Box, { marginBottom: 0 },
            h(Text, { color: 'yellow', bold: true }, '⚠ '),
            h(Text, { color: 'yellow' }, `Request timed out (${elapsedTime}s)`)
        ),

        // Action buttons
        h(Box, { marginTop: 0 },
            ...actions.map((action, i) =>
                h(Box, { key: action.key, marginRight: 2 },
                    h(Text, {
                        color: i === selectedAction ? 'white' : action.color,
                        inverse: i === selectedAction,
                        bold: i === selectedAction
                    }, ` ${action.label} `)
                )
            )
        ),

        // Context info (dimmed)
        lastGoodText ? h(Box, { marginTop: 0 },
            h(Text, { color: 'gray', dimColor: true },
                `${lastGoodText.split('\n').length} paragraphs preserved`)
        ) : null
    );
};

// ═══════════════════════════════════════════════════════════════
// RUN STATES - State machine for assistant responses
// ═══════════════════════════════════════════════════════════════

export const RUN_STATES = {
    IDLE: 'idle',
    STREAMING: 'streaming',
    WAITING_FOR_TOOL: 'waiting_for_tool',
    COMPLETE: 'complete',
    TIMED_OUT: 'timed_out',
    CANCELLED: 'cancelled'
};

/**
 * Create a new Run object
 * @param {string} id - Unique run ID
 * @param {string} prompt - Original user prompt
 * @returns {Object} New run object
 */
export function createRun(id, prompt) {
    return {
        id,
        prompt,
        state: RUN_STATES.IDLE,
        partialText: '',
        lastCheckpoint: '',
        startTime: Date.now(),
        lastActivityTime: Date.now(),
        tokensReceived: 0,
        error: null,
        metadata: {}
    };
}

/**
 * Update run state with new data
 * @param {Object} run - Current run object
 * @param {Object} updates - Updates to apply
 * @returns {Object} Updated run object
 */
export function updateRun(run, updates) {
    return {
        ...run,
        ...updates,
        lastActivityTime: Date.now()
    };
}

/**
 * Checkpoint the run for potential resume
 * @param {Object} run - Current run object
 * @returns {Object} Run with checkpoint set
 */
export function checkpointRun(run) {
    // Find last complete paragraph for clean resume point
    const text = run.partialText || '';
    const paragraphs = text.split('\n\n');
    const completeParagraphs = paragraphs.slice(0, -1).join('\n\n');

    return {
        ...run,
        lastCheckpoint: completeParagraphs || text
    };
}

/**
 * Calculate overlap for resume deduplication
 * @param {string} checkpoint - Last checkpointed text
 * @param {string} newText - New text from resumed generation
 * @returns {string} Deduplicated combined text
 */
export function deduplicateResume(checkpoint, newText) {
    if (!checkpoint || !newText) return newText || checkpoint || '';

    // Find overlap at end of checkpoint / start of newText
    const checkpointLines = checkpoint.split('\n');
    const newLines = newText.split('\n');

    // Look for matching lines to find overlap point
    let overlapStart = 0;
    for (let i = 0; i < newLines.length && i < 10; i++) {
        const line = newLines[i].trim();
        if (line && checkpointLines.some(cl => cl.trim() === line)) {
            overlapStart = i + 1;
            break;
        }
    }

    // Return checkpoint + non-overlapping new content
    const uniqueNewContent = newLines.slice(overlapStart).join('\n');
    return checkpoint + (uniqueNewContent ? '\n\n' + uniqueNewContent : '');
}

export default {
    TimeoutRow,
    RUN_STATES,
    createRun,
    updateRun,
    checkpointRun,
    deduplicateResume
};
