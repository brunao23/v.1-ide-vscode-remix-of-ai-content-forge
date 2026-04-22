export interface AIModel {
  id: string;
  name: string;
  provider: 'anthropic' | 'openai';
  runtimeProvider?: 'anthropic' | 'openai';
  apiModelId: string;
  description: string;
  supportsExtendedThinking: boolean;
  maxTokens: number;
  recommended?: boolean;
  badge?: string;
}

export const AI_MODELS: AIModel[] = [
  {
    id: 'gpt-5.4-nano',
    name: 'GPT-5.4 Nano',
    provider: 'openai',
    runtimeProvider: 'openai',
    apiModelId: 'gpt-5.4-nano',
    description: 'Mais rapido para tarefas simples (2026)',
    supportsExtendedThinking: false,
    maxTokens: 8000,
    badge: 'Rapido',
  },
  {
    id: 'gpt-5.4-mini',
    name: 'GPT-5.4 Mini',
    provider: 'openai',
    runtimeProvider: 'openai',
    apiModelId: 'gpt-5.4-mini',
    description: 'Equilibrio ideal (2026)',
    supportsExtendedThinking: false,
    maxTokens: 16000,
  },
  {
    id: 'gpt-5.4',
    name: 'GPT-5.4',
    provider: 'openai',
    runtimeProvider: 'openai',
    apiModelId: 'gpt-5.4',
    description: 'Alta capacidade de raciocinio',
    supportsExtendedThinking: true,
    maxTokens: 32000,
  },
  {
    id: 'gpt-5.4-pro',
    name: 'GPT-5.4 Pro',
    provider: 'openai',
    runtimeProvider: 'openai',
    apiModelId: 'gpt-5.4-pro',
    description: 'O mais avancado e poderoso da OpenAI',
    supportsExtendedThinking: true,
    maxTokens: 64000,
    badge: 'Novo 2026',
  },
  {
    id: 'claude-opus-4-7',
    name: 'Claude Opus 4.7',
    provider: 'anthropic',
    runtimeProvider: 'anthropic',
    apiModelId: 'claude-opus-4-7',
    description: 'Modelo mais avancado 2026 — maxima qualidade',
    supportsExtendedThinking: true,
    maxTokens: 16000,
    recommended: true,
    badge: 'Novo 2026',
  },
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'anthropic',
    runtimeProvider: 'anthropic',
    apiModelId: 'claude-opus-4-6',
    description: 'Opus 2026 — alta qualidade e raciocinio',
    supportsExtendedThinking: true,
    maxTokens: 14000,
    badge: 'Novo 2026',
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    runtimeProvider: 'anthropic',
    apiModelId: 'claude-sonnet-4-6',
    description: 'Sonnet 2026 — equilibrio velocidade e qualidade',
    supportsExtendedThinking: true,
    maxTokens: 12000,
    badge: 'Novo 2026',
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    runtimeProvider: 'anthropic',
    apiModelId: 'claude-haiku-4-5-20251001',
    description: 'Haiku 2026 — ultra rapido para tarefas do dia a dia',
    supportsExtendedThinking: false,
    maxTokens: 6000,
    badge: 'Rapido',
  },
  {
    id: 'claude-opus-4',
    name: 'Claude Opus 4',
    provider: 'anthropic',
    runtimeProvider: 'anthropic',
    apiModelId: 'claude-opus-4-20250514',
    description: 'Melhor qualidade para estrategia e criacao',
    supportsExtendedThinking: true,
    maxTokens: 12000,
  },
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    runtimeProvider: 'anthropic',
    apiModelId: 'claude-sonnet-4-20250514',
    description: 'Equilibrio entre velocidade e qualidade',
    supportsExtendedThinking: true,
    maxTokens: 10000,
  },
  {
    id: 'claude-3-5-haiku',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    runtimeProvider: 'anthropic',
    apiModelId: 'claude-3-5-haiku-20241022',
    description: 'Rapido para tarefas do dia a dia',
    supportsExtendedThinking: false,
    maxTokens: 4000,
    badge: 'Rapido',
  },
];

export const getModelById = (id: string) => AI_MODELS.find((model) => model.id === id);
