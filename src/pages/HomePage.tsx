import { useState, useRef, useEffect, KeyboardEvent, useCallback } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { sendChatMessage } from '@/services/chatService';
import { AI_MODELS, Message } from '@/types';
import { Plus, ArrowUp, Square, Paperclip, ImagePlus, Search, Globe, Mic, AudioLines, ChevronDown, Check, PanelLeft, Menu } from 'lucide-react';
import { AttachedFiles, UploadedFile } from '@/components/chat/FileUploadButton';
import MessageBubble from '@/components/chat/MessageBubble';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';

const PLUS_MENU_ITEMS = [
  { id: 'files', label: 'Adicionar fotos e arquivos', icon: Paperclip },
  { id: 'image', label: 'Criar imagem', icon: ImagePlus },
  { id: 'deep-search', label: 'Pesquisa aprofundada', icon: Search },
  { id: 'web', label: 'Busca na web', icon: Globe },
];

export default function HomePage() {
  const { selectedModel, setSelectedModel, thinkingMode, sidebarOpen, setSidebarOpen } = useChatStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [modelDropdown, setModelDropdown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const currentModel = AI_MODELS.find(m => m.id === selectedModel);

  const firstName = (() => {
    const raw = user?.email?.split('@')[0] || 'Usuário';
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  })();
  const hasMessages = messages.length > 0;

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

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isStreaming) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date() };
    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '', timestamp: new Date(), isStreaming: true };

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
        agentId: 'brand-book',
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const newFiles: UploadedFile[] = selectedFiles.map((file) => {
      const isImage = file.type.startsWith('image/');
      const isDocument = file.type.includes('pdf') || file.type.includes('document') || file.type.includes('text');
      return {
        id: crypto.randomUUID(),
        file,
        preview: isImage ? URL.createObjectURL(file) : undefined,
        type: isImage ? 'image' : isDocument ? 'document' : 'other',
      };
    });
    setAttachedFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePlusMenuClick = (itemId: string) => {
    setShowPlusMenu(false);
    switch (itemId) {
      case 'files':
        fileInputRef.current?.click();
        break;
      case 'image':
        setInputValue(prev => prev + (prev ? ' ' : '') + 'Crie uma imagem: ');
        textareaRef.current?.focus();
        break;
      case 'deep-search':
        setInputValue(prev => prev + (prev ? ' ' : '') + 'Faça uma pesquisa aprofundada sobre: ');
        textareaRef.current?.focus();
        break;
      case 'web':
        setInputValue(prev => prev + (prev ? ' ' : '') + 'Busque na web: ');
        textareaRef.current?.focus();
        break;
    }
  };

  const removeFile = (id: string) => {
    const file = attachedFiles.find(f => f.id === id);
    if (file?.preview) URL.revokeObjectURL(file.preview);
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 h-screen">
      {/* Header with model selector */}
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
                <div className="absolute top-full left-0 mt-1 z-50 bg-popover rounded-xl shadow-lg border border-border min-w-[260px] p-2">
                  <p className="px-3 py-1.5 text-xs text-muted-foreground font-medium">Modelo</p>
                  {AI_MODELS.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => { setSelectedModel(model.id); setModelDropdown(false); }}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between ${
                        selectedModel === model.id ? 'bg-secondary text-foreground' : 'hover:bg-secondary text-foreground'
                      }`}
                    >
                      <div>
                        <span className="block font-medium">{model.name}</span>
                        <span className="block text-xs text-muted-foreground">{model.description}</span>
                      </div>
                      {selectedModel === model.id && <Check className="w-4 h-4 text-muted-foreground ml-2 shrink-0" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx"
        onChange={handleFileSelect}
        className="hidden"
      />

      {!hasMessages ? (
        /* Empty state — centered greeting + input */
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <h1 className="text-[32px] font-medium text-foreground mb-6">
            Como posso ajudar, {firstName}?
          </h1>

          {/* Centered input */}
          <div className="w-full max-w-[680px] relative">
            <div className="bg-secondary border border-border rounded-[28px] px-4 py-2.5 focus-within:border-muted-foreground/40 transition-colors">
              <AttachedFiles files={attachedFiles} onRemove={removeFile} />

              <div className="flex items-center gap-2">
                {/* Plus button with dropdown */}
                <div className="relative shrink-0">
                  <button
                    onClick={() => setShowPlusMenu(!showPlusMenu)}
                    className="w-8 h-8 rounded-full bg-muted-foreground/10 hover:bg-muted-foreground/20 flex items-center justify-center transition-colors"
                    aria-label="Mais opções"
                  >
                    <Plus className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
                  </button>

                  {showPlusMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowPlusMenu(false)} />
                      <div className="absolute bottom-full left-0 mb-2 z-50 bg-popover rounded-2xl shadow-lg border border-border min-w-[260px] py-2">
                        {PLUS_MENU_ITEMS.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => handlePlusMenuClick(item.id)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors"
                          >
                            <item.icon className="w-[18px] h-[18px] text-muted-foreground" strokeWidth={1.5} />
                            <span>{item.label}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Pergunte alguma coisa"
                  rows={1}
                  className="flex-1 bg-transparent border-none outline-none text-foreground text-base resize-none placeholder:text-muted-foreground leading-normal py-1"
                  aria-label="Mensagem"
                />

                <div className="flex items-center gap-1 shrink-0">
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
                    <>
                      <button className="p-2 rounded-full hover:bg-accent transition-colors" aria-label="Entrada por voz">
                        <Mic className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
                      </button>
                      <button className="w-9 h-9 rounded-full bg-foreground flex items-center justify-center hover:opacity-80 transition-opacity" aria-label="Áudio">
                        <AudioLines className="w-4 h-4 text-background" strokeWidth={1.5} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <p className="text-center text-xs text-muted-foreground mt-3">
              A IA pode cometer erros. Confira informações importantes.
            </p>
          </div>
        </div>
      ) : (
        /* Messages view */
        <div className="flex-1 overflow-hidden relative flex flex-col">
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 py-4">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} agentId="brand-book" />
              ))}
            </div>
          </div>

          {/* Input pinned at bottom when chatting */}
          <div className="relative">
            <div className="absolute -top-8 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />
            <div className="px-4 pt-2 w-full max-w-3xl mx-auto pb-6" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
              <div className="bg-secondary border border-border rounded-[28px] px-4 py-3 focus-within:border-muted-foreground/40 transition-colors">
                <AttachedFiles files={attachedFiles} onRemove={removeFile} />
                <div className="flex items-end gap-2">
                  <div className="relative shrink-0 mb-0.5">
                    <button
                      onClick={() => setShowPlusMenu(!showPlusMenu)}
                      className="w-8 h-8 rounded-full bg-muted-foreground/10 hover:bg-muted-foreground/20 flex items-center justify-center transition-colors"
                      aria-label="Mais opções"
                    >
                      <Plus className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
                    </button>
                    {showPlusMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowPlusMenu(false)} />
                        <div className="absolute bottom-full left-0 mb-2 z-50 bg-popover rounded-2xl shadow-lg border border-border min-w-[260px] py-2">
                          {PLUS_MENU_ITEMS.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => handlePlusMenuClick(item.id)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors"
                            >
                              <item.icon className="w-[18px] h-[18px] text-muted-foreground" strokeWidth={1.5} />
                              <span>{item.label}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Pergunte alguma coisa"
                    rows={1}
                    className="flex-1 bg-transparent border-none outline-none text-foreground text-base resize-none placeholder:text-muted-foreground leading-normal py-1"
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
                      <>
                        <button className="p-2 rounded-full hover:bg-accent transition-colors" aria-label="Entrada por voz">
                          <Mic className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
                        </button>
                        <button className="w-9 h-9 rounded-full bg-foreground flex items-center justify-center hover:opacity-80 transition-opacity" aria-label="Áudio">
                          <AudioLines className="w-4 h-4 text-background" strokeWidth={1.5} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-center text-xs text-muted-foreground mt-3">
                A IA pode cometer erros. Confira informações importantes.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
