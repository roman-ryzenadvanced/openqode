# TUI Professional Visual Redesign - Implementation Plan

## Goal
Improve TUI text rendering to be professional-grade like Claude Code, fixing HTML entities, text wrapping, streaming jitter, and layout consistency. **VISUAL ONLY - NO functionality changes.**

---

## User Review Required

> [!IMPORTANT]
> **New Dependencies Required**: This plan requires installing `he` (HTML entity decoder) and `wrap-ansi` (width-aware text wrapping). Both are lightweight, pure ESM-compatible, and widely used.

---

## Root Cause Analysis

| Issue | Source | Fix |
|-------|--------|-----|
| `&#39;` showing literally | `marked` outputs HTML entities, no decoder | Add `he.decode()` before rendering |
| Text bleeding into borders | No width calculation for wrapping | Use `wrap-ansi` with calculated width |
| Inconsistent spacing | No theme system, hardcoded values | Create centralized theme module |
| Streaming jitter | React re-renders on every token | Add batched streaming component |
| List indentation broken | Inline tokens not properly wrapped | Fix list rendering in markdown |

---

## Proposed Changes

### Phase 1: Add Dependencies

```bash
npm install he wrap-ansi
```

---

### Phase 2: Create Theme Module

#### [NEW] bin/tui-theme.mjs
Central theme configuration:
- Spacing scale: xs=0, sm=1, md=2, lg=3
- Semantic colors: fg, muted, info, warning, error, accent, border
- Border styles with fallback for non-unicode terminals
- Consistent component styling

---

### Phase 3: Fix Markdown Renderer

#### [MODIFY] bin/ink-markdown-esm.mjs
**Changes:**
1. Import `he` for HTML entity decoding
2. Import `wrap-ansi` for width-aware wrapping
3. Apply `he.decode()` to all text content before rendering
4. Fix inline token rendering to decode entities
5. Improve list item wrapping and indentation
6. Add terminal width awareness for proper wrapping

---

### Phase 4: Update Card Components

#### [MODIFY] bin/opencode-ink.mjs (lines 477-590)
**Changes:**
1. Import theme module
2. Update SystemCard, UserCard, AgentCard, ErrorCard to use theme
3. Add consistent padding/margin from theme
4. Add flex-based width constraints
5. Ensure proper overflow handling

---

### Phase 5: Add Streaming Stability (Optional)

#### [MODIFY] bin/opencode-ink.mjs
**Changes:**
1. Add batched state update for streaming content
2. Implement 16ms throttle to reduce jitter
3. Use stable keys for message list

---

## Verification Plan

### Manual Testing (User)
Since there are no automated TUI tests in this project, verification is manual:

1. **HTML Entity Test**:
   - Launch TUI: `node bin/opencode-ink.mjs`
   - Send message containing apostrophes: "what's the best approach?"
   - ✅ Verify: apostrophes render as `'` not `&#39;`

2. **Text Wrapping Test**:
   - Resize terminal to 80 columns
   - Send long message
   - ✅ Verify: text wraps cleanly, doesn't touch borders

3. **List Rendering Test**:
   - Ask AI to list something: "list 5 programming languages"
   - ✅ Verify: bullet points render with proper indentation

4. **Code Block Test**:
   - Ask AI for code: "write a hello world in Python"
   - ✅ Verify: code block has border, syntax highlighting

5. **Streaming Stability Test**:
   - Send message requiring long response
   - ✅ Verify: output streams without major jitter

6. **Functionality Preservation Test**:
   - `/help` → Shows help card
   - `/agents` → Shows agent menu with scrolling
   - `/context` → Toggles context
   - `/clear` → Clears messages
   - ✅ All commands work exactly as before

### Cross-Platform Testing
- Windows Terminal + PowerShell
- Windows CMD
- Linux bash (if available)
