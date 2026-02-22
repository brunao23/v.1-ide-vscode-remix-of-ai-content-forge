export interface AIModel {
  id: string;
  name: string;
  provider: "anthropic" | "openai" | "google";
  apiModelId: string;
  description: string;
  supportsExtendedThinking: boolean;
  maxTokens: number;
  recommended?: boolean;
  badge?: string;
}

export const AI_MODELS: AIModel[] = [
  {
    id: "claude-opus-4.5",
    name: "Claude Opus 4.5",
    provider: "anthropic",
    apiModelId: "claude-opus-4-5-20250514",
    description: "Modelo mais avançado e inteligente",
    supportsExtendedThinking: true,
    maxTokens: 16000,
    recommended: true,
    badge: "Recomendado",
  },
  {
    id: "claude-sonnet-4.5",
    name: "Claude Sonnet 4.5",
    provider: "anthropic",
    apiModelId: "claude-sonnet-4-5-20250514",
    description: "Equilíbrio entre velocidade e qualidade",
    supportsExtendedThinking: true,
    maxTokens: 8000,
  },
  {
    id: "claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    apiModelId: "claude-haiku-4-5-20250514",
    description: "Rápido para tarefas simples",
    supportsExtendedThinking: false,
    maxTokens: 4000,
    badge: "Rápido",
  },
];

export const getModelById = (id: string) => AI_MODELS.find((m) => m.id === id);
