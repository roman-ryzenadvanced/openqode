/**
 * Responsive Layout Module for OpenQode TUI
 * Handles terminal size breakpoints, sidebar sizing, and layout modes
 * 
 * Breakpoints:
 * - Wide: columns >= 120 (full sidebar)
 * - Medium: 90 <= columns < 120 (narrower sidebar)
 * - Narrow: 60 <= columns < 90 (collapsed sidebar, Tab toggle)
 * - Tiny: columns < 60 OR rows < 20 (minimal chrome)
 */

import stringWidth from 'string-width';
import cliTruncate from 'cli-truncate';

// ═══════════════════════════════════════════════════════════════
// LAYOUT MODE DETECTION
// ═══════════════════════════════════════════════════════════════

/**
 * Compute layout mode based on terminal dimensions
 * @param {number} cols - Terminal columns
 * @param {number} rows - Terminal rows
 * @returns {Object} Layout configuration
 */
export function computeLayoutMode(cols, rows) {
    const c = cols ?? 80;
    const r = rows ?? 24;

    // Tiny mode: very small terminal
    if (c < 60 || r < 20) {
        return {
            mode: 'tiny',
            cols: c,
            rows: r,
            sidebarWidth: 0,
            sidebarCollapsed: true,
            showBorders: false,
            paddingX: 0,
            paddingY: 0
        };
    }

    // Narrow mode: sidebar collapsed by default but toggleable
    if (c < 90) {
        return {
            mode: 'narrow',
            cols: c,
            rows: r,
            sidebarWidth: 0, // collapsed by default
            sidebarCollapsedDefault: true,
            sidebarExpandedWidth: Math.min(24, Math.floor(c * 0.28)),
            showBorders: true,
            paddingX: 1,
            paddingY: 0
        };
    }

    // Medium mode: narrower sidebar
    if (c < 120) {
        return {
            mode: 'medium',
            cols: c,
            rows: r,
            sidebarWidth: Math.min(26, Math.floor(c * 0.25)),
            sidebarCollapsed: false,
            showBorders: true,
            paddingX: 1,
            paddingY: 0
        };
    }

    // Wide mode: full sidebar
    return {
        mode: 'wide',
        cols: c,
        rows: r,
        sidebarWidth: Math.min(32, Math.floor(c * 0.25)),
        sidebarCollapsed: false,
        showBorders: true,
        paddingX: 1,
        paddingY: 0
    };
}

// ═══════════════════════════════════════════════════════════════
// SIDEBAR UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Get sidebar width for current mode and toggle state
 * @param {Object} layout - Layout configuration
 * @param {boolean} isExpanded - Whether sidebar is manually expanded
 * @returns {number} Sidebar width in columns
 */
export function getSidebarWidth(layout, isExpanded) {
    if (layout.mode === 'tiny') return 0;

    if (layout.mode === 'narrow') {
        return isExpanded ? (layout.sidebarExpandedWidth || 24) : 0;
    }

    return layout.sidebarWidth;
}

/**
 * Get main content width
 * @param {Object} layout - Layout configuration
 * @param {number} sidebarWidth - Current sidebar width
 * @returns {number} Main content width
 */
export function getMainWidth(layout, sidebarWidth) {
    const borders = sidebarWidth > 0 ? 6 : 4; // increased safety margin (was 4:2, now 6:4)
    return Math.max(20, layout.cols - sidebarWidth - borders);
}

// ═══════════════════════════════════════════════════════════════
// TEXT UTILITIES (using string-width for accuracy)
// ═══════════════════════════════════════════════════════════════

/**
 * Truncate text to fit width (unicode-aware)
 * @param {string} text - Text to truncate
 * @param {number} width - Maximum width
 * @returns {string} Truncated text
 */
export function truncateText(text, width) {
    if (!text) return '';
    return cliTruncate(String(text), width, { position: 'end' });
}

/**
 * Get visual width of text (unicode-aware)
 * @param {string} text - Text to measure
 * @returns {number} Visual width
 */
export function getTextWidth(text) {
    if (!text) return 0;
    return stringWidth(String(text));
}

/**
 * Pad text to specific width
 * @param {string} text - Text to pad
 * @param {number} width - Target width
 * @param {string} char - Padding character
 * @returns {string} Padded text
 */
export function padText(text, width, char = ' ') {
    if (!text) return char.repeat(width);
    const currentWidth = getTextWidth(text);
    if (currentWidth >= width) return truncateText(text, width);
    return text + char.repeat(width - currentWidth);
}

// ═══════════════════════════════════════════════════════════════
// VIEWPORT HEIGHT CALCULATION
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate viewport dimensions for message list
 * @param {Object} layout - Layout configuration
 * @param {Object} options - Additional options
 * @returns {Object} Viewport dimensions
 */
export function calculateViewport(layout, options = {}) {
    const {
        headerRows = 0,
        inputRows = 3,
        thinkingRows = 0,
        marginsRows = 2
    } = options;

    const totalReserved = headerRows + inputRows + thinkingRows + marginsRows;
    const messageViewHeight = Math.max(4, layout.rows - totalReserved);

    // Estimate how many messages fit (conservative: ~4 lines per message avg)
    const linesPerMessage = 4;
    const maxVisibleMessages = Math.max(2, Math.floor(messageViewHeight / linesPerMessage));

    return {
        viewHeight: messageViewHeight,
        maxMessages: maxVisibleMessages,
        inputRows,
        headerRows
    };
}

// ═══════════════════════════════════════════════════════════════
// LAYOUT CONSTANTS
// ═══════════════════════════════════════════════════════════════

export const LAYOUT_CONSTANTS = {
    // Minimum dimensions
    MIN_SIDEBAR_WIDTH: 20,
    MIN_MAIN_WIDTH: 40,
    MIN_MESSAGE_VIEW_HEIGHT: 4,

    // Default padding
    DEFAULT_PADDING_X: 1,
    DEFAULT_PADDING_Y: 0,

    // Message estimation
    LINES_PER_MESSAGE: 4,

    // Input area
    INPUT_BOX_HEIGHT: 3,
    INPUT_BORDER_HEIGHT: 2
};

export default {
    computeLayoutMode,
    getSidebarWidth,
    getMainWidth,
    truncateText,
    getTextWidth,
    padText,
    calculateViewport,
    LAYOUT_CONSTANTS
};
