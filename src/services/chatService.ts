import { supabase } from '@/integrations/supabase/client';
import { AGENTS, Agent } from '@/types';
import { getModelById } from '@/config/models';

export function getAgentById(id: string): Agent | undefined {
  return AGENTS.find((agent) => agent.id === id);
}

const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  'brand-book':
    'Voce e o Construtor de Brand Book. Conduza o usuario com perguntas estrategicas e organizacao clara em markdown.',
  'market-research':
    'Voce e o Pesquisador de Mercado. Traga insights de tendencias, concorrencia e oportunidades com foco pratico.',
  'icp-architect':
    'Voce e o Arquiteto do ICP. Construa personas detalhadas com dores, desejos, linguagem e comportamentos.',
  'pillar-strategist':
    'Voce e o Estrategista de Pilares. Defina pilares e subpilares de conteudo alinhados a marca e ao publico.',
  'matrix-generator':
    'Voce e o Gerador de Matriz. Crie combinacoes de big ideas cruzando pilares, formatos e angulos.',
  'marketing-manager':
    'Voce e o Gerente de Marketing. Monte calendario de conteudo com objetivos, formatos e cadencia claros.',
  'scriptwriter':
    'Voce e o Roteirista de Infotainment. Escreva roteiros curtos, longos e newsletter com ganchos, narrativa e CTA.',
  'expert-social-selling':
    'Voce e o Expert Social Selling. Monte estrategias praticas para gerar relacionamento, autoridade e conversao nas redes sociais.',
  'criador-documento-oferta':
    'Voce e o Criador de Documento da Oferta. Estruture proposta de valor, oferta, prova, objecoes e CTA com clareza.',
  'amanda-ai':
    'Voce e Amanda AI. Atue como assistente estrategica geral com foco em prioridades praticas e resultado.',
  'arquiteta-perfil-icp':
    'Voce e a Arquiteta de Perfil do Cliente Ideal. Crie perfis comportamentais profundos com motivacoes e friccoes de compra.',
  'programa-rivotril':
    'Voce e o Programa Rivotril. Ajude a organizar rotina, reduzir sobrecarga e transformar caos em plano executavel.',
  'estrategias-sprint-20k':
    'Voce e o Estrategista Sprint 20k. Monte plano acelerado de crescimento e faturamento com metas e acoes semanais.',
  'arquiteta-workshops':
    'Voce e a Arquiteta de Workshops e Webinars. Planeje estrutura, roteiro, interacao e oferta para alta conversao.',
  'feedback-conteudo':
    'Voce e o Revisor de Conteudo. Entregue analise critica com melhorias objetivas de clareza, narrativa, retencao e CTA.',
  'copywriter-campanhas':
    'Voce e o Copywriter de Campanhas. Escreva copys persuasivas com promessa, provas, oferta, objecoes e CTA.',
  'vsl-invisivel':
    'Voce e o especialista em VSL Invisivel. Crie roteiro de vendas com narrativa estrategica, prova, quebra de objecoes e fechamento forte.',
  'voz-de-marca':
    'Voce e o Especialista em Voz de Marca. Analise transcricoes e textos autorais para extrair tom, proposito, valores, vicios de linguagem, personalidade, consistencia e adaptabilidade em formato aplicavel para chatbot.',
};

export function getSystemPrompt(agentId: string): string {
  if (!agentId) return '';
  return AGENT_SYSTEM_PROMPTS[agentId] || AGENT_SYSTEM_PROMPTS['brand-book'];
}

interface SendMessageParams {
  messages: { role: string; content: string }[];
  agentId: string;
  modelId: string;
  extendedThinking: boolean;
  marketingMode?: 'calendar' | 'idea';
  contextDocuments?: Record<string, string>;
  userId?: string;
  tenantId?: string;
  webSearchApproved?: boolean;
  onDelta?: (text: string) => void;
  onThinkingDelta?: (text: string) => void;
  onStep?: (step: { type: 'memory' | 'web'; status: 'searching' | 'done'; query: string; label?: string; resultCount?: number; domains?: string[] }) => void;
}

type ChatApiResponse = {
  content: string;
  thinking?: string;
  thinkingDuration?: number;
  usage?: { inputTokens: number; outputTokens: number };
  provider?: string;
  webContext?: {
    enabled: boolean;
    mode: 'calendar' | 'idea' | null;
    searched: boolean;
    used: boolean;
    queryCount: number;
    resultCount: number;
    skippedReason?: string;
    error?: string;
    sources?: Array<{ title: string; url: string; summary: string }>;
    steps?: Array<{ label: string; query: string; resultCount: number; domains: string[] }>;
  };
  documentsContext?: {
    topic: string | null;
    retrievalSteps?: Array<{ subject: string; query: string; chunkCount: number }>;
  };
  error?: string;
};

