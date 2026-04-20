import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from '@/integrations/supabase/client';
import { AGENTS, AGENT_AVATARS } from '@/types';
import gemzLogo from '@/assets/gemz-logo.png';

interface SharedMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agent_id: string | null;
  created_at: string;
}

interface SharedConversation {
  id: string;
  title: string;
  agent_id: string;
  messages: SharedMessage[];
}

export default function SharedConversationPage() {
  const { token } = useParams<{ token: string }>();
  const [conversation, setConversation] = useState<SharedConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return; }

    async function load() {
      const { data, error } = await (supabase as any)
        .from('chat_conversations')
        .select(`
          id, title, agent_id,
          chat_messages(id, role, content, agent_id, created_at)
        `)
        .eq('share_token', token)
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
      } else {
        const sorted = [...(data.chat_messages || [])].sort(
          (a: SharedMessage, b: SharedMessage) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        setConversation({ ...data, messages: sorted });
      }
      setLoading(false);
    }

    load();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Carregando conversa...
      </div>
    );
  }

  if (notFound || !conversation) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <img src={gemzLogo} alt="Gemz AI" className="w-8 h-8 rounded-lg opacity-60" />
        <p className="text-muted-foreground text-sm">Conversa não encontrada ou link inválido.</p>
      </div>
    );
  }

  const agentDef = AGENTS.find((a) => a.id === conversation.agent_id);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-3 flex items-center gap-3">
        <img src={gemzLogo} alt="Gemz AI" className="w-6 h-6 rounded-sm" />
        <span className="text-sm text-muted-foreground font-medium">Conversa compartilhada</span>
        <span className="mx-1 text-border">·</span>
        <span className="text-sm text-foreground truncate">{conversation.title}</span>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {conversation.messages.map((msg) => {
          const msgAgent = AGENTS.find((a) => a.id === (msg.agent_id || conversation.agent_id));
          const avatarUrl = AGENT_AVATARS[msg.agent_id || conversation.agent_id];

          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="bg-secondary text-foreground px-4 py-3 rounded-[20px_20px_4px_20px] max-w-[85%] text-base leading-relaxed">
                  {msg.content}
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className="mb-2">
              <div className="flex items-center gap-2 mb-2">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={msgAgent?.name || 'Agente'}
                    className="w-7 h-7 rounded-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
                    style={{ background: (msgAgent?.color || '#eff5ce') + '66' }}
                  >
                    {msgAgent?.emoji || 'AI'}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{msgAgent?.name || 'Assistente'}</span>
              </div>
              <div className="prose-chat text-base">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              </div>
            </div>
          );
        })}
      </div>

      <footer className="border-t border-border py-4 text-center">
        <p className="text-xs text-muted-foreground">
          Gerado com{' '}
          <a href="/" className="underline underline-offset-2 hover:text-foreground transition-colors">
            Gemz AI
          </a>
        </p>
      </footer>
    </div>
  );
}
