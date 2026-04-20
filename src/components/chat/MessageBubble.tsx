import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, AgentStep, LiveStep, AGENT_AVATARS } from '@/types';
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

  cleaned = cleaned.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    (_match, label, url) => {
      try {
        const parsed = new URL(url);
        const path = parsed.pathname.replace(/\/+$/, '');
        if (!path || path === '') return label;
        return _match;
      } catch {
        return label;
      }
    },
  );

  cleaned = cleaned.replace(/\[[A-Z_]*(?:PESQUIS|BUSCA|SEARCH|WEB|CONSULTA)[A-Z_"'\s:,.\w]{0,200}\]/gi, '');
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
  Brain,
  Trash2,
  Check,
  Database,
  ChevronDown,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Props {
  message: Message;
  agentId: string;
  onWebSearchRequest?: () => void;
  onDeleteMessage?: (messageId: string) => void;
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

function hasWebSearchTag(text: string): boolean {
  return /SUGERIR_PESQUISA_WEB/i.test(text);
}

function stripWebSearchTags(text: string): string {
  return text
    .replace(/\\?\[SUGERIR_PESQUISA_WEB\\?\]/gi, '')
    .replace(/\[[A-Z_]*(?:PESQUIS|BUSCA|SEARCH|WEB|CONSULTA)[A-Z_"'\s:,.\w]{0,200}\]/gi, '')
    .replace(/^(aguarde|buscando|pesquisando|consultando|reunindo|coletando)\b.*(\.\.\.?)?$/gim, '');
}

function StepGroup({
  icon,
  label,
  count,
  children,
  defaultOpen = false,
}: {
  icon: ReactNode;
  label: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border/50 overflow-hidden text-xs">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-secondary/30 transition-colors text-muted-foreground"
      >
        <span className="shrink-0 text-muted-foreground/70">{icon}</span>
        <span className="font-medium text-foreground/80">{label}</span>
        <span className="ml-1 opacity-50 text-[11px]">{count > 1 ? `(${count})` : ''}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 ml-auto shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="border-t border-border/30 bg-secondary/10 divide-y divide-border/20">
          {children}
        </div>
      )}
    </div>
  );
}

function ThinkingPanel({ thinking, duration, isStreaming }: { thinking: string; duration?: number; isStreaming: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-3 rounded-xl border border-border/50 overflow-hidden text-xs">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-secondary/30 transition-colors text-muted-foreground"
      >
        <Brain className="w-4 h-4 shrink-0 text-muted-foreground/70" />
        <span className="font-medium text-foreground/80">
          {isStreaming ? 'Raciocínio em andamento...' : `Pensou por ${duration?.toFixed(0) || '?'}s`}
        </span>
        {isStreaming && <Loader2 className="w-3.5 h-3.5 ml-1 animate-spin text-muted-foreground/50" />}
        <ChevronDown
          className={`w-3.5 h-3.5 ml-auto shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="border-t border-border/30 bg-secondary/10 px-3 py-2.5 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed font-mono max-h-64 overflow-y-auto">
          {thinking}
        </div>
      )}
    </div>
  );
}

function WebResultCard({ title, url }: { title: string; url: string }) {
  const domain = (() => { try { return new URL(url).hostname.replace('www.', ''); } catch { return url; } })();
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary border border-border/30 transition-colors group"
    >
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
        alt=""
        className="w-4 h-4 rounded-sm shrink-0"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      <span className="text-[11px] text-foreground/70 flex-1 truncate">{title}</span>
      <span className="text-[10px] text-muted-foreground/50 shrink-0 hidden group-hover:inline">{domain}</span>
      <span className="text-[10px] text-muted-foreground/40 shrink-0 group-hover:hidden">{domain}</span>
    </a>
  );
}

function MemoryStepRow({ step }: { step: AgentStep }) {
  const [open, setOpen] = useState(false);
  const hasChunks = step.chunks && step.chunks.length > 0;
  return (
    <div>
      <button
        onClick={() => hasChunks && setOpen(!open)}
        className={`w-full px-3 py-2 flex items-center gap-2 text-muted-foreground/80 text-left transition-colors ${hasChunks ? 'hover:bg-secondary/20 cursor-pointer' : 'cursor-default'}`}
      >
        <CheckCircle2 className="w-4 h-4 shrink-0 text-primary/70" />
        <span className="text-foreground/70 truncate flex-1">"{step.query}"</span>
        {step.resultCount !== undefined && step.resultCount > 0 && (
          <span className="shrink-0 opacity-50 text-[11px]">{step.resultCount} trechos</span>
        )}
        {hasChunks && (
          <ChevronDown className={`w-3 h-3 shrink-0 opacity-40 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
        )}
      </button>
      {open && hasChunks && (
        <div className="px-3 pb-2 space-y-1.5">
          {step.chunks!.map((chunk, j) => (
            <div key={j} className="rounded-lg border border-border/30 bg-secondary/20 px-3 py-2">
              {chunk.title && (
                <p className="text-[10px] font-medium text-primary/60 mb-1 uppercase tracking-wide">{chunk.title}</p>
              )}
              <p className="text-[11px] text-foreground/60 leading-relaxed line-clamp-4 whitespace-pre-wrap">{chunk.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentStepsPanel({ steps }: { steps: AgentStep[] }) {
  const memorySteps = steps.filter((s) => s.type === 'memory');
  const webSteps = steps.filter((s) => s.type === 'web');

  if (memorySteps.length === 0 && webSteps.length === 0) return null;

  return (
    <div className="mb-4 space-y-1.5">
      {memorySteps.length > 0 && (
        <StepGroup
          icon={<Database className="w-4 h-4" />}
          label="Pesquisou a memória"
          count={memorySteps.length}
          defaultOpen
        >
          {memorySteps.map((step, i) => (
            <MemoryStepRow key={i} step={step} />
          ))}
        </StepGroup>
      )}

      {webSteps.length > 0 && (
        <StepGroup
          icon={<Globe className="w-4 h-4" />}
          label="Pesquisou na web"
          count={webSteps.length}
          defaultOpen
        >
          {webSteps.map((step, i) => (
            <div key={i} className="px-3 py-2.5 text-muted-foreground/80">
              <div className="flex items-center gap-2 mb-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-primary/70" />
                <span className="text-foreground/70 truncate text-xs">"{step.query}"</span>
                {step.resultCount !== undefined && step.resultCount > 0 && (
                  <span className="ml-auto shrink-0 opacity-50 text-[11px]">{step.resultCount} resultados</span>
                )}
              </div>
              {step.results && step.results.length > 0 ? (
                <div className="ml-6 space-y-1">
                  {step.results.slice(0, 5).map((result, j) => (
                    <WebResultCard key={j} title={result.title} url={result.url} />
                  ))}
                </div>
              ) : step.domains && step.domains.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-1 pl-6">
                  {step.domains.slice(0, 5).map((domain, j) => (
                    <span
                      key={j}
                      className="px-1.5 py-0.5 rounded-md bg-secondary/60 border border-border/30 text-[10px] text-muted-foreground/60"
                    >
                      {domain}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </StepGroup>
      )}
    </div>
  );
}

function LiveStepsPanel({ steps }: { steps: LiveStep[] }) {
  const memorySteps = steps.filter((s) => s.type === 'memory');
  const webSteps = steps.filter((s) => s.type === 'web');
  if (memorySteps.length === 0 && webSteps.length === 0) return null;
  return (
    <div className="mb-4 space-y-1.5">
      {memorySteps.length > 0 && (
        <StepGroup icon={<Database className="w-4 h-4" />} label="Pesquisou a memória" count={memorySteps.length} defaultOpen>
          {memorySteps.map((step, i) => (
            <div key={i} className="px-3 py-2 flex items-center gap-2 text-muted-foreground/80">
              {step.status === 'searching'
                ? <Loader2 className="w-4 h-4 shrink-0 animate-spin text-primary/60" />
                : <CheckCircle2 className="w-4 h-4 shrink-0 text-primary/70" />}
              <span className="text-foreground/70 truncate">
                {step.status === 'searching' ? 'Buscando na memória...' : `"${step.query}"`}
              </span>
              {step.status === 'done' && step.resultCount !== undefined && step.resultCount > 0 && (
                <span className="ml-auto shrink-0 opacity-50 text-[11px]">{step.resultCount} trechos</span>
              )}
            </div>
          ))}
        </StepGroup>
      )}
      {webSteps.length > 0 && (
        <StepGroup icon={<Globe className="w-4 h-4" />} label="Pesquisou na web" count={webSteps.length} defaultOpen>
          {webSteps.map((step, i) => (
            <div key={i} className="px-3 py-2.5 text-muted-foreground/80">
              <div className="flex items-center gap-2">
                {step.status === 'searching'
                  ? <Loader2 className="w-4 h-4 shrink-0 animate-spin text-primary/60" />
                  : <CheckCircle2 className="w-4 h-4 shrink-0 text-primary/70" />}
                <span className="text-foreground/70 truncate">
                  {step.status === 'searching' ? 'Pesquisando na web...' : `"${step.query}"`}
                </span>
                {step.status === 'done' && step.resultCount !== undefined && step.resultCount > 0 && (
                  <span className="ml-auto shrink-0 opacity-50 text-[11px]">{step.resultCount} resultados</span>
                )}
              </div>
              {step.status === 'done' && step.results && step.results.length > 0 && (
                <div className="ml-6 mt-1.5 space-y-1">
                  {step.results.slice(0, 5).map((result, j) => (
                    <WebResultCard key={j} title={result.title} url={result.url} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </StepGroup>
      )}
    </div>
  );
}

export default function MessageBubble({ message, agentId, onWebSearchRequest, onDeleteMessage }: Props) {
  const agent = getAgentById(agentId);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, activeTenant } = useAuth();

  const avatarUrl = AGENT_AVATARS[agentId] || null;
  const showAvatar = !!avatarUrl && !avatarError;

  const canSaveAgentOutput = message.role === 'assistant' && SAVE_ENABLED_AGENTS.has(agentId);
  const localSaveKey = useMemo(
    () =>
      user?.id && activeTenant?.id
        ? `agent-output-saved:${activeTenant.id}:${user.id}:${message.id}`
        : null,
    [activeTenant?.id, message.id, user?.id],
  );

  useEffect(() => {
    if (!localSaveKey) { setSaved(false); return; }
    setSaved(window.localStorage.getItem(localSaveKey) === '1');
  }, [localSaveKey]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = () => {
    setMenuOpen(false);
    if (onDeleteMessage) onDeleteMessage(message.id);
  };

  const handleSaveAsDocument = async () => {
    if (!user || !activeTenant?.id) {
      toast.error('Faca login e selecione um tenant para salvar em Documentos');
      return;
    }
    if (saved) { toast.info('Este conteudo ja foi salvo em Documentos'); return; }
    if (!message.content?.trim()) { toast.error('Nada para salvar'); return; }
    if (/^erro:/i.test(message.content.trim())) { toast.error('Mensagem de erro nao pode ser salva como documento'); return; }
    if (!SAVE_ENABLED_AGENTS.has(agentId)) { toast.error('Este agente nao esta habilitado para salvar automaticamente'); return; }

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

      if (error || !data?.id) throw new Error(error?.message || 'Falha ao criar documento');

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

      if (processError) throw new Error(processError.message || 'Falha na indexacao do documento');

      if (localSaveKey) window.localStorage.setItem(localSaveKey, '1');
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
      <div className="flex justify-end mb-4 group">
        <div className="relative max-w-[85%]">
          <div className="bg-secondary text-foreground px-4 py-3 rounded-[20px_20px_4px_20px] text-base leading-relaxed">
            {message.content}
          </div>
          {onDeleteMessage && (
            <button
              onClick={handleDelete}
              className="absolute -left-8 top-1/2 -translate-y-1/2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-secondary transition-all"
              title="Excluir mensagem"
            >
              <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        {showAvatar ? (
          <img
            src={avatarUrl!}
            alt={agent?.name || 'Agente'}
            className="w-7 h-7 rounded-full object-cover shrink-0"
            onError={() => setAvatarError(true)}
          />
        ) : (
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0"
            style={{ background: (agent?.color || '#eff5ce') + '66' }}
          >
            {agent?.emoji || 'AI'}
          </span>
        )}
        <span className="text-xs text-muted-foreground">{agent?.name || 'Assistente'}</span>
      </div>

      {!message.isStreaming && message.agentSteps && message.agentSteps.length > 0 && (
        <AgentStepsPanel steps={message.agentSteps} />
      )}

      {message.isStreaming && message.liveSteps && message.liveSteps.length > 0 && (
        <LiveStepsPanel steps={message.liveSteps} />
      )}

      {message.thinking && (
        <ThinkingPanel thinking={message.thinking} duration={message.thinkingDuration} isStreaming={!!message.isStreaming} />
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
              <span className="text-xs font-medium text-muted-foreground">Fontes da pesquisa</span>
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
            title={copied ? 'Copiado!' : 'Copiar mensagem'}
          >
            {copied
              ? <Check className="w-4 h-4 text-primary" />
              : <Copy className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />}
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

          {/* Three-dot menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 rounded-md hover:bg-secondary transition-colors group"
              title="Mais opções"
            >
              <MoreHorizontal className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
            </button>

            {menuOpen && (
              <div className="absolute bottom-full left-0 mb-1 z-50 bg-popover border border-border rounded-xl shadow-lg min-w-[160px] py-1 overflow-hidden">
                <button
                  onClick={() => { handleCopy(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
                >
                  <Copy className="w-4 h-4 text-muted-foreground" />
                  Copiar mensagem
                </button>
                {onDeleteMessage && (
                  <>
                    <div className="my-1 mx-2 border-t border-border" />
                    <button
                      onClick={handleDelete}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir mensagem
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
