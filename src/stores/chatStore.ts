import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Message, Conversation } from '@/types';
import { getModelById } from '@/config/models';

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  activeAgentId: string;
  sidebarOpen: boolean;
  selectedModel: string;
  thinkingMode: boolean;
  activePage:
    | 'home'
    | 'chat'
    | 'market-research'
    | 'creator-kit'
    | 'implementation'
    | 'aulas'
    | 'metrics'
    | 'calendario'
    | 'news-feed'
    | 'admin'
    | 'admin-insights'
    | 'admin-global'
    | 'admin-access';

  setActiveAgent: (agentId: string) => void;
  setActiveAgentContext: (agentId: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setSelectedModel: (model: string) => void;
  setThinkingMode: (on: boolean) => void;
  setActivePage: (
    page:
      | 'home'
      | 'chat'
      | 'market-research'
      | 'creator-kit'
      | 'implementation'
      | 'aulas'
      | 'metrics'
      | 'calendario'
      | 'news-feed'
      | 'admin'
      | 'admin-insights'
      | 'admin-global'
      | 'admin-access'
  ) => void;
  createConversation: (agentId: string) => string;
  setActiveConversation: (id: string | null) => void;
  hydrateConversations: (conversations: Conversation[]) => void;
  clearConversations: () => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, content: string) => void;
  finishStreaming: (conversationId: string, messageId: string) => void;
  deleteConversation: (conversationId: string) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
  conversations: [],
  activeConversationId: null,
  activeAgentId: 'brand-book',
  sidebarOpen: true,
  selectedModel: 'claude-opus-4',
  thinkingMode: true,
  activePage: 'home',

  setActiveAgent: (agentId) => set({ activeAgentId: agentId, activeConversationId: null, activePage: 'chat' }),
  setActiveAgentContext: (agentId) => set({ activeAgentId: agentId, activePage: 'chat' }),
  setActivePage: (page) => set({ activePage: page, ...(page !== 'chat' ? { activeAgentId: '' } : {}) }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSelectedModel: (model) =>
    set((state) => {
      const supportsThinking = Boolean(getModelById(model)?.supportsExtendedThinking);
      return {
        selectedModel: model,
        thinkingMode: supportsThinking ? state.thinkingMode : false,
      };
    }),
  setThinkingMode: (on) => set({ thinkingMode: on }),

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

  setActiveConversation: (id) =>
    set((s) => {
      if (!id) return { activeConversationId: null };
      const conversation = s.conversations.find((conv) => conv.id === id);
      return {
        activeConversationId: id,
        activeAgentId: conversation?.agentId ?? s.activeAgentId,
        activePage: 'chat',
      };
    }),

  hydrateConversations: (conversations) =>
    set((s) => {
      const hasCurrentActive = Boolean(
        s.activeConversationId && conversations.some((conv) => conv.id === s.activeConversationId),
      );
      const fallbackConversation = conversations[0];
      const nextActiveConversationId = hasCurrentActive ? s.activeConversationId : fallbackConversation?.id ?? null;
      const nextActiveConversation = conversations.find((conv) => conv.id === nextActiveConversationId);

      return {
        conversations,
        activeConversationId: nextActiveConversationId,
        activeAgentId: nextActiveConversation?.agentId ?? s.activeAgentId,
      };
    }),

  clearConversations: () =>
    set({
      conversations: [],
      activeConversationId: null,
    }),

  addMessage: (conversationId, message) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              messages: [...c.messages, message],
              agentId: message.agentId || c.agentId,
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

  deleteConversation: (conversationId) =>
    set((s) => {
      const nextConversations = s.conversations.filter((conv) => conv.id !== conversationId);
      const isActiveConversation = s.activeConversationId === conversationId;

      return {
        conversations: nextConversations,
        activeConversationId: isActiveConversation ? null : s.activeConversationId,
      };
    }),

  deleteMessage: (conversationId, messageId) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, messages: c.messages.filter((m) => m.id !== messageId) }
          : c
      ),
    })),
    }),
    {
      name: 'chat-preferences',
      partialize: (state) => ({
        selectedModel: state.selectedModel,
        thinkingMode: state.thinkingMode,
      }),
    },
  ),
);
