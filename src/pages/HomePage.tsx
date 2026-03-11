import { useState, useRef, useEffect, KeyboardEvent, useCallback } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { sendChatMessage } from '@/services/chatService';
import { AI_MODELS, Message } from '@/types';
import { ArrowUp, Square, ChevronDown, Check, PanelLeft, Menu, Plus } from 'lucide-react';
import { FileUploadButton, AttachedFiles, UploadedFile } from '@/components/chat/FileUploadButton';
import { VoiceInputButton } from '@/components/chat/VoiceInputButton';
import MessageBubble from '@/components/chat/MessageBubble';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';

export default function HomePage() {
  const { selectedModel, setSelectedModel, sidebarOpen, setSidebarOpen, thinkingMode, setThinkingMode } = useChatStore();
  const [modelDropdown, setModelDropdown] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const { user } = useAuth();

  const currentModel = AI_MODELS.find(m => m.id === selectedModel);
  const firstName = user?.email?.split('@')[0] || 'Usuário';

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [inputValue]);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 100);
  };

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isStreaming) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInputValue('');
    setAttachedFiles([]);
    setIsStreaming(true);

    try {
      const historyMessages = [...messages, userMsg]
        .filter(m => m.role === 'user' || (m.role === 'assistant' && m.content))
        .map(m => ({ role: m.role, content: m.content }));

      const response = await sendChatMessage({
        messages: historyMessages,
        agentId: 'brand-book', // generic chat
        modelId: selectedModel,
        extendedThinking: thinkingMode,
      });

      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: response.content, isStreaming: false, thinking: response.thinking, thinkingDuration: response.thinkingDuration }
            : m
        )
      );
    } catch (err: any) {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: `❌ Erro: ${err.message || 'Falha ao obter resposta.'}`, isStreaming: false }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }, [inputValue, isStreaming, messages, selectedModel, thinkingMode]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoiceTranscript = (text: string) => {
    setInputValue(prev => prev + (prev ? ' ' : '') + text);
  };

  const removeFile = (id: string) => {
    const file = attachedFiles.find(f => f.id === id);
    if (file?.preview) URL.revokeObjectURL(file.preview);
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex-1 flex flex-col min-w-0 h-screen">
      {/* Header */}
      <header className="h-12 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-secondary transition-colors"
              aria-label="Abrir sidebar"
            >
              {isMobile ? <Menu className="w-[18px] h-[18px] text-muted-foreground" /> : <PanelLeft className="w-[18px] h-[18px] text-muted-foreground" />}
            </button>
          )}

          {/* Model selector */}
          <div className="relative">
            <button
              onClick={() => setModelDropdown(!modelDropdown)}
              className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-secondary transition-colors"
              aria-label="Selecionar modelo"
            >
              <span className="text-base font-semibold text-foreground">
                {currentModel?.name || 'Chat'}
              </span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>

            {modelDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setModelDropdown(false)} />
                <div className="absolute top-full left-0 mt-1 z-50 bg-popover rounded-xl shadow-lg border border-border min-w-[220px] p-2">
                  <p className="px-3 py-1.5 text-xs text-muted-foreground font-medium">Modelo</p>
                  {AI_MODELS.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => { setSelectedModel(model.id); setModelDropdown(false); }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between ${
                        selectedModel === model.id ? 'bg-secondary text-foreground' : 'hover:bg-secondary text-foreground'
                      }`}
                    >
                      <div>
                        <span className="block">{model.name}</span>
                        <span className="block text-xs text-muted-foreground">{model.description}</span>
                      </div>
                      {model.badge && <span className="text-xs text-muted-foreground ml-2">{model.badge}</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {!hasMessages ? (
          /* Empty state — ChatGPT style greeting */
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-8">
              Como posso ajudar, {firstName}?
            </h1>
          </div>
        ) : (
          /* Messages */
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto"
          >
            <div className="max-w-3xl mx-auto px-6 py-4">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  agentId="brand-book"
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

        {/* Input area */}
        <div className="relative">
          <div className="absolute -top-8 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />
          <div className="px-4 pt-2 w-full max-w-3xl mx-auto pb-6" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
            <div className="bg-secondary border border-border rounded-3xl px-4 py-3 focus-within:border-muted-foreground/40 transition-colors">
              <AttachedFiles files={attachedFiles} onRemove={removeFile} />

              <div className="flex items-end gap-2">
                <FileUploadButton files={attachedFiles} onFilesChange={setAttachedFiles} />

                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Pergunte alguma coisa"
                  rows={1}
                  className="flex-1 bg-transparent border-none outline-none text-foreground text-base resize-none placeholder:text-muted-foreground leading-normal py-0.5"
                  aria-label="Mensagem"
                />

                <div className="flex items-center gap-1 shrink-0 mb-0.5">
                  {isStreaming ? (
                    <button
                      onClick={() => setIsStreaming(false)}
                      className="w-9 h-9 rounded-full bg-foreground flex items-center justify-center hover:opacity-80 transition-opacity"
                      aria-label="Parar geração"
                    >
                      <Square className="w-3.5 h-3.5 text-background" />
                    </button>
                  ) : inputValue.trim() ? (
                    <button
                      onClick={handleSend}
                      className="w-9 h-9 rounded-full bg-foreground flex items-center justify-center hover:opacity-80 transition-opacity"
                      aria-label="Enviar mensagem"
                    >
                      <ArrowUp className="w-4 h-4 text-background" />
                    </button>
                  ) : (
                    <VoiceInputButton
                      onTranscript={handleVoiceTranscript}
                      disabled={isStreaming}
                    />
                  )}
                </div>
              </div>
            </div>

            <p className="text-center text-xs text-muted-foreground mt-3 mb-2">
              A IA pode cometer erros. Confira informações importantes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}