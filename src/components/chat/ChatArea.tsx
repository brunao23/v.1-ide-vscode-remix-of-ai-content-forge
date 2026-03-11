import { useRef, useEffect, useCallback, useState } from 'react'; // cache-bust
import { useChatStore } from '@/stores/chatStore';
import { getAgentById, sendChatMessage } from '@/services/chatService';
import { Message } from '@/types';
import Header from '@/components/layout/Header';
import ChatInput from '@/components/chat/ChatInput';
import MessageBubble from '@/components/chat/MessageBubble';
import ConversationStarters from '@/components/chat/ConversationStarters';
import { ChevronDown } from 'lucide-react';

export default function ChatArea() {
  const {
    activeAgentId,
    activeConversationId,
    conversations,
    createConversation,
    addMessage,
    updateMessage,
    finishStreaming,
    selectedModel,
    thinkingMode,
  } = useChatStore();

  const [isStreaming, setIsStreaming] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const agent = getAgentById(activeAgentId);
  const conversation = conversations.find(c => c.id === activeConversationId);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [conversation?.messages.length, scrollToBottom]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 100);
  };

  const handleSend = useCallback(async (text: string) => {
    if (!agent) return;

    let convId = activeConversationId;
    if (!convId) {
      convId = createConversation(activeAgentId);
    }

    // Add user message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    addMessage(convId, userMsg);

    // Add placeholder assistant message
    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };
    addMessage(convId, assistantMsg);
    setIsStreaming(true);

    try {
      // Get all messages for context
      const conv = useChatStore.getState().conversations.find(c => c.id === convId);
      const historyMessages = (conv?.messages || [])
        .filter(m => m.role === 'user' || (m.role === 'assistant' && m.content))
        .map(m => ({ role: m.role, content: m.content }));

      const response = await sendChatMessage({
        messages: historyMessages,
        agentId: activeAgentId,
        modelId: selectedModel,
        extendedThinking: thinkingMode,
      });

      updateMessage(convId!, assistantId, response.content);
      
      // Update with thinking data if available
      if (response.thinking) {
        const store = useChatStore.getState();
        const updatedConv = store.conversations.find(c => c.id === convId);
        if (updatedConv) {
          const msgIndex = updatedConv.messages.findIndex(m => m.id === assistantId);
          if (msgIndex !== -1) {
            const updatedMessages = [...updatedConv.messages];
            updatedMessages[msgIndex] = {
              ...updatedMessages[msgIndex],
              thinking: response.thinking,
              thinkingDuration: response.thinkingDuration,
            };
            useChatStore.setState({
              conversations: store.conversations.map(c =>
                c.id === convId ? { ...c, messages: updatedMessages } : c
              ),
            });
          }
        }
      }

      finishStreaming(convId!, assistantId);
    } catch (err: any) {
      updateMessage(convId!, assistantId, `❌ Erro: ${err.message || 'Falha ao obter resposta da IA.'}`);
      finishStreaming(convId!, assistantId);
    } finally {
      setIsStreaming(false);
    }
  }, [activeAgentId, activeConversationId, agent, addMessage, createConversation, updateMessage, finishStreaming, selectedModel, thinkingMode]);

  const handleStop = () => {
    setIsStreaming(false);
    if (conversation) {
      const lastMsg = conversation.messages[conversation.messages.length - 1];
      if (lastMsg?.isStreaming) {
        finishStreaming(conversation.id, lastMsg.id);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 h-screen">
      <Header />

      <div className="flex-1 overflow-hidden relative flex flex-col">
        {!conversation || conversation.messages.length === 0 ? (
          <div className="flex-1 overflow-y-auto" ref={scrollRef}>
            {agent && (
              <ConversationStarters
                agent={agent}
                onStarterClick={handleSend}
              />
            )}
          </div>
        ) : (
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto"
          >
            <div className="max-w-3xl mx-auto px-6 py-4">
              {conversation.messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  agentId={activeAgentId}
                />
              ))}
            </div>
          </div>
        )}

        {showScrollBtn && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-32 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center shadow-lg hover:bg-accent transition-colors z-10"
          >
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
        )}

        <div className="relative">
          <div className="absolute -top-8 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />
          <ChatInput
            onSend={handleSend}
            isStreaming={isStreaming}
            onStop={handleStop}
            hideDisclaimer={!conversation || conversation.messages.length === 0}
          />
        </div>
      </div>
    </div>
  );
}
