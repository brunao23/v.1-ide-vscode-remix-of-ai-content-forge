export interface AIModel {
  id: string;
  name: string;
  provider: 'anthropic' | 'openai' | 'google';
  runtimeProvider?: 'anthropic' | 'openai' | 'openrouter';
  apiModelId: string;
  description: string;
  supportsExtendedThinking: boolean;
  maxTokens: number;
  recommended?: boolean;
  badge?: string;
}

export const AI_MODELS: AIModel[] = [
  {
    id: 'gpt-4.1-nano',
    name: 'GPT-4.1 Nano',
    provider: 'openai',
    runtimeProvider: 'openai',
    apiModelId: 'gpt-4.1-nano',
    description: 'Mais rapido para tarefas simples',
    supportsExtendedThinking: false,
    maxTokens: 4000,
    badge: 'Rapido',
  },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    provider: 'openai',
    runtimeProvider: 'openai',
    apiModelId: 'gpt-4.1-mini',
    description: 'Equilibrio entre velocidade e qualidade',
    supportsExtendedThinking: false,
    maxTokens: 8000,
  },
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    provider: 'openai',
    runtimeProvider: 'openai',
    apiModelId: 'gpt-4.1',
    description: 'Modelo de alta qualidade para tarefas complexas',
    supportsExtendedThinking: false,
    maxTokens: 12000,
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
    recommended: true,
    badge: 'Recomendado',
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
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    runtimeProvider: 'openrouter',
    apiModelId: 'google/gemini-2.5-pro',
    description: 'Raciocinio complexo e contexto longo',
    supportsExtendedThinking: true,
    maxTokens: 12000,
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    runtimeProvider: 'openrouter',
    apiModelId: 'google/gemini-2.5-flash',
    description: 'Equilibrio entre velocidade e qualidade',
    supportsExtendedThinking: true,
    maxTokens: 8000,
    badge: 'Rapido',
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'google',
    runtimeProvider: 'openrouter',
    apiModelId: 'google/gemini-2.5-flash-lite',
    description: 'Ultra rapido para tarefas simples',
    supportsExtendedThinking: true,
    maxTokens: 4000,
    badge: 'Mais rapido',
  },
];

export const getModelById = (id: string) => AI_MODELS.find((model) => model.id === id);
