# Issue #18: Message Copy Button + Chat Search — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a hover copy button to chat messages and a Cmd+F search bar with inline highlighting to the chat pane.

**Architecture:** Two independent features sharing the same files. The copy button is a self-contained addition to `MessageBubble.tsx`. The search bar adds state to `chatStore`, a new `ChatSearchBar.tsx` component, and highlight logic threaded through `MarkdownRenderer`. Both are frontend-only — no Rust changes.

**Tech Stack:** React 19, Zustand 5, Tailwind CSS v4, TypeScript strict mode

**Design doc:** `docs/plans/2026-02-19-issue-18-copy-search-design.md`

---

## Task 1: Add copy button to MessageBubble

**Files:**
- Modify: `src/components/chat/MessageBubble.tsx`

**Step 1: Add a text extraction helper function**

At the bottom of `MessageBubble.tsx`, add a helper that extracts plain text from a `ChatMessage`:

```typescript
function extractTextContent(content: string | ContentBlock[]): string {
  if (typeof content === "string") return content;
  return content
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text!)
    .join("\n\n");
}
```

**Step 2: Add the copy button to the MessageBubble component**

Inside the `MessageBubble` function, add state and a copy handler:

```typescript
const [copied, setCopied] = useState(false);

const handleCopyMessage = useCallback(() => {
  const text = extractTextContent(message.content);
  navigator.clipboard.writeText(text).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  });
}, [message.content]);
```

Then render the button inside the bubble's inner `<div>`, as the first child (before the streaming indicator). Only show for non-streaming, non-system messages:

```tsx
{/* Copy button — hover only */}
{!message.isStreaming && !isSystem && (
  <button
    onClick={handleCopyMessage}
    className="absolute -top-3 right-2 rounded-md bg-bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-text-muted opacity-0 shadow-sm transition-all hover:text-text group-hover:opacity-100"
    title="Copy message"
  >
    {copied ? "Copied!" : "Copy"}
  </button>
)}
```

The bubble's inner `<div>` needs `relative` added to its className for absolute positioning to work.

**Step 3: Verify**

Run: `pnpm exec tsc --noEmit && pnpm build`
Expected: No type errors, build succeeds.

**Step 4: Commit**

```bash
git add src/components/chat/MessageBubble.tsx
git commit -m "feat(chat): add hover copy button to message bubbles

Closes part of #18"
```

---

## Task 2: Add search state to chatStore

**Files:**
- Modify: `src/stores/chatStore.ts`

**Step 1: Add search properties to ChatState interface**

Add after `currentToolInputBuffer`:

```typescript
searchQuery: string;
searchMatchIds: string[];
searchCurrentIndex: number;
```

**Step 2: Add search actions to ChatState interface**

Add after `flushPendingToolCalls`:

```typescript
setSearchQuery: (query: string, messages: ChatMessage[]) => void;
clearSearch: () => void;
nextMatch: () => void;
prevMatch: () => void;
```

**Step 3: Implement the state and actions**

Add defaults:

```typescript
searchQuery: "",
searchMatchIds: [],
searchCurrentIndex: -1,
```

Add action implementations:

```typescript
setSearchQuery: (query, messages) => {
  if (!query.trim()) {
    set({ searchQuery: "", searchMatchIds: [], searchCurrentIndex: -1 });
    return;
  }
  const lowerQuery = query.toLowerCase();
  const matchIds = messages
    .filter((m) => {
      const text = typeof m.content === "string"
        ? m.content
        : m.content
            .filter((b) => b.type === "text" && b.text)
            .map((b) => b.text!)
            .join(" ");
      return text.toLowerCase().includes(lowerQuery);
    })
    .map((m) => m.uuid);
  set({
    searchQuery: query,
    searchMatchIds: matchIds,
    searchCurrentIndex: matchIds.length > 0 ? 0 : -1,
  });
},

clearSearch: () =>
  set({ searchQuery: "", searchMatchIds: [], searchCurrentIndex: -1 }),

nextMatch: () =>
  set((state) => {
    if (state.searchMatchIds.length === 0) return state;
    return {
      searchCurrentIndex:
        (state.searchCurrentIndex + 1) % state.searchMatchIds.length,
    };
  }),

prevMatch: () =>
  set((state) => {
    if (state.searchMatchIds.length === 0) return state;
    return {
      searchCurrentIndex:
        (state.searchCurrentIndex - 1 + state.searchMatchIds.length) %
        state.searchMatchIds.length,
    };
  }),
```

