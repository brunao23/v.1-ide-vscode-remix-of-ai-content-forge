import { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronDown, Plus, Pencil, Check, X, Trash2 } from 'lucide-react';
import Header from '@/components/layout/Header';
import ChatInput from '@/components/chat/ChatInput';
import MessageBubble from '@/components/chat/MessageBubble';
import ConversationStarters from '@/components/chat/ConversationStarters';
import { sendChatMessage } from '@/services/chatService';
import {
  persistConversation,
  persistMessage,
  deletePersistedMessage,
  deletePersistedConversation,
  loadGemzConversations,
  updateConversationTitle,
} from '@/services/chatPersistenceService';
import { useChatStore } from '@/stores/chatStore';
import { useAuth } from '@/contexts/AuthContext';
import { AGENT_AVATARS, AGENTS } from '@/types';
import type { Message, Conversation } from '@/types';

const TABS = [
  {
    id: 'diretora' as const,
    label: 'GABBY Diretora Criativa',
    agentId: 'diretora-criativa',
    placeholder: 'Diga à GABBY Diretora o que você precisa criar...',
  },
  {
    id: 'copywriter' as const,
    label: 'GABBY Copywriter',
    agentId: 'scriptwriter',
    placeholder: 'Descreva seu conteúdo para GABBY Copywriter...',
  },
  {
    id: 'sombra' as const,
    label: 'GABBY Sombra',
    agentId: 'feedback-conteudo',
    placeholder: 'Cole seu conteúdo para GABBY Sombra revisar...',
  },
];

type TabId = 'diretora' | 'copywriter' | 'sombra';
type TabMessages = Record<TabId, Message[]>;


function buildAssistantStages(agentId: string, willSearchWeb: boolean, mode?: 'calendar' | 'idea' | null): string[] {
  if (agentId === 'diretora-criativa') {
    if (mode === 'idea') {
      return willSearchWeb
        ? ['Buscando na web...', 'Analisando contexto...', 'Desenvolvendo ângulos da ideia...']
        : ['Analisando contexto...', 'Desenvolvendo ângulos da ideia...'];
    }
    return willSearchWeb
      ? ['Buscando na web...', 'Analisando contexto...', 'Montando calendário editorial...']
      : ['Analisando contexto...', 'Montando calendário editorial...'];
  }
  return ['Analisando contexto...', 'Pensando...', 'Gerando resposta...'];
}

function getAgentLabel(agentId: string): string {
  const tab = TABS.find(t => t.agentId === agentId);
  if (tab) return tab.label;
  const agent = AGENTS.find(a => a.id === agentId);
  return agent?.name || agentId;
}

