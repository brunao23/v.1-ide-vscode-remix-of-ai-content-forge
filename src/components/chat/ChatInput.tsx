import { useMemo, useRef, useState, useEffect, type KeyboardEvent } from 'react';
import { ArrowUp, Square, Brain, ChevronDown, Check } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import { FileUploadButton, AttachedFiles, UploadedFile } from '@/components/chat/FileUploadButton';
import { VoiceInputButton } from '@/components/chat/VoiceInputButton';
import { AGENTS, AGENT_AVATARS } from '@/types';
import { getMentionContext } from '@/lib/agentMentions';
import { getModelById } from '@/config/models';

interface Props {
  onSend: (message: string, options?: { marketingMode?: 'calendar' | 'idea' }) => void;
  isStreaming: boolean;
  onStop?: () => void;
  hideDisclaimer?: boolean;
  marketingMode?: 'calendar' | 'idea' | null;
  onMarketingModeChange?: (mode: 'calendar' | 'idea') => void;
}

type MentionState = {
  start: number;
  end: number;
  query: string;
};

function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export default function ChatInput({
  onSend,
  isStreaming,
  onStop,
  hideDisclaimer = false,
  marketingMode,
  onMarketingModeChange,
}: Props) {
  const [value, setValue] = useState('');
  const [thinkDropdown, setThinkDropdown] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  const [mention, setMention] = useState<MentionState | null>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { selectedModel, thinkingMode, setThinkingMode, activeAgentId } = useChatStore();
  const selectedModelConfig = getModelById(selectedModel);
  const supportsThinking = Boolean(selectedModelConfig?.supportsExtendedThinking);

  useEffect(() => {
    if (!supportsThinking && thinkingMode) {
      setThinkingMode(false);
    }
  }, [supportsThinking, thinkingMode, setThinkingMode]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [value]);

  const mentionCandidates = useMemo(() => {
    if (!mention) return [];
    const q = normalizeSearch(mention.query.trim());
    if (!q) return AGENTS;
    return AGENTS
      .filter((agent) => {
        const id = normalizeSearch(agent.id);
        const name = normalizeSearch(agent.name);
        const description = normalizeSearch(agent.description);
        return id.includes(q) || name.includes(q) || description.includes(q);
      });
  }, [mention]);

  useEffect(() => {
    setSelectedMentionIndex(0);
  }, [mention?.query]);

  const updateMentionContext = (nextValue: string) => {
    const cursor = textareaRef.current?.selectionStart ?? nextValue.length;
    const ctx = getMentionContext(nextValue, cursor);
    setMention(ctx);
  };

  const handleSend = () => {
    if (!value.trim() || isStreaming) return;
    onSend(value.trim(), {
      marketingMode: activeAgentId === 'diretora-criativa' ? (marketingMode || undefined) : undefined,
    });
    setValue('');
    setAttachedFiles([]);
    setMention(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const selectMention = (agentId: string) => {
    if (!mention) return;
    const insertion = `@${agentId} `;
    const nextValue = `${value.slice(0, mention.start)}${insertion}${value.slice(mention.end)}`;
    setValue(nextValue);
    setMention(null);

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        const nextCursor = mention.start + insertion.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nextCursor, nextCursor);
      }
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && mentionCandidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev + 1) % mentionCandidates.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev - 1 + mentionCandidates.length) % mentionCandidates.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = mentionCandidates[selectedMentionIndex] || mentionCandidates[0];
        if (selected) {
          selectMention(selected.id);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMention(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoiceTranscript = (text: string) => {
    const nextValue = value + (value ? ' ' : '') + text;
    setValue(nextValue);
    updateMentionContext(nextValue);
  };

  const removeFile = (id: string) => {
    const file = attachedFiles.find((f) => f.id === id);
    if (file?.preview) URL.revokeObjectURL(file.preview);
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const showMentionList = Boolean(mention) && mentionCandidates.length > 0;

  return (
    <div className="px-4 pt-2 w-full max-w-3xl mx-auto pb-6" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
      <div className="bg-secondary border border-border rounded-3xl px-4 py-3 focus-within:border-muted-foreground/40 transition-colors">
        {activeAgentId === 'diretora-criativa' && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xs text-muted-foreground">Modo:</span>
            <button
              type="button"
              onClick={() => onMarketingModeChange?.('calendar')}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                marketingMode === 'calendar'
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:border-muted-foreground/50'
              }`}
            >
              Calendário
            </button>
            <button
              type="button"
              onClick={() => onMarketingModeChange?.('idea')}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                marketingMode === 'idea'
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:border-muted-foreground/50'
              }`}
            >
              Ideia solta
            </button>
          </div>
        )}

        <AttachedFiles files={attachedFiles} onRemove={removeFile} />

        <div className="flex items-end gap-2">
          <FileUploadButton files={attachedFiles} onFilesChange={setAttachedFiles} />

          <div className="flex-1 relative">
            {showMentionList && (
              <div className="absolute bottom-full left-0 mb-2 w-full z-30 bg-popover border border-border rounded-xl shadow-xl overflow-hidden">
                <div className="px-3 py-2 text-[11px] text-muted-foreground border-b border-border/50">
                  Mencione um agente com @
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {mentionCandidates.map((candidate, idx) => (
                    <button
                      key={candidate.id}
                      onMouseDown={(ev) => {
                        ev.preventDefault();
                        selectMention(candidate.id);
                      }}
                      className={`w-full text-left px-3 py-2.5 transition-colors ${
                        idx === selectedMentionIndex ? 'bg-secondary' : 'hover:bg-secondary/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={AGENT_AVATARS[candidate.id]}
                          alt={candidate.name}
                          className="w-7 h-7 rounded-full object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-sm text-foreground font-medium truncate">@{candidate.id}</div>
                          <div className="text-xs text-muted-foreground truncate">{candidate.name}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => {
                const nextValue = e.target.value;
                setValue(nextValue);
                updateMentionContext(nextValue);
              }}
              onKeyDown={handleKeyDown}
              onClick={() => updateMentionContext(value)}
              onKeyUp={() => updateMentionContext(value)}
              placeholder="Pergunte alguma coisa"
              rows={1}
              className="w-full bg-transparent border-none outline-none text-foreground text-base resize-none placeholder:text-muted-foreground leading-normal py-0.5"
              aria-label="Mensagem"
            />
          </div>

          <div className="flex items-center gap-1 shrink-0 mb-0.5">
            <div className="relative">
              <button
                onClick={() => setThinkDropdown(!thinkDropdown)}
                className={`p-1.5 rounded-full border text-sm flex items-center gap-1.5 transition-colors ${
                  thinkingMode && supportsThinking
                    ? 'border-muted-foreground/40 text-muted-foreground'
                    : 'border-border text-muted-foreground'
                } hover:bg-accent`}
                aria-label="Modo de raciocinio"
              >
                <Brain className="w-4 h-4" />
                <span className="text-xs font-medium pr-0.5 hidden sm:inline">
                  {supportsThinking ? 'Pensar' : 'Resposta rapida'}
                </span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {thinkDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setThinkDropdown(false)} />
                  <div className="absolute bottom-full right-0 mb-2 z-50 bg-popover rounded-xl shadow-lg border border-border min-w-[220px] p-2">
                    <button
                      onClick={() => {
                        if (!supportsThinking) return;
                        setThinkingMode(true);
                        setThinkDropdown(false);
                      }}
                      disabled={!supportsThinking}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        supportsThinking ? 'hover:bg-secondary' : 'opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex-1">
                        <p className="text-sm text-foreground font-medium flex items-center gap-2">
                          {thinkingMode && supportsThinking && <Check className="w-3.5 h-3.5 text-muted-foreground" />}
                          Pensar
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {supportsThinking ? 'Raciocinio estendido' : 'Indisponivel para este modelo'}
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={() => { setThinkingMode(false); setThinkDropdown(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-secondary transition-colors"
                    >
                      <div className="flex-1">
                        <p className="text-sm text-foreground font-medium flex items-center gap-2">
                          {(!thinkingMode || !supportsThinking) && <Check className="w-3.5 h-3.5 text-muted-foreground" />}
                          Resposta rapida
                        </p>
                        <p className="text-xs text-muted-foreground">Sem raciocinio visivel</p>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>

            {isStreaming ? (
              <button
                onClick={onStop}
                className="w-9 h-9 rounded-full bg-foreground flex items-center justify-center hover:opacity-80 transition-opacity"
                aria-label="Parar geracao"
              >
                <Square className="w-3.5 h-3.5 text-background" />
              </button>
            ) : value.trim() ? (
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

      {!hideDisclaimer && (
        <p className="text-center text-xs text-muted-foreground mt-3 mb-2">
          A IA pode cometer erros. Confira informacoes importantes.
        </p>
      )}
    </div>
  );
}