Also update `clearMessages` to reset search state:

```typescript
clearMessages: () =>
  set({
    messages: [],
    streamingText: "",
    compactionCount: 0,
    pendingToolCalls: [],
    currentToolInputBuffer: "",
    searchQuery: "",
    searchMatchIds: [],
    searchCurrentIndex: -1,
  }),
```

**Step 4: Verify**

Run: `pnpm exec tsc --noEmit && pnpm build`
Expected: No type errors, build succeeds.

**Step 5: Commit**

```bash
git add src/stores/chatStore.ts
git commit -m "feat(store): add chat search state and actions to chatStore"
```

---

## Task 3: Create ChatSearchBar component

**Files:**
- Create: `src/components/chat/ChatSearchBar.tsx`

**Step 1: Create the component file**

```typescript
import { useState, useEffect, useRef, useCallback } from "react";
import { useChatStore } from "../../stores/chatStore";

interface ChatSearchBarProps {
  onClose: () => void;
}

export function ChatSearchBar({ onClose }: ChatSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localQuery, setLocalQuery] = useState("");
  const messages = useChatStore((s) => s.messages);
  const setSearchQuery = useChatStore((s) => s.setSearchQuery);
  const clearSearch = useChatStore((s) => s.clearSearch);
  const nextMatch = useChatStore((s) => s.nextMatch);
  const prevMatch = useChatStore((s) => s.prevMatch);
  const searchMatchIds = useChatStore((s) => s.searchMatchIds);
  const searchCurrentIndex = useChatStore((s) => s.searchCurrentIndex);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Sync local query to store (debounced feel via onChange)
  const handleChange = useCallback(
    (value: string) => {
      setLocalQuery(value);
      setSearchQuery(value, messages);
    },
    [messages, setSearchQuery],
  );

  // Keyboard handling
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        clearSearch();
        onClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          prevMatch();
        } else {
          nextMatch();
        }
      }
    },
    [clearSearch, onClose, nextMatch, prevMatch],
  );

  const handleClose = useCallback(() => {
    clearSearch();
    onClose();
  }, [clearSearch, onClose]);

  const matchLabel =
    searchMatchIds.length > 0
      ? `${searchCurrentIndex + 1} of ${searchMatchIds.length}`
      : localQuery
        ? "No results"
        : "";

  return (
    <div className="absolute top-0 right-0 left-0 z-10 flex items-center gap-2 border-b border-border bg-bg-secondary px-4 py-2 shadow-sm">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="flex-shrink-0 text-text-muted"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>

      <input
        ref={inputRef}
        type="text"
        value={localQuery}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search messages..."
        className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
      />

      {matchLabel && (
        <span className="flex-shrink-0 text-xs text-text-muted">{matchLabel}</span>
      )}

      {/* Up arrow */}
      <button
        onClick={prevMatch}
        disabled={searchMatchIds.length === 0}
        className="rounded p-1 text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text disabled:opacity-30"
        title="Previous match (Shift+Enter)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m18 15-6-6-6 6" />
        </svg>
      </button>

      {/* Down arrow */}
      <button
        onClick={nextMatch}
        disabled={searchMatchIds.length === 0}
        className="rounded p-1 text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text disabled:opacity-30"
        title="Next match (Enter)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Close */}
      <button
        onClick={handleClose}
        className="rounded p-1 text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text"
        title="Close (Escape)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  );
}
```

**Step 2: Verify**

