/**
 * Block-Based Markdown Renderer for Ink
 * 
 * CRITICAL FIX: This renderer ensures headings, paragraphs, and lists
 * are NEVER merged into the same line. Each block is a separate Box.
 * 
 * The previous bug: "## Initial Observationssome general thoughts"
 * happened because inline rendering merged blocks.
 * 
 * This renderer:
 * 1. Parses markdown into AST using remark
 * 2. Converts AST to block array
 * 3. Renders each block as a separate Ink Box with spacing
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import React from 'react';
import { Box, Text } from 'ink';
import Highlight from 'ink-syntax-highlight';
import he from 'he';
import { theme } from './tui-theme.mjs';

const h = React.createElement;

// ═══════════════════════════════════════════════════════════════
// BLOCK TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Block types that get their own Box with spacing:
 * - heading: #, ##, ###
 * - paragraph: plain text blocks
 * - code: fenced code blocks
 * - list: ul/ol with items
 * - quote: blockquotes
 * - thematicBreak: horizontal rule
 */

// ═══════════════════════════════════════════════════════════════
// AST TO TEXT EXTRACTION (for inline content)
// ═══════════════════════════════════════════════════════════════

function extractText(node) {
    if (!node) return '';

    if (node.type === 'text') {
        return he.decode(node.value || '');
    }

    if (node.type === 'inlineCode') {
        return node.value || '';
    }

    if (node.children && Array.isArray(node.children)) {
        return node.children.map(extractText).join('');
    }

    return node.value ? he.decode(node.value) : '';
}

// ═══════════════════════════════════════════════════════════════
// INLINE CONTENT RENDERER (for text inside blocks)
// ═══════════════════════════════════════════════════════════════

function renderInline(node, key = 0) {
    if (!node) return null;

    switch (node.type) {
        case 'text':
            return he.decode(node.value || '');

        case 'strong':
            return h(Text, { key, bold: true },
                node.children?.map((c, i) => renderInline(c, i)));

        case 'emphasis':
            return h(Text, { key, italic: true },
                node.children?.map((c, i) => renderInline(c, i)));

        case 'inlineCode':
            return h(Text, {
                key,
                color: theme.colors.warning,
                backgroundColor: 'blackBright'
            }, ` ${node.value} `);

        case 'link':
            return h(Text, { key, color: theme.colors.info, underline: true },
                `${extractText(node)} (${node.url || ''})`);

        case 'paragraph':
        case 'heading':
            // For nested content, just extract children
            return node.children?.map((c, i) => renderInline(c, i));

        default:
            if (node.children) {
                return node.children.map((c, i) => renderInline(c, i));
            }
            return node.value ? he.decode(node.value) : null;
    }
}

// ═══════════════════════════════════════════════════════════════
// BLOCK RENDERERS - Each block gets its own Box with spacing
// ═══════════════════════════════════════════════════════════════

function renderHeading(node, index, width) {
    const depth = node.depth || 1;
    const colors = ['cyan', 'green', 'yellow', 'magenta', 'blue', 'white'];
    const color = colors[Math.min(depth - 1, 5)];
    const prefix = '#'.repeat(depth);
    const text = extractText(node);

    // CRITICAL: marginTop AND marginBottom ensure separation
    return h(Box, {
        key: `heading-${index}`,
        marginTop: 1,
        marginBottom: 1,
        flexDirection: 'column',
        width: width // Enforce width
    },
        h(Text, { bold: true, color, wrap: 'wrap' }, `${prefix} ${text}`)
    );
}

function renderParagraph(node, index, width) {
    // CRITICAL: marginBottom ensures paragraphs don't merge
    return h(Box, {
        key: `para-${index}`,
        marginBottom: 1,
        flexDirection: 'column',
        width: width // Enforce width
    },
        h(Text, { wrap: 'wrap' },
            node.children?.map((c, i) => renderInline(c, i)))
    );
}

function renderCode(node, index, width) {
    const lang = node.lang || 'text';
    const code = he.decode(node.value || '');

    // Supported languages
    const SUPPORTED = ['javascript', 'typescript', 'python', 'java', 'html',
        'css', 'json', 'yaml', 'bash', 'shell', 'sql', 'go', 'rust', 'plaintext'];
    const safeLang = SUPPORTED.includes(lang.toLowerCase()) ? lang.toLowerCase() : 'plaintext';

    try {
        return h(Box, {
            key: `code-${index}`,
            marginTop: 1,
            marginBottom: 1,
            flexDirection: 'column',
            width: width // Enforce width
        },
            h(Box, {
                borderStyle: theme.borders.round,
                borderColor: theme.colors.muted,
                flexDirection: 'column',
                paddingX: 1
            },
                h(Box, { marginBottom: 0 },
                    h(Text, { color: theme.colors.info, bold: true },
                        `${theme.icons.info} ${lang}`)
                ),
                h(Highlight, { code, language: safeLang, theme: 'dracula' })
            )
        );
    } catch (e) {
        return h(Box, {
            key: `code-${index}`,
            marginTop: 1,
            marginBottom: 1,
            flexDirection: 'column'
        },
            h(Box, {
                borderStyle: theme.borders.single,
                borderColor: theme.colors.muted,
                paddingX: 1
            },
                h(Text, {}, code)
            )
        );
    }
}

