export interface Agent {
  id: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  recommendedModel: string;
  requires: string[];
  outputDocument: string;
  starters: string[];
  order: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  thinking?: string;
  thinkingDuration?: number;
  isStreaming?: boolean;
}

export interface Conversation {
  id: string;
  agentId: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  id: string;
  type: string;
  title: string;
  content: string;
  agentId: string;
  createdAt: Date;
}

export const AGENT_AVATARS: Record<string, string> = {
  'brand-book': '/assets/agents/brand-book.png',
  'market-research': '/assets/agents/pesquisador-mercado.png',
  'icp-architect': '/assets/agents/arquiteto-icp.png',
  'pillar-strategist': '/assets/agents/estrategista-pilares.png',
  'matrix-generator': '/assets/agents/gerador-matriz.png',
  'marketing-manager': '/assets/agents/gerente-marketing.png',
  'scriptwriter': '/assets/agents/roteirista.png',
  'expert-social-selling': '/assets/agents/gerente-marketing.png',
  'criador-documento-oferta': '/assets/agents/brand-book.png',
  'amanda-ai': '/assets/agents/estrategista-pilares.png',
  'arquiteta-perfil-icp': '/assets/agents/arquiteto-icp.png',
  'programa-rivotril': '/assets/agents/pesquisador-mercado.png',
  'estrategias-sprint-20k': '/assets/agents/gerador-matriz.png',
  'arquiteta-workshops': '/assets/agents/roteirista.png',
  'feedback-conteudo': '/assets/agents/gerente-marketing.png',
  'copywriter-campanhas': '/assets/agents/brand-book.png',
  'vsl-invisivel': '/assets/agents/roteirista.png',
};