export default function GemzAIPage() {
  const [activeTab, setActiveTab] = useState<TabId>('diretora');
  const [tabMessages, setTabMessages] = useState<TabMessages>({
    diretora: [],
    copywriter: [],
    sombra: [],
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const [marketingMode, setMarketingMode] = useState<'calendar' | 'idea' | null>('calendar');
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [gemzConversations, setGemzConversations] = useState<Conversation[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const convRefs = useRef<Record<TabId, string | null>>({
    diretora: null,
    copywriter: null,
    sombra: null,
  });

  const { selectedModel, thinkingMode, setGemzAgent } = useChatStore();
  const { user, activeTenant } = useAuth();

  const currentTab = TABS.find(t => t.id === activeTab)!;
  const messages = tabMessages[activeTab];
  const currentTabHistory = gemzConversations.filter(c => c.agentId === currentTab.agentId);

  useEffect(() => {
    setGemzAgent(currentTab.agentId);
  }, [activeTab, currentTab.agentId, setGemzAgent]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [tabMessages[activeTab].length]);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, []);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 100);
  };

  const setMessages = useCallback((tab: TabId, updater: (prev: Message[]) => Message[]) => {
    setTabMessages(prev => ({ ...prev, [tab]: updater(prev[tab]) }));
  }, []);

  const loadHistory = useCallback(async () => {
    if (!user?.id || !activeTenant?.id) return;
    try {
      const convs = await loadGemzConversations({ userId: user.id, tenantId: activeTenant.id });
      setGemzConversations(convs);
    } catch (e) {
      console.error('Failed to load gemz history:', e);
    }
  }, [user?.id, activeTenant?.id]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleLoadConversation = useCallback((conv: Conversation) => {
    const tab = TABS.find(t => t.agentId === conv.agentId);
    if (!tab) return;
    convRefs.current[tab.id] = conv.id;
    setTabMessages(prev => ({ ...prev, [tab.id]: conv.messages }));
    setActiveTab(tab.id);
  }, []);

  const handleNewChat = useCallback(() => {
    convRefs.current[activeTab] = null;
    setMessages(activeTab, () => []);
  }, [activeTab, setMessages]);

  const handleSaveTitle = useCallback(async (conversationId: string) => {
    if (!editingTitle.trim() || !user?.id || !activeTenant?.id) {
      setEditingId(null);
      return;
    }
    const newTitle = editingTitle.trim();
    try {
      await updateConversationTitle({
        conversationId,
        title: newTitle,
        userId: user.id,
        tenantId: activeTenant.id,
      });
      setGemzConversations(prev =>
        prev.map(c => c.id === conversationId ? { ...c, title: newTitle } : c)
      );
    } catch (e) {
      console.error('Failed to rename conversation:', e);
    }
    setEditingId(null);
  }, [editingTitle, user?.id, activeTenant?.id]);

  const handleDeleteConversation = useCallback(async (conversationId: string) => {
    if (!user?.id || !activeTenant?.id) return;
    if (!window.confirm('Deseja excluir esta conversa? Esta ação não pode ser desfeita.')) return;
    try {
      await deletePersistedConversation({ conversationId, userId: user.id, tenantId: activeTenant.id });
      const tab = TABS.find(t => convRefs.current[t.id] === conversationId);
      if (tab) {
        convRefs.current[tab.id] = null;
        setMessages(tab.id, () => []);
      }
      setGemzConversations(prev => prev.filter(c => c.id !== conversationId));
    } catch (e) {
      console.error('Failed to delete conversation:', e);
    }
  }, [user?.id, activeTenant?.id, setMessages]);

  const ensureConversation = useCallback(async (tab: TabId, agentId: string): Promise<string> => {
    if (convRefs.current[tab]) return convRefs.current[tab]!;
    const id = crypto.randomUUID();
    convRefs.current[tab] = id;
    if (user?.id && activeTenant?.id) {
      await persistConversation({
        conversation: {
          id,
          agentId,
          title: 'Nova conversa',
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        userId: user.id,
        tenantId: activeTenant.id,
        conversationType: 'gemz',
      }).catch(console.error);
      loadHistory();
    }
    return id;
  }, [user?.id, activeTenant?.id, loadHistory]);

  const handleSend = useCallback(async (
    text: string,
    options?: { marketingMode?: 'calendar' | 'idea'; webSearchApproved?: boolean },
  ) => {
    const promptText = text.trim();
    if (!promptText || isStreaming) return;

    const tab = activeTab;
    const agentId = currentTab.agentId;

    const history = [...tabMessages[tab], { role: 'user' as const, content: promptText }]
      .filter(m => m.role === 'user' || (m.role === 'assistant' && m.content && !m.isStreaming))
      .map(m => ({ role: m.role, content: m.content }));

    const convId = await ensureConversation(tab, agentId);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: promptText,
      timestamp: new Date(),
      agentId,
    };

    setMessages(tab, prev => [...prev, userMsg]);

    if (user?.id && activeTenant?.id) {
      persistMessage({ conversationId: convId, message: userMsg, userId: user.id, tenantId: activeTenant.id }).catch(console.error);
    }

    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      agentId,
      isStreaming: true,
    };

    setMessages(tab, prev => [...prev, assistantMsg]);
    setIsStreaming(true);

    const willSearchWeb = Boolean(options?.webSearchApproved);
    const effectiveMode = options?.marketingMode ?? marketingMode;
    const stages = buildAssistantStages(agentId, willSearchWeb, effectiveMode);
    let stageIndex = 0;

    setMessages(tab, prev =>
      prev.map(m => m.id === assistantId ? { ...m, content: stages[0] } : m)
    );

    const stageTimer = window.setInterval(() => {
      if (stageIndex < stages.length - 1) {
        stageIndex += 1;
        setMessages(tab, prev =>
          prev.map(m => m.id === assistantId ? { ...m, content: stages[stageIndex] } : m)
        );
      }
    }, 2400);

    let stageCleared = false;
    let streamedContent = '';
    let streamingThinking = '';

    try {
      const response = await sendChatMessage({
        messages: history,
        agentId,
        modelId: selectedModel,
        extendedThinking: thinkingMode,
        marketingMode: options?.marketingMode || marketingMode || undefined,
        userId: user?.id,
        tenantId: activeTenant?.id,
        webSearchApproved: options?.webSearchApproved || false,
        onDelta: (delta) => {
          if (!stageCleared) {
            window.clearInterval(stageTimer);
            stageCleared = true;
          }
          streamedContent += delta;
          setMessages(tab, prev =>
            prev.map(m => m.id === assistantId ? { ...m, content: streamedContent } : m)
          );
        },
        onThinkingDelta: (delta) => {
          if (!stageCleared) {
            window.clearInterval(stageTimer);
            stageCleared = true;
          }
          streamingThinking += delta;
          setMessages(tab, prev =>
            prev.map(m => m.id === assistantId ? { ...m, thinking: streamingThinking } : m)
          );
        },
        onStep: (step) => {
          if (!stageCleared) {
            window.clearInterval(stageTimer);
            stageCleared = true;
          }
          setMessages(tab, prev =>
            prev.map(m => {
              if (m.id !== assistantId) return m;
              const currentLiveSteps = m.liveSteps || [];
              const existingIdx = currentLiveSteps.findIndex(
                s => s.type === step.type && s.status === 'searching' && s.query === step.query,
              );
              const newLiveSteps =
                existingIdx !== -1 && step.status === 'done'
                  ? currentLiveSteps.map((s, i) => (i === existingIdx ? step : s))
                  : [...currentLiveSteps, step];
              return { ...m, liveSteps: newLiveSteps };
            })
          );
        },
      });

      if (!response) throw new Error('Resposta inválida do servidor.');
      if (!stageCleared) window.clearInterval(stageTimer);

      const finalContent = response.content ?? streamedContent;

      setMessages(tab, prev =>
        prev.map(m => {
          if (m.id !== assistantId) return m;

          const extras: Partial<Message> = {};

          if (response.thinking) {
            extras.thinking = response.thinking;
            extras.thinkingDuration = response.thinkingDuration;
          }
          if (response.webContext?.sources?.length) {
            extras.webSources = response.webContext.sources;
          }

          const liveStepsSnapshot = m.liveSteps || [];
          const allWebSources = (response.webContext?.sources || [])
            .slice(0, 5)
            .map(src => ({ title: src.title, url: src.url }));

          const detailedWebSteps = (response.webContext?.steps || []).map((s, idx) => ({
            type: 'web' as const,
            query: s.query,
            label: s.label,
            resultCount: s.resultCount,
            domains: s.domains,
            results: idx === 0 ? allWebSources : [],
          }));
          const webSteps =
            detailedWebSteps.length > 0
              ? detailedWebSteps
              : response.webContext?.used
                ? [{
                    type: 'web' as const,
                    query: 'Pesquisa na web',
                    resultCount: response.webContext.resultCount || 0,
                    domains: (response.webContext.sources || []).slice(0, 5).map(src => {
                      try { return new URL(src.url).hostname.replace('www.', ''); } catch { return ''; }
                    }).filter(Boolean),
                    results: allWebSources,
                  }]
                : [];

          const hadLiveMemorySteps = liveStepsSnapshot.some(ls => ls.type === 'memory');
          const memSteps = hadLiveMemorySteps
            ? (response.documentsContext?.retrievalSteps || []).map(s => {
                const matchingLive = liveStepsSnapshot.find(ls => ls.type === 'memory' && ls.query === s.query);
                return {
                  type: 'memory' as const,
                  query: s.query,
                  label: s.subject,
                  resultCount: s.chunkCount,
                  chunks: matchingLive?.chunks,
                };
              })
            : [];

          const allSteps = [...memSteps, ...webSteps];
          if (allSteps.length > 0) {
            extras.agentSteps = allSteps;
          } else if (liveStepsSnapshot.length > 0) {
            let webResultsAssigned = false;
            extras.agentSteps = liveStepsSnapshot.map(ls => {
              if (ls.type === 'web' && !webResultsAssigned) {
                webResultsAssigned = true;
                return {
                  type: ls.type,
                  query: ls.query,
                  label: ls.label,
                  resultCount: ls.resultCount,
                  domains: ls.domains,
                  results: ls.results?.length ? ls.results : allWebSources.length ? allWebSources : undefined,
                  chunks: ls.chunks,
                };
              }
              return ls;
            });
          } else if (hadLiveMemorySteps) {
            extras.agentSteps = [{
              type: 'memory' as const,
              query: promptText.slice(0, 120),
              label: 'Documentos da memória',
            }];
          }

          return { ...m, content: finalContent, isStreaming: false, ...extras };
        })
      );

      if (user?.id && activeTenant?.id) {
        persistMessage({
          conversationId: convId,
          message: { id: assistantId, role: 'assistant', content: finalContent, timestamp: new Date(), agentId, isStreaming: false },
          userId: user.id,
          tenantId: activeTenant.id,
        }).catch(console.error);
      }
    } catch (err: any) {
      if (!stageCleared) window.clearInterval(stageTimer);
      const errMsg = String(err?.message || 'Não foi possível gerar a resposta. Tente novamente.');
      setMessages(tab, prev =>
        prev.map(m => m.id === assistantId ? { ...m, content: errMsg, isStreaming: false } : m)
      );
    } finally {
      window.clearInterval(stageTimer);
      setIsStreaming(false);
    }
  }, [
    isStreaming, activeTab, currentTab, ensureConversation, tabMessages,
    selectedModel, thinkingMode, marketingMode, user?.id, activeTenant?.id, setMessages,
  ]);

  const handleWebSearchRequest = useCallback(() => {
    if (isStreaming) return;
    const msgs = tabMessages[activeTab];
    const lastUserMsg = [...msgs].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return;
    handleSend(lastUserMsg.content, { marketingMode: marketingMode || 'idea', webSearchApproved: true });
  }, [activeTab, tabMessages, isStreaming, marketingMode, handleSend]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    const tab = activeTab;
    setMessages(tab, prev => prev.filter(m => m.id !== messageId));
    if (user?.id && activeTenant?.id) {
      await deletePersistedMessage({ messageId, userId: user.id, tenantId: activeTenant.id }).catch(console.error);
    }
  }, [activeTab, setMessages, user?.id, activeTenant?.id]);

  const handleStop = () => {
    setIsStreaming(false);
    setMessages(activeTab, prev =>
      prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m)
    );
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        {/* History Sidebar */}
        <div className="w-52 shrink-0 border-r border-border flex flex-col overflow-hidden bg-background">
          <div className="p-2 border-b border-border">
            <button
              onClick={handleNewChat}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors text-left"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Nova conversa</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            <p className="text-xs text-muted-foreground font-medium px-2 py-1.5 uppercase tracking-wide">
              {currentTab.label}
            </p>
            <div className="space-y-0.5">
              {currentTabHistory.map(conv => (
                <div
                  key={conv.id}
                  className={`group flex items-start gap-2 px-2 py-2 rounded-md cursor-pointer hover:bg-accent transition-colors ${
                    conv.id === convRefs.current[activeTab] ? 'bg-accent' : ''
                  }`}
                  onClick={() => handleLoadConversation(conv)}
                >
                  {editingId === conv.id ? (
                    <div
                      className="flex-1 flex items-center gap-1 min-w-0"
                      onClick={e => e.stopPropagation()}
                    >
                      <input
                        autoFocus
                        value={editingTitle}
                        onChange={e => setEditingTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveTitle(conv.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="flex-1 min-w-0 bg-transparent border-b border-border text-xs outline-none py-0.5"
                      />
                      <button
                        onClick={() => handleSaveTitle(conv.id)}
                        className="text-green-500 hover:text-green-400 shrink-0"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <img
                        src={AGENT_AVATARS[conv.agentId]}
                        alt=""
                        className="w-4 h-4 rounded-full object-cover mt-0.5 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground truncate leading-none mb-0.5">
                          {getAgentLabel(conv.agentId)}
                        </p>
                        <p className="text-xs truncate">{conv.title}</p>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 mt-0.5 transition-opacity">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setEditingId(conv.id);
                            setEditingTitle(conv.title);
                          }}
                          className="text-muted-foreground hover:text-foreground"
                          title="Renomear conversa"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleDeleteConversation(conv.id);
                          }}
                          className="text-muted-foreground hover:text-destructive"
                          title="Excluir conversa"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {currentTabHistory.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-1 italic">
                  Nenhuma conversa ainda
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="shrink-0 border-b border-border px-4 flex items-center gap-1 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <img
                  src={AGENT_AVATARS[tab.agentId]}
                  alt=""
                  className="w-5 h-5 rounded-full object-cover"
                />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden relative flex flex-col">
            {messages.length === 0 ? (
              <div className="flex-1 overflow-y-auto">
                {(() => {
                  const agent = AGENTS.find(a => a.id === currentTab.agentId);
                  if (!agent) return (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
                      <img src={AGENT_AVATARS[currentTab.agentId]} alt="" className="w-16 h-16 rounded-full object-cover" />
                      <p className="text-muted-foreground text-sm">{currentTab.placeholder}</p>
                    </div>
                  );
                  return (
                    <ConversationStarters
                      agent={agent}
                      onStarterClick={(starter) => handleSend(starter, { marketingMode: marketingMode || 'calendar' })}
                      marketingMode={marketingMode}
                      onMarketingModeSelect={setMarketingMode}
                    />
                  );
                })()}
              </div>
            ) : (
              <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-6 py-4">
                  {messages.map(message => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      agentId={message.agentId || currentTab.agentId}
                      onWebSearchRequest={
                        message.role === 'assistant' &&
                        /SUGERIR_PESQUISA_WEB/i.test(message.content || '') &&
                        !isStreaming
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
                hideDisclaimer={messages.length === 0}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
