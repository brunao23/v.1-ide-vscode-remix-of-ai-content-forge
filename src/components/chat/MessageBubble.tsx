import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '@/types';
import { getAgentById } from '@/services/chatService';

function sanitizeContent(text: string): string {
  let cleaned = text
    .replace(/<function_calls>[\s\S]*?<\/function_calls>/gi, '')
    .replace(/<function_calls>[\s\S]*?<\/antml:function_calls>/gi, '')
    .replace(/<\/?function_calls>/gi, '')
    .replace(/<\/?antml:function_calls>/gi, '')
    .replace(/<invoke[\s\S]*?<\/invoke>/gi, '')
    .replace(/<invoke[\s\S]*?<\/antml:invoke>/gi, '')
    .replace(/<\/?(?:parameter_name|parameter_value|antml:parameter|antml:invoke)[^>]*>/gi, '');

  // Remove likely fake markdown links (domain-only without real path, e.g. [Forbes](https://forbes.com))
  cleaned = cleaned.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    (_match, label, url) => {
      try {
        const parsed = new URL(url);
        const path = parsed.pathname.replace(/\/+$/, '');
        // Domain-only or domain/ → likely fabricated, strip to text only
        if (!path || path === '') return label;
        return _match;
      } catch {
        // Invalid URL → strip to text
        return label;
      }
    },
  );

  // Remove any remaining bracket-tags the AI invented (web search related)
  cleaned = cleaned.replace(/\[[A-Z_]*(?:PESQUIS|BUSCA|SEARCH|WEB|CONSULTA)[A-Z_"'\s:,.\w]{0,200}\]/gi, '');
  // Remove filler "Aguarde/Buscando/Pesquisando..." lines
  cleaned = cleaned.replace(/^(aguarde|buscando|pesquisando|consultando|reunindo|coletando)\b.*(\.\.\.?)?$/gim, '');

  return cleaned.replace(/\n{3,}/g, '\n\n').trim();
}
import {
  Copy,
  ThumbsUp,
  ThumbsDown,
  MoreHorizontal,
  Save,
  Loader2,
  CheckCircle2,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Props {
  message: Message;
  agentId: string;
  onWebSearchRequest?: () => void;
}

const SAVE_ENABLED_AGENTS = new Set([
  'brand-book',
  'market-research',
  'icp-architect',
  'pillar-strategist',
  'matrix-generator',
  'marketing-manager',
  'scriptwriter',
  'copywriter-campanhas',
  'expert-social-selling',
  'criador-documento-oferta',
  'amanda-ai',
  'arquiteta-perfil-icp',
  'estrategias-sprint-20k',
  'arquiteta-workshops',
  'feedback-conteudo',
  'vsl-invisivel',
  'voz-de-marca',
]);

const AGENT_TO_DOCUMENT_TYPE: Record<string, string> = {
  'brand-book': 'brand-book',
  'market-research': 'pesquisa',
  'icp-architect': 'icp',
  'pillar-strategist': 'pilares',
  'matrix-generator': 'matriz',
  'marketing-manager': 'calendario',
  'scriptwriter': 'roteiro',
  'feedback-conteudo': 'roteiro',
  'vsl-invisivel': 'roteiro',
  'copywriter-campanhas': 'roteiro',
  'arquiteta-perfil-icp': 'icp',
  'voz-de-marca': 'outro',
};

// Detect the suggest-search tag (tolerates backslash-escaped brackets)
function hasWebSearchTag(text: string): boolean {
  return /SUGERIR_PESQUISA_WEB/i.test(text);
}
// Strip ALL web-search bracket tags the AI might output
function stripWebSearchTags(text: string): string {
  return text
    // The real tag [SUGERIR_PESQUISA_WEB] with optional backslashes
    .replace(/\\?\[SUGERIR_PESQUISA_WEB\\?\]/gi, '')
    // ANY bracket-tag the AI might invent containing PESQUIS/BUSCA/SEARCH/WEB/CONSULTA
    .replace(/\[[A-Z_]*(?:PESQUIS|BUSCA|SEARCH|WEB|CONSULTA)[A-Z_"'\s:,.\w]{0,200}\]/gi, '')
    // Filler lines: "Aguarde...", "Buscando...", "Pesquisando...", "Coletando..."
    .replace(/^(aguarde|buscando|pesquisando|consultando|reunindo|coletando)\b.*(\.\.\.?)?$/gim, '');
}

export default function MessageBubble({ message, agentId, onWebSearchRequest }: Props) {
  const agent = getAgentById(agentId);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { user, activeTenant } = useAuth();

  const canSaveAgentOutput = message.role === 'assistant' && SAVE_ENABLED_AGENTS.has(agentId);
  const localSaveKey = useMemo(
    () =>
      user?.id && activeTenant?.id
        ? `agent-output-saved:${activeTenant.id}:${user.id}:${message.id}`
        : null,
    [activeTenant?.id, message.id, user?.id],
  );

  useEffect(() => {
    if (!localSaveKey) {
      setSaved(false);
      return;
    }
    setSaved(window.localStorage.getItem(localSaveKey) === '1');
  }, [localSaveKey]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveAsDocument = async () => {
    if (!user || !activeTenant?.id) {
      toast.error('Faca login e selecione um tenant para salvar em Documentos');
      return;
    }
    if (saved) {
      toast.info('Este conteudo ja foi salvo em Documentos');
      return;
    }
    if (!message.content?.trim()) {
      toast.error('Nada para salvar');
      return;
    }
    if (/^erro:/i.test(message.content.trim())) {
      toast.error('Mensagem de erro nao pode ser salva como documento');
      return;
    }
    if (!SAVE_ENABLED_AGENTS.has(agentId)) {
      toast.error('Este agente nao esta habilitado para salvar automaticamente');
      return;
    }

    const confirmed = window.confirm(
      'Voce revisou e aprova este conteudo? Ao confirmar, ele sera salvo em Documentos e indexado automaticamente no sistema de Documentos.',
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      const documentType = AGENT_TO_DOCUMENT_TYPE[agentId] || 'outro';
      const now = new Date();
      const name = `${agent?.name || 'Documento'} - ${now.toLocaleDateString('pt-BR')}`;

      const { data, error } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          tenant_id: activeTenant.id,
          name,
          type: documentType,
          agent_id: agentId,
          content: message.content,
          processing_status: 'processing',
        })
        .select('id')
        .single();

      if (error || !data?.id) {
        throw new Error(error?.message || 'Falha ao criar documento');
      }

      const { error: processError } = await supabase.functions.invoke('process-document', {
        body: {
          documentId: data.id,
          content: message.content,
          userId: user.id,
          tenantId: activeTenant.id,
          documentType,
          agentDocument: true,
          agentId,
        },
      });

      if (processError) {
        throw new Error(processError.message || 'Falha na indexacao do documento');
      }

      if (localSaveKey) {
        window.localStorage.setItem(localSaveKey, '1');
      }
      setSaved(true);
      toast.success('Resposta aprovada, salva em Documentos e indexada no RAG');
    } catch (e: any) {
      toast.error(`Nao foi possivel salvar: ${e?.message || 'erro desconhecido'}`);
    } finally {
      setSaving(false);
    }
  };

  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-4">
        <div className="bg-secondary text-foreground px-4 py-3 rounded-[20px_20px_4px_20px] max-w-[85%] text-base leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
          style={{ background: (agent?.color || '#eff5ce') + '66' }}
        >
          {agent?.emoji || 'AI'}
        </span>
        <span className="text-xs text-muted-foreground">{agent?.name || 'Assistente'}</span>
      </div>

      {message.thinking && (
        <details className="text-sm text-muted-foreground mb-3 cursor-pointer">
          <summary className="italic hover:text-foreground transition-colors">
            Pensou por {message.thinkingDuration?.toFixed(0) || '?'}s
          </summary>
          <div className="mt-2 p-3 bg-secondary rounded-lg text-sm text-muted-foreground whitespace-pre-wrap max-h-60 overflow-y-auto">
            {message.thinking}
          </div>
        </details>
      )}

      {message.isStreaming && !message.content?.startsWith('Erro:') ? (
        <div className="flex items-center gap-2.5 py-1">
          {message.content === 'Buscando na web...' ? (
            <Globe className="w-4 h-4 text-muted-foreground animate-pulse" />
          ) : (
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
            </div>
          )}
          <span className="text-sm text-muted-foreground animate-fade-in">
            {message.content || 'Pensando...'}
          </span>
        </div>
      ) : (
        <>
          <div className="prose-chat text-base">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {sanitizeContent(stripWebSearchTags(message.content).trim())}
            </ReactMarkdown>
          </div>
          {!message.isStreaming && hasWebSearchTag(message.content) && onWebSearchRequest && (
            <button
              onClick={onWebSearchRequest}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-primary/10 border border-primary/30 text-foreground hover:bg-primary/20 hover:border-primary/50 transition-all active:scale-[0.98]"
            >
              <Globe className="w-4 h-4" />
              Pesquisar na web
            </button>
          )}
        </>
      )}

      {!message.isStreaming && message.webSources && message.webSources.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                Fontes da pesquisa
              </span>
            </div>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-primary/10 text-primary border border-primary/20">
              Modo agente
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {message.webSources.filter(s => s.url).map((source, idx) => {
              const domain = source.url
                .replace(/^https?:\/\//, '')
                .replace(/^www\./, '')
                .split('/')[0];
              return (
                <a
                  key={idx}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-secondary/80 hover:bg-secondary border border-border/50 text-muted-foreground hover:text-foreground transition-colors group"
                  title={source.summary || source.title}
                >
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
                    alt=""
                    className="w-3.5 h-3.5 rounded-sm"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span className="max-w-[160px] truncate">{source.title || domain}</span>
                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </a>
              );
            })}
          </div>
        </div>
      )}

      {!message.isStreaming && (
        <div className="flex items-center gap-1 mt-2">
          <button
            onClick={handleCopy}
            className="p-2 rounded-md hover:bg-secondary transition-colors group"
            title={copied ? 'Copiado' : 'Copiar'}
          >
            <Copy className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
          </button>

          {canSaveAgentOutput && (
            <button
              onClick={handleSaveAsDocument}
              disabled={saving || saved}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border hover:bg-secondary transition-colors disabled:opacity-60"
              title={saved ? 'Ja salvo em Documentos' : 'Aprovar e salvar em Documentos'}
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : saved ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{saved ? 'Salvo' : 'Aprovar e salvar'}</span>
            </button>
          )}

          <button
            className="p-2 rounded-md hover:bg-secondary transition-colors group disabled:opacity-50"
            onClick={canSaveAgentOutput ? handleSaveAsDocument : undefined}
            title={canSaveAgentOutput ? 'Aprovar e salvar em Documentos' : 'Curtir resposta'}
            disabled={canSaveAgentOutput && (saving || saved)}
          >
            <ThumbsUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
          </button>
          <button className="p-2 rounded-md hover:bg-secondary transition-colors group">
            <ThumbsDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
          </button>
          <button className="p-2 rounded-md hover:bg-secondary transition-colors group">
            <MoreHorizontal className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
          </button>
        </div>
      )}
    </div>
  );
}
