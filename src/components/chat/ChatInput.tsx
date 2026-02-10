import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Plus, Mic, ArrowUp, Square, Brain } from 'lucide-react';

interface Props {
  onSend: (message: string) => void;
  isStreaming: boolean;
  onStop?: () => void;
}

export default function ChatInput({ onSend, isStreaming, onStop }: Props) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="px-4 pb-6 pt-2 w-full max-w-3xl mx-auto">
      {/* Input box */}
      <div className="bg-secondary border border-border-secondary rounded-3xl px-4 py-3 flex items-end gap-2 focus-within:border-[hsl(var(--border-focus))] transition-colors">
        <button className="p-1.5 rounded-lg hover:bg-accent transition-colors shrink-0 mb-0.5">
          <Plus className="w-5 h-5 text-muted-foreground" />
        </button>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pergunte alguma coisa"
          rows={1}
          className="flex-1 bg-transparent border-none outline-none text-foreground text-base resize-none placeholder:text-text-placeholder leading-normal py-0.5"
        />

        <div className="flex items-center gap-1 shrink-0 mb-0.5">
          <button className="p-1.5 rounded-full border border-border-secondary text-primary text-sm flex items-center gap-1.5 hover:bg-accent transition-colors">
            <Brain className="w-4 h-4" />
            <span className="text-xs font-medium pr-0.5">Pensar</span>
          </button>

          {isStreaming ? (
            <button
              onClick={onStop}
              className="w-9 h-9 rounded-full bg-foreground flex items-center justify-center hover:opacity-80 transition-opacity"
            >
              <Square className="w-3.5 h-3.5 text-background" />
            </button>
          ) : value.trim() ? (
            <button
              onClick={handleSend}
              className="w-9 h-9 rounded-full bg-foreground flex items-center justify-center hover:opacity-80 transition-opacity"
            >
              <ArrowUp className="w-4 h-4 text-background" />
            </button>
          ) : (
            <button className="p-1.5 rounded-lg hover:bg-accent transition-colors">
              <Mic className="w-5 h-5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-center text-xs text-text-placeholder mt-2">
        A IA pode cometer erros. Confira informações importantes.
      </p>
    </div>
  );
}
