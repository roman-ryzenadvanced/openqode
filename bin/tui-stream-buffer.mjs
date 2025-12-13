/**
 * Streaming Buffer Hook for OpenQode TUI
 * 
 * Prevents "reflow per token" chaos by:
 * 1. Buffering incoming tokens
 * 2. Flushing on newlines or after 50ms interval
 * 3. Providing stable committed content for rendering
 */

import { useState, useRef, useCallback } from 'react';

/**
 * useStreamBuffer - Stable streaming text buffer
 * 
 * Instead of re-rendering on every token, this hook:
 * - Accumulates tokens in a pending buffer
 * - Commits to state on newlines or 50ms timeout
 * - Prevents mid-word reflows and jitter
 * 
 * @returns {Object} { committed, pushToken, flushNow, reset }
 */
export function useStreamBuffer(flushInterval = 50) {
    const [committed, setCommitted] = useState('');
    const pendingRef = useRef('');
    const flushTimerRef = useRef(null);

    // Push a token to the pending buffer
    const pushToken = useCallback((token) => {
        pendingRef.current += token;

        // Flush immediately on newline
        if (token.includes('\n')) {
            if (flushTimerRef.current) {
                clearTimeout(flushTimerRef.current);
                flushTimerRef.current = null;
            }
            setCommitted(prev => prev + pendingRef.current);
            pendingRef.current = '';
            return;
        }

        // Schedule flush if not already pending
        if (!flushTimerRef.current) {
            flushTimerRef.current = setTimeout(() => {
                setCommitted(prev => prev + pendingRef.current);
                pendingRef.current = '';
                flushTimerRef.current = null;
            }, flushInterval);
        }
    }, [flushInterval]);

    // Force immediate flush
    const flushNow = useCallback(() => {
        if (flushTimerRef.current) {
            clearTimeout(flushTimerRef.current);
            flushTimerRef.current = null;
        }
        if (pendingRef.current) {
            setCommitted(prev => prev + pendingRef.current);
            pendingRef.current = '';
        }
    }, []);

    // Reset buffer (for new messages)
    const reset = useCallback(() => {
        if (flushTimerRef.current) {
            clearTimeout(flushTimerRef.current);
            flushTimerRef.current = null;
        }
        pendingRef.current = '';
        setCommitted('');
    }, []);

    // Get current total (committed + pending, for display during active streaming)
    const getTotal = useCallback(() => {
        return committed + pendingRef.current;
    }, [committed]);

    return {
        committed,
        pushToken,
        flushNow,
        reset,
        getTotal,
        isPending: pendingRef.current.length > 0
    };
}

/**
 * Resize debounce hook
 * Only reflows content after terminal resize settles
 */
export function useResizeDebounce(callback, delay = 150) {
    const timerRef = useRef(null);

    return useCallback((cols, rows) => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(() => {
            callback(cols, rows);
            timerRef.current = null;
        }, delay);
    }, [callback, delay]);
}

export default { useStreamBuffer, useResizeDebounce };
