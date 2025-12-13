# TUI Manual QA Checklist

## Pre-Test Setup
- [ ] Windows Terminal installed
- [ ] PowerShell 7+ available
- [ ] CMD available for fallback testing
- [ ] Linux terminal available (WSL or actual Linux)

## Responsive Layout Tests

### Wide Mode (≥120 columns)
- [ ] Sidebar visible with full width
- [ ] All commands visible in sidebar
- [ ] Multi-Agent status shows correctly
- [ ] Main panel has comfortable width

### Medium Mode (90-119 columns)
- [ ] Sidebar narrower but visible
- [ ] Text truncates without breaking
- [ ] Layout doesn't overflow

### Narrow Mode (<90 columns)
- [ ] Sidebar hidden by default
- [ ] Press Tab → sidebar appears
- [ ] "[Tab] Hide" hint shows in sidebar
- [ ] Press Tab again → sidebar hides
- [ ] Ctrl+P → Command palette opens
- [ ] All commands accessible via palette

### Tiny Mode (<60 cols or <20 rows)
- [ ] Minimal chrome
- [ ] Still functional
- [ ] Input still visible and usable

## Resize Testing
- [ ] Resize from wide to narrow while streaming → no crash
- [ ] Resize to tiny height and back → layout recovers
- [ ] Sidebar visibility persists across mode changes

## Markdown Rendering Tests

### Headings
- [ ] `## Heading` appears on own line
- [ ] Heading has spacing before/after
- [ ] Heading does NOT merge with paragraph text

### Paragraphs
- [ ] Paragraphs separated by blank line
- [ ] Long text wraps cleanly
- [ ] No text bleeding into borders

### Lists
- [ ] Bullets aligned properly
- [ ] Nested lists indented
- [ ] List items don't merge

### Code Blocks
- [ ] Bordered with language label
- [ ] Syntax highlighting works
- [ ] Unknown language falls back gracefully
- [ ] Indentation preserved

## Smart Agent Flow Tests

### Commands
- [ ] `/agents` → Opens menu
- [ ] `/agents on` → "Multi: ON" in sidebar
- [ ] `/agents off` → "Multi: OFF" in sidebar
- [ ] `/agents list` → Shows all 6 agents
- [ ] `/plan` → Switches to planner agent

### Agent Registry
- [ ] Build agent present
- [ ] Plan agent present
- [ ] Test agent present
- [ ] Docs agent present
- [ ] Security agent present
- [ ] Refactor agent present

## Command Palette Tests
- [ ] Ctrl+P opens palette
- [ ] Shows all 12 commands
- [ ] Arrow keys navigate
- [ ] Enter selects command
- [ ] ESC closes palette
- [ ] Selected command appears in input

## Terminal Compatibility

### Windows Terminal
- [ ] Unicode borders render (╭╮╯╰)
- [ ] Emojis display correctly
- [ ] Colors correct

### PowerShell
- [ ] Functional
- [ ] Fallback borders if needed

### CMD
- [ ] Falls back to ASCII borders
- [ ] Still readable and functional

### Linux Terminal (bash/zsh)
- [ ] Unicode renders correctly
- [ ] Colors correct
- [ ] All features work

## Streaming Tests
- [ ] Long response streams smoothly
- [ ] No excessive re-rendering
- [ ] Headings appear properly during stream
- [ ] Code blocks form correctly as they stream

## Existing Feature Verification
- [ ] `/help` works
- [ ] `/context` toggles context
- [ ] `/clear` clears session
- [ ] `/paste` pastes from clipboard
- [ ] `/write` writes pending files
- [ ] `/exit` exits TUI
- [ ] Project selection works
- [ ] Agent selection works
- [ ] Git branch shows correctly

## Pass Criteria
All items must be checked ✓ for QA pass.
Document any failures with screenshots and steps to reproduce.