export const AGENTS: Agent[] = [
  {
    id: 'brand-book',
    name: 'Construtor de Brand Book',
    description: 'Cria o Brand Book completo da sua marca através de perguntas estratégicas',
    emoji: '📘',
    color: '#3B82F6',
    recommendedModel: 'Claude Opus 4.5',
    requires: [],
    outputDocument: 'Brand Book',
    starters: [
      'Criar meu Brand Book do zero',
      'Já tenho algumas informações, quero completar',
      'Me ajude a definir a identidade da minha marca',
      'Quero revisar meu Brand Book existente',
    ],
    order: 1,
  },
  {
    id: 'market-research',
    name: 'Pesquisador de Mercado',
    description: 'Realiza pesquisa de mercado aprofundada usando inteligência artificial e busca na web',
    emoji: '🔍',
    color: '#8B5CF6',
    recommendedModel: 'Google Gemini Pro',
    requires: ['brand-book'],
    outputDocument: 'Highcharts de Mercado',
    starters: [
      'Analisar meu mercado',
      'Pesquisar concorrentes e tendências',
      'Quero entender melhor meu segmento',
      'Mapear oportunidades de mercado',
    ],
    order: 2,
  },
  {
    id: 'icp-architect',
    name: 'Arquiteto do ICP',
    description: 'Constrói o Mapa do Cliente Ideal (ICP) completo com dores, desejos e linguagem',
    emoji: '🎯',
    color: '#EF4444',
    recommendedModel: 'Claude Opus 4.5',
    requires: ['brand-book', 'market-research'],
    outputDocument: 'Mapa do ICP',
    starters: [
      'Construir meu ICP',
      'Mapear meu cliente ideal',
      'Definir personas detalhadas',
      'Analisar dores e desejos do meu público',
    ],
    order: 3,
  },
  {
    id: 'pillar-strategist',
    name: 'Estrategista de Pilares',
    description: 'Define os pilares e subpilares estratégicos de conteúdo para sua marca',
    emoji: '🏛️',
    color: '#F59E0B',
    recommendedModel: 'Claude Opus 4.5',
    requires: ['brand-book', 'market-research', 'icp-architect'],
    outputDocument: 'Pilares e Subpilares',
    starters: [
      'Definir meus pilares de conteúdo',
      'Criar estratégia de subpilares',
      'Revisar minha estrutura de conteúdo',
      'Me ajude a organizar meus temas',
    ],
    order: 4,
  },
  {
    id: 'matrix-generator',
    name: 'Gerador de Matriz',
    description: 'Cria uma matriz com 1000 Big Ideas de conteúdo combinando todos os elementos estratégicos',
    emoji: '🧮',
    color: '#06B6D4',
    recommendedModel: 'Claude Opus 4.5',
    requires: ['brand-book', 'market-research', 'icp-architect', 'pillar-strategist'],
    outputDocument: 'Matriz de Conteúdo',
    starters: [
      'Gerar minha matriz de 1000 ideias',
      'Criar banco de Big Ideas',
      'Expandir minhas ideias de conteúdo',
      'Gerar novas combinações de temas',
    ],
    order: 5,
  },
  {
    id: 'marketing-manager',
    name: 'Gerente de Marketing',
    description: 'Cria calendários mensais e estrutura ideias no padrão profissional',
    emoji: '📅',
    color: '#10B981',
    recommendedModel: 'Claude Opus 4.5',
    requires: ['brand-book', 'market-research', 'icp-architect', 'pillar-strategist', 'matrix-generator'],
    outputDocument: 'Calendário Mensal',
    starters: [
      'Criar calendário mensal de conteúdo',
      'Tenho uma ideia, quero estruturar',
      'Planejar próximo mês de postagens',
      'Organizar minha grade de conteúdo',
    ],
    order: 6,
  },
  {
    id: 'scriptwriter',
    name: 'Roteirista de Infotainment',
    description: 'Escreve roteiros de vídeo prontos para gravação no estilo infotainment',
    emoji: '🎬',
    color: '#EC4899',
    recommendedModel: 'Claude Opus 4.5',
    requires: ['brand-book', 'market-research', 'icp-architect', 'pillar-strategist', 'matrix-generator', 'marketing-manager'],
    outputDocument: 'Roteiro de Vídeo',
    starters: [
      'Escrever roteiro para minha ideia',
      'Criar roteiro de infotainment',
      'Transformar ideia em script de vídeo',
      'Roteirizar meu próximo conteúdo',
    ],
    order: 7,
  },
  {
    id: 'expert-social-selling',
    name: 'Expert Social Selling',
    description: 'Especialista em estratégias de vendas através das redes sociais',
    emoji: '💰',
    color: '#14B8A6',
    recommendedModel: 'Claude Opus 4.5',
    requires: [],
    outputDocument: 'Estratégia Social Selling',
    starters: ['Criar estratégia de social selling', 'Me ajude a vender nas redes sociais'],
    order: 8,
  },
  {
    id: 'criador-documento-oferta',
    name: 'Criador de Documento da Oferta',
    description: 'Cria documentos de oferta completos e persuasivos para seu produto ou serviço',
    emoji: '📄',
    color: '#6366F1',
    recommendedModel: 'Claude Opus 4.5',
    requires: [],
    outputDocument: 'Documento da Oferta',
    starters: ['Criar documento da minha oferta', 'Estruturar minha proposta comercial'],
    order: 9,
  },
  {
    id: 'amanda-ai',
    name: 'Amanda AI',
    description: 'Assistente de inteligência artificial para estratégia e automação de negócios',
    emoji: '🤖',
    color: '#A855F7',
    recommendedModel: 'Claude Opus 4.5',
    requires: [],
    outputDocument: 'Plano Estratégico',
    starters: ['Conversar com Amanda AI', 'Me ajude com minha estratégia'],
    order: 10,
  },
  {
    id: 'arquiteta-perfil-icp',
    name: 'Arquiteta de Perfil do Cliente Ideal (ICP)',
    description: 'Constrói perfis detalhados do cliente ideal com análise comportamental profunda',
    emoji: '🎯',
    color: '#F43F5E',
    recommendedModel: 'Claude Opus 4.5',
    requires: [],
    outputDocument: 'Perfil ICP',
    starters: ['Construir perfil do meu ICP', 'Analisar meu cliente ideal'],
    order: 11,
  },
  {
    id: 'programa-rivotril',
    name: 'Programa Rivotril™',
    description: 'Sistema de organização e redução de estresse para empreendedores',
    emoji: '💊',
    color: '#0EA5E9',
    recommendedModel: 'Claude Opus 4.5',
    requires: [],
    outputDocument: 'Plano Rivotril',
    starters: ['Iniciar Programa Rivotril', 'Me ajude a organizar minha rotina'],
    order: 12,
  },
  {
    id: 'estrategias-sprint-20k',
    name: 'Estratégias Sprint R$20k',
    description: 'Estratégias aceleradas para alcançar R$20k em faturamento',
    emoji: '🚀',
    color: '#F97316',
    recommendedModel: 'Claude Opus 4.5',
    requires: [],
    outputDocument: 'Sprint Strategy',
    starters: ['Criar sprint de R$20k', 'Montar estratégia de faturamento rápido'],
    order: 13,
  },
  {
    id: 'arquiteta-workshops',
    name: 'Arquiteta de Workshops/Webinars',
    description: 'Planeja e estrutura workshops e webinars de alto impacto',
    emoji: '🎤',
    color: '#84CC16',
    recommendedModel: 'Claude Opus 4.5',
    requires: [],
    outputDocument: 'Plano de Workshop',
    starters: ['Planejar meu workshop', 'Criar estrutura de webinar'],
    order: 14,
  },
  {
    id: 'feedback-conteudo',
    name: 'Feedback de Conteúdo | Revisão Amanda AI',
    description: 'Analisa e fornece feedback detalhado sobre seu conteúdo com revisão inteligente',
    emoji: '✅',
    color: '#22C55E',
    recommendedModel: 'Claude Opus 4.5',
    requires: [],
    outputDocument: 'Feedback Report',
    starters: ['Revisar meu conteúdo', 'Quero feedback sobre meu post'],
    order: 15,
  },
  {
    id: 'copywriter-campanhas',
    name: 'Copywriter de Campanhas',
    description: 'Escreve copys persuasivas para campanhas de marketing e vendas',
    emoji: '✍️',
    color: '#E11D48',
    recommendedModel: 'Claude Opus 4.5',
    requires: [],
    outputDocument: 'Copy de Campanha',
    starters: ['Criar copy para campanha', 'Escrever texto persuasivo'],
    order: 16,
  },
  {
    id: 'vsl-invisivel',
    name: 'VSL Invisível',
    description: 'Cria Video Sales Letters invisíveis e de alta conversão',
    emoji: '🎥',
    color: '#7C3AED',
    recommendedModel: 'Claude Opus 4.5',
    requires: [],
    outputDocument: 'VSL Script',
    starters: ['Criar minha VSL invisível', 'Montar roteiro de VSL'],
    order: 17,
  },
];

// AI_MODELS is now in src/config/models.ts
export { AI_MODELS } from '@/config/models';
