import { supabase } from '@/integrations/supabase/client';
import { AGENTS, Agent } from '@/types';
import { getModelById } from '@/config/models';

export function getAgentById(id: string): Agent | undefined {
  return AGENTS.find(a => a.id === id);
}

// System prompts per agent
const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  'brand-book': `Você é o Construtor de Brand Book, um especialista em branding e identidade de marca. Seu papel é guiar o usuário através de um processo estratégico de perguntas para criar um Brand Book completo. Faça uma pergunta por vez, seja detalhado nas explicações e use formatação markdown.`,
  'market-research': `Você é o Pesquisador de Mercado, especialista em análise de mercado e concorrência. Analise tendências, concorrentes e oportunidades com base nas informações fornecidas. Use dados e insights acionáveis.`,
  'icp-architect': `Você é o Arquiteto do ICP, especialista em definir o perfil do cliente ideal. Construa personas detalhadas com dores, desejos, linguagem e comportamentos do público-alvo.`,
  'pillar-strategist': `Você é o Estrategista de Pilares de Conteúdo. Defina pilares e subpilares estratégicos de conteúdo alinhados à marca, mercado e público-alvo.`,
  'matrix-generator': `Você é o Gerador de Matriz de Conteúdo. Crie combinações criativas de Big Ideas de conteúdo cruzando pilares, subpilares, formatos e ângulos.`,
  'marketing-manager': `Você é o Gerente de Marketing. Crie calendários mensais de conteúdo organizados e estratégicos, com datas, formatos e objetivos claros.`,
  'scriptwriter': `Você é o Roteirista de Infotainment. Escreva roteiros de vídeo prontos para gravação no estilo infotainment - educativo e entretenimento ao mesmo tempo. Use ganchos, storytelling e CTAs.`,
};

export function getSystemPrompt(agentId: string): string {
  return AGENT_SYSTEM_PROMPTS[agentId] || AGENT_SYSTEM_PROMPTS['brand-book'];
}

interface SendMessageParams {
  messages: { role: string; content: string }[];
  agentId: string;
  modelId: string;
  extendedThinking: boolean;
  contextDocuments?: Record<string, string>;
}

export async function sendChatMessage(params: SendMessageParams): Promise<{
  content: string;
  thinking?: string;
  thinkingDuration?: number;
  usage?: { inputTokens: number; outputTokens: number };
}> {
  const model = getModelById(params.modelId);
  const actualThinking = model?.supportsExtendedThinking && params.extendedThinking;

  const { data, error } = await supabase.functions.invoke('chat', {
    body: {
      messages: params.messages,
      systemPrompt: getSystemPrompt(params.agentId),
      modelId: model?.apiModelId || 'claude-sonnet-4-5-20250514',
      extendedThinking: actualThinking,
      maxTokens: model?.maxTokens || 8000,
      contextDocuments: params.contextDocuments,
    },
  });

  if (error) throw new Error(error.message || 'Erro ao chamar a API');
  if (data?.error) throw new Error(data.error);

  return data;
}
