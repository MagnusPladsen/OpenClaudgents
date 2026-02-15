# Status Bar Redesign — Issue #4

## Problem
The current status bar packs 6+ elements with equal visual weight into a 40px strip, making it hard to scan. The context budget bar is particularly confusing (tiny 96px bar with 8px font overlay).

## Decision
VS Code-style segmented bar with clear left/right layout and a hover tooltip for detailed metrics.

## Layout

```
+--------------------------------------------------------------+
|  git-icon main (2)  |  Sonnet  |        |  [====----] 42%  | >_ |
|  [git info]          [model]    [spacer] [context bar]      [term]
+--------------------------------------------------------------+
```

### Left segment (session context)
- Git branch: icon + name + dirty count. Warning color when dirty. Worktree badge if applicable.
- Model badge: Short name in accent pill.

### Right segment (resources + actions)
- Context budget bar: 120px, color-coded (green < 60%, yellow 60-85%, red > 85%). Hover tooltip with full breakdown.
- Terminal toggle: icon, highlighted when open.

### Removed
- Status dot + label (redundant with sidebar activity indicators)
- Message count (low value)
- Inline token/cost text (moved to tooltip)

## Tooltip Content
```
Context: 42% used
---
Input:  38.2k tokens
Output: 4.1k tokens
Total:  42.3k / 200k
Cost:   $0.12
```

## Visual Specs
- Height: h-10 (40px)
- Segment dividers: border-r border-border/10
- Segment padding: px-3
- Hover: hover:bg-bg-tertiary/40
- Tooltip: rounded-lg bg-bg-secondary border border-border/50 shadow-xl, 200ms hover delay, appears above bar

## Files to Modify
- `src/components/layout/StatusBar.tsx` — Full rewrite