Run: `pnpm exec tsc --noEmit && pnpm build`
Expected: No type errors (component isn't rendered yet, just importable).

**Step 3: Commit**

```bash
git add src/components/chat/ChatSearchBar.tsx
git commit -m "feat(chat): create ChatSearchBar component"
```

---

## Task 4: Wire ChatSearchBar into ChatPane and add Cmd+F shortcut

**Files:**
- Modify: `src/components/layout/ChatPane.tsx`
- Modify: `src/hooks/useKeyboardShortcuts.ts`

**Step 1: Update useKeyboardShortcuts**

Add `onToggleSearch` to the `ShortcutHandlers` interface and handle `Cmd+F`:

```typescript
interface ShortcutHandlers {
  onToggleTerminal: () => void;
  onToggleSearch?: () => void;
}
```

Add inside the handler function, before the terminal shortcut:

```typescript
// Cmd+F: Toggle chat search
if (isMod && e.key === "f" && handlers.onToggleSearch) {
  e.preventDefault();
  handlers.onToggleSearch();
}
```

Note: Make `onToggleSearch` optional so existing call sites don't break.

**Step 2: Wire ChatSearchBar into ChatPane**

In `ChatPane.tsx`:

1. Import `ChatSearchBar`:
   ```typescript
   import { ChatSearchBar } from "../chat/ChatSearchBar";
   ```

2. Add state:
   ```typescript
   const [showSearch, setShowSearch] = useState(false);
   ```

3. Read search state for scroll-to-match:
   ```typescript
   const searchQuery = useChatStore((s) => s.searchQuery);
   const searchMatchIds = useChatStore((s) => s.searchMatchIds);
   const searchCurrentIndex = useChatStore((s) => s.searchCurrentIndex);
   ```

4. Add scroll-to-match effect:
   ```typescript
   useEffect(() => {
     if (searchCurrentIndex < 0 || searchMatchIds.length === 0) return;
     const targetId = searchMatchIds[searchCurrentIndex];
     const el = document.querySelector(`[data-message-id="${targetId}"]`);
     el?.scrollIntoView({ behavior: "smooth", block: "center" });
   }, [searchCurrentIndex, searchMatchIds]);
   ```

5. Wrap the messages area in `relative` for the floating bar, and render `ChatSearchBar`:
   ```tsx
   {/* Messages */}
   <div className="relative min-h-0 flex-1 overflow-y-auto">
     {showSearch && (
       <ChatSearchBar onClose={() => setShowSearch(false)} />
     )}
     <MessageList messages={messages} searchQuery={searchQuery} />
   </div>
   ```

**Step 3: Update AppShell or wherever useKeyboardShortcuts is called**

Find the call site of `useKeyboardShortcuts` and pass `onToggleSearch`. This requires checking `AppShell.tsx` to see how to thread the `setShowSearch` state. The simplest approach: move `useKeyboardShortcuts` call into `ChatPane` itself, or lift `showSearch` state.

Alternative (simpler): Add a standalone `useEffect` in `ChatPane` for Cmd+F instead of routing through `useKeyboardShortcuts`:

```typescript
// Cmd+F to toggle search
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "f") {
      e.preventDefault();
      setShowSearch((prev) => !prev);
    }
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, []);
```

This is simpler than threading state through `useKeyboardShortcuts`. Use this approach.

**Step 4: Verify**

Run: `pnpm exec tsc --noEmit && pnpm build`
Expected: No type errors, build succeeds.

**Step 5: Commit**

```bash
git add src/components/layout/ChatPane.tsx src/components/chat/ChatSearchBar.tsx
git commit -m "feat(chat): wire ChatSearchBar into ChatPane with Cmd+F shortcut"
```

---

## Task 5: Thread search highlighting through MessageList and MessageBubble

**Files:**
- Modify: `src/components/chat/MessageList.tsx`
- Modify: `src/components/chat/MessageBubble.tsx`

**Step 1: Update MessageList to pass searchQuery and data-message-id**

Add `searchQuery` to `MessageListProps`:

```typescript
interface MessageListProps {
  messages: ChatMessage[];
  searchQuery?: string;
}
```

Add `data-message-id` to each message wrapper and pass `searchQuery` to `MessageBubble`:

```tsx
<div
  key={msg.uuid}
  data-message-id={msg.uuid}
  className="animate-stagger-in"
  style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
>
  <MessageBubble message={msg} searchQuery={searchQuery} />
</div>
```

**Step 2: Update MessageBubble to accept and pass searchQuery**

Add `searchQuery` to `MessageBubbleProps`:

```typescript
interface MessageBubbleProps {
  message: ChatMessage;
  searchQuery?: string;
}
```

Pass to `MessageContent`:

```tsx
<MessageContent content={message.content} searchQuery={searchQuery} />
```

Update `MessageContent` signature:

```typescript
function MessageContent({ content, searchQuery }: { content: string | ContentBlock[]; searchQuery?: string }) {
```

Pass to `MarkdownRenderer`:

```tsx
<MarkdownRenderer text={content} highlight={searchQuery} />
// and
<MarkdownRenderer key={i} text={block.text} highlight={searchQuery} />
```

**Step 3: Add highlight logic to MarkdownRenderer**

Update `MarkdownRenderer` signature:

```typescript
function MarkdownRenderer({ text, highlight }: { text: string; highlight?: string }) {
```

Create a helper component for highlighted text. Add this inside or near `MarkdownRenderer`:

```typescript
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="rounded-sm bg-warning/30 text-text">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
```

**Important**: The `regex.test()` call advances `lastIndex` on a global regex. Reset it or use a fresh check. Simpler: use `part.toLowerCase() === query.toLowerCase()` instead:

```typescript
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="rounded-sm bg-warning/30 text-text">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
```

Now update the markdown `components` object. For text nodes inside paragraphs, headings, list items, etc., wrap children through `HighlightedText`. The simplest approach: override the `text` component in react-markdown (if available) or process string children in the `p`, `li`, `strong`, `em` components.

The cleanest approach: add a custom `text` handler. React-markdown doesn't directly expose a `text` component, but we can intercept string children in each component. A simpler approach is to preprocess the text and add markers, but that breaks markdown parsing.

**Pragmatic approach**: Only highlight in `p`, `li`, `h1`-`h4`, `td`, `th`, `blockquote` components — wrap their children with `HighlightedText` when children is a string:

Add to each text-containing component in the `components` object a wrapper helper:

```typescript
// At top of MarkdownRenderer, after state hooks:
const wrapHighlight = useCallback(
  (children: React.ReactNode): React.ReactNode => {
    if (!highlight) return children;
    if (typeof children === "string") {
      return <HighlightedText text={children} query={highlight} />;
    }
    if (Array.isArray(children)) {
      return children.map((child, i) =>
        typeof child === "string" ? (
          <HighlightedText key={i} text={child} query={highlight} />
        ) : (
          child
        ),
      );
    }
    return children;
  },
  [highlight],
);
```

Then in each component:
```tsx
p({ children }) {
  return <p className="mb-2 last:mb-0">{wrapHighlight(children)}</p>;
},
```

Apply `wrapHighlight(children)` to: `p`, `li`, `h1`, `h2`, `h3`, `h4`, `td`, `th`, `strong`, `em`, `del`, `blockquote`'s inner content.

**Step 4: Verify**

Run: `pnpm exec tsc --noEmit && pnpm build`
Expected: No type errors, build succeeds.

**Step 5: Visual test**

Run: `pnpm tauri dev`
- Send a few messages in a chat
- Press Cmd+F — search bar should appear
- Type a word that appears in messages — matches should highlight yellow
- Press Enter/Shift+Enter — should cycle through matches and scroll
- Press Escape — bar closes, highlights clear
- Hover a message — copy button should appear
- Click copy — should show "Copied!" and clipboard should have the text

**Step 6: Commit**

```bash
git add src/components/chat/MessageBubble.tsx src/components/chat/MessageList.tsx
git commit -m "feat(chat): add search highlighting to message bubbles

Thread searchQuery through MessageList → MessageBubble → MarkdownRenderer.
Matches are highlighted with <mark> tags in paragraph-level text nodes."
```

---

## Task 6: Final polish and cleanup

**Files:**
- Modify: `src/components/chat/ChatSearchBar.tsx` (if needed)
- Modify: `src/components/layout/ChatPane.tsx` (if needed)

**Step 1: Add top padding to MessageList when search is visible**

When the search bar is shown, messages need extra padding at the top so the first message isn't hidden behind the floating bar. Add a `searchVisible` prop to `MessageList` and conditionally add `pt-12` to the container:

```tsx
<div className={`space-y-6 px-8 py-8 ${searchVisible ? "pt-16" : ""}`}>
```

Or simpler: the search bar is absolutely positioned, so add `pt-12` to the scroll container in `ChatPane` when `showSearch` is true.

**Step 2: Close search when switching sessions**

In `ChatPane`, add an effect that clears search when activeSessionId changes:

```typescript
const clearSearch = useChatStore((s) => s.clearSearch);

useEffect(() => {
  setShowSearch(false);
  clearSearch();
}, [activeSessionId, clearSearch]);
```

**Step 3: Full verification**

Run: `pnpm exec tsc --noEmit && pnpm build`
Expected: Clean build.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(chat): polish search bar padding and session-switch cleanup

Closes #18"
```
