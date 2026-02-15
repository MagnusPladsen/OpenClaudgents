import { create } from "zustand";
import type { ChatMessage } from "../lib/types";

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingText: string;
  compactionCount: number;
  planMode: boolean;
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
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isStreaming: false,
  streamingText: "",
  compactionCount: 0,
  planMode: false,

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

  clearMessages: () => set({ messages: [], streamingText: "", compactionCount: 0 }),

  incrementCompaction: () =>
    set((state) => ({ compactionCount: state.compactionCount + 1 })),

  setPlanMode: (enabled) => set({ planMode: enabled }),

  removeLastMessages: (count) =>
    set((state) => ({
      messages: state.messages.slice(0, Math.max(0, state.messages.length - count)),
    })),
}));
