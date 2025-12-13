import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

const h = React.createElement;

const ThinkingBlock = ({
    lines = [],
    isThinking = false,
    stats = { chars: 0 },
    width = 80
}) => {
    // If no thinking lines and not thinking, show nothing
    if (lines.length === 0 && !isThinking) return null;

    // Show only last few lines to avoid clutter
    const visibleLines = lines.slice(-3);
    const hiddenCount = Math.max(0, lines.length - 3);

    return h(Box, {
        flexDirection: 'row',
        width: width,
        marginBottom: 1,
        overflow: 'hidden'
    },
        // Left Gutter (Dimmed)
        h(Box, { marginRight: 1, borderStyle: 'single', borderRight: false, borderTop: false, borderBottom: false, borderLeftColor: 'gray', borderDimColor: true }),

        h(Box, { flexDirection: 'column' },
            h(Text, { color: 'gray', dimColor: true },
                isThinking
                    ? `🧠 Thinking${stats.activeAgent ? ` (${stats.activeAgent})` : ''}... (${stats.chars} chars)`
                    : `💭 Thought Process (${stats.chars} chars)`
            ),
            visibleLines.map((line, i) =>
                h(Text, { key: i, color: 'gray', dimColor: true, wrap: 'truncate' }, `  ${line}`)
            ),
            hiddenCount > 0 ? h(Text, { color: 'gray', dimColor: true, italic: true }, `  ...${hiddenCount} more`) : null
        )
    );
};

export default ThinkingBlock;
