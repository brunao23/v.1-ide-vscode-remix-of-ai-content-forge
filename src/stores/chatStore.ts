import { create } from 'zustand';
import { Message, Conversation, AGENTS } from '@/types';

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  activeAgentId: string;
  sidebarOpen: boolean;
  selectedModel: string;

  setActiveAgent: (agentId: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setSelectedModel: (model: string) => void;
  createConversation: (agentId: string) => string;
  setActiveConversation: (id: string | null) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, content: string) => void;
  finishStreaming: (conversationId: string, messageId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  activeAgentId: 'brand-book',
  sidebarOpen: true,
  selectedModel: 'claude-opus-4.5',

  setActiveAgent: (agentId) => set({ activeAgentId: agentId, activeConversationId: null }),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  setSelectedModel: (model) => set({ selectedModel: model }),

  createConversation: (agentId) => {
    const id = crypto.randomUUID();
    const conv: Conversation = {
      id,
      agentId,
      title: 'Nova conversa',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    set((s) => ({
      conversations: [conv, ...s.conversations],
      activeConversationId: id,
    }));
    return id;
  },

  setActiveConversation: (id) => set({ activeConversationId: id }),

  addMessage: (conversationId, message) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              messages: [...c.messages, message],
              title: c.messages.length === 0 && message.role === 'user'
                ? message.content.slice(0, 40) + (message.content.length > 40 ? '...' : '')
                : c.title,
              updatedAt: new Date(),
            }
          : c
      ),
    })),

  updateMessage: (conversationId, messageId, content) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, content } : m
              ),
            }
          : c
      ),
    })),

  finishStreaming: (conversationId, messageId) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, isStreaming: false } : m
              ),
            }
          : c
      ),
    })),
}));