function renderList(node, index, width) {
    const ordered = node.ordered || false;
    const items = node.children || [];

    // Hanging indent: bullet in fixed-width column, text wraps aligned
    return h(Box, {
        key: `list-${index}`,
        marginTop: 1,
        marginBottom: 1,
        flexDirection: 'column',
        width: width // Enforce width
    },
        items.map((item, i) => {
            const bullet = ordered ? `${i + 1}.` : '•';
            const bulletWidth = ordered ? 4 : 3; // Fixed width for alignment

            return h(Box, {
                key: `item-${i}`,
                flexDirection: 'row'
            },
                // Fixed-width bullet column for hanging indent
                h(Box, { width: bulletWidth, flexShrink: 0 },
                    h(Text, { color: theme.colors.info }, bullet)
                ),
                // Content wraps but stays aligned past bullet
                h(Box, { flexDirection: 'column', flexGrow: 1, flexShrink: 1 },
                    item.children?.map((child, j) => {
                        if (child.type === 'paragraph') {
                            return h(Text, { key: j, wrap: 'wrap' },
                                child.children?.map((c, k) => renderInline(c, k)));
                        }
                        return renderBlock(child, j);
                    })
                )
            );
        })
    );
}

function renderBlockquote(node, index, width) {
    // Decrease width for children by padding
    const innerWidth = width ? width - 2 : undefined;

    return h(Box, {
        key: `quote-${index}`,
        marginTop: 1,
        marginBottom: 1,
        flexDirection: 'row',
        paddingLeft: 2,
        width: width // Enforce width
    },
        h(Text, { color: theme.colors.muted }, '│ '),
        h(Box, { flexDirection: 'column', dimColor: true, width: innerWidth },
            node.children?.map((child, i) => renderBlock(child, i, innerWidth))
        )
    );
}

function renderThematicBreak(index) {
    return h(Box, { key: `hr-${index}`, marginTop: 1, marginBottom: 1 },
        h(Text, { color: theme.colors.muted }, '─'.repeat(40))
    );
}

// ═══════════════════════════════════════════════════════════════
// MAIN BLOCK DISPATCHER
// ═══════════════════════════════════════════════════════════════

function renderBlock(node, index, width) {
    if (!node) return null;

    switch (node.type) {
        case 'heading':
            return renderHeading(node, index, width);

        case 'paragraph':
            return renderParagraph(node, index, width);

        case 'code':
            return renderCode(node, index, width);

        case 'list':
            return renderList(node, index, width);

        case 'blockquote':
            return renderBlockquote(node, index, width);

        case 'thematicBreak':
            return renderThematicBreak(index);

        case 'html':
            // Skip HTML nodes
            return null;

        default:
            // For unknown types, try to extract text
            const text = extractText(node);
            if (text) {
                return h(Box, { key: `unknown-${index}`, marginBottom: 1, width: width },
                    h(Text, { wrap: 'wrap' }, text)
                );
            }
            return null;
    }
}

// ═══════════════════════════════════════════════════════════════
// MAIN MARKDOWN COMPONENT
// ═══════════════════════════════════════════════════════════════

const Markdown = ({ children, syntaxTheme = 'dracula', width }) => {
    if (!children || typeof children !== 'string') {
        return null;
    }

    const content = children.trim();
    if (!content) return null;

    try {
        // Parse markdown into AST
        const processor = unified().use(remarkParse).use(remarkGfm);
        const tree = processor.parse(he.decode(content));

        // Get root children (top-level blocks)
        const blocks = tree.children || [];

        if (blocks.length === 0) {
            return h(Box, { width },
                h(Text, { wrap: 'wrap' }, content)
            );
        }

        // Render each block with proper spacing
        return h(Box, { flexDirection: 'column', width },
            blocks.map((block, i) => renderBlock(block, i, width)).filter(Boolean)
        );
    } catch (err) {
        // Fallback: render as plain text
        return h(Text, { wrap: 'wrap' }, he.decode(content));
    }
};

export default Markdown;
