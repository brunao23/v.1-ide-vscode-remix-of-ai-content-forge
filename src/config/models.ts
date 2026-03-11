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
  // ChatGPT models
  {
    id: "chatgpt-5.3-instant",
    name: "ChatGPT 5.3 Instant",
    provider: "openai",
    apiModelId: "gpt-5.3-instant",
    description: "Rápido para tarefas simples",
    supportsExtendedThinking: false,
    maxTokens: 4000,
    badge: "Rápido",
  },
  {
    id: "chatgpt-5.3",
    name: "ChatGPT 5.3",
    provider: "openai",
    apiModelId: "gpt-5.3",
    description: "Equilíbrio entre velocidade e qualidade",
    supportsExtendedThinking: true,
    maxTokens: 8000,
  },
  {
    id: "chatgpt-5.3-pro",
    name: "ChatGPT 5.3 Pro",
    provider: "openai",
    apiModelId: "gpt-5.3-pro",
    description: "Modelo mais avançado do ChatGPT",
    supportsExtendedThinking: true,
    maxTokens: 16000,
  },
  // Claude models
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
  // Gemini models
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    apiModelId: "google/gemini-2.5-pro",
    description: "Raciocínio complexo e contexto longo",
    supportsExtendedThinking: true,
    maxTokens: 16000,
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    apiModelId: "google/gemini-2.5-flash",
    description: "Equilíbrio entre velocidade e qualidade",
    supportsExtendedThinking: true,
    maxTokens: 8000,
    badge: "Rápido",
  },
  {
    id: "gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    provider: "google",
    apiModelId: "google/gemini-2.5-flash-lite",
    description: "Ultra rápido para tarefas simples",
    supportsExtendedThinking: false,
    maxTokens: 4000,
    badge: "Mais rápido",
  },
];

export const getModelById = (id: string) => AI_MODELS.find((m) => m.id === id);
