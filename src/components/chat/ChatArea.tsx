import { useRef, useEffect, useCallback, useState } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { getAgentById, simulateResponse, streamResponse } from '@/services/chatService';
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
  } = useChatStore();

  const [isStreaming, setIsStreaming] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(false);

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
    abortRef.current = false;

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

    // Simulate assistant response
    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
      thinkingTime: Math.round(Math.random() * 4 + 1),
    };
    addMessage(convId, assistantMsg);
    setIsStreaming(true);

    // Get response
    const conv = useChatStore.getState().conversations.find(c => c.id === convId);
    const msgCount = conv ? Math.floor(conv.messages.length / 2) : 0;
    const responseText = simulateResponse(activeAgentId, msgCount);

    await streamResponse(
      responseText,
      (accumulated) => {
        if (abortRef.current) return;
        updateMessage(convId!, assistantId, accumulated);
      },
      () => {
        finishStreaming(convId!, assistantId);
        setIsStreaming(false);
      }
    );
  }, [activeAgentId, activeConversationId, agent, addMessage, createConversation, updateMessage, finishStreaming]);

  const handleStop = () => {
    abortRef.current = true;
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
        {/* Messages or Starters */}
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

        {/* Scroll to bottom button */}
        {showScrollBtn && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-32 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-secondary border border-border-secondary flex items-center justify-center shadow-lg hover:bg-accent transition-colors z-10"
          >
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
        )}

        {/* Input area with gradient fade */}
        <div className="relative">
          <div className="absolute -top-8 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />
          <ChatInput
            onSend={handleSend}
            isStreaming={isStreaming}
            onStop={handleStop}
          />
        </div>
      </div>
    </div>
  );
}
