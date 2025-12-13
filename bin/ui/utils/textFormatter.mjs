/**
 * Text Formatter Utilities - "Pro" Protocol
 * Sanitizes text before rendering to remove debug noise and HTML entities
 * 
 * @module ui/utils/textFormatter
 */

import he from 'he';

// ═══════════════════════════════════════════════════════════════
// SANITIZATION PATTERNS
// ═══════════════════════════════════════════════════════════════

// Debug log patterns to strip
const DEBUG_PATTERNS = [
    /\d+\s+[A-Z]:\\[^\n]+/g,           // Windows paths: "xx E:\path\to\file"
    /\[\d{4}-\d{2}-\d{2}[^\]]+\]/g,    // Timestamps: "[2024-01-01 12:00:00]"
    /DEBUG:\s*[^\n]+/gi,                // DEBUG: messages
    /^>\s*undefined$/gm,                // Stray undefined
    /^\s*at\s+[^\n]+$/gm,              // Stack trace lines
];

// HTML entities that commonly appear in AI output
const ENTITY_MAP = {
    '&#39;': "'",
    '&quot;': '"',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&nbsp;': ' ',
    '&#x27;': "'",
    '&#x2F;': '/',
};

// ═══════════════════════════════════════════════════════════════
// CORE SANITIZERS
// ═══════════════════════════════════════════════════════════════

/**
 * Decode HTML entities to clean text
 * @param {string} text - Raw text with possible HTML entities
 * @returns {string} Clean text
 */
export function decodeEntities(text) {
    if (!text || typeof text !== 'string') return '';

    // First pass: common entities via map
    let result = text;
    for (const [entity, char] of Object.entries(ENTITY_MAP)) {
        result = result.replace(new RegExp(entity, 'g'), char);
    }

    // Second pass: use 'he' library for comprehensive decoding
    try {
        result = he.decode(result);
    } catch (e) {
        // Fallback if he fails
    }

    return result;
}

/**
 * Strip debug noise from text
 * @param {string} text - Text with possible debug output
 * @returns {string} Clean text without debug noise
 */
export function stripDebugNoise(text) {
    if (!text || typeof text !== 'string') return '';

    let result = text;
    for (const pattern of DEBUG_PATTERNS) {
        result = result.replace(pattern, '');
    }

    // Clean up resulting empty lines
    result = result.replace(/\n{3,}/g, '\n\n');

    return result.trim();
}

/**
 * Fix broken list formatting
 * @param {string} text - Text with potentially broken lists
 * @returns {string} Text with fixed list formatting
 */
export function fixListFormatting(text) {
    if (!text || typeof text !== 'string') return '';

    // Fix bullet points that got mangled
    let result = text
        .replace(/•\s*([a-z])/g, '• $1')        // Fix stuck bullets
        .replace(/(\d+)\.\s*([a-z])/g, '$1. $2') // Fix numbered lists
        .replace(/:\s*\n\s*•/g, ':\n\n•')       // Add spacing before lists
        .replace(/([.!?])\s*•/g, '$1\n\n•');    // Add line break before bullets

    return result;
}

/**
 * Ensure proper paragraph spacing
 * @param {string} text - Text to process
 * @returns {string} Text with proper paragraph breaks
 */
export function ensureParagraphSpacing(text) {
    if (!text || typeof text !== 'string') return '';

    // Ensure sentences starting new topics get proper breaks
    let result = text
        .replace(/([.!?])\s*([A-Z][a-z])/g, '$1\n\n$2') // New sentence, new paragraph
        .replace(/\n{4,}/g, '\n\n\n');                   // Max 3 newlines

    return result;
}

// ═══════════════════════════════════════════════════════════════
// MAIN PIPELINE
// ═══════════════════════════════════════════════════════════════

/**
 * Full sanitization pipeline for content before rendering
 * @param {string} text - Raw text from AI or system
 * @returns {string} Clean, formatted text ready for display
 */
export function cleanContent(text) {
    if (!text || typeof text !== 'string') return '';

    let result = text;

    // Step 1: Decode HTML entities
    result = decodeEntities(result);

    // Step 2: Strip debug noise
    result = stripDebugNoise(result);

    // Step 3: Fix list formatting
    result = fixListFormatting(result);

    // Step 4: Normalize whitespace
    result = result.replace(/\r\n/g, '\n').trim();

    return result;
}

/**
 * Format for single-line display (status messages, etc)
 * @param {string} text - Text to format
 * @param {number} maxLength - Maximum length before truncation
 * @returns {string} Single-line formatted text
 */
export function formatSingleLine(text, maxLength = 80) {
    if (!text || typeof text !== 'string') return '';

    let result = cleanContent(text);

    // Collapse to single line
    result = result.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();

    // Truncate if needed
    if (result.length > maxLength) {
        result = result.slice(0, maxLength - 3) + '...';
    }

    return result;
}

export default {
    cleanContent,
    decodeEntities,
    stripDebugNoise,
    fixListFormatting,
    ensureParagraphSpacing,
    formatSingleLine
};
