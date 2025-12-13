import React from 'react';
import { Box, Text } from 'ink';

const h = React.createElement;

const ChatBubble = ({ role, content, meta, width, children }) => {

    // ═══════════════════════════════════════════════════════════════
    // USER MESSAGE (RIGHT ALIGNED) - RAIL STYLE
    // ═══════════════════════════════════════════════════════════════
    if (role === 'user') {
        return h(Box, { width: width, flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 1, overflow: 'hidden' },
            h(Box, { flexDirection: 'row', paddingRight: 1 },
                h(Text, { color: 'cyan', wrap: 'wrap' }, content),
                h(Box, { marginLeft: 1, borderStyle: 'single', borderLeft: false, borderTop: false, borderBottom: false, borderRightColor: 'cyan' })
            )
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // SYSTEM - MINIMALIST TOAST
    // ═══════════════════════════════════════════════════════════════
    if (role === 'system') {
        return h(Box, { width: width, justifyContent: 'center', marginBottom: 1 },
            h(Text, { color: 'gray', dimColor: true }, ` ${content} `)
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // ERROR - RED GUTTER
    // ═══════════════════════════════════════════════════════════════
    if (role === 'error') {
        // Strip redundant "Error: " prefix if present in content
        const cleanContent = content.replace(/^Error:\s*/i, '');
        return h(Box, { width: width, flexDirection: 'row', marginBottom: 1, overflow: 'hidden' },
            h(Box, { marginRight: 1, borderStyle: 'single', borderRight: false, borderTop: false, borderBottom: false, borderLeftColor: 'red' }),
            h(Text, { color: 'red', wrap: 'wrap' }, cleanContent)
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // ASSISTANT - LEFT GUTTER RAIL
    // ═══════════════════════════════════════════════════════════════
    return h(Box, { width: width, flexDirection: 'row', marginBottom: 1, overflow: 'hidden' },
        // Left Gutter
        h(Box, { marginRight: 1, borderStyle: 'single', borderRight: false, borderTop: false, borderBottom: false, borderLeftColor: 'green' }),

        // Content
        h(Box, { flexDirection: 'column', paddingRight: 2, flexGrow: 1 },
            children ? children : h(Text, { wrap: 'wrap' }, content)
        )
    );
};

export default ChatBubble;
