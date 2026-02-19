import { create } from "zustand";
import type { ChatMessage, ToolCall } from "../lib/types";

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingText: string;
  compactionCount: number;
  planMode: boolean;
  pendingToolCalls: ToolCall[];
  currentToolInputBuffer: string;
  searchQuery: string;
  searchMatchIds: string[];
  searchCurrentIndex: number;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (uuid: string, updates: Partial<ChatMessage>) => void;
  setStreaming: (isStreaming: boolean) => void;
  appendStreamingText: (text: string) => void;
  resetStreamingText: () => void;
  clearMessages: () => void;
  incrementCompaction: () => void;
  setPlanMode: (enabled: boolean) => void;
  removeLastMessages: (count: number) => void;
  startToolCall: (id: string, name: string) => void;
  appendToolInput: (partialJson: string) => void;
  flushPendingToolCalls: () => ToolCall[];
  setSearchQuery: (query: string, messages: ChatMessage[]) => void;
  clearSearch: () => void;
  nextMatch: () => void;
  prevMatch: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  streamingText: "",
  compactionCount: 0,
  planMode: false,
  pendingToolCalls: [],
  currentToolInputBuffer: "",
  searchQuery: "",
  searchMatchIds: [],
  searchCurrentIndex: -1,

  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  updateMessage: (uuid, updates) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.uuid === uuid ? { ...m, ...updates } : m,
      ),
    })),

  setStreaming: (isStreaming) => set({ isStreaming }),

  appendStreamingText: (text) =>
    set((state) => ({ streamingText: state.streamingText + text })),

  resetStreamingText: () => set({ streamingText: "" }),

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

  incrementCompaction: () =>
    set((state) => ({ compactionCount: state.compactionCount + 1 })),

  setPlanMode: (enabled) => set({ planMode: enabled }),

  removeLastMessages: (count) =>
    set((state) => ({
      messages: state.messages.slice(0, Math.max(0, state.messages.length - count)),
    })),

  startToolCall: (id, name) => {
    const state = get();
    // Finalize the previous tool's input buffer if any
    const updated = [...state.pendingToolCalls];
    if (updated.length > 0 && state.currentToolInputBuffer) {
      const last = updated[updated.length - 1];
      try {
        last.input = JSON.parse(state.currentToolInputBuffer);
      } catch {
        last.input = { raw: state.currentToolInputBuffer };
      }
    }
    updated.push({ id, name, input: {}, status: "running" });
    set({ pendingToolCalls: updated, currentToolInputBuffer: "" });
  },

  appendToolInput: (partialJson) =>
    set((state) => ({ currentToolInputBuffer: state.currentToolInputBuffer + partialJson })),

  flushPendingToolCalls: () => {
    const state = get();
    const tools = [...state.pendingToolCalls];
    // Finalize the last tool's input
    if (tools.length > 0 && state.currentToolInputBuffer) {
      const last = tools[tools.length - 1];
      try {
        last.input = JSON.parse(state.currentToolInputBuffer);
      } catch {
        last.input = { raw: state.currentToolInputBuffer };
      }
    }
    // Mark all as completed
    for (const tool of tools) {
      tool.status = "completed";
    }
    set({ pendingToolCalls: [], currentToolInputBuffer: "" });
    return tools;
  },

  setSearchQuery: (query, messages) => {
    if (!query.trim()) {
      set({ searchQuery: "", searchMatchIds: [], searchCurrentIndex: -1 });
      return;
    }
    const lowerQuery = query.toLowerCase();
    const matchIds = messages
      .filter((m) => {
        const text =
          typeof m.content === "string"
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
}));