async function isAccessTokenValid(accessToken: string): Promise<boolean> {
  const { data, error } = await supabase.auth.getUser(accessToken);
  return Boolean(!error && data?.user?.id);
}

async function getValidAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(`Falha ao validar sessao: ${error.message}`);
  }
  if (data.session?.access_token) {
    const valid = await isAccessTokenValid(data.session.access_token);
    if (valid) {
      return data.session.access_token;
    }
  }

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  const refreshedToken = refreshed.session?.access_token;
  if (refreshError || !refreshedToken) {
    throw new Error('Sessao expirada. Faca login novamente.');
  }

  const refreshedValid = await isAccessTokenValid(refreshedToken);
  if (!refreshedValid) {
    throw new Error('Sessao invalida. Faca logout e login novamente.');
  }

  return refreshedToken;
}

async function callChatFunction(
  accessToken: string,
  payload: Record<string, unknown>,
  onDelta?: (text: string) => void,
  onThinkingDelta?: (text: string) => void,
  onStep?: (step: any) => void,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300_000);

  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/event-stream')) {
      const raw = await response.text();
      let parsed: any = null;
      try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = null; }
      return { response, parsed };
    }

    if (!response.body) throw new Error('Response body is null');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let parsed: any = null;
    let eventType = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (eventType === 'delta') {
            try {
              const { text } = JSON.parse(data);
              if (text && onDelta) onDelta(text);
            } catch {}
          } else if (eventType === 'thinkingDelta') {
            try {
              const { text } = JSON.parse(data);
              if (text && onThinkingDelta) onThinkingDelta(text);
            } catch {}
          } else if (eventType === 'step') {
            try {
              const step = JSON.parse(data);
              if (step && onStep) onStep(step);
            } catch {}
          } else if (eventType === 'done') {
            try { parsed = JSON.parse(data); } catch {}
          } else if (eventType === 'error') {
            let errMsg = 'Erro no servidor.';
            try { errMsg = JSON.parse(data)?.error || errMsg; } catch {}
            throw new Error(errMsg);
          }
        } else if (line === '') {
          eventType = '';
        }
      }
    }

    return { response, parsed };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('A resposta demorou mais que o esperado. Tente novamente com uma pergunta mais curta.');
    }
    if (err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError') || err?.message?.includes('fetch')) {
      throw new Error('Falha na conexao. Verifique sua internet e tente novamente.');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendChatMessage(params: SendMessageParams): Promise<ChatApiResponse> {
  const model = getModelById(params.modelId);
  const actualThinking = Boolean(model?.supportsExtendedThinking && params.extendedThinking);
  const modelProvider =
    model?.runtimeProvider ||
    (model?.provider === 'google' ? 'openrouter' : model?.provider) ||
    'anthropic';

  const payload = {
    messages: params.messages,
    systemPrompt: getSystemPrompt(params.agentId),
    agentId: params.agentId,
    marketingMode: params.marketingMode || null,
    userId: params.userId,
    targetUserId: params.userId,
    tenantId: params.tenantId,
    modelId: model?.apiModelId || 'claude-sonnet-4-20250514',
    modelProvider,
    extendedThinking: actualThinking,
    maxTokens: model?.maxTokens || 8000,
    contextDocuments: params.contextDocuments,
    webSearchApproved: params.webSearchApproved || false,
  };

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken();
  } catch {
    throw new Error('Sua sessao expirou. Faca login novamente.');
  }

  let response: Response;
  let parsed: any;

  try {
    ({ response, parsed } = await callChatFunction(accessToken, payload, params.onDelta, params.onThinkingDelta, params.onStep));
  } catch (err: any) {
    // Network/timeout errors from callChatFunction
    throw err;
  }

  // Auto-refresh on auth errors
  if (response.status === 401 || response.status === 403) {
    try {
      const refreshed = await supabase.auth.refreshSession();
      if (refreshed.data.session?.access_token) {
        accessToken = refreshed.data.session.access_token;
        ({ response, parsed } = await callChatFunction(accessToken, payload, params.onDelta, params.onThinkingDelta, params.onStep));
      }
    } catch {
      throw new Error('Sua sessao expirou. Faca login novamente.');
    }
  }

  // Backend returned an error field (even with 200 status)
  if (parsed?.error && !parsed?.content) {
    throw new Error(String(parsed.error));
  }

  // HTTP error without parsed body
  if (!response.ok && !parsed?.content) {
    const status = response.status;
    if (status === 429) throw new Error('Muitas requisicoes. Aguarde alguns segundos e tente novamente.');
    if (status >= 500) throw new Error('Erro temporario no servidor. Tente novamente em alguns instantes.');
    throw new Error(parsed?.error || 'Falha ao processar sua mensagem. Tente novamente.');
  }

  if (!parsed) {
    throw new Error('Resposta invalida do servidor. Tente novamente.');
  }

  return parsed as ChatApiResponse;
}
