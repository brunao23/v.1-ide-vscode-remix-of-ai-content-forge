import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Plus, Mic, ArrowUp, Square, Brain, ChevronDown, Check } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';

interface Props {
  onSend: (message: string) => void;
  isStreaming: boolean;
  onStop?: () => void;
}

export default function ChatInput({ onSend, isStreaming, onStop }: Props) {
  const [value, setValue] = useState('');
  const [thinkDropdown, setThinkDropdown] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const { thinkingMode, setThinkingMode } = useChatStore();

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [value]);

  const handleSend = () => {
    if (!value.trim() || isStreaming) return;
    onSend(value.trim());
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Seu navegador não suporta reconhecimento de voz.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'pt-BR';

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setValue(transcript);
    };

    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  };

  return (
    <div className="px-4 pb-6 pt-2 w-full max-w-3xl mx-auto pb-[env(safe-area-inset-bottom,24px)]">
      <div className="bg-secondary border border-border-secondary rounded-3xl px-4 py-3 flex items-end gap-2 focus-within:border-[hsl(var(--border-focus))] transition-colors">
        <button className="p-1.5 rounded-lg hover:bg-accent transition-colors shrink-0 mb-0.5" aria-label="Anexar arquivo">
          <Plus className="w-5 h-5 text-muted-foreground" />
        </button>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pergunte alguma coisa"
          rows={1}
          className="flex-1 bg-transparent border-none outline-none text-foreground text-base resize-none placeholder:text-muted-foreground leading-normal py-0.5"
          aria-label="Mensagem"
        />

        <div className="flex items-center gap-1 shrink-0 mb-0.5">
          {/* Think button with dropdown */}
          <div className="relative">
            <button
              onClick={() => setThinkDropdown(!thinkDropdown)}
              className={`p-1.5 rounded-full border text-sm flex items-center gap-1.5 transition-colors ${
                thinkingMode
                  ? 'border-primary text-primary'
                  : 'border-border-secondary text-muted-foreground'
              } hover:bg-accent`}
              aria-label="Modo de raciocínio"
            >
              <Brain className="w-4 h-4" />
              <span className="text-xs font-medium pr-0.5 hidden sm:inline">Pensar</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {thinkDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setThinkDropdown(false)} />
                <div className="absolute bottom-full right-0 mb-2 z-50 bg-popover rounded-xl shadow-lg border border-border-secondary min-w-[220px] p-2">
                  <button
                    onClick={() => { setThinkingMode(true); setThinkDropdown(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-secondary transition-colors"
                  >
                    <div className="flex-1">
                      <p className="text-sm text-foreground font-medium flex items-center gap-2">
                        {thinkingMode && <Check className="w-3.5 h-3.5 text-primary" />}
                        Pensar
                      </p>
                      <p className="text-xs text-muted-foreground">Raciocínio estendido</p>
                    </div>
                  </button>
                  <button
                    onClick={() => { setThinkingMode(false); setThinkDropdown(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-secondary transition-colors"
                  >
                    <div className="flex-1">
                      <p className="text-sm text-foreground font-medium flex items-center gap-2">
                        {!thinkingMode && <Check className="w-3.5 h-3.5 text-primary" />}
                        Resposta rápida
                      </p>
                      <p className="text-xs text-muted-foreground">Sem raciocínio visível</p>
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
              aria-label="Parar geração"
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
            <button
              onClick={toggleRecording}
              className={`p-1.5 rounded-lg transition-colors ${isRecording ? 'recording-pulse' : 'hover:bg-accent'}`}
              aria-label={isRecording ? 'Parar gravação' : 'Gravar voz'}
            >
              {isRecording ? (
                <div className="w-5 h-5 rounded-full bg-destructive" />
              ) : (
                <Mic className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-2">
        A IA pode cometer erros. Confira informações importantes.
      </p>
    </div>
  );
}
