import { useState, useEffect, useMemo } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { AGENTS } from '@/types';
import { Search, MessageSquare, FileText, Bot, X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SearchModal({ open, onClose }: Props) {
  const [query, setQuery] = useState('');
  const { conversations, setActiveConversation, setActiveAgent } = useChatStore();

  useEffect(() => {
    if (!open) { setQuery(''); return; }
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Global Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (open) onClose();
        else onClose(); // parent handles toggle
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return { conversations: conversations.slice(0, 5), agents: [], documents: [] };

    const filteredConvs = conversations.filter(c =>
      c.title.toLowerCase().includes(q) || c.messages.some(m => m.content.toLowerCase().includes(q))
    ).slice(0, 5);

    const filteredAgents = AGENTS.filter(a =>
      a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
    );

    return { conversations: filteredConvs, agents: filteredAgents, documents: [] };
  }, [query, conversations]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 z-50 w-full max-w-lg">
        <div className="bg-card border border-border-secondary rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search className="w-5 h-5 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar em chats, agentes..."
              className="flex-1 bg-transparent border-none outline-none text-foreground text-base placeholder:text-muted-foreground"
            />
            <button onClick={onClose} className="p-1 rounded hover:bg-secondary" aria-label="Fechar busca">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {results.agents.length > 0 && (
              <div className="mb-2">
                <p className="px-3 py-1 text-xs text-muted-foreground font-medium uppercase">Agentes</p>
                {results.agents.map(a => (
                  <button
                    key={a.id}
                    onClick={() => { setActiveAgent(a.id); onClose(); }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary transition-colors text-left"
                  >
                    <Bot className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm text-foreground truncate">{a.name}</span>
                  </button>
                ))}
              </div>
            )}

            {results.conversations.length > 0 && (
              <div>
                <p className="px-3 py-1 text-xs text-muted-foreground font-medium uppercase">
                  {query ? 'Conversas' : 'Recentes'}
                </p>
                {results.conversations.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setActiveConversation(c.id); onClose(); }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary transition-colors text-left"
                  >
                    <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground truncate">{c.title}</span>
                  </button>
                ))}
              </div>
            )}

            {results.conversations.length === 0 && results.agents.length === 0 && query && (
              <p className="text-center text-sm text-muted-foreground py-8">Nenhum resultado encontrado</p>
            )}
          </div>

          <div className="border-t border-border px-4 py-2">
            <p className="text-xs text-muted-foreground">Pressione <kbd className="px-1.5 py-0.5 rounded bg-secondary text-xs">ESC</kbd> para fechar</p>
          </div>
        </div>
      </div>
    </>
  );
}
