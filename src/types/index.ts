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
  thinkingTime?: number;
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
];

export const AI_MODELS = [
  { id: 'claude-opus-4.5', name: 'Claude Opus 4.5', badge: 'Recomendado' },
  { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5', badge: '' },
  { id: 'gpt-4o', name: 'GPT-4o', badge: '' },
  { id: 'gpt-5.2-thinking', name: 'GPT-5.2 Thinking', badge: '' },
  { id: 'gemini-pro', name: 'Gemini Pro', badge: '' },
  { id: 'gemini-flash', name: 'Gemini Flash', badge: 'Rápido' },
];
