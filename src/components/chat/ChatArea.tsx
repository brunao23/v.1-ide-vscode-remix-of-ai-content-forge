import { useRef, useEffect, useCallback, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Header from '@/components/layout/Header';
import ChatInput from '@/components/chat/ChatInput';
import MessageBubble from '@/components/chat/MessageBubble';
import ConversationStarters from '@/components/chat/ConversationStarters';
import DocumentGateBlock from '@/components/agents/DocumentGateBlock';
import { useChatStore } from '@/stores/chatStore';
import { getAgentById, sendChatMessage } from '@/services/chatService';
import { Message } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { resolveMentionedAgent } from '@/lib/agentMentions';
import { persistConversation, persistMessage, deletePersistedMessage } from '@/services/chatPersistenceService';
import { toast } from 'sonner';
import { useUserDocuments } from '@/hooks/useUserDocuments';
import { getMissingDocTypes } from '@/lib/documentGate';

type OutgoingMessage = { role: string; content: string };

function normalizeIntentText(text: string): string {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function containsResearchSignals(text: string): boolean {
  const normalized = normalizeIntentText(text);
  return (
    /https?:\/\/|www\./i.test(String(text || '')) ||
    /\b[a-z0-9-]+\.[a-z]{2,}\b/i.test(String(text || '')) ||
    normalized.includes('fonte:') ||
    normalized.includes('fontes:') ||
    normalized.includes('referencia')
  );
}

function requestsWebSearch(text: string): boolean {
  const normalized = normalizeIntentText(text);
  return (
    normalized.includes('busque na web') ||
    normalized.includes('buscar na web') ||
    normalized.includes('pesquise na web') ||
    normalized.includes('pesquisar na web') ||
    normalized.includes('pesquise') ||
    normalized.includes('buscar') ||
    normalized.includes('noticias recentes') ||
    normalized.includes('dados recentes') ||
    normalized.includes('tendencias')
  );
}

function disablesWebSearch(text: string): boolean {
  const normalized = normalizeIntentText(text);
  return (
    normalized.includes('sem busca na web') ||
    normalized.includes('sem pesquisar na web') ||
    normalized.includes('nao busque na web') ||
    normalized.includes('nao pesquisar na web')
  );
}

function shouldSearchWebPreview(
  targetAgentId: string,
  historyMessages: OutgoingMessage[],
  latestUserText: string,
): boolean {
  if (targetAgentId !== 'diretora-criativa') return false;
  if (!latestUserText.trim()) return false;
  if (disablesWebSearch(latestUserText)) return false;
  if (containsResearchSignals(latestUserText)) return false;

  const explicitRequest = requestsWebSearch(latestUserText);
  const hasResearchInConversation = historyMessages
    .slice(-8)
    .some((message) => containsResearchSignals(message.content));

  return explicitRequest || !hasResearchInConversation;
}

function buildAssistantStages(params: {
  targetAgentId: string;
  mode?: 'calendar' | 'idea';
  willSearchWeb: boolean;
}): string[] {
  if (params.targetAgentId !== 'diretora-criativa') {
    return ['Analisando contexto...', 'Pensando...', 'Gerando resposta...'];
  }

  const mode = params.mode || 'calendar';
  const buildStage = mode === 'calendar'
    ? 'Montando calendário editorial...'
    : 'Estruturando ideia estratégica...';

  return params.willSearchWeb
    ? ['Buscando na web...', 'Analisando contexto...', buildStage]
    : ['Analisando contexto...', buildStage];
}

export default function ChatArea({ embedded = false }: { embedded?: boolean }) {
  const { user, activeTenant } = useAuth();
  const {
    activeAgentId,
    activeConversationId,
    conversations,
    createConversation,
    addMessage,
    updateMessage,
    finishStreaming,
    deleteMessage,
    setActiveAgentContext,
    selectedModel,
    thinkingMode,
  } = useChatStore();

  const [isStreaming, setIsStreaming] = useState(false);
  const [marketingMode, setMarketingMode] = useState<'calendar' | 'idea' | null>('calendar');
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const agent = getAgentById(activeAgentId);
  const conversation = conversations.find((item) => item.id === activeConversationId);

  const { existingTypes, isLoading: docsLoading } = useUserDocuments();
  const missingDocTypes = agent && !docsLoading ? getMissingDocTypes(agent, existingTypes) : [];
  const isGated = missingDocTypes.length > 0;

  const persistConversationSnapshot = useCallback(
    async (conversationId: string) => {
      if (!user?.id || !activeTenant?.id) return;
      const conv = useChatStore.getState().conversations.find((item) => item.id === conversationId);
      if (!conv) return;

      await persistConversation({
        conversation: conv,
        userId: user.id,
        tenantId: activeTenant.id,
      });
    },
    [user?.id, activeTenant?.id],
  );

  const persistMessageSnapshot = useCallback(
    async (conversationId: string, messageId: string) => {
      if (!user?.id || !activeTenant?.id) return;
      const conv = useChatStore.getState().conversations.find((item) => item.id === conversationId);
      const msg = conv?.messages.find((item) => item.id === messageId);
      if (!msg) return;

      await persistMessage({
        conversationId,
        message: msg,
        userId: user.id,
        tenantId: activeTenant.id,
      });
    },
    [user?.id, activeTenant?.id],
  );

  const persistMessageSnapshotWithRetry = useCallback(
    async (conversationId: string, messageId: string) => {
      try {
        await persistMessageSnapshot(conversationId, messageId);
      } catch (error: any) {
        const message = String(error?.message || '');
        if (!message.includes('Conversa nao encontrada')) {
          throw error;
        }

        await persistConversationSnapshot(conversationId);
        await persistMessageSnapshot(conversationId, messageId);
      }
    },
    [persistConversationSnapshot, persistMessageSnapshot],
  );

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

  const handleSend = useCallback(
    async (text: string, options?: { marketingMode?: 'calendar' | 'idea'; webSearchApproved?: boolean }) => {
      const { targetAgentId: mentionedAgentId, cleanedText } = resolveMentionedAgent(text);
      const targetAgentId = mentionedAgentId || activeAgentId;
      const targetAgent = getAgentById(targetAgentId);
      const promptText = cleanedText.trim();

      if (!targetAgent || !promptText) return;

      if (targetAgentId !== activeAgentId) {
        setActiveAgentContext(targetAgentId);
      }

      let convId = activeConversationId;
      if (!convId) {
        convId = createConversation(targetAgentId);
      }

      await persistConversationSnapshot(convId).catch((error) => {
        console.error('Falha ao salvar conversa inicial:', error);
      });

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: promptText,
        timestamp: new Date(),
        agentId: targetAgentId,
      };

      addMessage(convId, userMessage);
      await persistConversationSnapshot(convId).catch((error) => {
        console.error('Falha ao salvar metadados da conversa:', error);
      });
      await persistMessageSnapshotWithRetry(convId, userMessage.id).catch((error) => {
        console.error('Falha ao salvar mensagem do usuario:', error);
      });

      const currentMarketingMode =
        targetAgentId === 'diretora-criativa'
          ? (options?.marketingMode || marketingMode || 'calendar')
          : undefined;

      const convoBeforeAssistant = useChatStore.getState().conversations.find((item) => item.id === convId);
      const previewHistory = (convoBeforeAssistant?.messages || [])
        .filter((item) => item.role === 'user' || (item.role === 'assistant' && item.content))
        .map((item) => ({ role: item.role, content: item.content }));

      const willSearchWeb = Boolean(options?.webSearchApproved);

      const assistantId = crypto.randomUUID();
      const assistantMessage: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        agentId: targetAgentId,
        isStreaming: true,
      };

      addMessage(convId, assistantMessage);
      setIsStreaming(true);

      const stages = buildAssistantStages({
        targetAgentId,
        mode: currentMarketingMode,
        willSearchWeb,
      });

      let stageIndex = 0;
      updateMessage(convId, assistantId, stages[stageIndex]);
      const stageTimer = window.setInterval(() => {
        if (stageIndex < stages.length - 1) {
          stageIndex += 1;
          updateMessage(convId, assistantId, stages[stageIndex]);
        }
      }, 2400);

      let stageCleared = false;
      try {
        const conv = useChatStore.getState().conversations.find((item) => item.id === convId);
        const historyMessages = (conv?.messages || [])
          .filter((item) => item.id !== assistantId)
          .filter((item) => item.role === 'user' || (item.role === 'assistant' && item.content))
          .map((item) => ({ role: item.role, content: item.content }));

        let streamedContent = '';
        let updateTimer: number | null = null;
        const handleDelta = (text: string) => {
          if (!stageCleared) {
            window.clearInterval(stageTimer);
            stageCleared = true;
          }
          streamedContent += text;
          if (!updateTimer) {
            updateTimer = window.setTimeout(() => {
              updateMessage(convId, assistantId, streamedContent);
              updateTimer = null;
            }, 30);
          }
        };

        let streamingThinking = '';
        const handleThinkingDelta = (text: string) => {
          if (!stageCleared) {
            window.clearInterval(stageTimer);
            stageCleared = true;
          }
          streamingThinking += text;
          const store = useChatStore.getState();
          const conv = store.conversations.find((item) => item.id === convId);
          if (!conv) return;
          const msgIdx = conv.messages.findIndex((item) => item.id === assistantId);
          if (msgIdx === -1) return;
          const updatedMsgs = [...conv.messages];
          updatedMsgs[msgIdx] = { ...updatedMsgs[msgIdx], thinking: streamingThinking };
          useChatStore.setState({
            conversations: store.conversations.map((item) =>
              item.id === convId ? { ...item, messages: updatedMsgs } : item,
            ),
          });
        };

        const handleStep = (step: any) => {
          if (!stageCleared) {
            window.clearInterval(stageTimer);
            stageCleared = true;
          }
          const store = useChatStore.getState();
          const conv = store.conversations.find((item) => item.id === convId);
          if (!conv) return;
          const msgIdx = conv.messages.findIndex((item) => item.id === assistantId);
          if (msgIdx === -1) return;
          const updatedMsgs = [...conv.messages];
          const currentLiveSteps = updatedMsgs[msgIdx].liveSteps || [];
          const existingIdx = currentLiveSteps.findIndex(
            (s) => s.type === step.type && s.status === 'searching' && s.query === step.query,
          );
          const newLiveSteps = existingIdx !== -1 && step.status === 'done'
            ? currentLiveSteps.map((s, i) => (i === existingIdx ? step : s))
            : [...currentLiveSteps, step];
          updatedMsgs[msgIdx] = { ...updatedMsgs[msgIdx], liveSteps: newLiveSteps };
          useChatStore.setState({
            conversations: store.conversations.map((item) =>
              item.id === convId ? { ...item, messages: updatedMsgs } : item,
            ),
          });
        };

        const response = await sendChatMessage({
          messages: historyMessages,
          agentId: targetAgentId,
          modelId: selectedModel,
          extendedThinking: thinkingMode,
          marketingMode: currentMarketingMode,
          userId: user?.id,
          tenantId: activeTenant?.id,
          webSearchApproved: options?.webSearchApproved || false,
          onDelta: handleDelta,
          onThinkingDelta: handleThinkingDelta,
          onStep: handleStep,
        });

        if (!response) throw new Error('Resposta invalida do servidor. Tente novamente.');

        if (updateTimer !== null) { window.clearTimeout(updateTimer); updateTimer = null; }
        if (!stageCleared) window.clearInterval(stageTimer);

        if (!stageCleared && response.webContext?.searched && response.webContext?.used) {
          updateMessage(convId, assistantId, 'Buscando na web...');
          await new Promise((r) => setTimeout(r, 900));
          updateMessage(convId, assistantId, 'Gerando resposta...');
          await new Promise((r) => setTimeout(r, 600));
        }

        updateMessage(convId, assistantId, response.content ?? '');

        {
          const store = useChatStore.getState();
          const updatedConversation = store.conversations.find((item) => item.id === convId);
          if (updatedConversation) {
            const msgIndex = updatedConversation.messages.findIndex((item) => item.id === assistantId);
            if (msgIndex !== -1) {
              const updatedMessages = [...updatedConversation.messages];
              const extras: Partial<Message> = {};
              if (response.thinking) {
                extras.thinking = response.thinking;
                extras.thinkingDuration = response.thinkingDuration;
              }
              if (response.webContext?.sources?.length) {
                extras.webSources = response.webContext.sources;
              }
              const liveStepsSnapshot = updatedMessages[msgIndex].liveSteps || [];
              const hadLiveMemorySteps = liveStepsSnapshot.some((ls) => ls.type === 'memory');
              const detailedMemSteps = (response.documentsContext?.retrievalSteps || []).map((s) => {
                const matchingLive = liveStepsSnapshot.find((ls) => ls.type === 'memory' && ls.query === s.query);
                return {
                  type: 'memory' as const,
                  query: s.query,
                  label: s.subject,
                  resultCount: s.chunkCount,
                  chunks: matchingLive?.chunks,
                };
              });
              const memSteps = hadLiveMemorySteps
                ? detailedMemSteps.length > 0
                  ? detailedMemSteps
                  : response.documentsContext?.topic
                    ? [{ type: 'memory' as const, query: response.documentsContext.topic, label: 'Contexto dos documentos' }]
                    : []
                : [];

              const allWebSources = (response.webContext?.sources || [])
                .slice(0, 5)
                .map((src) => ({ title: src.title, url: src.url }));
              const detailedWebSteps = (response.webContext?.steps || []).map((s, idx) => ({
                type: 'web' as const,
                query: s.query,
                label: s.label,
                resultCount: s.resultCount,
                domains: s.domains,
                results: idx === 0 ? allWebSources : [],
              }));
              const webSteps = detailedWebSteps.length > 0
                ? detailedWebSteps
                : response.webContext?.used
                  ? [{
                      type: 'web' as const,
                      query: 'Pesquisa na web',
                      resultCount: response.webContext.resultCount || (response.webContext.sources?.length ?? 0),
                      domains: (response.webContext.sources || []).slice(0, 5).map((src) => {
                        try { return new URL(src.url).hostname.replace('www.', ''); } catch { return ''; }
                      }).filter(Boolean),
                      results: allWebSources,
                    }]
                  : [];

              const allSteps = [...memSteps, ...webSteps];
              if (allSteps.length > 0) {
                extras.agentSteps = allSteps;
              } else {
                // Fallback 1: copia SSE live steps para que persistam após o streaming
                const currentLiveSteps = updatedMessages[msgIndex].liveSteps || [];
                if (currentLiveSteps.length > 0) {
                  let webResultsAssigned = false;
                  extras.agentSteps = currentLiveSteps.map((ls) => {
                    if (ls.type === 'web' && !webResultsAssigned) {
                      webResultsAssigned = true;
                      const webResultsToUse = ls.results && ls.results.length > 0 ? ls.results : allWebSources.length > 0 ? allWebSources : undefined;
                      return { type: ls.type, query: ls.query, label: ls.label, resultCount: ls.resultCount, domains: ls.domains, results: webResultsToUse, chunks: ls.chunks };
                    }
                    return { type: ls.type, query: ls.query, label: ls.label, resultCount: ls.resultCount, domains: ls.domains, results: ls.results, chunks: ls.chunks };
                  });
                } else if (hadLiveMemorySteps) {
                  // Fallback 2: step sintético para qualquer agente que buscou memória via SSE
                  extras.agentSteps = [{
                    type: 'memory' as const,
                    query: promptText.slice(0, 120),
                    label: 'Documentos da memória',
                  }];
                }
              }
              if (Object.keys(extras).length > 0) {
                updatedMessages[msgIndex] = {
                  ...updatedMessages[msgIndex],
                  ...extras,
                };
                useChatStore.setState({
                  conversations: store.conversations.map((item) =>
                    item.id === convId ? { ...item, messages: updatedMessages } : item,
                  ),
                });
              }
            }
          }
        }

        finishStreaming(convId, assistantId);
        await persistConversationSnapshot(convId).catch((error) => {
          console.error('Falha ao atualizar conversa apos resposta:', error);
        });
        await persistMessageSnapshotWithRetry(convId, assistantId).catch((error) => {
          console.error('Falha ao salvar resposta do assistente:', error);
        });
      } catch (error: any) {
        if (updateTimer !== null) { window.clearTimeout(updateTimer); updateTimer = null; }
        if (!stageCleared) window.clearInterval(stageTimer);
        const errMsg = String(error?.message || '');
        console.error('Chat error:', errMsg);

        // Friendly message for the chat bubble
        const friendlyMessage = errMsg.includes('sessao expirou') || errMsg.includes('login')
          ? 'Sua sessao expirou. Faca login novamente para continuar.'
          : 'Nao foi possivel gerar a resposta agora. Por favor, tente novamente.';

        updateMessage(convId, assistantId, friendlyMessage);
        finishStreaming(convId, assistantId);
        toast.error(errMsg || 'Erro ao processar mensagem');
        await persistConversationSnapshot(convId).catch((persistError) => {
          console.error('Falha ao atualizar conversa apos erro:', persistError);
        });
        await persistMessageSnapshotWithRetry(convId, assistantId).catch((persistError) => {
          console.error('Falha ao salvar mensagem de erro do assistente:', persistError);
        });
      } finally {
        window.clearInterval(stageTimer);
        setIsStreaming(false);
      }
    },
    [
      activeAgentId,
      activeConversationId,
      activeTenant?.id,
      addMessage,
      createConversation,
      finishStreaming,
      persistConversationSnapshot,
      persistMessageSnapshotWithRetry,
      selectedModel,
      setActiveAgentContext,
      thinkingMode,
      marketingMode,
      updateMessage,
      user?.id,
    ],
  );

  const handleWebSearchRequest = useCallback(
    () => {
      if (!activeConversationId || isStreaming) return;
      const conv = conversations.find((item) => item.id === activeConversationId);
      if (!conv) return;
      const lastUserMsg = [...conv.messages].reverse().find((m) => m.role === 'user');
      if (!lastUserMsg) return;
      handleSend(lastUserMsg.content, { marketingMode: marketingMode || 'idea', webSearchApproved: true });
    },
    [activeConversationId, conversations, isStreaming, marketingMode, handleSend],
  );

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (!activeConversationId) return;
      deleteMessage(activeConversationId, messageId);
      if (user?.id && activeTenant?.id) {
        await deletePersistedMessage({ messageId, userId: user.id, tenantId: activeTenant.id }).catch((err) => {
          console.error('Falha ao excluir mensagem:', err);
        });
      }
    },
    [activeConversationId, deleteMessage, user?.id, activeTenant?.id],
  );

  const handleStop = () => {
    setIsStreaming(false);
    if (!conversation) return;

    const lastMessage = conversation.messages[conversation.messages.length - 1];
    if (lastMessage?.isStreaming) {
      finishStreaming(conversation.id, lastMessage.id);
    }
  };

  return (
    <div className={`flex-1 flex flex-col min-w-0 ${embedded ? 'overflow-hidden' : 'h-screen'}`}>
      {!embedded && <Header />}

      <div className="flex-1 overflow-hidden relative flex flex-col">
        {isGated && agent ? (
          <DocumentGateBlock agent={agent} missingDocTypes={missingDocTypes} />
        ) : !conversation || conversation.messages.length === 0 ? (
          <div className="flex-1 overflow-y-auto" ref={scrollRef}>
            {agent && (
              <ConversationStarters
                agent={agent}
                onStarterClick={handleSend}
                marketingMode={marketingMode}
                onMarketingModeSelect={setMarketingMode}
              />
            )}
          </div>
        ) : (
          <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 py-4">
              {conversation.messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  agentId={message.agentId || activeAgentId}
                  onWebSearchRequest={
                    message.role === 'assistant' && /SUGERIR_PESQUISA_WEB/i.test(message.content || '') && !isStreaming
                      ? handleWebSearchRequest
                      : undefined
                  }
                  onDeleteMessage={handleDeleteMessage}
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
            marketingMode={marketingMode}
            onMarketingModeChange={setMarketingMode}
            hideDisclaimer={!conversation || conversation.messages.length === 0}
          />
        </div>
      </div>
    </div>
  );
}
