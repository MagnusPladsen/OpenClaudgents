# Issue #18: Message Copy Button + Chat Search — Design

> **Date**: 2026-02-19
> **Status**: Approved
> **Approach**: Minimal React (Approach A)

---

## 1. Copy Button on MessageBubble

- **Trigger**: Hover over any non-streaming, non-system message bubble
- **Position**: Absolutely positioned top-right of the bubble inner div, `opacity-0 group-hover:opacity-100`
- **Content extraction**: `string` content → use directly; `ContentBlock[]` → join `.text` fields (text-only, skip tool_use blocks)
- **Clipboard**: `navigator.clipboard.writeText()`
- **Feedback**: Icon swaps to checkmark for 2 seconds, then reverts
- **Skipped for**: Streaming messages, system messages

No new files — small addition to `MessageBubble.tsx`.

## 2. Chat Search Bar

### Component: `ChatSearchBar.tsx`

- **Trigger**: `Cmd+F` (added to `useKeyboardShortcuts`)
- **Layout**: Absolutely positioned top of ChatPane scroll area, ~44px height, full width with padding
- **Styling**: `bg-bg-secondary border-b border-border`
- **Contains**: Text input, match count ("3 of 12"), up/down arrows, close (X) button
- **Dismiss**: Escape key or X button — clears highlights and closes

### Store additions (`chatStore.ts`)

```typescript
// New state
searchQuery: string;
searchMatchIds: string[];     // UUIDs of messages containing matches
searchCurrentIndex: number;   // Which match is currently focused

// New actions
setSearchQuery: (query: string) => void;
clearSearch: () => void;
nextMatch: () => void;
prevMatch: () => void;
```

### Highlighting

- `searchQuery` passed down: `MessageList` → `MessageBubble` → `MessageContent` → `MarkdownRenderer`
- In `MarkdownRenderer`: before rendering each text node, split at case-insensitive query matches
- Wrap matches in `<mark className="bg-warning/30 text-text rounded-sm">`

### Scroll-to-match

- Each message wrapper in `MessageList` gets `data-message-id={msg.uuid}`
- `nextMatch()` / `prevMatch()` cycle through `searchMatchIds`
- Active match scrolled into view: `element.scrollIntoView({ behavior: "smooth", block: "center" })`

## 3. Files Changed

| File | Change |
|------|--------|
| `MessageBubble.tsx` | Add copy button, accept `searchQuery` prop |
| `MarkdownRenderer` (in MessageBubble.tsx) | Accept `highlight` prop, split text at matches |
| `MessageList.tsx` | Accept/pass `searchQuery`, `data-message-id` on wrappers |
| `ChatPane.tsx` | Render `ChatSearchBar`, wire Cmd+F |
| `chatStore.ts` | Add search state + actions |
| `useKeyboardShortcuts.ts` | Add `Cmd+F` → `onToggleSearch` |
| **New**: `ChatSearchBar.tsx` | Floating search bar component |

## 4. Non-goals

- No regex search
- No search across sessions
- No mark.js or external dependencies
- No Rust backend changes
