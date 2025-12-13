import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import * as Diff from 'diff';

const h = React.createElement;

const DiffView = ({
    original = '',
    modified = '',
    file = 'unknown.js',
    onApply,
    onSkip,
    width = 80,
    height = 20
}) => {
    // Generate diff objects
    // [{ value: 'line', added: boolean, removed: boolean }]
    const diff = Diff.diffLines(original, modified);

    // Scroll state
    const [scrollTop, setScrollTop] = useState(0);

    // Calculate total lines for scrolling
    const totalLines = diff.reduce((acc, part) => acc + part.value.split('\n').length - 1, 0);
    const visibleLines = height - 4; // Header + Footer space

    useInput((input, key) => {
        if (key.upArrow) {
            setScrollTop(prev => Math.max(0, prev - 1));
        }
        if (key.downArrow) {
            setScrollTop(prev => Math.min(totalLines - visibleLines, prev + 1));
        }
        if (key.pageUp) {
            setScrollTop(prev => Math.max(0, prev - visibleLines));
        }
        if (key.pageDown) {
            setScrollTop(prev => Math.min(totalLines - visibleLines, prev + visibleLines));
        }

        if (input === 'y' || input === 'Y' || key.return) {
            onApply();
        }
        if (input === 'n' || input === 'N' || key.escape) {
            onSkip();
        }
    });

    // Render Logic
    let currentLine = 0;
    const renderedLines = [];

    diff.forEach((part) => {
        const lines = part.value.split('\n');
        // last element of split is often empty if value ends with newline
        if (lines[lines.length - 1] === '') lines.pop();

        lines.forEach((line) => {
            currentLine++;
            // Check visibility
            if (currentLine <= scrollTop || currentLine > scrollTop + visibleLines) {
                return;
            }

            let color = 'gray'; // Unchanged
            let prefix = '  ';
            let bg = undefined;

            if (part.added) {
                color = 'green';
                prefix = '+ ';
            } else if (part.removed) {
                color = 'red';
                prefix = '- ';
            }

            renderedLines.push(
                h(Box, { key: currentLine, width: '100%' },
                    h(Text, { color: 'gray', dimColor: true }, `${currentLine.toString().padEnd(4)} `),
                    h(Text, { color: color, backgroundColor: bg, wrap: 'truncate-end' }, prefix + line)
                )
            );
        });
    });

    return h(Box, {
        flexDirection: 'column',
        width: width,
        height: height,
        borderStyle: 'double',
        borderColor: 'yellow'
    },
        // Header
        h(Box, { flexDirection: 'column', paddingX: 1, borderStyle: 'single', borderBottom: true, borderTop: false, borderLeft: false, borderRight: false },
            h(Text, { bold: true, color: 'yellow' }, `Reviewing: ${file}`),
            h(Box, { justifyContent: 'space-between' },
                h(Text, { dimColor: true }, `Lines: ${totalLines} | Changes: ${diff.filter(p => p.added || p.removed).length} blocks`),
                h(Text, { color: 'blue' }, 'UP/DOWN to scroll')
            )
        ),

        // Diff Content
        h(Box, { flexDirection: 'column', flexGrow: 1, paddingX: 1 },
            renderedLines.length > 0
                ? renderedLines
                : h(Text, { color: 'gray' }, 'No changes detected (Files are identical)')
        ),

        // Footer Actions
        h(Box, {
            borderStyle: 'single',
            borderTop: true,
            borderBottom: false,
            borderLeft: false,
            borderRight: false,
            paddingX: 1,
            justifyContent: 'center',
            gap: 4
        },
            h(Text, { color: 'green', bold: true }, '[Y] Apply Changes'),
            h(Text, { color: 'red', bold: true }, '[N] Discard/Skip')
        )
    );
};

export default DiffView;
