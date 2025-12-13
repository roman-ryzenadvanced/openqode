/**
 * TUI Theme Module - Centralized styling for OpenQode TUI
 * Provides consistent colors, spacing, and border styles
 * With capability detection for cross-platform compatibility
 */

// Capability detection
const hasUnicode = process.platform !== 'win32' ||
    process.env.WT_SESSION || // Windows Terminal
    process.env.TERM_PROGRAM === 'vscode'; // VS Code integrated terminal

// Theme configuration
export const theme = {
    // Spacing scale (terminal rows/chars)
    spacing: {
        xs: 0,
        sm: 1,
        md: 2,
        lg: 3
    },

    // Semantic colors
    colors: {
        fg: 'white',
        muted: 'gray',
        border: 'gray',
        info: 'cyan',
        success: 'green',
        warning: 'yellow',
        error: 'red',
        accent: 'magenta',
        user: 'cyan',
        assistant: 'white',
        system: 'yellow'
    },

    // Border styles with fallback
    borders: {
        default: hasUnicode ? 'round' : 'single',
        single: 'single',
        round: hasUnicode ? 'round' : 'single',
        double: hasUnicode ? 'double' : 'single'
    },

    // Card-specific styles
    cards: {
        system: {
            borderStyle: hasUnicode ? 'round' : 'single',
            borderColor: 'yellow',
            paddingX: 1,
            paddingY: 0,
            marginBottom: 1
        },
        user: {
            marginTop: 1,
            marginBottom: 1,
            promptIcon: hasUnicode ? '❯' : '>',
            promptColor: 'cyan'
        },
        assistant: {
            borderStyle: 'single',
            borderColor: 'gray',
            paddingX: 1,
            paddingY: 0,
            marginBottom: 1,
            divider: hasUnicode ? '── Assistant ──' : '-- Assistant --'
        },
        error: {
            borderStyle: hasUnicode ? 'round' : 'single',
            borderColor: 'red',
            paddingX: 1,
            paddingY: 0,
            marginBottom: 1,
            icon: hasUnicode ? '⚠' : '!'
        }
    },

    // Icons with fallback
    icons: {
        info: hasUnicode ? 'ℹ' : 'i',
        warning: hasUnicode ? '⚠' : '!',
        error: hasUnicode ? '✗' : 'X',
        success: hasUnicode ? '✓' : 'OK',
        bullet: hasUnicode ? '•' : '-',
        arrow: hasUnicode ? '→' : '->',
        prompt: hasUnicode ? '❯' : '>'
    }
};

export default theme;
