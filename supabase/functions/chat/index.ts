import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.39.0";
import { Pinecone } from "npm:@pinecone-database/pinecone@3.0.2";
import { resolveRuntimeSecrets } from "../_shared/runtime-secrets.ts";
import {
  HttpError,
  isGlobalAdmin,
  resolveTenantForRequest,
} from "../_shared/auth-tenant.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DOCUMENT_CONTEXT_AGENT_FALLBACK = new Set([
  "icp-architect",
  "arquiteta-perfil-icp",
  "pillar-strategist",
  "matrix-generator",
  "diretora-criativa",
  "scriptwriter",
  "copywriter-campanhas",
  "expert-social-selling",
  "criador-documento-oferta",
  "estrategias-sprint-20k",
  "arquiteta-workshops",
  "feedback-conteudo",
  "vsl-invisivel",
  "amanda-ai",
  "voz-de-marca",
]);

const DEFAULT_DOCUMENT_TYPES_BY_AGENT: Record<string, string[]> = {
  "brand-book": ["brand-book"],
  "icp-architect": ["brand-book", "pesquisa", "icp"],
  "arquiteta-perfil-icp": ["brand-book", "pesquisa", "icp"],
  "pillar-strategist": ["brand-book", "pesquisa", "icp", "pilares"],
  "matrix-generator": ["brand-book", "pesquisa", "icp", "pilares", "matriz"],
  "diretora-criativa": ["brand-book", "pesquisa", "icp", "pilares", "matriz"],
  "scriptwriter": [
    "brand-book",
    "pesquisa",
    "icp",
    "pilares",
    "matriz",
    "calendario",
    "roteiro",
  ],
  "copywriter-campanhas": [
    "brand-book",
    "pesquisa",
    "icp",
    "pilares",
    "matriz",
    "calendario",
    "roteiro",
  ],
  "expert-social-selling": ["brand-book", "pesquisa", "icp", "calendario", "roteiro"],
  "criador-documento-oferta": ["brand-book", "pesquisa", "icp", "calendario", "roteiro"],
  "estrategias-sprint-20k": [
    "brand-book",
    "pesquisa",
    "icp",
    "pilares",
    "matriz",
    "calendario",
  ],
  "arquiteta-workshops": [
    "brand-book",
    "pesquisa",
    "icp",
    "pilares",
    "matriz",
    "calendario",
    "roteiro",
  ],
  "feedback-conteudo": [
    "brand-book",
    "pesquisa",
    "icp",
    "pilares",
    "matriz",
    "calendario",
    "roteiro",
    "outro",
  ],
  "vsl-invisivel": [
    "brand-book",
    "pesquisa",
    "icp",
    "pilares",
    "matriz",
    "calendario",
    "roteiro",
  ],
  "amanda-ai": [
    "brand-book",
    "pesquisa",
    "icp",
    "pilares",
    "matriz",
    "calendario",
    "roteiro",
    "outro",
  ],
  "voz-de-marca": ["outro", "brand-book", "pesquisa", "icp", "roteiro"],
};

const AGENT_TO_DOCUMENT_TYPE: Record<string, string> = {
  "brand-book": "brand-book",
  "market-research": "pesquisa",
  "icp-architect": "icp",
  "pillar-strategist": "pilares",
  "matrix-generator": "matriz",
  "diretora-criativa": "calendario",
  "scriptwriter": "roteiro",
  "copywriter-campanhas": "roteiro",
  "voz-de-marca": "outro",
};

const DOCUMENT_TYPE_ALIASES: Record<string, string[]> = {
  "brand-book": ["brand-book", "brand book", "brandbook", "brand_book"],
  "pesquisa": ["pesquisa", "market-research", "market research"],
  "icp": ["icp", "icp-architect", "arquiteto-icp", "mapa do icp"],
  "pilares": ["pilares", "pillar-strategist", "pilar"],
  "matriz": ["matriz", "matrix-generator", "matriz de ideias"],
  "calendario": ["calendario", "calendar", "diretora-criativa", "gerente de marketing"],
  "roteiro": ["roteiro", "scriptwriter", "copywriter-campanhas", "copywriter campanhas"],
  "outro": ["outro", "other", "voz-de-marca", "voz de marca", "voice-profile"],
};

const MAX_SYSTEM_DOC_TOKENS = 14000;
const MAX_SYSTEM_DOCS_IN_PROMPT = 12;
const MAX_USER_DOC_TOKENS = 8000;
const MAX_USER_DOC_CHUNKS_IN_PROMPT = 16;
const MAX_SINGLE_CHUNK_TOKENS = 600;

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type RetrievedDocumentSource =
  | "PINECONE"
  | "SUPABASE_FALLBACK"
  | "MANDATORY_FALLBACK";

type RetrievedDocumentChunk = {
  content: string;
  similarity: number;
  source: RetrievedDocumentSource;
  documentType: string | null;
  subject?: string | null;
};

type SystemDocument = {
  name: string;
  content: string;
  isMandatory: boolean;
};

type AgentPromptConfig = {
  system_prompt: string;
  requires_documents: string[] | null;
  uses_documents_context: boolean;
};

type RuntimeModelProvider = "anthropic" | "openai";
type MarketingMode = "calendar" | "idea";
type ThinkingEffort = "low" | "medium" | "high" | "xhigh" | "max";
type AnthropicThinkingResolution = {
  requested: boolean;
  enabled: boolean;
  mode: "disabled" | "enabled" | "adaptive";
  reason: string;
  budgetTokens?: number;
  effort?: ThinkingEffort;
};
type MarketingWebSearchDecision = {
  shouldSearch: boolean;
  reason: string;
};
type MarketingDocumentSearchStep = {
  subject: string;
  query: string;
  maxChunks: number;
};
type MarketingWebSearchStep = {
  label: string;
  query: string;
  maxResults: number;
};
type MarketingWebStepResult = {
  label: string;
  query: string;
  resultCount: number;
  domains: string[];
};

function resolveTenantNamespace(basePrefix: string, tenantId: string): string {
  const cleanTenantId = tenantId.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const namespace = `${basePrefix}-tenant-${cleanTenantId}`;
  return namespace.slice(0, 63);
}

function normalizeMessages(rawMessages: unknown): ChatMessage[] {
  if (!Array.isArray(rawMessages)) return [];
  return rawMessages
    .filter((msg) => msg && typeof msg === "object")
    .map((msg: any) => ({
      role: msg.role,
      content: String(msg.content ?? ""),
    }))
    .filter((msg) =>
      (msg.role === "user" || msg.role === "assistant") &&
      typeof msg.content === "string"
    );
}

function isAnthropicModel(modelId: string): boolean {
  return String(modelId || "").toLowerCase().startsWith("claude-");
}

function isOpenAIModel(modelId: string): boolean {
  const normalized = String(modelId || "").toLowerCase();
  return normalized.startsWith("gpt-") || normalized.startsWith("o");
}

function inferProviderFromModelId(modelId: string): RuntimeModelProvider {
  const normalized = String(modelId || "").trim().toLowerCase();
  if (!normalized) return "anthropic";
  if (isAnthropicModel(normalized)) return "anthropic";
  if (isOpenAIModel(normalized)) return "openai";
  return "anthropic";
}

function resolveEffectiveProvider(
  modelId: string,
  requestedProvider: RuntimeModelProvider | null,
): RuntimeModelProvider {
  const inferred = inferProviderFromModelId(modelId);
  if (!requestedProvider) return inferred;

  if (requestedProvider !== inferred) {
    throw new HttpError(
      400,
      `Modelo '${modelId}' pertence ao provedor '${inferred}', mas foi solicitado '${requestedProvider}'. Corrija a selecao de modelo/provedor.`,
    );
  }

  return requestedProvider;
}

function isAdaptiveThinkingOnlyAnthropicModel(modelId: string): boolean {
  const n = String(modelId || "").toLowerCase();
  if (n.includes("claude-mythos-preview")) return true;
  if (n.includes("opus-4-7") || n.includes("opus-4.7")) return true;
  if (n.includes("opus-5") || n.includes("opus-6")) return true;
  return false;
}

function isAdaptivePreferredAnthropicModel(modelId: string): boolean {
  const n = String(modelId || "").toLowerCase();
  return (
    isAdaptiveThinkingOnlyAnthropicModel(n) ||
    n.includes("opus-4-6") ||
    n.includes("opus-4.6") ||
    n.includes("sonnet-4-6") ||
    n.includes("sonnet-4.6")
  );
}

function supportsAnthropicThinking(modelId: string): boolean {
  const n = String(modelId || "").toLowerCase();
  if (!n.startsWith("claude-")) return false;
  if (n.includes("3-5-haiku")) return false;
  if (n.includes("3-5-sonnet")) return false;
  return (
    n.includes("sonnet-3-7") ||
    n.includes("opus-4") ||
    n.includes("sonnet-4") ||
    n.includes("haiku-4-5") ||
    n.includes("mythos-preview")
  );
}

function normalizeThinkingEffort(value: unknown): ThinkingEffort {
  const normalized = String(value || "").trim().toLowerCase();
  if (
    normalized === "low" ||
    normalized === "medium" ||
    normalized === "high" ||
    normalized === "xhigh" ||
    normalized === "max"
  ) {
    return normalized;
  }
  return "high";
}

function resolveAnthropicThinkingConfig(params: {
  modelId: string;
  requested: boolean;
  maxTokens: number;
  effort: ThinkingEffort;
}): AnthropicThinkingResolution {
  const safeMaxTokens = Math.max(512, Math.floor(params.maxTokens || 0));
  if (!params.requested) {
    return {
      requested: false,
      enabled: false,
      mode: "disabled",
      reason: "disabled-by-user",
    };
  }

  if (!supportsAnthropicThinking(params.modelId)) {
    return {
      requested: true,
      enabled: false,
      mode: "disabled",
      reason: "model-does-not-support-thinking",
    };
  }

  if (isAdaptivePreferredAnthropicModel(params.modelId)) {
    return {
      requested: true,
      enabled: true,
      mode: "adaptive",
      reason: isAdaptiveThinkingOnlyAnthropicModel(params.modelId)
        ? "adaptive-required-by-model"
        : "adaptive-recommended-by-model",
      effort: params.effort,
    };
  }

  const targetBudget = Math.max(
    1024,
    Math.min(10000, Math.floor(safeMaxTokens * 0.55)),
  );
  if (targetBudget >= safeMaxTokens) {
    return {
      requested: true,
      enabled: false,
      mode: "disabled",
      reason: "insufficient-max_tokens-for-manual-thinking",
    };
  }

  return {
    requested: true,
    enabled: true,
    mode: "enabled",
    reason: "manual-thinking",
    budgetTokens: targetBudget,
  };
}

function isAuthenticationError(error: any): boolean {
  const status = getProviderErrorStatus(error);
  if (status === 401 || status === 403) return true;
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("invalid x-api-key") ||
    message.includes("authentication") ||
    message.includes("api key") ||
    message.includes("unauthorized")
  );
}

function getProviderErrorStatus(error: any): number {
  const statusCandidates = [
    Number(error?.status || 0),
    Number(error?.statusCode || 0),
    Number(error?.response?.status || 0),
    Number(error?.error?.status || 0),
  ];
  for (const status of statusCandidates) {
    if (Number.isFinite(status) && status > 0) return status;
  }
  return 0;
}

function isTransientUpstreamError(error: any): boolean {
  const status = getProviderErrorStatus(error);
  if ([408, 409, 425, 429, 500, 502, 503, 504, 529].includes(status)) {
    return true;
  }

  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("internal server error") ||
    message.includes("server error") ||
    message.includes("temporarily unavailable") ||
    message.includes("overloaded") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("rate limit") ||
    message.includes("upstream")
  );
}

function wrapProviderError(provider: string, error: any): Error {
  const status = getProviderErrorStatus(error);
  const message = String(
    error?.message ||
      error?.error?.message ||
      error?.cause?.message ||
      "Unknown provider error",
  );
  const wrapped = new Error(
    `${provider} request failed${status ? ` (${status})` : ""}: ${message}`,
  ) as Error & { status?: number };
  if (status > 0) wrapped.status = status;
  return wrapped;
}

async function waitForRetry(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ Model pricing (USD per million tokens) ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬

function getModelPricing(modelId: string): { inputPerM: number; outputPerM: number } {
  const id = (modelId || "").toLowerCase();
  // Claude 2026 series
  if (id.includes("opus-4-7") || id === "claude-opus-4-7") return { inputPerM: 15, outputPerM: 75 };
  if (id.includes("opus-4-6") || id === "claude-opus-4-6") return { inputPerM: 15, outputPerM: 75 };
  if (id.includes("sonnet-4-6") || id === "claude-sonnet-4-6") return { inputPerM: 3, outputPerM: 15 };
  if (id.includes("haiku-4-5") || id.includes("claude-haiku-4-5")) return { inputPerM: 0.80, outputPerM: 4 };
  // Claude 2025 / legacy
  if (id.includes("opus-4") || id.includes("claude-opus-4")) return { inputPerM: 15, outputPerM: 75 };
  if (id.includes("sonnet-4") || id.includes("claude-sonnet-4")) return { inputPerM: 3, outputPerM: 15 };
  if (id.includes("haiku-4") || id.includes("claude-haiku-4")) return { inputPerM: 0.80, outputPerM: 4 };
  if (id.includes("3-5-sonnet") || id.includes("3.5-sonnet")) return { inputPerM: 3, outputPerM: 15 };
  if (id.includes("3-5-haiku") || id.includes("3.5-haiku")) return { inputPerM: 0.80, outputPerM: 4 };
  if (id.includes("claude-3-opus")) return { inputPerM: 15, outputPerM: 75 };
  // OpenAI
  if (id.includes("gpt-4o-mini")) return { inputPerM: 0.15, outputPerM: 0.60 };
  if (id.includes("gpt-4o")) return { inputPerM: 2.50, outputPerM: 10 };
  if (id.includes("gpt-4.1-nano")) return { inputPerM: 0.10, outputPerM: 0.40 };
  if (id.includes("gpt-4.1-mini")) return { inputPerM: 0.40, outputPerM: 1.60 };
  if (id.includes("gpt-4.1")) return { inputPerM: 2.00, outputPerM: 8.00 };
  if (id.includes("gpt-5.4-nano")) return { inputPerM: 0.10, outputPerM: 0.40 };
  if (id.includes("gpt-5.4-mini")) return { inputPerM: 0.40, outputPerM: 1.60 };
  if (id.includes("gpt-5.4-pro")) return { inputPerM: 5.00, outputPerM: 20.00 };
  if (id.includes("gpt-5.4")) return { inputPerM: 2.00, outputPerM: 8.00 };
  // Gemini
  if (id.includes("gemini-2.5-pro")) return { inputPerM: 1.25, outputPerM: 10 };
  if (id.includes("gemini-2.5-flash")) return { inputPerM: 0.15, outputPerM: 0.60 };
  return { inputPerM: 3, outputPerM: 15 }; // default: sonnet pricing
}

function sanitizeLeakedToolCalls(text: string): string {
  let cleaned = String(text || "");
  // Remove full <function_calls>...</function_calls> blocks (multiline)
  cleaned = cleaned.replace(/<function_calls>[\s\S]*?<\/function_calls>/gi, "");
  // Remove orphan opening/closing tags
  cleaned = cleaned.replace(/<\/?function_calls>/gi, "");
  cleaned = cleaned.replace(/<\/?antml:function_calls>/gi, "");
  // Remove <invoke ...>...</invoke> blocks
  cleaned = cleaned.replace(/<invoke[\s\S]*?<\/invoke>/gi, "");
  cleaned = cleaned.replace(/<invoke[\s\S]*?<\/antml:invoke>/gi, "");
  // Remove standalone tags like <parameter_name>, <parameter_value>, etc.
  cleaned = cleaned.replace(/<\/?(?:parameter_name|parameter_value|antml:parameter)[^>]*>/gi, "");
  // Remove ALL invented bracket-tags related to web search (any variation the AI might invent)
  cleaned = cleaned.replace(/\[[A-Z_]*(?:PESQUIS|BUSCA|SEARCH|WEB|CONSULTA)[A-Z_]*[^\]]{0,200}\]/gi, "");
  // Remove "Aguarde..." / "Buscando..." filler lines when AI pretends to be searching
  cleaned = cleaned.replace(/^(aguarde|buscando|pesquisando|consultando|reunindo|coletando)\b.*\.(\.\.)?$/gim, "");
  // Collapse excessive blank lines left behind
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  return cleaned.trim();
}

function estimateTokenCount(text: string): number {
  return Math.ceil(String(text || "").length / 4);
}

function truncateTextToTokenBudget(text: string, tokenBudget: number): string {
  const safeBudget = Math.max(32, Math.floor(tokenBudget));
  const safeText = String(text || "");
  if (estimateTokenCount(safeText) <= safeBudget) return safeText;
  return safeText.slice(0, safeBudget * 4);
}

function trimMessagesToTokenBudget(
  messages: ChatMessage[],
  tokenBudget: number,
): ChatMessage[] {
  const safeBudget = Math.max(64, Math.floor(tokenBudget));
  if (messages.length === 0) return messages;

  const kept: ChatMessage[] = [];
  let used = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const msg = messages[index];
    const msgTokens = estimateTokenCount(String(msg.content || "")) + 8;

    if (used + msgTokens <= safeBudget) {
      kept.unshift(msg);
      used += msgTokens;
      continue;
    }

    if (kept.length === 0) {
      const remaining = Math.max(32, safeBudget - 8);
      kept.unshift({
        ...msg,
        content: truncateTextToTokenBudget(String(msg.content || ""), remaining),
      });
    }

    break;
  }

  return kept;
}

function normalizeModelProvider(value: unknown): RuntimeModelProvider | null {
  const provider = String(value || "").trim().toLowerCase();
  if (provider === "anthropic" || provider === "openai") {
    return provider;
  }
  return null;
}

function shouldUseDocumentContext(
  agentId: string | null,
  agentPrompt: AgentPromptConfig | null,
  latestUserText: string,
): boolean {
  if (!agentId) return false;
  const fallbackByAgent = DOCUMENT_CONTEXT_AGENT_FALLBACK.has(agentId);
  const fallbackByIntent = isDocumentConsultIntent(latestUserText) &&
    Boolean(DEFAULT_DOCUMENT_TYPES_BY_AGENT[agentId]?.length);

  if (agentPrompt && typeof agentPrompt.uses_documents_context === "boolean") {
    if (agentPrompt.uses_documents_context) return true;
    return fallbackByAgent || fallbackByIntent;
  }
  return fallbackByAgent || fallbackByIntent;
}

function normalizeIntentText(text: string): string {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeMarketingMode(value: unknown): MarketingMode {
  const raw = String(value || "").trim().toLowerCase();
  return raw === "idea" ? "idea" : "calendar";
}

function buildMarketingDocumentRetrievalPlan(
  userPrompt: string,
  mode: MarketingMode,
): MarketingDocumentSearchStep[] {
  const baseTopic = String(userPrompt || "").trim();
  const compactTopic = baseTopic.slice(0, 420);

  if (mode === "idea") {
    return [
      {
        subject: "Marca, metodo e posicionamento",
        query: `${compactTopic} brand book proposta de valor diferenciais mecanismo assinatura`,
        maxChunks: 4,
      },
      {
        subject: "ICP, dores e linguagem",
        query: `${compactTopic} icp publico alvo dores desejos objecoes linguagem comportamento compra`,
        maxChunks: 4,
      },
      {
        subject: "Pilares, matriz e angulos",
        query: `${compactTopic} pilares subpilares matriz de conteudo big ideas angulos narrativos`,
        maxChunks: 4,
      },
      {
        subject: "Voz, banlist e padroes de comunicacao",
        query: `${compactTopic} voz de marca tom de voz padroes de comunicacao ban list proibicoes`,
        maxChunks: 4,
      },
    ];
  }

  return [
    {
      subject: "Direcionamento estrategico da marca",
      query: `${compactTopic} brand book objetivo de negocio oferta posicionamento`,
      maxChunks: 4,
    },
    {
      subject: "Contexto do publico e temas prioritarios",
      query: `${compactTopic} icp pilares subpilares matriz prioridades de conteudo`,
      maxChunks: 4,
    },
    {
      subject: "Regras de comunicacao e execucao",
      query: `${compactTopic} voz de marca ban list padroes comunicacao roteiro calendario`,
      maxChunks: 4,
    },
  ];
}
function buildMarketingWebSearchPlan(
  userPrompt: string,
  mode: MarketingMode,
): MarketingWebSearchStep[] {
  const topic = String(userPrompt || "").trim().slice(0, 220);

  if (mode === "idea") {
    return [
      {
        label: "Fatos e contexto principal do tema",
        query: `${topic} fatos recentes contexto oficial`,
        maxResults: 6,
      },
      {
        label: "Acoes, ativacoes e execucao pratica",
        query: `${topic} ativacao campanha execucao experiencia fisica resultados`,
        maxResults: 6,
      },
      {
        label: "Dados de mercado, numeros e impacto",
        query: `${topic} dados metricas numeros crescimento receita impacto`,
        maxResults: 6,
      },
      {
        label: "Contrapontos e angulos alternativos",
        query: `${topic} analise critica contraponto opinioes especialistas`,
        maxResults: 6,
      },
    ];
  }

  return [
    {
      label: "Tendencias e pautas quentes",
      query: `${topic} tendencias atuais pautas quentes`,
      maxResults: 6,
    },
    {
      label: "Exemplos aplicaveis ao calendario",
      query: `${topic} exemplos de conteudo calendario editorial redes sociais`,
      maxResults: 6,
    },
    {
      label: "Dados e fatos para validar premissas",
      query: `${topic} dados fatos recentes fonte confiavel`,
      maxResults: 6,
    },
  ];
}
function parseDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname || "";
    return hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function hasUrlReference(text: string): boolean {
  return /https?:\/\/|www\./i.test(String(text || ""));
}

function containsResearchSignals(text: string): boolean {
  const normalized = normalizeIntentText(text);
  return (
    hasUrlReference(text) ||
    /\b[a-z0-9-]+\.[a-z]{2,}\b/i.test(String(text || "")) ||
    normalized.includes("fonte:") ||
    normalized.includes("fontes:") ||
    normalized.includes("[referencia") ||
    normalized.includes("referencia ")
  );
}

function userExplicitlyRequestsWebSearch(text: string): boolean {
  const normalized = normalizeIntentText(text);
  return (
    normalized.includes("busque na web") ||
    normalized.includes("buscar na web") ||
    normalized.includes("pesquise na web") ||
    normalized.includes("pesquisar na web") ||
    normalized.includes("pesquise") ||
    normalized.includes("buscar") ||
    normalized.includes("noticias recentes") ||
    normalized.includes("dados recentes") ||
    normalized.includes("tendencias") ||
    // Approval patterns  -  user confirming AI should search
    normalized.includes("pode buscar") ||
    normalized.includes("pode pesquisar") ||
    normalized.includes("pode procurar") ||
    normalized.includes("faz a busca") ||
    normalized.includes("faca a busca") ||
    normalized.includes("faz a pesquisa") ||
    normalized.includes("faca a pesquisa") ||
    normalized.includes("sim busca") ||
    normalized.includes("sim pesquisa") ||
    normalized.includes("ok busca") ||
    normalized.includes("ok pesquisa") ||
    normalized.includes("vai la buscar") ||
    normalized.includes("manda buscar") ||
    normalized.includes("manda pesquisar") ||
    /^(sim|pode|ok|va em frente|manda ver|bora|vai)\s*[.!]?\s*$/i.test(normalized)
  );
}

function userExplicitlyDisablesWebSearch(text: string): boolean {
  const normalized = normalizeIntentText(text);
  return (
    normalized.includes("sem busca na web") ||
    normalized.includes("sem pesquisar na web") ||
    normalized.includes("nao busque na web") ||
    normalized.includes("nao pesquisar na web")
  );
}

function hasRecentResearchInConversation(messages: ChatMessage[]): boolean {
  const recentMessages = messages.slice(-8);
  return recentMessages.some((message) => containsResearchSignals(message.content));
}

function marketingResearchAutoTrigger(text: string): boolean {
  const n = normalizeIntentText(text);
  if (n.length < 8) return false;

  // "sobre X" pattern — user responding with a concrete topic
  if (/^sobre\s+\w/.test(n) && n.length >= 10) return true;

  // Short topic messages (≥15 chars) with high-signal keywords
  const highSignalKeywords = [
    "ia", "inteligencia artificial", "agente", "agentes", "chatgpt", "llm",
    "tendencia", "tendencias", "mercado", "viral", "o que bomba", "o que funciona",
    "temas quentes", "o que ta em alta", "recente", "atualmente",
  ];
  if (n.length >= 15 && highSignalKeywords.some((s) => n.includes(s))) return true;

  // Longer messages with broader research signals (original logic, lowered to 25 chars)
  if (n.length < 25) return false;
  const signals = [
    "concorrente", "concorrencia", "competidor", "dado", "dados",
    "estatistica", "estatisticas", "pesquisa de mercado", "analise de mercado",
    "o que esta", "como esta", "hoje em dia", "ultimos meses",
    "estrategia de conteudo", "planejamento de conteudo",
    "ideias de conteudo", "roteiro", "campanha", "lancamento",
  ];
  return signals.some((s) => n.includes(s));
}

function resolveMarketingWebSearchDecision(
  messages: ChatMessage[],
  latestUserText: string,
  webSearchApproved: boolean,
): MarketingWebSearchDecision {
  if (!latestUserText.trim()) {
    return { shouldSearch: false, reason: "empty-user-message" };
  }

  if (userExplicitlyDisablesWebSearch(latestUserText)) {
    return { shouldSearch: false, reason: "disabled-by-user" };
  }

  const recentResearchExists = hasRecentResearchInConversation(messages);
  const explicitRequest = userExplicitlyRequestsWebSearch(latestUserText);
  const autoTrigger = marketingResearchAutoTrigger(latestUserText);

  // If recent web research already exists, skip re-run unless explicitly requested or auto-triggered
  if (recentResearchExists && !webSearchApproved && !explicitRequest && !autoTrigger) {
    return { shouldSearch: false, reason: "recent-research-already-present" };
  }

  if (webSearchApproved) {
    return { shouldSearch: true, reason: "user-approved-via-button" };
  }

  if (explicitRequest) {
    return { shouldSearch: true, reason: "explicit-web-search-request" };
  }

  if (autoTrigger) {
    return { shouldSearch: true, reason: "auto-research-intent-detected" };
  }

  return { shouldSearch: false, reason: "awaiting-user-approval" };
}
/**
 * Extracts the real topic from the full conversation history.
 * When the user says "pode buscar" or clicks the search button,
 * lastUserText has no useful context. This function looks through
 * ALL user messages to build the real search topic.
 */
/**
 * Returns true if the text is primarily a search request / approval,
 * carrying no real topical content to search about.
 */
function isSearchTriggerMessage(text: string): boolean {
  const n = text.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Short approval
  if (n.length < 30 && /^(sim|pode|ok|vai|bora|manda ver|va em frente)/.test(n)) return true;
  // Explicitly about wanting a search, nothing else
  const searchPhrases = [
    "queria enriquecer com", "queria buscar", "qeria enrriquecer",
    "quero enriquecer com", "faz uma busca", "pode buscar",
    "pode pesquisar", "pesquisa na web", "busca na web",
    "enriquecer com alguma busca", "enriquecer com busca",
    "preciso de mais dados", "buscar mais informacoes",
    "pesquisar mais", "buscar na web", "pesquisar na web",
    "busque na web", "busque novamente", "busca novamente",
    "pesquise na web", "pesquise novamente", "faz busca",
    "faca a busca", "faca busca", "faz a busca",
    "tente novamente", "tenta novamente", "tente buscar",
    "isso na web", "isso ai na web", "pesquisa isso",
    "busca isso", "pesquise isso", "busque isso",
    "faz isso na web", "faz essa busca", "faz essa pesquisa",
  ];
  const matchedPhrase = searchPhrases.find((p) => n.includes(p));
  if (!matchedPhrase) return false;

  // Strip the trigger phrase and check if substantial topic content remains.
  // "busca na web" → remainder="" → pure trigger ✓
  // "preciso que voce busque na web uma ideia sobre IA" → remainder has 6 words → NOT a trigger
  const remainder = n.replace(matchedPhrase, "").replace(/\s+/g, " ").trim();
  const remainderWords = remainder.split(/\s+/).filter((w) => w.length > 2);
  if (remainderWords.length >= 3) return false;

  return n.length < 80;
}

/**
 * Extracts the real topic from the full conversation history.
 * When the user says "pode buscar" or "queria enriquecer com busca na web",
 * looks through the full message history to find what the conversation is actually about.
 */
function extractConversationTopic(messages: ChatMessage[], latestUserText: string): string {
  if (!isSearchTriggerMessage(latestUserText)) {
    // Latest message has real substance  -  use it
    return latestUserText;
  }

  // It's a search trigger  -  look back for the REAL topic
  // Collect all substantive user messages, excluding search triggers
  const substantiveUserMessages = messages
    .filter((m) => m.role === "user")
    .map((m) => String(m.content || "").trim())
    .filter((text) => text.length >= 20 && !isSearchTriggerMessage(text));

  // Take the 3 most recent substantive messages (they have the most context)
  const recent = substantiveUserMessages.slice(-3);
  if (recent.length > 0) {
    const combined = recent.join(" | ").slice(0, 600);
    console.log(`[WebSearch] Topic from history: "${combined.slice(0, 100)}"`);
    return combined;
  }

  // Nothing useful in history  -  fallback to the trigger message itself
  return latestUserText;
}


function extractMarketResearchContext(messages: ChatMessage[], fallback: string): string {
  const userMessages = messages
    .filter((m) => m.role === "user")
    .map((m) => String(m.content || "").trim())
    .filter((t) => t.length >= 5);

  if (userMessages.length === 0) return fallback;
  if (userMessages.length === 1) return userMessages[0];

  // Filter out purely vague generic messages that carry no topical content
  const businessKeywords =
    /mercado|nicho|setor|industria|segmento|curso|mentoria|coaching|consultoria|ecommerce|loja|produto|servico|marca|negocio|empresa|cliente|publico|audiencia|vendo|vender|ofere[ÃƒÂ§c]o|atendo|trabalh/i;

  const substantive = userMessages.filter(
    (t) => t.length > 40 || businessKeywords.test(t),
  );

  const toUse = substantive.length > 0 ? substantive : userMessages;
  return toUse.join(" | ").slice(0, 420);
}

function extractTopicFromDocContent(content: string): string {
  // Strategy 1: extract value from labeled fields (e.g. "Setor: educaÃƒÂ§ÃƒÂ£o digital")
  const fieldRe = /(?:setor|mercado|nicho|segmento|area de atuacao|industria|produto principal|servico principal)\s*[:Ã¢â‚¬â€œ\-]\s*([^\n]{5,160})/gi;
  const fieldMatches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = fieldRe.exec(content)) !== null) {
    const val = m[1].replace(/\*\*/g, "").replace(/\*/g, "").trim();
    if (val.length > 4) fieldMatches.push(val);
  }
  if (fieldMatches.length > 0) return fieldMatches.slice(0, 2).join(", ").slice(0, 220);

  // Strategy 2: clean lines that are substantive but not document titles
  const stripped = content
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/`/g, "")
    .replace(/\[.*?\]\(.*?\)/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) =>
      l.length > 20 &&
      l.length < 130 &&
      !/^(mapeamento|perfil do cliente|arquiteto|criado por|elaborado|documento de|icp -|brand book -)/i.test(l),
    );

  const businessRe =
    /mercado|nicho|setor|industria|atua|trabalha|produto|servico|publico|vende|negocio|mentor|coach|consult|curso|treinam|segmento|oferta/i;
  const businessLines = stripped.filter((l) => businessRe.test(l));
  const toUse = businessLines.length > 0 ? businessLines : stripped;
  return toUse.slice(0, 3).join(", ").replace(/\s+/g, " ").trim().slice(0, 220);
}

function normalizeTypeToken(value: string): string {
  return normalizeIntentText(value).replace(/[\s_]+/g, "-").trim();
}

function canonicalizeDocumentType(
  rawType: string | null | undefined,
  agentId?: string | null,
): string {
  const normalized = normalizeTypeToken(String(rawType || ""));

  for (const [canonical, aliases] of Object.entries(DOCUMENT_TYPE_ALIASES)) {
    if (normalizeTypeToken(canonical) === normalized) return canonical;
    if (aliases.some((alias) => normalizeTypeToken(alias) === normalized)) {
      return canonical;
    }
  }

  const mappedByAgent = agentId && AGENT_TO_DOCUMENT_TYPE[agentId]
    ? AGENT_TO_DOCUMENT_TYPE[agentId]
    : null;
  if (mappedByAgent && (!normalized || normalized === "outro" || normalized === "other")) {
    return mappedByAgent;
  }
  if (mappedByAgent) {
    return mappedByAgent;
  }

  return rawType ? String(rawType) : "outro";
}

function isDocumentConsultIntent(text: string): boolean {
  const normalized = normalizeIntentText(text);
  return (
    normalized.includes("revisar") ||
    normalized.includes("revisao") ||
    normalized.includes("rever") ||
    normalized.includes("revisÃƒÆ’Ã‚Â£o") ||
    normalized.includes("consultar") ||
    normalized.includes("analisar") ||
    normalized.includes("existente") ||
    normalized.includes("documento") ||
    normalized.includes("documentos") ||
    normalized.includes("contexto") ||
    normalized.includes("meu brand book") ||
    normalized.includes("meu brandbook") ||
    normalized.includes("ja tenho") ||
    normalized.includes("jÃƒÆ’Ã‚Â¡ tenho") ||
    normalized.includes("com base no meu")
  );
}

function resolveDocumentTypes(
  agentId: string | null,
  agentPrompt: AgentPromptConfig | null,
): string[] | null {
  if (agentPrompt?.requires_documents?.length) {
    return Array.from(
      new Set([
        ...agentPrompt.requires_documents,
        "outro",
      ]),
    );
  }
  if (!agentId) return null;
  const fallback = DEFAULT_DOCUMENT_TYPES_BY_AGENT[agentId];
  if (fallback?.length) {
    return Array.from(new Set([...fallback, "outro"]));
  }
  return ["outro"];
}

async function buildQueryEmbedding(
  openaiKey: string,
  text: string,
  model = "text-embedding-3-small",
): Promise<number[]> {
  const embResponse = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: text,
    }),
  });

  if (!embResponse.ok) {
    const errorText = await embResponse.text();
    throw new Error(
      `Embedding request failed (${embResponse.status}): ${errorText}`,
    );
  }

  const embData = await embResponse.json();
  return embData.data[0].embedding as number[];
}

async function fetchSystemDocuments(
  supabase: ReturnType<typeof createClient>,
  agentId: string | null,
): Promise<SystemDocument[]> {
  const { data, error } = await supabase
    .from("system_documents")
    .select("name, content, applies_to_agents, is_mandatory")
    .eq("is_active", true);

  if (error || !data?.length) return [];

  const filtered = data.filter((doc: any) => {
    const applies: string[] = Array.isArray(doc.applies_to_agents)
      ? doc.applies_to_agents
      : [];
    return applies.length === 0 || (agentId ? applies.includes(agentId) : false);
  });

  const normalizedDocs = filtered
    .map((doc: any) => ({
      name: String(doc.name || "Documento"),
      content: String(doc.content || "").trim(),
      isMandatory: Boolean(doc.is_mandatory),
    }))
    .filter((doc) => Boolean(doc.content));

  const priority = (name: string) => {
    const n = String(name || "").toLowerCase();
    if (
      n.includes("banlist") ||
      n.includes("ban list") ||
      n.includes("ban_list") ||
      n.includes("lista de banimento")
    ) return 0;
    if (n.includes("prompt principal") || n.includes("instru")) return 1;
    return 10;
  };

  const dedupMap = new Map<string, SystemDocument>();
  for (const doc of normalizedDocs) {
    const fingerprint = chunkFingerprint(doc.content);
    const existing = dedupMap.get(fingerprint);
    if (!existing) {
      dedupMap.set(fingerprint, doc);
      continue;
    }
    if (doc.isMandatory && !existing.isMandatory) {
      dedupMap.set(fingerprint, doc);
    }
  }

  return Array.from(dedupMap.values()).sort((a, b) => {
    if (a.isMandatory !== b.isMandatory) {
      return a.isMandatory ? -1 : 1;
    }
    const pa = priority(a.name);
    const pb = priority(b.name);
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });
}

function normalizeChunkContent(content: string): string {
  return String(content || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chunkFingerprint(content: string): string {
  return normalizeChunkContent(content)
    .slice(0, 280)
    .toLowerCase();
}

function selectSystemDocumentsForPrompt(docs: SystemDocument[]): SystemDocument[] {
  const selected: SystemDocument[] = [];
  let usedTokens = 0;

  for (const doc of docs) {
    if (selected.length >= MAX_SYSTEM_DOCS_IN_PROMPT) break;
    const normalized = normalizeChunkContent(doc.content);
    if (!normalized) continue;

    const docTokens = estimateTokenCount(normalized);
    if (usedTokens + docTokens > MAX_SYSTEM_DOC_TOKENS) {
      const remaining = MAX_SYSTEM_DOC_TOKENS - usedTokens;
      if (remaining < 64) continue;
      selected.push({
        ...doc,
        content: truncateTextToTokenBudget(normalized, remaining),
      });
      usedTokens = MAX_SYSTEM_DOC_TOKENS;
      break;
    }

    selected.push({ ...doc, content: normalized });
    usedTokens += docTokens;
  }

  return selected;
}

function selectUserChunksForPrompt(
  chunks: RetrievedDocumentChunk[],
): RetrievedDocumentChunk[] {
  const selected: RetrievedDocumentChunk[] = [];
  const seen = new Set<string>();
  let usedTokens = 0;

  const ordered = [...chunks].sort((a, b) => {
    const simA = Number.isFinite(a.similarity) ? a.similarity : 0;
    const simB = Number.isFinite(b.similarity) ? b.similarity : 0;
    return simB - simA;
  });

  for (const chunk of ordered) {
    if (selected.length >= MAX_USER_DOC_CHUNKS_IN_PROMPT) break;

    const normalized = normalizeChunkContent(chunk.content);
    if (!normalized) continue;

    const fingerprint = chunkFingerprint(normalized);
    if (seen.has(fingerprint)) continue;

    const truncated = truncateTextToTokenBudget(normalized, MAX_SINGLE_CHUNK_TOKENS);
    const chunkTokens = estimateTokenCount(truncated);

    if (usedTokens + chunkTokens > MAX_USER_DOC_TOKENS) {
      const remaining = MAX_USER_DOC_TOKENS - usedTokens;
      if (remaining < 80) continue;
      selected.push({
        ...chunk,
        content: truncateTextToTokenBudget(truncated, remaining),
      });
      break;
    }

    selected.push({
      ...chunk,
      content: truncated,
    });
    seen.add(fingerprint);
    usedTokens += chunkTokens;
  }

  return selected;
}

function selectMarketingChunksForPrompt(
  chunks: RetrievedDocumentChunk[],
): RetrievedDocumentChunk[] {
  const grouped = new Map<string, RetrievedDocumentChunk[]>();

  for (const chunk of chunks) {
    const key = (chunk.subject && chunk.subject.trim()) || "Contexto geral";
    const existing = grouped.get(key) || [];
    existing.push(chunk);
    grouped.set(key, existing);
  }

  for (const [key, group] of grouped.entries()) {
    grouped.set(key, group.sort((a, b) => (b.similarity || 0) - (a.similarity || 0)));
  }

  const orderedSubjects = Array.from(grouped.keys());
  const selected: RetrievedDocumentChunk[] = [];
  const seen = new Set<string>();
  let usedTokens = 0;
  let cursor = 0;

  while (
    selected.length < MAX_USER_DOC_CHUNKS_IN_PROMPT &&
    orderedSubjects.length > 0
  ) {
    const subject = orderedSubjects[cursor % orderedSubjects.length];
    const queue = grouped.get(subject) || [];

    if (queue.length === 0) {
      grouped.delete(subject);
      orderedSubjects.splice(cursor % orderedSubjects.length, 1);
      if (orderedSubjects.length === 0) break;
      continue;
    }

    const chunk = queue.shift() as RetrievedDocumentChunk;
    const normalized = normalizeChunkContent(chunk.content);
    if (!normalized) {
      cursor += 1;
      continue;
    }

    const fingerprint = chunkFingerprint(normalized);
    if (seen.has(fingerprint)) {
      cursor += 1;
      continue;
    }

    const truncated = truncateTextToTokenBudget(normalized, MAX_SINGLE_CHUNK_TOKENS);
    const chunkTokens = estimateTokenCount(truncated);
    if (usedTokens + chunkTokens > MAX_USER_DOC_TOKENS) {
      const remaining = MAX_USER_DOC_TOKENS - usedTokens;
      if (remaining >= 80) {
        selected.push({
          ...chunk,
          content: truncateTextToTokenBudget(truncated, remaining),
          subject,
        });
      }
      break;
    }

    selected.push({
      ...chunk,
      content: truncated,
      subject,
    });
    seen.add(fingerprint);
    usedTokens += chunkTokens;
    cursor += 1;
  }

  return selected;
}

async function backfillMissingRequiredDocumentTypes(params: {
  supabase: ReturnType<typeof createClient>;
  tenantId: string;
  userId: string;
  requiredTypes: string[] | null;
  existingChunks: RetrievedDocumentChunk[];
}): Promise<RetrievedDocumentChunk[]> {
  const { supabase, tenantId, userId, requiredTypes, existingChunks } = params;
  if (!requiredTypes?.length) return [];

  const requiredCanonical = Array.from(
    new Set(requiredTypes.map((type) => canonicalizeDocumentType(type))),
  );
  const coveredTypes = new Set(
    existingChunks
      .map((chunk) => canonicalizeDocumentType(chunk.documentType))
      .filter((type): type is string => Boolean(type)),
  );
  const missingTypes = requiredCanonical.filter((type) => !coveredTypes.has(type));
  if (missingTypes.length === 0) return [];

  const { data, error } = await supabase
    .from("documents")
    .select("id, type, agent_id, name, content, updated_at, created_at")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(120);

  if (error || !data?.length) return [];

  const fallbackChunks: RetrievedDocumentChunk[] = [];
  const resolvedTypes = new Set<string>();

  for (const row of data as any[]) {
    const canonicalType = canonicalizeDocumentType(
      String(row.type || ""),
      row.agent_id ? String(row.agent_id) : null,
    );
    if (!canonicalType || resolvedTypes.has(canonicalType) || !missingTypes.includes(canonicalType)) continue;

    const content = normalizeChunkContent(String(row.content || ""));
    if (!content) continue;

    fallbackChunks.push({
      content: truncateTextToTokenBudget(content, 2000),
      similarity: 1,
      source: "MANDATORY_FALLBACK",
      documentType: canonicalType,
    });
    resolvedTypes.add(canonicalType);

    if (resolvedTypes.size === missingTypes.length) break;
  }

  const stillMissing = missingTypes.filter((type) => !resolvedTypes.has(type));
  if (stillMissing.length > 0) {
    for (const row of data as any[]) {
      const canonicalType = canonicalizeDocumentType(
        String(row.type || ""),
        row.agent_id ? String(row.agent_id) : null,
      );
      if (!canonicalType || resolvedTypes.has(canonicalType) || !stillMissing.includes(canonicalType)) {
        continue;
      }

      const { data: chunkRows } = await supabase
        .from("document_chunks")
        .select("content, chunk_index")
        .eq("document_id", String(row.id))
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .order("chunk_index", { ascending: true })
        .limit(6);

      const combinedChunkContent = (chunkRows || [])
        .map((c: any) => normalizeChunkContent(String(c.content || "")))
        .filter(Boolean)
        .join("\n\n");
      if (!combinedChunkContent) continue;

      fallbackChunks.push({
        content: truncateTextToTokenBudget(combinedChunkContent, 2000),
        similarity: 0.95,
        source: "MANDATORY_FALLBACK",
        documentType: canonicalType,
      });
      resolvedTypes.add(canonicalType);
    }
  }

  return fallbackChunks;
}

async function retrieveDocumentChunks(params: {
  queryEmbedding: number[];
  userId: string;
  tenantId: string;
  filterTypes: string[] | null;
  pineconeApiKey: string | null;
  pineconeIndexName: string | null;
  pineconeNamespacePrefix: string;
  supabase: ReturnType<typeof createClient> | null;
}): Promise<RetrievedDocumentChunk[]> {
  const {
    queryEmbedding,
    userId,
    tenantId,
    filterTypes,
    pineconeApiKey,
    pineconeIndexName,
    pineconeNamespacePrefix,
    supabase,
  } = params;

  const chunks: RetrievedDocumentChunk[] = [];

  if (pineconeApiKey && pineconeIndexName) {
    try {
      const pinecone = new Pinecone({ apiKey: pineconeApiKey });
      const tenantNamespace = resolveTenantNamespace(pineconeNamespacePrefix, tenantId);
      const index = pinecone.index(pineconeIndexName).namespace(tenantNamespace);

      const filter: Record<string, unknown> = {
        user_id: { "$eq": userId },
        tenant_id: { "$eq": tenantId },
      };

      if (filterTypes?.length) {
        filter.document_type = { "$in": filterTypes };
      }

      console.log(`[RAG:Pinecone] namespace=${tenantNamespace} userId=${userId} tenantId=${tenantId} filterTypes=${JSON.stringify(filterTypes)}`);

      const queryResponse = await index.query({
        topK: 20,
        vector: queryEmbedding,
        includeMetadata: true,
        filter,
      });

      const pineconeChunks = (queryResponse.matches || [])
        .filter((match) => typeof match.metadata?.content === "string")
        .map((match) => ({
          content: String(match.metadata?.content || ""),
          similarity: match.score || 0,
          source: "PINECONE" as const,
          documentType: match.metadata?.document_type
            ? String(match.metadata.document_type)
            : null,
        }));

      console.log(`[RAG:Pinecone] retornou ${pineconeChunks.length} chunks`);

      if (pineconeChunks.length > 0) {
        chunks.push(...pineconeChunks);
      }
    } catch (error) {
      console.error("Pinecone documentos retrieval failed:", error);
    }
  }

  if (chunks.length === 0 && supabase) {
    try {
      const { data } = await supabase.rpc(
        "search_documents",
        {
          query_embedding: JSON.stringify(queryEmbedding),
          match_count: 20,
          filter_user_id: userId,
          filter_document_types: filterTypes,
          filter_tenant_id: tenantId,
        },
      );

      const fallbackChunks = (data || []).map((chunk: any) => ({
        content: String(chunk.content || ""),
        similarity: Number(chunk.similarity || 0),
        source: "SUPABASE_FALLBACK" as const,
        documentType: chunk.document_type ? String(chunk.document_type) : null,
      }));

      console.log(`[RAG:Supabase] retornou ${fallbackChunks.length} chunks`);
      chunks.push(...fallbackChunks);
    } catch (error) {
      console.error("Supabase fallback documentos retrieval failed:", error);
    }
  }

  return chunks;
}

function appendDocumentsContextToPrompt(
  basePrompt: string,
  systemDocuments: SystemDocument[],
  userDocumentChunks: RetrievedDocumentChunk[],
): {
  prompt: string;
  systemDocsUsed: number;
  userChunksUsed: number;
  userChunkSources: RetrievedDocumentSource[];
  usedDocumentTypes: string[];
} {
  let output = basePrompt;

  if (systemDocuments.length > 0) {
    output += "\n\n## REGRAS FIXAS E GUIAS (OBRIGATORIAS)\n";
    systemDocuments.forEach((doc, index) => {
      output += `\n[Guia ${index + 1}: ${doc.name}]\n${doc.content}\n`;
    });
  }

  if (userDocumentChunks.length > 0) {
    output += "\n\n## DOCUMENTOS DO USUARIO (MEMORIA CONTEXTUAL)\n";
    const hasSubjects = userDocumentChunks.some((chunk) => Boolean(chunk.subject));
    if (hasSubjects) {
      const grouped = new Map<string, RetrievedDocumentChunk[]>();
      for (const chunk of userDocumentChunks) {
        const subject = (chunk.subject && chunk.subject.trim()) || "Contexto geral";
        const existing = grouped.get(subject) || [];
        existing.push(chunk);
        grouped.set(subject, existing);
      }

      let counter = 1;
      for (const [subject, chunks] of grouped.entries()) {
        output += `\n### Assunto: ${subject}\n`;
        for (const chunk of chunks) {
          output += `\n[Trecho ${counter} - ${chunk.source} - relevancia ${(chunk.similarity * 100).toFixed(1)}%]\n${chunk.content}\n`;
          counter += 1;
        }
      }
    } else {
      userDocumentChunks.forEach((chunk, index) => {
        output += `\n[Trecho ${index + 1} - ${chunk.source} - relevancia ${(chunk.similarity * 100).toFixed(1)}%]\n${chunk.content}\n`;
      });
    }
  }

  return {
    prompt: output,
    systemDocsUsed: systemDocuments.length,
    userChunksUsed: userDocumentChunks.length,
    userChunkSources: Array.from(new Set(userDocumentChunks.map((chunk) => chunk.source))),
    usedDocumentTypes: Array.from(
      new Set(
        userDocumentChunks
          .map((chunk) => chunk.documentType)
          .filter((type): type is string => Boolean(type)),
      ),
    ),
  };
}

function buildConsultModeInstruction(
  agentId: string | null,
  consultIntentDetected: boolean,
  userChunksUsed: number,
): string {
  if (!consultIntentDetected || !agentId) return "";

  if (agentId === "brand-book") {
    if (userChunksUsed > 0) {
      return `

## MODO REVISAO DE BRAND BOOK (OBRIGATORIO)
- O usuario pediu para revisar/consultar o Brand Book existente.
- Nao inicie entrevista do zero.
- Use os DOCUMENTOS DO USUARIO como fonte principal.
- Abra a resposta com uma linha objetiva: "Base consultada: Brand Book encontrado em Documentos".
- E proibido pedir para o usuario colar/reenviar o Brand Book quando houver contexto recuperado.
- Entregue analise, ajustes e recomendacoes com base no material existente.
- Se faltar dado, pergunte apenas lacunas especificas no final.`;
    }

    return `

## MODO REVISAO DE BRAND BOOK (SEM BASE SUFICIENTE)
- O usuario pediu revisao, mas nenhum documento relevante foi recuperado.
- Informe objetivamente que nao encontrou contexto do Brand Book deste usuario no momento.
- Peca para enviar/selecionar o documento correto e ofereca prosseguir assim que houver conteudo.`;
  }

  return `

## MODO CONSULTA DE DOCUMENTOS (OBRIGATORIO)
- O usuario pediu resposta com base em documentos existentes.
- Priorize trechos recuperados dos DOCUMENTOS DO USUARIO.
- Evite resposta generica; cite como o contexto foi aplicado.
- Se houver lacunas, pergunte dados faltantes de forma objetiva.`;
}

async function callAnthropic(params: {
  apiKey: string;
  modelId: string;
  maxTokens: number;
  extendedThinking: boolean;
  thinkingEffort?: ThinkingEffort;
  systemPrompt: string;
  messages: ChatMessage[];
  timeoutMs?: number;
}) {
  // Single hard deadline covering ALL retries combined  -  prevents 3ÃƒÆ’Ã¢â‚¬â€timeout blowup
  const deadlineMs = params.timeoutMs ?? 90_000;
  const deadline = Date.now() + deadlineMs;

  const anthropic = new Anthropic({ apiKey: params.apiKey });
  const baseModelId = params.modelId || "claude-sonnet-4-20250514";
  const baseMaxTokens = Math.max(512, Number(params.maxTokens || 8000));
  const requestedEffort = normalizeThinkingEffort(params.thinkingEffort);
  const thinkingConfig = resolveAnthropicThinkingConfig({
    modelId: baseModelId,
    requested: Boolean(params.extendedThinking),
    maxTokens: baseMaxTokens,
    effort: requestedEffort,
  });

  const requestParams: any = {
    model: baseModelId,
    max_tokens: baseMaxTokens,
    system: params.systemPrompt,
    messages: params.messages,
  };

  if (thinkingConfig.enabled && thinkingConfig.mode === "adaptive") {
    requestParams.thinking = {
      type: "adaptive",
      display: "summarized",
    };
    requestParams.output_config = {
      effort: thinkingConfig.effort || requestedEffort,
    };
  } else if (thinkingConfig.enabled && thinkingConfig.mode === "enabled") {
    const budgetTokens = Math.max(1024, thinkingConfig.budgetTokens || 1024);
    requestParams.max_tokens = Math.max(requestParams.max_tokens, budgetTokens + 512);
    requestParams.thinking = {
      type: "enabled",
      budget_tokens: budgetTokens,
    };
  }

  let response: Awaited<ReturnType<typeof anthropic.messages.create>> | null = null;
  let thinkingDuration = 0;
  let lastError: any = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 5000) {
      // No time left for another attempt
      break;
    }

    // Per-attempt timeout = remaining budget (never more than 150s)
    const attemptTimeout = Math.min(remaining, 150_000);

    try {
      const startTime = Date.now();
      const timeoutError = new Error("Anthropic request timed out");

      // Wrap in Promise.race so we never hang past the deadline
      response = await Promise.race([
        anthropic.messages.create(requestParams),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(timeoutError), attemptTimeout)
        ),
      ]) as Awaited<ReturnType<typeof anthropic.messages.create>>;

      thinkingDuration = (Date.now() - startTime) / 1000;
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      const msg = String((error as any)?.message || error);
      console.error(`Anthropic attempt ${attempt + 1}/3 failed (${Math.round((deadline - Date.now()) / 1000)}s left):`, msg.slice(0, 120));

      // Don't retry timeouts Ã¢â‚¬â€ just fail immediately (another attempt would also timeout)
      const isTimeout = msg.includes("timed out") || msg.includes("timeout") || msg.includes("AbortError");
      if (isTimeout) break;

      // Retry transient errors (429, 503, overloaded) AND generic 5xx server errors
      const isRetryable = isTransientUpstreamError(error) || getProviderErrorStatus(error) >= 500;
      if (attempt < 2 && isRetryable && remaining > 10_000) {
        const waitMs = isTransientUpstreamError(error) ? 800 : 2000;
        console.warn(`[Anthropic] attempt ${attempt + 1}/3 retrying in ${waitMs}ms...`);
        await waitForRetry(waitMs);
        continue;
      }
      break;
    }
  }

  if (!response) {
    throw wrapProviderError("Anthropic", lastError);
  }

  let content = "";
  let thinking = "";

  for (const block of response.content) {
    if (block.type === "text") {
      content += block.text;
    } else if (block.type === "thinking") {
      thinking = (block as any).thinking;
    }
  }

  return {
    content,
    thinking: thinking || undefined,
    thinkingDuration: thinkingConfig.enabled ? thinkingDuration : undefined,
    thinkingConfig,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
    provider: "anthropic",
  };
}

async function callAnthropicStream(params: {
  apiKey: string;
  modelId: string;
  maxTokens: number;
  extendedThinking: boolean;
  thinkingEffort?: ThinkingEffort;
  systemPrompt: string;
  messages: ChatMessage[];
  timeoutMs?: number;
  onDelta: (text: string) => void;
  onThinkingDelta?: (text: string) => void;
}, _retryCount = 0) {
  const MAX_CONTINUATION_RETRIES = 2;
  const deadlineMs = params.timeoutMs ?? 90_000;
  const anthropic = new Anthropic({ apiKey: params.apiKey });
  const baseModelId = params.modelId || "claude-sonnet-4-20250514";
  const baseMaxTokens = Math.max(512, Number(params.maxTokens || 8000));
  const requestedEffort = normalizeThinkingEffort(params.thinkingEffort);
  const thinkingConfig = resolveAnthropicThinkingConfig({
    modelId: baseModelId,
    requested: Boolean(params.extendedThinking),
    maxTokens: baseMaxTokens,
    effort: requestedEffort,
  });

  const requestParams: any = {
    model: baseModelId,
    max_tokens: baseMaxTokens,
    system: params.systemPrompt,
    messages: params.messages,
  };

  if (thinkingConfig.enabled && thinkingConfig.mode === "adaptive") {
    requestParams.thinking = { type: "adaptive", display: "summarized" };
    requestParams.output_config = { effort: thinkingConfig.effort || requestedEffort };
  } else if (thinkingConfig.enabled && thinkingConfig.mode === "enabled") {
    const budgetTokens = Math.max(1024, thinkingConfig.budgetTokens || 1024);
    requestParams.max_tokens = Math.max(requestParams.max_tokens, budgetTokens + 512);
    requestParams.thinking = { type: "enabled", budget_tokens: budgetTokens };
  }

  const startTime = Date.now();
  const stream = anthropic.messages.stream(requestParams);
  const abortTimeout = setTimeout(() => stream.abort(), deadlineMs);

  let accumulatedContent = "";
  let accumulatedThinking = "";
  let streamLoopError: any = null;

  try {
    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        const delta = event.delta as any;
        if (delta.type === "text_delta") {
          accumulatedContent += delta.text;
          params.onDelta(delta.text);
        } else if (delta.type === "thinking_block_delta" && params.onThinkingDelta) {
          accumulatedThinking += delta.thinking;
          params.onThinkingDelta(delta.thinking);
        }
      }
    }
  } catch (loopErr) {
    streamLoopError = loopErr;
    console.warn("[AnthropicStream] stream loop error (accumulated chars:", accumulatedContent.length, "):", String(loopErr).slice(0, 200));
  } finally {
    clearTimeout(abortTimeout);
  }

  if (streamLoopError) {
    // Assistant prefill continuation: re-invoke with the partial content as last assistant turn.
    // The same onDelta callback keeps firing — the client sees a seamless stream.
    // Only works for non-thinking models (Anthropic does not support prefill with extended thinking).
    if (accumulatedContent && _retryCount < MAX_CONTINUATION_RETRIES && !thinkingConfig.enabled) {
      console.warn(
        `[AnthropicStream] Continuation attempt ${_retryCount + 1}/${MAX_CONTINUATION_RETRIES}` +
        ` (${accumulatedContent.length} chars accumulated, error: ${String(streamLoopError).slice(0, 120)})`
      );
      await new Promise((r) => setTimeout(r, 800));
      try {
        const continuationResult = await callAnthropicStream(
          {
            ...params,
            messages: [
              ...params.messages,
              { role: "assistant" as const, content: accumulatedContent },
            ],
          },
          _retryCount + 1
        );
        return {
          ...continuationResult,
          content: accumulatedContent + continuationResult.content,
        };
      } catch (continuationErr) {
        console.warn("[AnthropicStream] Continuation failed, returning partial content:", String(continuationErr).slice(0, 200));
        return {
          content: accumulatedContent,
          thinking: accumulatedThinking || undefined,
          thinkingDuration: thinkingConfig.enabled ? (Date.now() - startTime) / 1000 : undefined,
          thinkingConfig,
          usage: { inputTokens: 0, outputTokens: 0 },
          provider: "anthropic",
        };
      }
    }

    if (accumulatedContent) {
      console.warn("[AnthropicStream] Returning partial content (thinking mode or retries exhausted)");
      return {
        content: accumulatedContent,
        thinking: accumulatedThinking || undefined,
        thinkingDuration: thinkingConfig.enabled ? (Date.now() - startTime) / 1000 : undefined,
        thinkingConfig,
        usage: { inputTokens: 0, outputTokens: 0 },
        provider: "anthropic",
      };
    }
    throw streamLoopError;
  }

  const thinkingDuration = (Date.now() - startTime) / 1000;
  let content = accumulatedContent;
  let thinking = accumulatedThinking;
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const finalMsg = await stream.finalMessage();
    inputTokens = finalMsg.usage.input_tokens;
    outputTokens = finalMsg.usage.output_tokens;
    if (!content) {
      for (const block of finalMsg.content) {
        if (block.type === "text") content += block.text;
        else if (block.type === "thinking") thinking = (block as any).thinking || (block as any).thinking_summary || "";
      }
    }
  } catch (finalMsgErr) {
    console.warn("[AnthropicStream] finalMessage() failed, using accumulated content:", String(finalMsgErr).slice(0, 200));
  }

  return {
    content,
    thinking: thinking || undefined,
    thinkingDuration: thinkingConfig.enabled ? thinkingDuration : undefined,
    thinkingConfig,
    usage: { inputTokens, outputTokens },
    provider: "anthropic",
  };
}

async function callOpenAI(params: {
  apiKey: string;
  modelId: string;
  maxTokens: number;
  systemPrompt: string;
  messages: ChatMessage[];
}) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.modelId,
      max_completion_tokens: params.maxTokens || 8000,
      messages: [
        { role: "system", content: params.systemPrompt },
        ...params.messages,
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new Error("OpenAI authentication failed. Verifique OPENAI_API_KEY.");
    }
      throw wrapProviderError("OpenAI", {
        status: response.status,
        message: errText,
      });
  }

  const data = await response.json();
  const content = String(data?.choices?.[0]?.message?.content || "");

  return {
    content,
    usage: {
      inputTokens: Number(data?.usage?.prompt_tokens || 0),
      outputTokens: Number(data?.usage?.completion_tokens || 0),
    },
    provider: "openai",
  };
}

async function callOpenAIWithTools(params: {
  apiKey: string;
  modelId: string;
  maxTokens: number;
  systemPrompt: string;
  messages: ChatMessage[];
  tools: any[];
  toolExecutor: ToolExecutor;
  maxIterations?: number;
  timeoutMs?: number;
}): Promise<{
  content: string;
  usage: { inputTokens: number; outputTokens: number };
  provider: string;
  toolCallCount: number;
  ragDocsRetrieved: number;
}> {
  const maxIter = params.maxIterations ?? 5;
  const deadline = Date.now() + (params.timeoutMs ?? 120_000);

  let toolCallCount = 0;
  let ragDocsRetrieved = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  const apiMessages: any[] = [
    { role: "system", content: params.systemPrompt },
    ...params.messages.map((m) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    })),
  ];

  const openAITools = params.tools
    .map((t) => {
      if (t.type === "web_search_20260209" || t.name === "web_search") {
        return { type: "web_search" };
      }
      return {
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description || "",
          parameters: t.input_schema || { type: "object", properties: {}, required: [] },
        },
      };
    });

  for (let iter = 0; iter < maxIter; iter++) {
    const remaining = deadline - Date.now();
    if (remaining <= 8000) {
      throw new Error("timeout: deadline exceeded Ã¢â‚¬â€ A resposta demorou mais que o esperado. Tente novamente com uma pergunta mais curta.");
    }

    const reqBody: any = {
      model: params.modelId,
      max_completion_tokens: params.maxTokens || 8000,
      messages: apiMessages,
    };
    if (openAITools.length > 0) {
      reqBody.tools = openAITools;
      reqBody.tool_choice = "auto";
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(remaining, 120_000));

    let data: any;
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${params.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        const errText = await res.text();
        throw wrapProviderError("OpenAI", { status: res.status, message: errText });
      }
      data = await res.json();
    } catch (err) {
      clearTimeout(timer);
      throw wrapProviderError("OpenAI", err);
    }

    totalInputTokens += data?.usage?.prompt_tokens ?? 0;
    totalOutputTokens += data?.usage?.completion_tokens ?? 0;

    const choice = data?.choices?.[0];
    const message = choice?.message;
    const finishReason = choice?.finish_reason;

    if (finishReason === "stop" || !message?.tool_calls?.length) {
      return {
        content: String(message?.content || ""),
        usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
        provider: "openai",
        toolCallCount,
        ragDocsRetrieved,
      };
    }

    apiMessages.push({ role: "assistant", content: message.content || null, tool_calls: message.tool_calls });

    for (const toolCall of message.tool_calls) {
      if (toolCall.type !== "function") {
        apiMessages.push({ role: "tool", tool_call_id: toolCall.id, content: "Native tool executed by provider" });
        continue;
      }
      toolCallCount++;
      const toolName = toolCall.function.name;
      let toolInput: any = {};
      try { toolInput = JSON.parse(toolCall.function.arguments || "{}"); } catch { /* noop */ }

      let toolResult = "";
      try {
        toolResult = await params.toolExecutor(toolName, toolInput);
        if (toolName === "retrieve_documents") ragDocsRetrieved++;
      } catch (err) {
        toolResult = `Erro ao executar ${toolName}: ${String((err as any)?.message || err)}`;
      }

      apiMessages.push({ role: "tool", tool_call_id: toolCall.id, content: toolResult });
    }
  }

  return {
    content: "",
    usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
    provider: "openai",
    toolCallCount,
    ragDocsRetrieved,
  };
}
const WEB_SEARCH_CAPABLE_MODELS = new Set([
  "claude-opus-4-7",
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "gpt-5.4",
  "gpt-5.4-pro",
  "gpt-5.4-mini",
  "gpt-5.4-nano",
]);

function resolveWebSearchModel(selectedModelId: string): string {
  return WEB_SEARCH_CAPABLE_MODELS.has(selectedModelId)
    ? selectedModelId
    : "claude-sonnet-4-6";
}

async function runNativeWebSearch(params: {
  apiKey: string;
  modelId: string;
  userMessage: string;
  agentScope?: string;
  onStep: (step: object) => void;
  timeoutMs?: number;
}): Promise<string> {
  const anthropic = new Anthropic({ apiKey: params.apiKey });
  const timeout = params.timeoutMs ?? 45_000;
  const scope = params.agentScope || "assistente de marketing de conteÃƒÂºdo digital brasileiro";

  let response: any;
  try {
    response = await Promise.race([
      anthropic.messages.create({
        model: params.modelId,
        max_tokens: 1500,
        system: `Você é um pesquisador especializado atuando como suporte para: ${scope}

Sua tarefa: formule UMA query de pesquisa web em português e sintetize os resultados encontrados.

REGRA CRÍTICA: A query deve ser uma BUSCA DE PESQUISA, não uma tarefa ou descrição de ação.
- ERRADO: "Criar 5 variações de ângulo para minha ideia"
- ERRADO: "Fazer calendário editorial para instagram"
- CERTO: "ângulos narrativos criativos para conteúdo de marketing digital 2025"
- CERTO: "estratégias de conteúdo para redes sociais Brasil tendências"
- CERTO: "técnicas de storytelling engajamento instagram criadores"

Extraia do contexto o TEMA/ASSUNTO central e transforme em uma query de pesquisa de mercado, tendências ou exemplos reais sobre esse tema.

Sintetize os resultados em um resumo direto, útil e em português brasileiro, citando as fontes com URLs quando disponíveis.`,
        messages: [{
          role: "user",
          content: `Pedido do usuÃƒÂ¡rio: ${params.userMessage.slice(0, 600)}`,
        }],
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 1 } as any],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("native web search timed out")), timeout)
      ),
    ]);
  } catch (err) {
    console.warn("[NativeWebSearch] Falhou, continuando sem contexto web:", String(err).slice(0, 120));
    return "";
  }

  const serverToolBlocks = (response.content as any[]).filter(
    (b: any) => b.type === "server_tool_use" && b.name === "web_search"
  );
  const webResultBlocks = (response.content as any[]).filter(
    (b: any) => b.type === "web_search_tool_result"
  );

  let totalResultCount = 0;
  for (const stb of serverToolBlocks) {
    const query = String(stb.input?.query || "");
    params.onStep({ type: "web", status: "searching", query });

    const resultBlock = webResultBlocks.find((r: any) => r.tool_use_id === stb.id);
    const results: { title: string; url: string }[] = [];
    if (resultBlock && Array.isArray(resultBlock.content)) {
      for (const item of resultBlock.content as any[]) {
        if (item.url) results.push({ title: String(item.title || item.url), url: String(item.url) });
      }
    }
    totalResultCount += results.length;
    params.onStep({ type: "web", status: "done", query, resultCount: results.length, results });
    console.log(`[NativeWebSearch] query="${query}" results=${results.length}`);
  }

  // If the search tool was never invoked, discard — the synthesis would be the model
  // talking about its inability to search, not actual research.
  if (serverToolBlocks.length === 0) return "";

  // If the tool was invoked but returned 0 URL results (service down / blocked),
  // the synthesis text will describe the failure — discard it to avoid injecting
  // "Não consigo acessar a pesquisa" into the system prompt.
  if (totalResultCount === 0) {
    console.warn("[NativeWebSearch] Tool invoked but 0 results returned — discarding synthesis to prevent failure propagation");
    return "";
  }

  const synthesisText = (response.content as any[])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n");

  if (!synthesisText) return "";
  if (synthesisText.trim().startsWith("NAO_NECESSARIO")) return "";

  return `\n\n## Contexto de Pesquisa Web (dados atuais pesquisados antes desta resposta)\n${synthesisText}`;
}

async function callAnthropicWithTools(params: {
  apiKey: string;
  modelId: string;
  maxTokens: number;
  extendedThinking: boolean;
  thinkingEffort?: ThinkingEffort;
  forcedThinkingConfig?: AnthropicThinkingResolution;
  systemPrompt: string;
  messages: ChatMessage[];
  tools: any[];
  toolExecutor: ToolExecutor;
  maxIterations?: number;
  timeoutMs?: number;
  onThinkingDelta?: (text: string) => void;
  onNativeWebSearch?: (query: string, results: { title: string; url: string }[]) => void;
}): Promise<{
  content: string;
  thinking?: string;
  thinkingDuration?: number;
  thinkingConfig?: AnthropicThinkingResolution;
  usage: { inputTokens: number; outputTokens: number };
  provider: string;
  toolCallCount: number;
  ragDocsRetrieved: number;
}> {
  const anthropic = new Anthropic({ apiKey: params.apiKey });
  const maxIter = Math.min(params.maxIterations ?? 6, 8);
  const deadline = Date.now() + (params.timeoutMs ?? 120_000);

  const thinkingConfig = params.forcedThinkingConfig ?? resolveAnthropicThinkingConfig({
    modelId: params.modelId,
    requested: Boolean(params.extendedThinking),
    maxTokens: params.maxTokens,
    effort: normalizeThinkingEffort(params.thinkingEffort),
  });

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let accumulatedThinking = "";
  let thinkingDuration = 0;
  let toolCallCount = 0;
  let ragDocsRetrieved = 0;

  // Convert ChatMessage[] to Anthropic API format (drop system role Ã¢â‚¬â€ goes in system param)
  const apiMessages: any[] = params.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: String(m.content || "") }));

  // Trim history to last 8 messages to prevent context explosion on subsequent requests
  if (apiMessages.length > 8) {
    const trimmed = apiMessages.slice(apiMessages.length - 8);
    const firstUserIdx = trimmed.findIndex((m: any) => m.role === "user");
    apiMessages.splice(0, apiMessages.length, ...(firstUserIdx > 0 ? trimmed.slice(firstUserIdx) : trimmed));
    console.log(`[AgentMode] History trimmed to ${apiMessages.length} messages`);
  }

  for (let iter = 0; iter < maxIter; iter++) {
    const remaining = deadline - Date.now();
    if (remaining <= 8000) {
      const deadlineErr = new Error("timeout: deadline exceeded Ã¢â‚¬â€ A resposta demorou mais que o esperado. Tente novamente com uma pergunta mais curta.") as Error & { status: number };
      deadlineErr.status = 503;
      throw deadlineErr;
    }

    const requestParams: any = {
      model: params.modelId,
      max_tokens: Math.max(512, params.maxTokens),
      system: params.systemPrompt,
      messages: apiMessages,
    };

    // Always pass tools Ã¢â‚¬â€ model decides when to stop calling them; maxIterations is the safety net.
    requestParams.tools = params.tools;
    console.log(`[AgentMode] iter=${iter} toolCallCount=${toolCallCount}`);

    if (thinkingConfig.enabled && thinkingConfig.mode === "adaptive") {
      requestParams.thinking = { type: "adaptive" };
    } else if (thinkingConfig.enabled && thinkingConfig.mode === "enabled") {
      const budgetTokens = Math.max(1024, thinkingConfig.budgetTokens || 1024);
      requestParams.max_tokens = Math.max(requestParams.max_tokens, budgetTokens + 512);
      requestParams.thinking = { type: "enabled", budget_tokens: budgetTokens };
    }

    const startTime = Date.now();
    let response: any;
    let lastAgentErr: any;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await Promise.race([
          anthropic.messages.create(requestParams),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Agentic tool loop request timed out")), Math.min(remaining, 240_000))
          ),
        ]);
        break;
      } catch (err) {
        lastAgentErr = err;
        const msg = String((err as any)?.message || "");
        const isTimeout = msg.includes("timed out") || msg.includes("timeout") || msg.includes("AbortError");
        if (isTimeout) { throw wrapProviderError("Anthropic", err); }

        const isRetryable = isTransientUpstreamError(err) || getProviderErrorStatus(err) >= 500;
        if (attempt < 2 && isRetryable) {
          const remainingTime = deadline - Date.now();
          const waitMs = isTransientUpstreamError(err) ? 800 : 2000;
          if (remainingTime > waitMs + 10_000) {
            console.warn(`[AgentMode] iter=${iter} attempt ${attempt + 1}/3 retrying in ${waitMs}ms:`, msg.slice(0, 80));
            await waitForRetry(waitMs);
            continue;
          }
        }
        throw wrapProviderError("Anthropic", err);
      }
    }
    if (!response) throw wrapProviderError("Anthropic", lastAgentErr);

    thinkingDuration += (Date.now() - startTime) / 1000;
    totalInputTokens += response.usage?.input_tokens ?? 0;
    totalOutputTokens += response.usage?.output_tokens ?? 0;

    // Accumulate thinking blocks and emit SSE delta for visual effect
    for (const block of response.content) {
      if (block.type === "thinking") {
        const b = block as any;
        const text = b.thinking || b.thinking_summary || (Array.isArray(b.summary) ? b.summary.map((s: any) => s.text || "").join("\n") : "") || "";
        if (text) {
          accumulatedThinking = text;
          params.onThinkingDelta?.(text);
        }
      }
    }

    // Parse native web search results (server_tool_use / web_search_tool_result)
    if (params.onNativeWebSearch) {
      const serverToolBlocks = (response.content as any[]).filter((b) => b.type === "server_tool_use" && b.name === "web_search");
      const webResultBlocks = (response.content as any[]).filter((b) => b.type === "web_search_tool_result");
      for (const stb of serverToolBlocks) {
        const query = String(stb.input?.query || "");
        const resultBlock = webResultBlocks.find((r: any) => r.tool_use_id === stb.id);
        const results: { title: string; url: string }[] = [];
        if (resultBlock && Array.isArray(resultBlock.content)) {
          for (const item of resultBlock.content) {
            if (item.url) results.push({ title: String(item.title || item.url), url: String(item.url) });
          }
        }
        params.onNativeWebSearch(query, results);
      }
    }

    const toolUseBlocks = (response.content as any[]).filter((b) => b.type === "tool_use");

    if (response.stop_reason === "end_turn" || toolUseBlocks.length === 0) {
      let content = (response.content as any[])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");

      // Safety net: if final response is empty (model only output thinking), retry without tools
      if (!content && toolCallCount > 0) {
        console.log(`[AgentMode] iter=${iter} Ã¢â‚¬â€ resposta vazia na iteraÃƒÂ§ÃƒÂ£o final, tentando novamente sem tools`);
        const retryMessages = [
          ...apiMessages,
          { role: "assistant" as const, content: (response.content as any[]).filter((b: any) => !["thinking", "server_tool_use", "web_search_tool_result", "code_execution_tool_result"].includes(b.type)) },
          { role: "user" as const, content: "Com base nas pesquisas realizadas acima, gere agora a resposta completa em portuguÃƒÂªs brasileiro." },
        ];
        const retryParams: any = {
          model: params.modelId,
          max_tokens: Math.max(512, params.maxTokens),
          system: params.systemPrompt,
          messages: retryMessages,
        };
        if (thinkingConfig.enabled && thinkingConfig.mode === "adaptive") {
          retryParams.thinking = { type: "adaptive", display: "summarized" };
          retryParams.output_config = { effort: thinkingConfig.effort || "medium" };
        } else if (thinkingConfig.enabled && thinkingConfig.mode === "enabled") {
          retryParams.thinking = { type: "enabled", budget_tokens: Math.max(1024, thinkingConfig.budgetTokens || 1024) };
        }
        try {
          const retryResponse = await Promise.race([
            anthropic.messages.create(retryParams),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error("retry timed out")), Math.min(deadline - Date.now(), 90_000))),
          ]);
          totalInputTokens += retryResponse.usage?.input_tokens ?? 0;
          totalOutputTokens += retryResponse.usage?.output_tokens ?? 0;
          content = (retryResponse.content as any[])
            .filter((b: any) => b.type === "text")
            .map((b: any) => b.text)
            .join("");
        } catch (retryErr) {
          console.error(`[AgentMode] retry falhou:`, String(retryErr));
        }
      }

      return {
        content,
        thinking: accumulatedThinking || undefined,
        thinkingDuration: thinkingConfig.enabled ? thinkingDuration : undefined,
        thinkingConfig,
        usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
        provider: "anthropic",
        toolCallCount,
        ragDocsRetrieved,
      };
    }

    // Append assistant turn Ã¢â‚¬â€ strip thinking + server tool blocks from history.
    // server_tool_use / web_search_tool_result / code_execution_tool_result blocks cause 400
    // errors in subsequent iterations if not perfectly paired, so we drop them all.
    const SERVER_BLOCK_TYPES = new Set(["thinking", "thinking_summary", "redacted_thinking", "server_tool_use", "web_search_tool_result", "code_execution_tool_result"]);
    const contentForHistory = (response.content as any[]).filter((b: any) => !SERVER_BLOCK_TYPES.has(b.type));
    apiMessages.push({ role: "assistant", content: contentForHistory });

    // Execute each requested tool
    const toolResults: any[] = [];
    for (const toolBlock of toolUseBlocks) {
      toolCallCount++;
      console.log(`[AgentTool][iter=${iter}] ${toolBlock.name}:`, JSON.stringify(toolBlock.input).slice(0, 300));
      let toolResult: string;
      try {
        toolResult = await params.toolExecutor(toolBlock.name, toolBlock.input as AgentToolInput);
        console.log(`[AgentTool][iter=${iter}] ${toolBlock.name} => ${toolResult.length} chars`);
        if (toolBlock.name === "retrieve_documents") {
          const m = toolResult.match(/Ã¢â‚¬â€ (\d+) blocos de conteudo/);
          if (m) ragDocsRetrieved += parseInt(m[1], 10);
        }
      } catch (toolErr) {
        toolResult = `Erro na ferramenta ${toolBlock.name}: ${String(toolErr)}`;
        console.error(`[AgentTool][iter=${iter}] ${toolBlock.name} error:`, String(toolErr));
      }
      toolResults.push({ type: "tool_result", tool_use_id: toolBlock.id, content: toolResult });
    }

    // Append tool results as a user turn
    apiMessages.push({ role: "user", content: toolResults });
  }

  const iterErr = new Error(`A resposta demorou mais que o esperado. Tente novamente com uma pergunta mais curta.`) as Error & { status: number };
  iterErr.status = 503;
  throw iterErr;
}

function buildMarketingToolExecutor(context: {
  openaiKey: string | null;
  embeddingModel: string;
  pineconeApiKey: string | null;
  pineconeIndexName: string | null;
  pineconeNamespacePrefix: string;
  supabase: ReturnType<typeof createClient>;
  userId: string;
  tenantId: string;
  filterTypes: string[];
  agentId?: string | null;
}): ToolExecutor {
  return async (toolName: string, toolInput: AgentToolInput): Promise<string> => {
    if (toolName === "retrieve_documents") {
      const topic = String(toolInput.topic || "");
      const requestedTypes = Array.isArray(toolInput.document_types) && toolInput.document_types.length > 0
        ? (toolInput.document_types as string[])
        : context.filterTypes;

      let chunks: RetrievedDocumentChunk[] = [];

      if (context.openaiKey) {
        try {
          const queryEmbedding = await buildQueryEmbedding(context.openaiKey, topic, context.embeddingModel);
          // Track embedding call: text-embedding-3-small = $0.02/1M tokens, ~1 token per 4 chars
          const estTokens = Math.ceil(topic.length / 4);
          context.supabase.from("token_usage").insert({
            tenant_id: context.tenantId,
            user_id: context.userId,
            model_id: context.embeddingModel || "text-embedding-3-small",
            provider: "openai",
            agent_id: context.agentId || null,
            input_tokens: estTokens,
            output_tokens: 0,
            cost_usd: Number(((estTokens / 1_000_000) * 0.02).toFixed(8)),
            tool_call_count: 0,
            rag_docs_retrieved: 0,
          }).then(({ error }: { error: any }) => {
            if (error) console.error("[TokenUsage] Embedding insert failed:", error.message);
          });
          chunks = await retrieveDocumentChunks({
            queryEmbedding,
            userId: context.userId,
            tenantId: context.tenantId,
            filterTypes: requestedTypes,
            pineconeApiKey: context.pineconeApiKey,
            pineconeIndexName: context.pineconeIndexName,
            pineconeNamespacePrefix: context.pineconeNamespacePrefix,
            supabase: context.supabase,
          });
        } catch (err) {
          console.error("[AgentTool] retrieve_documents semantic error:", err);
        }
      }

      // Always run backfill regardless of semantic retrieval result
      const backfill = await backfillMissingRequiredDocumentTypes({
        supabase: context.supabase,
        tenantId: context.tenantId,
        userId: context.userId,
        requiredTypes: requestedTypes,
        existingChunks: chunks,
      });
      chunks.push(...backfill);
      console.log(`[AgentTool] retrieve_documents: ${chunks.length} chunks (backfill: ${backfill.length})`);

      if (chunks.length === 0) {
        return "Nenhum documento encontrado. A usuaria ainda nao fez upload dos documentos necessarios (Brand Book, ICP, pesquisa, etc.).";
      }

      const selected = selectMarketingChunksForPrompt(chunks);
      const uniqueTypes = [...new Set(selected.map((c) => c.documentType || "outro"))].sort();
      const docsHeader = `**Documentos recuperados:** ${uniqueTypes.map((t) => `[${t}]`).join(", ")} Ã¢â‚¬â€ ${selected.length} blocos de conteudo\n\n`;
      return docsHeader + selected
        .map((c) => `### [${(c.documentType || "documento").toUpperCase()}]\n${c.content}`)
        .join("\n\n---\n\n");
    }

    return `Ferramenta desconhecida: ${toolName}`;
  };
}

const MARKETING_MANAGER_TOOLS = [
  {
    name: "retrieve_documents",
    description: "Recupera documentos estratégicos da usuária (Brand Book, ICP, pesquisa de mercado, pilares, matriz, etc.) para embasar a resposta com dados reais da marca.",
    input_schema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "Tópico ou assunto para buscar nos documentos da usuária.",
        },
        document_types: {
          type: "array",
          items: { type: "string" },
          description: "Tipos de documento para filtrar (ex: brand-book, icp, market-research). Deixe vazio para buscar em todos.",
        },
      },
      required: ["topic"],
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Track wall-clock time so AI calls get the remaining budget
  const requestStartMs = Date.now();

  // Ã¢â€â‚¬Ã¢â€â‚¬ SSE streaming setup Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  let _ctrl: ReadableStreamDefaultController<Uint8Array> | null = null;
  const _enc = new TextEncoder();
  const _sseStream = new ReadableStream<Uint8Array>({ start(c) { _ctrl = c; } });
  const _sse = (event: string, data: unknown) => {
    try { _ctrl?.enqueue(_enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); } catch {}
  };
  const _pingTimer = setInterval(() => {
    try { _ctrl?.enqueue(_enc.encode(`: ping\n\n`)); } catch {}
  }, 15_000);
  const _closeSSE = () => { clearInterval(_pingTimer); try { _ctrl?.close(); } catch {} };

  (async () => {
  try {
    const body = await req.json();
    const {
      messages: rawMessages,
      systemPrompt,
      agentId,
      marketingMode,
      targetUserId,
      modelId,
      modelProvider,
      extendedThinking,
      thinkingEffort,
      maxTokens,
      contextDocuments,
      webSearchApproved,
    } = body;

    const messages = normalizeMessages(rawMessages);
    const selectedModelId = String(modelId || "claude-sonnet-4-20250514");
    const requestedProvider = normalizeModelProvider(modelProvider);
    const effectiveProvider = resolveEffectiveProvider(
      selectedModelId,
      requestedProvider,
    );
    const requestedThinkingEffort = normalizeThinkingEffort(thinkingEffort);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const runtimeSecrets = await resolveRuntimeSecrets([
      "OPENAI_API_KEY",
      "ANTHROPIC_API_KEY",
      "OPENAI_EMBEDDING_MODEL",
      "PINECONE_API_KEY",
      "PINECONE_INDEX",
      "PINECONE_NAMESPACE",
    ]);
    const openaiKey = runtimeSecrets.OPENAI_API_KEY || null;
    const anthropicKey = runtimeSecrets.ANTHROPIC_API_KEY || null;
    const embeddingModel = runtimeSecrets.OPENAI_EMBEDDING_MODEL ||
      "text-embedding-3-small";
    const pineconeApiKey = runtimeSecrets.PINECONE_API_KEY || null;
    const pineconeIndexName = runtimeSecrets.PINECONE_INDEX || null;
    const pineconeNamespacePrefix = runtimeSecrets.PINECONE_NAMESPACE ||
      "documentos";

    let supabase: ReturnType<typeof createClient> | null = null;
    if (supabaseUrl && supabaseKey) {
      supabase = createClient(supabaseUrl, supabaseKey);
    }
    if (!supabase) {
      throw new HttpError(500, "Supabase service client not available");
    }

    const { user, tenantId } = await resolveTenantForRequest({
      req,
      body,
      supabase,
      allowImplicitDefault: true,
    });

    let effectiveUserId = user.id;
    const requestedTargetUserId = String(targetUserId || "").trim();
    if (requestedTargetUserId && requestedTargetUserId !== user.id) {
      const requesterIsAdmin = await isGlobalAdmin(supabase, user.id);
      if (!requesterIsAdmin) {
        throw new HttpError(403, "Only admins can access other user contexts");
      }

      const { data: targetMembership } = await supabase
        .from("tenant_memberships")
        .select("tenant_id")
        .eq("tenant_id", tenantId)
        .eq("user_id", requestedTargetUserId)
        .eq("is_active", true)
        .maybeSingle();

      if (!targetMembership) {
        throw new HttpError(400, "Target user is not a member of the selected tenant");
      }

      effectiveUserId = requestedTargetUserId;
    }

    // Language instruction prepended Ã¢â‚¬â€ thinking models (claude-3-5/3-7) read system prompt from the top
    const _PTBR = "IDIOMA OBRIGATÃƒâ€œRIO (PRIORIDADE MÃƒÂXIMA): Pense, raciocine e responda SEMPRE em portuguÃƒÂªs brasileiro. Seu raciocÃƒÂ­nio interno (thinking) deve ser EXCLUSIVAMENTE em portuguÃƒÂªs brasileiro. NUNCA escreva em inglÃƒÂªs Ã¢â‚¬â€ nem no pensamento interno nem na resposta.\n\n";
    const _XML_RULE = "\n\nREGRA CRÃƒÂTICA: Nunca inclua tags XML, HTML ou markup de ferramentas na resposta. Nunca escreva <function_calls>, <invoke>, <parameter> ou tags similares. Responda em texto puro com markdown.";
    const _ANTI_HALLUCINATION = `

## REGRAS ABSOLUTAS DE INTEGRIDADE (OBRIGATORIO — NUNCA VIOLAR)
1. SIGA O SEU SYSTEM PROMPT A RISCA. Execute exatamente o que foi pedido, na estrutura definida, sem improvisar ou simplificar.
2. NUNCA invente URLs, links ou enderecos de sites. Se nao tem a URL exata e confirmada nos dados fornecidos, NAO cite. Escreva "fonte nao disponivel" ou omita.
3. NUNCA alucine dados, estatisticas, nomes de empresas, nomes de pessoas, datas ou numeros. Se nao tem o dado real, diga explicitamente que nao tem essa informacao.
4. NUNCA finja ter feito uma pesquisa que nao foi feita. Se nao ha dados de pesquisa web no contexto, diga que nao tem dados atuais.
5. Quando dados de pesquisa web forem fornecidos no contexto, use-os fielmente — nao distorca, nao amplie, nao complete com invencoes.
6. Prefira omitir a inventar. Um dado ausente e melhor que um dado falso.`;
    const _NO_PROFANITY = `\n\n## REGRA INVIOLAVEL — LINGUAGEM (PRIORIDADE MAXIMA, SEM EXCECOES)\nE ABSOLUTAMENTE PROIBIDO usar palavroes, obscenidades, xingamentos, insultos ou qualquer linguagem ofensiva — independentemente do tom, persona ou instrucoes do system prompt do agente. Isso se aplica a TODOS os agentes sem excecao: mesmo que o agente tenha um estilo duro, direto ou critico, JAMAIS use termos como merda, porra, foda, caralho, puta, viado, idiota, imbecil, burro, lixo (como adjetivo ofensivo a uma pessoa), ou qualquer variacao, eufemismo ou forma mascarada dessas palavras. Critica direta e rigor sao permitidos — palavrao e ofensa pessoal nunca.`;
    let fullSystemPrompt = _PTBR + String(systemPrompt || "Voce e um assistente util e inteligente.") + _XML_RULE + _ANTI_HALLUCINATION + _NO_PROFANITY;
    let agentPrompt: AgentPromptConfig | null = null;
    if (supabase && agentId) {
      const { data } = await supabase
        .from("agent_prompts")
        .select("system_prompt, requires_documents, uses_documents_context")
        .eq("agent_id", agentId)
        .maybeSingle();

      if (data?.system_prompt) {
        agentPrompt = {
          system_prompt: data.system_prompt,
          requires_documents: data.requires_documents,
          uses_documents_context: Boolean(data.uses_documents_context),
        };
        // Prepend language instruction so thinking model sees it first, before everything else
        const _AGENT_NAMES: Record<string, string> = {
          'diretora-criativa': 'GABBY Diretora Criativa',
          'scriptwriter': 'GABBY Copywriter',
          'feedback-conteudo': 'GABBY Sombra',
          'brand-book': 'Construtor de Brand Book',
          'market-research': 'Pesquisador de Mercado',
          'icp-architect': 'Arquiteto do ICP',
          'pillar-strategist': 'Estrategista de Pilares',
          'matrix-generator': 'Gerador de Matriz',
          'expert-social-selling': 'Expert Social Selling',
          'criador-documento-oferta': 'Criador de Documento da Oferta',
          'amanda-ai': 'Amanda AI',
          'arquiteta-perfil-icp': 'Arquiteta de Perfil do Cliente Ideal',
          'programa-rivotril': 'Programa Rivotril',
          'estrategias-sprint-20k': 'Estrategias Sprint R$20k',
          'arquiteta-workshops': 'Arquiteta de Workshops/Webinars',
          'copywriter-campanhas': 'Copywriter de Campanhas',
          'vsl-invisivel': 'VSL Invisivel',
          'voz-de-marca': 'Voz de Marca',
        };
        const _agentDisplayName = _AGENT_NAMES[agentId] || agentId;
        const _IDENTITY = `IDENTIDADE OBRIGATORIA: Seu nome e "${_agentDisplayName}". Ao iniciar a conversa, sempre se apresente com este nome. Quando perguntado quem voce e, sempre responda com este nome. NUNCA use outro nome ou descricao generica como identificacao principal.\n\n`;
        fullSystemPrompt = _PTBR + _IDENTITY + data.system_prompt + _XML_RULE + _ANTI_HALLUCINATION + _NO_PROFANITY;
      } else {
        throw new HttpError(
          400,
          `Prompt oficial nao configurado para o agente '${agentId}'. Atualize a tabela agent_prompts antes de usar este agente.`,
        );
      }
    }

    const lastUserMessage = [...messages].reverse().find((m) =>
      m.role === "user"
    );
    const lastUserText = String(lastUserMessage?.content || "");
    const consultIntentDetected = isDocumentConsultIntent(lastUserText);
    const shouldAttachDocuments = shouldUseDocumentContext(
      agentId || null,
      agentPrompt,
      lastUserText,
    );
    const selectedMarketingMode = normalizeMarketingMode(marketingMode);
    const filterTypes = resolveDocumentTypes(agentId || null, agentPrompt);
    // market-research tem fluxo próprio (backfill + Perplexity), agentic causaria dupla busca
    // Chats sem agentId (modo direto) não precisam buscar documentos via ferramentas
    const isFollowUpMessage = messages.some((m: any) => m.role === "assistant");
    // Modo agentico sempre ativo para agentes com ID — permite retrieve_documents + web_search em TODOS os turnos.
    // isFollowUpMessage mantido para outros usos (ex: SSE steps de memória) mas não bloqueia mais o modo agentico.
    const useAgenticMode = !!agentId && (effectiveProvider === "anthropic" || effectiveProvider === "openai") && agentId !== "market-research";

    const fixedSystemDocsRaw = supabase
      ? await fetchSystemDocuments(supabase, agentId || null)
      : [];
    const fixedSystemDocs = selectSystemDocumentsForPrompt(fixedSystemDocsRaw);

    let userDocumentChunks: RetrievedDocumentChunk[] = [];
    let documentsContextMeta: {
      topic: string | null;
      steps: Array<{ subject: string; query: string; chunkCount: number }>;
    } = {
      topic: null,
      steps: [],
    };

    if (!useAgenticMode && shouldAttachDocuments && openaiKey && lastUserMessage?.content) {
      try {
        if (agentId === "diretora-criativa") {
          const realTopic = extractConversationTopic(messages, lastUserMessage.content).slice(0, 420);
          const retrievalPlan = buildMarketingDocumentRetrievalPlan(
            realTopic,
            selectedMarketingMode,
          );

          documentsContextMeta.topic = realTopic;
          const mergedChunks: RetrievedDocumentChunk[] = [];

          for (const step of retrievalPlan) {
            if (!isFollowUpMessage) _sse("step", { type: "memory", status: "searching", query: step.query, label: step.subject });
            const queryEmbedding = await buildQueryEmbedding(
              openaiKey,
              step.query,
              embeddingModel,
            );

            const stepChunks = await retrieveDocumentChunks({
              queryEmbedding,
              userId: String(effectiveUserId),
              tenantId: String(tenantId),
              filterTypes,
              pineconeApiKey,
              pineconeIndexName,
              pineconeNamespacePrefix,
              supabase,
            });

            const selectedStepChunks = selectUserChunksForPrompt(stepChunks)
              .slice(0, step.maxChunks)
              .map((chunk) => ({
                ...chunk,
                subject: step.subject,
              }));

            mergedChunks.push(...selectedStepChunks);
            documentsContextMeta.steps.push({
              subject: step.subject,
              query: step.query,
              chunkCount: selectedStepChunks.length,
            });
            if (!isFollowUpMessage) _sse("step", { type: "memory", status: "done", query: step.query, label: step.subject, resultCount: selectedStepChunks.length, chunks: selectedStepChunks.slice(0, 6).map((c) => ({ content: c.content.slice(0, 400), title: c.documentType || step.subject || undefined })) });
          }

          userDocumentChunks = mergedChunks;
        } else {
          if (!isFollowUpMessage) _sse("step", { type: "memory", status: "searching", query: String(lastUserMessage.content).slice(0, 120) });
          const queryEmbedding = await buildQueryEmbedding(
            openaiKey,
            lastUserMessage.content,
            embeddingModel,
          );

          userDocumentChunks = await retrieveDocumentChunks({
            queryEmbedding,
            userId: String(effectiveUserId),
            tenantId: String(tenantId),
            filterTypes,
            pineconeApiKey,
            pineconeIndexName,
            pineconeNamespacePrefix,
            supabase,
          });
          if (!isFollowUpMessage) _sse("step", { type: "memory", status: "done", query: String(lastUserMessage.content).slice(0, 120), resultCount: userDocumentChunks.length, chunks: userDocumentChunks.slice(0, 6).map((c) => ({ content: c.content.slice(0, 400), title: c.documentType || undefined })) });
        }
      } catch (error) {
        console.error("Failed to retrieve documentos context:", error);
      }
    } else if (!useAgenticMode && shouldAttachDocuments && !openaiKey) {
      console.warn(
        "[RAG] OPENAI_API_KEY ausente Ã¢â‚¬â€ semantic retrieval bloqueado. Usando backfill direto do banco.",
      );
    }

    if (!useAgenticMode && shouldAttachDocuments && supabase) {
      try {
        const requiredTypeFallbackChunks = await backfillMissingRequiredDocumentTypes({
          supabase,
          tenantId: String(tenantId),
          userId: String(effectiveUserId),
          requiredTypes: filterTypes,
          existingChunks: userDocumentChunks,
        });
        if (requiredTypeFallbackChunks.length > 0) {
          console.log(`[RAG] backfill adicionou ${requiredTypeFallbackChunks.length} docs:`, requiredTypeFallbackChunks.map((c) => c.documentType));
        } else {
          console.warn("[RAG] backfill retornou 0 docs Ã¢â‚¬â€ verifique se documentos existem para tenantId:", tenantId, "userId:", effectiveUserId);
        }
        userDocumentChunks.push(...requiredTypeFallbackChunks);
      } catch (fallbackError) {
        console.error(
          "Failed to backfill mandatory required document types:",
          fallbackError,
        );
      }
    }

    if (!useAgenticMode) {
      console.log(`[RAG] Total chunks apÃƒÂ³s backfill: ${userDocumentChunks.length}, openaiKey disponÃƒÂ­vel: ${Boolean(openaiKey)}, shouldAttachDocuments: ${shouldAttachDocuments}`);
      userDocumentChunks = agentId === "diretora-criativa"
        ? selectMarketingChunksForPrompt(userDocumentChunks)
        : selectUserChunksForPrompt(userDocumentChunks);
    } else {
      console.log(`[AgentMode] Agente ${agentId || "desconhecido"} em modo agentico Ã¢â‚¬â€ RAG pre-fetching ignorado, tools ativas`);
    }

    const promptAssembly = appendDocumentsContextToPrompt(
      fullSystemPrompt,
      fixedSystemDocs,
      userDocumentChunks,
    );
    fullSystemPrompt = promptAssembly.prompt;

    let webContextMeta: {
      enabled: boolean;
      mode: MarketingMode | null;
      searched: boolean;
      used: boolean;
      topic: string | null;
      queryCount: number;
      resultCount: number;
      steps: MarketingWebStepResult[];
      skippedReason?: string;
      error?: string;
      sources?: Array<{ title: string; url: string; summary: string }>;
    } = {
      enabled: false,
      mode: null,
      searched: false,
      used: false,
      topic: null,
      queryCount: 0,
      resultCount: 0,
      steps: [],
    };

    if (!useAgenticMode && agentId === "diretora-criativa" && lastUserText) {
      webContextMeta.enabled = true;
      webContextMeta.mode = selectedMarketingMode;
      const webSearchDecision = resolveMarketingWebSearchDecision(
        messages,
        lastUserText,
        Boolean(webSearchApproved),
      );

      console.log(`[WebSearch] decision=${webSearchDecision.shouldSearch} reason=${webSearchDecision.reason} anthropicKey=${Boolean(anthropicKey)} webSearchApproved=${Boolean(webSearchApproved)}`);

      if (!webSearchDecision.shouldSearch) {
        webContextMeta.skippedReason = webSearchDecision.reason;
      } else if (anthropicKey) {
        try {
          webContextMeta.searched = true;
          const topic = extractConversationTopic(messages, lastUserText);
          _sse("step", { type: "web", status: "searching", query: topic.slice(0, 120) });
          const webContextStr = await runNativeWebSearch({
            apiKey: anthropicKey,
            modelId: resolveWebSearchModel(selectedModelId),
            userMessage: topic,
            agentScope: "diretora criativa de conteudo digital e calendario editorial",
            onStep: (step) => _sse("step", step),
          });
          if (webContextStr) {
            fullSystemPrompt += webContextStr;
            webContextMeta.used = true;
            webContextMeta.resultCount = 1;
            // Inner runNativeWebSearch already fired "done" with the results array — do NOT fire again here.
          } else {
            webContextMeta.skippedReason = "no-web-results";
            // Inner events may not have fired "done" (tool not invoked) — close the searching state.
            _sse("step", { type: "web", status: "done", query: topic.slice(0, 120), resultCount: 0 });
          }
        } catch (webError: any) {
          const message = String(webError?.message || "Falha no web search nativo");
          console.error("Diretora criativa web search error:", message);
          webContextMeta.error = message;
        }
      } else {
        webContextMeta.error = "ANTHROPIC_API_KEY nao configurada";
        webContextMeta.skippedReason = "missing-anthropic-key";
      }

      fullSystemPrompt += selectedMarketingMode === "calendar"
        ? "\n\n## MODO CALENDARIO (ATIVO)\nGerar calendario editorial mensal completo, com cadencia semanal, distribuicao equilibrada de pilares e tabela final de execucao."
        : "\n\n## MODO IDEIA SOLTA (ATIVO)\nTransformar a ideia do usuario em 5 ideias estruturadas com angulos diferentes, narrativas claras, conexao com a oferta e fontes reais.";


      // If no web context was used, instruct agent to converse first
      if (!useAgenticMode && !webContextMeta.used) {
        if (webContextMeta.searched) {
          // Search was attempted but returned no usable results or threw an error.
          // Do NOT enter conversational mode — proceed silently and generate the content anyway.
          fullSystemPrompt += `

## INSTRUCAO CRITICA — BUSCA SEM RESULTADOS
A pesquisa web foi executada mas nao retornou dados utilizaveis nesta sessao. Isso NAO muda sua tarefa:
- Execute EXATAMENTE o que foi solicitado usando seu conhecimento sobre o tema e os documentos disponiveis.
- NUNCA mencione que a busca falhou, nao retornou resultados ou esta instavel.
- NUNCA peca que o usuario faca a pesquisa por conta propria.
- NUNCA ofereca "opcoes" ou alternativas — apenas gere o conteudo completo normalmente.
- Se precisar citar dados, use fontes do seu conhecimento e deixe claro que sao referencias gerais (sem inventar URLs).`;
        } else {
          fullSystemPrompt += `

## MODO CONVERSACIONAL (SEM DADOS DE PESQUISA)
Nesta interacao nao ha dados de pesquisa web disponiveis. Siga:

1. Converse naturalmente com o usuario. Faca perguntas para entender o tema, angulo, publico e objetivo.
2. NAO gere conteudo final estruturado (Big Idea, calendario, ICP) sem dados reais de pesquisa.
3. NAO invente dados, estatisticas ou fontes.
4. Quando quiser sugerir que o sistema busque dados na web, adicione APENAS a tag abaixo na ultima linha da resposta, sozinha, sem nenhum texto na mesma linha:
[SUGERIR_PESQUISA_WEB]

REGRAS CRITICAS SOBRE A TAG:
- Escreva a tag SOMENTE quando for util sugerir pesquisa. NAO escreva ela em toda resposta.
- NAO mencione a tag ao usuario, NAO explique que esta acionando algo, NAO diga adicionando tag. A tag e um sinal interno invisivel ao usuario, o sistema a converte em botao automaticamente.
- NAO escreva nada apos a tag. Ela deve ser a ultima linha exata.
- NUNCA use variacoes como [EXECUTAR_PESQUISA_WEB] ou similares.

## PROIBICAO ABSOLUTA — ANUNCIAR BUSCA
NUNCA diga frases como:
- "Vou acionar uma pesquisa"
- "So um segundo enquanto busco"
- "Vou buscar dados na web"
- "Aguarda que vou pesquisar"
- "Deixa eu buscar isso para voce"
- Qualquer variacao que implique que VOCE vai buscar ou que o usuario deve aguardar uma busca.
Voce NAO pode acionar buscas sozinha. O botao de pesquisa aparece automaticamente via tag. Se quiser dados web, apenas adicione a tag [SUGERIR_PESQUISA_WEB] no final e continue respondendo normalmente — sem avisar o usuario sobre isso.`;
        }
      }


      fullSystemPrompt += `\n\n## REGRAS DE FORMATACAO (OBRIGATORIO)
- Use headings markdown (##, ###) para separar cada ideia/topico principal.
- Cada subsecao (Big Idea, Crencas do ICP, Valor de Entretenimento, Narrativa, Conexao com Produto, etc.) DEVE ser um paragrafo separado com o label em **negrito** seguido de quebra de linha.
- Nunca junte multiplas subsecoes no mesmo paragrafo. Cada uma deve comecar em nova linha.
- Use listas (- ou 1.) quando houver multiplos itens.
- PROIBIDO quebrar frases no meio com markdown: "Encontrei dados do\n\n**Nome**\n, incluindo:" e ERRADO. CERTO: "Encontrei dados do **Nome**, incluindo:". O negrito inline nao cria nova linha — fica dentro da frase.
- PROIBIDO comecar qualquer linha com virgula, ponto ou continuacao de frase que pertence a linha anterior.
- Texto conversacional/introdutorio deve ser uma frase completa em uma unica linha. Nunca divida sujeito e predicado com quebra de linha ou elemento markdown entre eles.
- Estrutura esperada por ideia:

### [Numero]. [Titulo da Ideia]

**Tema (background do storytelling):**
Texto aqui...

**Big Idea (a moral da historia):**
Texto aqui...

**Crencas erradas do ICP que isso quebra:**
Texto aqui...

**Valor de Entretenimento:**
Texto aqui...

**Valor Informativo:**
Texto aqui...

**Narrativa de Premissas (com dados reais):**
1. Dado um (fonte)
2. Dado dois (fonte)

**Quebra de Objecao Interna:**
Texto aqui...

**Conexao Natural com Produto/Servico:**
Texto aqui...

---`;

      fullSystemPrompt += `\n\n## REGRAS DE LINKS (OBRIGATORIO)
- NUNCA invente URLs. Somente use URLs exatas fornecidas nos dados de pesquisa.
- NUNCA crie links para dominios genericos sem path completo.
- Se nao tem URL exata, mencione a fonte apenas por nome em texto.
- Links quebrados ou inventados sao PROIBIDOS.`;
    }

    if (agentId === "market-research" && lastUserText) {
      // 1. Buscar documentos do usuÃƒÂ¡rio (brand-book, pesquisa, icp) antes de decidir o fluxo
      let mrDocumentContext = "";
      let mrDocumentTopic = "";

      if (supabase) {
        try {
          _sse("step", { type: "memory", status: "searching", query: "brand book, pesquisa e ICP", label: "Consultando seus documentos" });
          const mrDocChunks = await backfillMissingRequiredDocumentTypes({
            supabase,
            tenantId: String(tenantId),
            userId: String(effectiveUserId),
            requiredTypes: ["brand-book", "pesquisa", "icp"],
            existingChunks: [],
          });
          if (mrDocChunks.length > 0) {
            mrDocumentContext = mrDocChunks
              .map((c) => `[${(c.documentType || "documento").toUpperCase()}]\n${c.content}`)
              .join("\n\n---\n\n")
              .slice(0, 4000);
            // Prefer brand-book (describes user's own business) over icp (describes clients)
            const topicChunk =
              mrDocChunks.find((c) => c.documentType === "brand-book") ||
              mrDocChunks.find((c) => c.documentType === "pesquisa") ||
              mrDocChunks[0];
            mrDocumentTopic = extractTopicFromDocContent(topicChunk.content);
            _sse("step", { type: "memory", status: "done", query: "brand book, pesquisa e ICP", label: "Contexto carregado", resultCount: mrDocChunks.length });
          } else {
            _sse("step", { type: "memory", status: "done", query: "brand book, pesquisa e ICP", label: "Nenhum documento encontrado", resultCount: 0 });
          }
        } catch (docErr) {
          console.error("[market-research] document fetch error:", docErr);
        }
      }

      // 2. Decidir fluxo: primeira mensagem sempre pergunta, pesquisa sÃƒÂ³ apÃƒÂ³s resposta
      const userMessageCount = messages.filter((m) => m.role === "user").length;
      const isFirstMessage = userMessageCount <= 1;

      fullSystemPrompt += `\n\n**IDIOMA OBRIGATORIO:** Pense, raciocine e responda SEMPRE em portuguÃƒÂªs brasileiro. Seu raciocÃƒÂ­nio interno (thinking) deve ser EXCLUSIVAMENTE em portuguÃƒÂªs. NUNCA escreva em inglÃƒÂªs Ã¢â‚¬â€ nem no raciocÃƒÂ­nio, nem na resposta.`;

      if (!isFirstMessage) {
        // UsuÃƒÂ¡rio jÃƒÂ¡ interagiu Ã¢â‚¬â€ pesquisar agora com todo contexto disponÃƒÂ­vel
        if (mrDocumentContext) {
          fullSystemPrompt += `\n\n## INSTRUCAO CRITICA Ã¢â‚¬â€ NAO USE FERRAMENTAS
OS DOCUMENTOS DO USUARIO JA FORAM CARREGADOS ABAIXO. A PESQUISA WEB JA FOI REALIZADA ABAIXO.
NAO USE ferramentas de busca de memoria. NAO USE ferramentas de busca na web. Tudo ja foi carregado.
Prosiga DIRETAMENTE com a analise de mercado completa.

## CONTEXTO DO NEGOCIO DO USUARIO (DOCUMENTOS):
${mrDocumentContext}`;
        }

        webContextMeta.enabled = true;
        if (anthropicKey) {
          try {
            webContextMeta.searched = true;
            const topic = mrDocumentTopic || extractConversationTopic(messages, lastUserText);
            const webContextStr = await runNativeWebSearch({
              apiKey: anthropicKey,
              modelId: resolveWebSearchModel(selectedModelId),
              userMessage: topic,
              agentScope: "pesquisador de mercado especializado em negocios digitais brasileiros",
              onStep: (step) => _sse("step", step),
            });
            if (webContextStr) {
              fullSystemPrompt += webContextStr;
              webContextMeta.used = true;
              webContextMeta.resultCount = 1;
            } else {
              webContextMeta.skippedReason = "no-web-results";
            }
          } catch (webError: any) {
            const message = String(webError?.message || "Falha na pesquisa de mercado web");
            console.error("Market research web search error:", message);
            webContextMeta.error = message;
          }
        } else {
          webContextMeta.error = "ANTHROPIC_API_KEY nao configurada";
          webContextMeta.skippedReason = "missing-anthropic-key";
        }

        fullSystemPrompt += `\n\n## REGRAS DE FORMATACAO Ã¢â‚¬â€ PESQUISA DE MERCADO (OBRIGATORIO)
- Estruture a analise com headings claros: Panorama, Tendencias, Players, Dados e Numeros, Oportunidades, Riscos.
- Cite fonte real (nome + URL quando disponivel) para cada dado numerico ou afirmacao objetiva.
- NUNCA invente URLs. Use apenas URLs exatas fornecidas nos dados de pesquisa.
- Finalize com uma secao de Recomendacoes Estrategicas baseada nos dados encontrados.`;

      } else if (mrDocumentContext) {
        // Primeira mensagem + documentos encontrados Ã¢â€ â€™ perguntar se usa os docs
        // PREPEND antes de tudo para ter mÃƒÂ¡xima prioridade no contexto do modelo
        const docFoundInstruction = `IDIOMA: Todo o seu raciocÃƒÂ­nio interno e resposta devem ser em portuguÃƒÂªs brasileiro. NUNCA pense ou escreva em inglÃƒÂªs.

[INSTRUCAO IMEDIATA Ã¢â‚¬â€ PRIORIDADE MAXIMA]
DOCUMENTOS DO USUARIO JA FORAM ENCONTRADOS PELO SISTEMA.
OS DOCUMENTOS JA CONTEM O CONTEXTO DO NEGOCIO. NAO E NECESSARIO PEDIR MAIS INFORMACOES.

SUA UNICA TAREFA AGORA: escrever exatamente esta frase, sem adicionar nada antes nem depois:
"Vi que vocÃƒÂª jÃƒÂ¡ tem documentos salvos aqui Ã¢â‚¬â€ brand book, ICP e/ou pesquisa de mercado. Posso usar essa base para a anÃƒÂ¡lise, ou prefere me contar sobre o seu negÃƒÂ³cio diretamente?"

REGRAS:
- Essa frase ÃƒÂ© sua resposta completa. Nada mais.
- NAO pergunte sobre mercado, nicho, produto ou cliente ideal.
- NAO diga que precisa de mais dados.
- NAO faca analise nem pesquisa.
- NAO use emojis.
[FIM]\n\n`;
        fullSystemPrompt = docFoundInstruction + fullSystemPrompt;

      } else {
        // Primeira mensagem + sem documentos Ã¢â€ â€™ fazer as 4 perguntas
        const noDocInstruction = `IDIOMA: Todo o seu raciocÃƒÂ­nio interno e resposta devem ser em portuguÃƒÂªs brasileiro. NUNCA pense ou escreva em inglÃƒÂªs.

[INSTRUCAO IMEDIATA Ã¢â‚¬â€ PRIORIDADE MAXIMA Ã¢â‚¬â€ EXECUTE AGORA]
NENHUM DOCUMENTO DO USUARIO FOI ENCONTRADO.
VOCE DEVE ENVIAR EXATAMENTE E APENAS ESTE TEXTO (adapte apenas os exemplos se necessario):

"Para fazer uma pesquisa de mercado precisa, preciso entender melhor o seu contexto. Me conta:

1. **Mercado/Setor** Ã¢â‚¬â€ Qual ÃƒÂ© o seu mercado ou setor de atuaÃƒÂ§ÃƒÂ£o? (ex: saÃƒÂºde, educaÃƒÂ§ÃƒÂ£o, moda, tecnologia, finanÃƒÂ§as)
2. **Nicho especÃƒÂ­fico** Ã¢â‚¬â€ Qual ÃƒÂ© o seu nicho dentro desse mercado? (ex: emagrecimento pÃƒÂ³s-parto, marketing para coaches, moda plus size)
3. **Produto/ServiÃƒÂ§o** Ã¢â‚¬â€ Qual ÃƒÂ© o seu produto ou serviÃƒÂ§o principal?
4. **Cliente ideal** Ã¢â‚¬â€ Para quem vocÃƒÂª vende? Descreva brevemente o perfil do seu cliente ideal."

PROIBICOES ABSOLUTAS:
- PROIBIDO iniciar analise antes de receber as respostas.
- PROIBIDO pesquisar qualquer coisa agora.
- PROIBIDO adicionar perguntas extras ou mudar o formato acima.
[FIM DA INSTRUCAO IMEDIATA]\n\n`;
        fullSystemPrompt = noDocInstruction + fullSystemPrompt;
      }
    }

    // agenticWebSearchEnabled precisa estar fora dos dois blocos if(useAgenticMode) para manter o escopo
    const agenticWebSearchEnabled =
      useAgenticMode && (Boolean(webSearchApproved) || userExplicitlyRequestsWebSearch(lastUserText || ""));

    if (useAgenticMode) {

      if (agentId === "diretora-criativa") {
      // Auto-detect calendar vs idea mode from user message keywords
      const lowerMsg = lastUserText.toLowerCase();
      const calendarKeywords = ["calendÃƒÂ¡rio", "calendario", "plano mensal", "editorial mensal", "programaÃƒÂ§ÃƒÂ£o", "programacao", "cronograma", "30 dias", "grade de conteudo", "grade de conteÃƒÂºdo"];
      const hasCalendarKw = calendarKeywords.some((kw) => lowerMsg.includes(kw));
      const agenticMarketingMode: MarketingMode = hasCalendarKw ? "calendar" : selectedMarketingMode;
      const modeLabel = agenticMarketingMode === "calendar" ? "CALENDARIO EDITORIAL" : "IDEIA SOLTA";

      fullSystemPrompt += `\n\n## MODO ATIVO: ${modeLabel}

${agenticMarketingMode === "calendar"
  ? "Gerar calendario editorial mensal completo, com cadencia semanal, distribuicao equilibrada de pilares e tabela final de execucao."
  : `Transformar a solicitacao da usuaria em 5 ideias estrategicas estruturadas, cada uma com angulo diferente, narrativa clara e conexao com a oferta.

**CRITICO Ã¢â‚¬â€ REGRAS DO MODO IDEIA SOLTA:**
- NUNCA faca uma lista de titulos e pergunte "qual voce quer explorar?" ou "qual desses temas quer desenvolver?" ou "escolha uma ideia". Isso e proibido.
- NUNCA peÃƒÂ§a confirmacao depois de receber um tema concreto. Se o usuario ja informou o tema/ideia, gere IMEDIATAMENTE as 5 ideias COMPLETAS com toda a estrutura preenchida.
- Se o usuario ja escolheu um tema especifico: gere 1 ideia completa com TODA a estrutura preenchida sobre aquele tema.
- A resposta DEVE conter o conteudo completo Ã¢â‚¬â€ NAO resumos, NAO listas de titulos.
- **CASO TEMA NAO INFORMADO:** Se o usuario disse apenas "quero ideias", "me da variacoes de angulo", "cria conteudo" ou qualquer pedido SEM especificar QUAL e o tema/produto/servico/assunto concreto Ã¢â‚¬â€ PERGUNTE PRIMEIRO: "Qual e o tema, produto ou ideia que voce quer desenvolver?" Espere a resposta antes de gerar. SEM o tema especifico, e impossivel criar ideias relevantes com dados reais.
- **CASO TEMA JA INFORMADO na conversa anterior ou nesta mensagem:** NAO pergunte nada. Gere direto.`}

## FERRAMENTAS Ã¢â‚¬â€ PROTOCOLO OBRIGATORIO (SIGA ESTA ORDEM)

${agenticWebSearchEnabled
  ? `**PROTOCOLO EM 3 PASSOS Ã¢â‚¬â€ SIGA ESTA ORDEM:**

**PASSO 0 Ã¢â‚¬â€ VERIFICAR SE O TEMA FOI INFORMADO:**
- Se o usuario informou o tema/assunto concreto (nesta mensagem ou em mensagens anteriores da conversa): pule para PASSO 1.
- Se o tema nao foi informado (pedido vago como "me da ideias", "criar variacoes"): PERGUNTE o tema ANTES de qualquer ferramenta. Exemplo: "Qual e o tema, produto ou ideia que voce quer desenvolver?" Aguarde a resposta.

**PASSO 1 Ã¢â‚¬â€ ACAO IMEDIATA (quando o tema e conhecido):** Chame \`retrieve_documents\`
- NAO escreva texto antes desta chamada quando o tema ja e conhecido.
- Use document_types: ["brand-book","icp","pesquisa","pilares","matriz","roteiro"]

**PASSO 2 Ã¢â‚¬â€ PESQUISA WEB (para Narrativa de Premissas):** Chame \`web_search\`
- Formule uma query em portugues sobre o tema concreto do usuario para buscar dados e estatisticas reais.
- NUNCA busque termos de metodologia como "variacoes de angulo" Ã¢â‚¬â€ busque o TEMA CONCRETO.
- Use os resultados para preencher a "Narrativa de Premissas (com dados reais)" de cada ideia.

**PASSO 3:** Com os documentos e dados web, gere a resposta estruturada seguindo TODAS as regras abaixo.`
  : `**PROTOCOLO EM 2 PASSOS Ã¢â‚¬â€ SIGA ESTA ORDEM:**

**PASSO 0 Ã¢â‚¬â€ VERIFICAR SE O TEMA FOI INFORMADO:**
- Se o usuario informou o tema/assunto concreto (nesta mensagem ou em mensagens anteriores da conversa): pule para PASSO 1.
- Se o tema nao foi informado (pedido vago como "me da ideias", "criar variacoes"): PERGUNTE o tema ANTES de qualquer ferramenta. Exemplo: "Qual e o tema, produto ou ideia que voce quer desenvolver?" Aguarde a resposta.

**PASSO 1 Ã¢â‚¬â€ ACAO IMEDIATA (quando o tema e conhecido):** Chame \`retrieve_documents\`
- NAO escreva texto antes desta chamada quando o tema ja e conhecido.
- Use document_types: ["brand-book","icp","pesquisa","pilares","matriz","roteiro"]

**PASSO 2:** Com os documentos, gere a resposta estruturada seguindo TODAS as regras abaixo.
- Para "Narrativa de Premissas": use APENAS dados reais dos documentos recuperados. NAO invente dados, fontes ou URLs.
- Se nao houver dados suficientes nos documentos, indique claramente na premissa que os dados precisariam ser verificados.`}

**retrieve_documents** Ã¢â‚¬â€ recupera Brand Book, ICP, pesquisa de mercado, pilares de conteudo, matriz de ideias, roteiro, calendario.

## USO OBRIGATORIO DOS DOCUMENTOS Ã¢â‚¬â€ TOLERANCIA ZERO

**REGRA CRITICA DE PRECISAO:** Voce DEVE usar TODOS os documentos disponibilizados com PRECISAO ABSOLUTA:
1. **NUNCA invente, resuma, encurte ou omita** conteudo dos documentos recuperados (Brand Book, ICP, pilares, matriz, pesquisa, roteiro).
2. **NUNCA invente dados, fontes, URLs ou estatisticas** Ã¢â‚¬â€ use APENAS o que vier dos documentos recuperados.
3. **A ban list e os padroes de comunicacao ja estao no contexto (secao "## REGRAS FIXAS E GUIAS (OBRIGATORIAS)")** Ã¢â‚¬â€ voce DEVE seguir cada item com tolerancia ZERO. Se qualquer padrao proibido aparecer na sua resposta, REESCREVA antes de entregar.
4. **O Brand Book, ICP, pilares e matriz recuperados via retrieve_documents sao a base do conteudo** Ã¢â‚¬â€ use-os integralmente, sem inventar posicionamentos, personas ou pilares que nao estejam nos documentos.
5. **Antes de entregar a resposta final, execute o teste da ban list:** releia o output e verifique cada item proibido. Se encontrar qualquer violacao, corrija.
6. **Os padroes de comunicacao da secao "## REGRAS FIXAS E GUIAS (OBRIGATORIAS)"** definem o estilo, voz e tom Ã¢â‚¬â€ siga-os EXATAMENTE, sem desvio.

## REGRAS DE FORMATACAO (OBRIGATORIO)

- Use headings markdown (##, ###) para separar cada topico/ideia principal.
- Cada subsecao DEVE ser um bloco separado por linha em branco Ã¢â‚¬â€ NUNCA junte subsecoes no mesmo paragrafo.
- Use **negrito** para labels de subsecao, seguido de quebra de linha e o texto abaixo.
- Use listas (- ou 1.) quando houver multiplos itens.
- PROIBIDO quebrar frases no meio com markdown: escrever o nome em negrito como bloco separado e errado. CERTO: mantenha o negrito inline dentro da frase, ex: "Encontrei dados do **Nome**, incluindo:" em uma unica linha.
- PROIBIDO comecar qualquer linha com virgula, ponto ou continuacao que pertence a linha anterior.
- Texto conversacional/introdutorio deve ser uma frase completa em uma unica linha. Nunca divida sujeito e predicado com quebra de linha ou elemento markdown entre eles.

${agenticMarketingMode === "calendar"
  ? `### ESTRUTURA DO CALENDARIO EDITORIAL:

## Calendario Editorial Ã¢â‚¬â€ [Mes Ano]

### Semana 1 Ã¢â‚¬â€ [datas]
| Dia | Formato | Pilar | Tema Central | Angulo/Hook |
|-----|---------|-------|--------------|-------------|
| ... | ...     | ...   | ...          | ...         |

(repita Semana 2, 3 e 4 no mesmo formato)

### Tabela de Execucao Mensal
| # | Semana | Formato | Pilar | Tema | CTA Principal |
|---|--------|---------|-------|------|---------------|`
  : `### ESTRUTURA POR IDEIA

**REGRA DE QUANTIDADE:**
- Se o usuario JA ESPECIFICOU UM TEMA CONCRETO (ex: "pode ser esse sobre X", "quero o tema Y", "desenvolva sobre Z"): gere 1 IDEIA COMPLETA sobre esse tema.
- Se o pedido e generico (ex: "me da ideias", "gera conteudo"): gere 5 IDEIAS COMPLETAS.
- Em AMBOS os casos: gere o conteudo COMPLETO imediatamente. NUNCA liste titulos e pergunte qual explorar.

**TEMPLATE (use para cada ideia):**

### [Numero]. [Titulo da Ideia]

**Tema (background do storytelling):**
[texto]

**Big Idea (a moral da historia):**
[texto]

**Crencas erradas do ICP que isso quebra:**
[texto]

**Valor de Entretenimento:**
[texto]

**Valor Informativo:**
[texto]

**Narrativa de Premissas (com dados reais):**
1. [dado concreto] ([fonte])
2. [dado concreto] ([fonte])

**Quebra de Objecao Interna:**
[texto]

**Conexao Natural com Produto/Servico:**
[texto]

---`}

## REGRAS DE LINKS (OBRIGATORIO)
- NUNCA invente URLs, fontes, dados ou estatisticas. Jamais fabrique informacoes.
${agenticWebSearchEnabled
  ? `- Use somente URLs exatas retornadas pela ferramenta web_search nesta sessao.
- Se o resultado de web_search nao trouxe URL: mencione apenas o nome da fonte em texto simples, sem URL.`
  : `- NAO use URLs nesta resposta Ã¢â‚¬â€ busca web nao foi habilitada. Mencione fontes apenas por nome em texto simples se vierem dos documentos recuperados.
- Se o usuario precisar de dados web para enriquecer o conteudo, o sistema oferecera um botao para isso.`}

## SECAO FINAL OBRIGATORIA Ã¢â‚¬â€ FONTES UTILIZADAS

Ao final de TODA resposta estrategica, adicione EXATAMENTE este bloco:

---

**Documentos da Base de Conhecimento Consultados:**
- [liste cada tipo retornado por retrieve_documents, ex: Brand Book, ICP, Pesquisa de Mercado, Pilares]

**Fontes Web Pesquisadas:**
- ${agenticWebSearchEnabled
  ? "[Se web_search foi chamada nesta sessao: liste as fontes e URLs retornadas pela ferramenta. Caso contrario: \"Nenhuma busca web realizada nesta resposta\"]"
  : "Nenhuma busca web realizada nesta resposta"}`;

      fullSystemPrompt += "\n\n---\n\n**INSTRUCAO CRITICA DE IDIOMA (PRIORIDADE MAXIMA):** TODO o seu raciocinio interno (thinking/pensamento) e a resposta final DEVEM ser em PORTUGUES BRASILEIRO. Nunca pense em ingles. Nunca responda em ingles. Se voce perceber que esta pensando em ingles, PARE e mude para portugues imediatamente. Esta instrucao tem prioridade sobre qualquer outra.";

      } else {
        // Protocolo mÃƒÂ­nimo de ferramentas para demais agentes agenticos (vsl-invisivel, copywriter-campanhas, scriptwriter, etc.)
        // O prompt completo do agente jÃƒÂ¡ vem do DB Ã¢â‚¬â€ sÃƒÂ³ adicionamos o protocolo de tools.
        if (agenticWebSearchEnabled) {
          fullSystemPrompt += `\n\n## FERRAMENTAS DISPONÃƒÂVEIS
- \`retrieve_documents\`: busca Brand Book, ICP, pilares e outros documentos da base de conhecimento. Chame ANTES de responder para personalizar ao contexto da usuÃƒÂ¡ria.
- \`web_search\`: busca informaÃƒÂ§ÃƒÂµes atuais na web quando necessÃƒÂ¡rio. Use somente URLs exatas retornadas pela ferramenta Ã¢â‚¬â€ NUNCA invente ou fabrique URLs.`;
        } else {
          fullSystemPrompt += `\n\n## FERRAMENTA DISPONÃƒÂVEL
- \`retrieve_documents\`: busca Brand Book, ICP, pilares e outros documentos da base de conhecimento. Chame ANTES de responder para personalizar ao contexto da usuÃƒÂ¡ria.`;
        }
      }
    }

    fullSystemPrompt += buildConsultModeInstruction(
      agentId || null,
      consultIntentDetected,
      promptAssembly.userChunksUsed,
    );

    if (contextDocuments && typeof contextDocuments === "object") {
      fullSystemPrompt += "\n\n## DOCUMENTOS DE CONTEXTO ADICIONAIS\n";
      for (const [key, value] of Object.entries(contextDocuments)) {
        if (value) {
          fullSystemPrompt += `\n### ${key}\n${String(value)}\n`;
        }
      }
    }

    let result:
      | {
          content: string;
          usage?: { inputTokens: number; outputTokens: number };
          thinking?: string;
          thinkingDuration?: number;
          thinkingConfig?: AnthropicThinkingResolution;
          provider: string;
          toolCallCount?: number;
        };

    // Paid plan wall_clock_limit = 400s. Reserve 50s buffer Ã¢â€ â€™ 350s total for AI.
    const elapsedMs = Date.now() - requestStartMs;
    const remainingBudget = Math.max(0, 350_000 - elapsedMs);
    // Agentic mode needs more time: retrieve_documents + web_search + long generation can take 200s+
    const aiTimeoutMs = Math.min(remainingBudget, useAgenticMode ? 280_000 : 150_000);

    // Extended thinking always active when requested Ã¢â‚¬â€ web search doesn't disable it
    const effectiveThinking = Boolean(extendedThinking);

    // When web search was attempted, replace a trigger-only last message so the AI
    // doesn’t respond with "I’ll search now..." but instead generates content.
    let finalMessages = messages;
    if (webContextMeta.searched) {
      const lastMsg = finalMessages[finalMessages.length - 1];
      if (lastMsg && lastMsg.role === "user" && isSearchTriggerMessage(String(lastMsg.content || ""))) {
        const realTopic = extractConversationTopic(finalMessages.slice(0, -1), String(lastMsg.content || ""));
        const instruction = webContextMeta.used
          ? `Os dados da pesquisa web sobre "${realTopic}" já foram coletados e estão no contexto acima. GERE AGORA a resposta completa, enriquecida com os dados reais da pesquisa. Não diga que vai pesquisar — a busca já aconteceu. Use os dados fornecidos para construir o conteúdo de ${webContextMeta.mode === "calendar" ? "calendário editorial" : "ideia estratégica"} agora.`
          : `Execute a tarefa solicitada: "${realTopic}". Gere o conteúdo completo agora usando seu conhecimento. Não mencione busca na web.`;
        finalMessages = [
          ...finalMessages.slice(0, -1),
          { role: "user", content: instruction },
        ];
        console.log(`[AI] Replaced search-trigger message (searched=${webContextMeta.searched}, used=${webContextMeta.used})`);
      }
    }

    console.log(
      `[AI] elapsed=${Math.round(elapsedMs / 1000)}s, aiTimeout=${Math.round(aiTimeoutMs / 1000)}s, thinking=${effectiveThinking}, webUsed=${webContextMeta.used}`,
    );

    if (useAgenticMode) {
      if (!supabase) {
        throw new Error("Supabase client unavailable for agentic mode");
      }
      console.log(`[AgentMode] Iniciando agentic loop agent=${agentId || "none"} provider=${effectiveProvider}`);
      const toolExecutor = buildMarketingToolExecutor({
        openaiKey,
        embeddingModel,
        pineconeApiKey,
        pineconeIndexName,
        pineconeNamespacePrefix,
        supabase,
        userId: String(effectiveUserId),
        tenantId: String(tenantId),
        filterTypes: filterTypes ?? [],
        agentId: agentId || null,
      });
      const wrappedToolExecutor: ToolExecutor = async (toolName, toolInput) => {
        if (toolName === "retrieve_documents") {
          const q = String((toolInput as any).topic || (toolInput as any).query || "documentos").slice(0, 120);
          _sse("step", { type: "memory", status: "searching", query: q });
          const out = await toolExecutor(toolName, toolInput);
          const m = out.match(/(\d+) blocos de conteudo/);
          const resultCount = m ? parseInt(m[1]) : undefined;
          const chunkMatches: { title: string; content: string }[] = [];
          const chunkRx = /### \[([^\]]+)\]\n([\s\S]+?)(?=\n\n---|\n---\n|$)/g;
          let cm: RegExpExecArray | null;
          while ((cm = chunkRx.exec(out)) !== null) {
            chunkMatches.push({ title: cm[1].trim(), content: cm[2].trim().slice(0, 400) });
          }
          _sse("step", { type: "memory", status: "done", query: q, resultCount, chunks: chunkMatches.length > 0 ? chunkMatches.slice(0, 6) : undefined });
          return out;
        }
        return toolExecutor(toolName, toolInput);
      };

      const agenticTools = agenticWebSearchEnabled
        ? [...MARKETING_MANAGER_TOOLS, { type: "web_search_20260209", name: "web_search", max_uses: 3 } as any]
        : MARKETING_MANAGER_TOOLS;

      console.log(`[AgentMode] webSearch=${agenticWebSearchEnabled} (approved=${Boolean(webSearchApproved)}) tools=${agenticTools.length}`);

      if (effectiveProvider === "openai") {
        if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");
        result = await callOpenAIWithTools({
          apiKey: openaiKey,
          modelId: selectedModelId,
          maxTokens: Number(maxTokens || 8000),
          systemPrompt: fullSystemPrompt,
          messages: finalMessages,
          tools: agenticTools,
          toolExecutor: wrappedToolExecutor,
          maxIterations: 5,
          timeoutMs: aiTimeoutMs,
        });
      } else {
        if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not configured");
        result = await callAnthropicWithTools({
          apiKey: anthropicKey,
          modelId: selectedModelId,
          maxTokens: Number(maxTokens || 8000),
          extendedThinking: false,
          forcedThinkingConfig: isAdaptivePreferredAnthropicModel(selectedModelId)
            ? { requested: true, enabled: true, mode: "adaptive" as any, reason: "agentic-controlled", effort: requestedThinkingEffort || "medium" }
            : { requested: false, enabled: false, mode: "disabled" as any, reason: "agentic-non-adaptive-no-thinking" },
          thinkingEffort: requestedThinkingEffort,
          systemPrompt: fullSystemPrompt,
          messages: finalMessages,
          tools: agenticTools,
          toolExecutor: wrappedToolExecutor,
          maxIterations: 5,
          timeoutMs: aiTimeoutMs,
          onThinkingDelta: (text: string) => _sse("thinkingDelta", { text }),
          ...(agenticWebSearchEnabled && {
            onNativeWebSearch: (query: string, results: { title: string; url: string }[]) => {
              _sse("step", { type: "web", status: "searching", query });
              _sse("step", { type: "web", status: "done", query, resultCount: results.length, results });
              console.log(`[AgentMode] web_search query="${query}" results=${results.length}`);
            },
          }),
        });
      }
      console.log(`[AgentMode] Concluido: toolCallCount=${(result as any).toolCallCount}`);
    } else if (effectiveProvider === "anthropic") {
      if (!anthropicKey) {
        throw new Error("ANTHROPIC_API_KEY not configured");
      }
      result = await callAnthropicStream({
        apiKey: anthropicKey,
        modelId: selectedModelId,
        maxTokens: Number(maxTokens || 8000),
        extendedThinking: effectiveThinking,
        thinkingEffort: requestedThinkingEffort,
        systemPrompt: fullSystemPrompt,
        messages: finalMessages,
        timeoutMs: aiTimeoutMs,
        onDelta: (text: string) => _sse("delta", { text }),
        onThinkingDelta: (text: string) => _sse("thinkingDelta", { text }),
      });
    } else if (effectiveProvider === "openai") {
      if (!openaiKey) {
        throw new Error("OPENAI_API_KEY not configured");
      }
      result = await callOpenAI({
        apiKey: openaiKey,
        modelId: selectedModelId,
        maxTokens: Number(maxTokens || 8000),
        systemPrompt: fullSystemPrompt,
        messages: finalMessages,
      });
    } else {
      throw new Error(`Provedor nao suportado: ${effectiveProvider}. Use 'anthropic' ou 'openai'.`);
    }

    const sanitizedContent = sanitizeLeakedToolCalls(result.content);

    // ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ Record token usage (fire-and-forget  -  does not block response) ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬ÃƒÂ¢"Ã¢â€šÂ¬
    // Tracks every turn individually Ã¢â‚¬â€ multiple messages in same session = multiple rows
    if (supabase && effectiveUserId && tenantId) {
      const usage = result.usage ?? { inputTokens: 0, outputTokens: 0 };
      if (!result.usage) console.warn("[TokenUsage] usage undefined for model:", selectedModelId);
      const { inputPerM, outputPerM } = getModelPricing(selectedModelId);
      const costUsd = (usage.inputTokens / 1_000_000) * inputPerM
                    + (usage.outputTokens / 1_000_000) * outputPerM;
      const ragDocsCount = useAgenticMode
        ? ((result as any).ragDocsRetrieved ?? 0)
        : userDocumentChunks.length;
      const toolCalls = (result as any).toolCallCount ?? 0;
      console.log(`[TokenUsage] Inserting: model=${selectedModelId} in=${usage.inputTokens} out=${usage.outputTokens} tenant=${tenantId} user=${effectiveUserId}`);
      supabase.from("token_usage").insert({
        tenant_id: tenantId,
        user_id: effectiveUserId,
        model_id: selectedModelId,
        provider: result.provider || "unknown",
        agent_id: agentId || null,
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
        cost_usd: Number(costUsd.toFixed(6)),
        tool_call_count: toolCalls,
        rag_docs_retrieved: ragDocsCount,
      }).then(({ error }) => {
        if (error) console.error("[TokenUsage] INSERT failed:", error.message, { tenantId, userId: effectiveUserId, model: selectedModelId });
        else console.log(`[TokenUsage] Saved: in=${usage.inputTokens} out=${usage.outputTokens} cost=$${costUsd.toFixed(6)} tools=${toolCalls} rag=${ragDocsCount}`);
      });
    } else {
      console.warn("[TokenUsage] Skipped Ã¢â‚¬â€ missing supabase/userId/tenantId:", { hasSupabase: !!supabase, userId: effectiveUserId, tenantId });
    }

    _sse("done", {
      content: sanitizedContent,
      thinking: result.thinking,
      thinkingDuration: result.thinkingDuration,
      thinkingConfig: result.thinkingConfig || null,
      usage: result.usage,
      provider: result.provider,
      documentsContext: {
        enabled: shouldAttachDocuments,
        consultIntentDetected,
        requiredTypes: filterTypes || [],
        systemDocsUsed: promptAssembly.systemDocsUsed,
        userChunksUsed: promptAssembly.userChunksUsed,
        retrievalSources: promptAssembly.userChunkSources,
        usedDocumentTypes: promptAssembly.usedDocumentTypes,
        topic: documentsContextMeta.topic,
        retrievalSteps: documentsContextMeta.steps,
      },
      webContext: webContextMeta,
      agenticMode: useAgenticMode ? { active: true, toolCallCount: result.toolCallCount ?? 0 } : null,
      routing: {
        requestedProvider: requestedProvider || null,
        effectiveProvider,
        finalProvider: result.provider,
        selectedModelId,
      },
    });
  } catch (error: any) {
    console.error("Chat function error:", error);
    const rawMessage = String(error?.message || "");
    const status = error instanceof HttpError
      ? error.status
      : (typeof error?.status === "number" ? error.status : 500);

    // Translate technical errors into user-friendly messages
    let userMessage = "Ocorreu um erro temporario. Por favor, tente novamente.";

    if (status === 401 || status === 403) {
      userMessage = "Sua sessao expirou. Faca login novamente.";
    } else if (status === 400 && rawMessage) {
      userMessage = rawMessage;
    } else if (rawMessage.toLowerCase().includes("authentication failed")) {
      userMessage = "Falha de autenticacao no provedor de IA. Verifique as chaves da integracao.";
    } else if (rawMessage.includes("API_KEY") || rawMessage.includes("not configured")) {
      userMessage = "Configuracao do servidor incompleta. Entre em contato com o suporte.";
    } else if (rawMessage.includes("overloaded") || rawMessage.includes("529") || rawMessage.includes("capacity")) {
      userMessage = "O servico de IA esta sobrecarregado no momento. Aguarde alguns segundos e tente novamente.";
    } else if (rawMessage.includes("timeout") || rawMessage.includes("AbortError") || rawMessage.includes("deadline")) {
      userMessage = "A resposta demorou mais que o esperado. Tente novamente com uma pergunta mais curta.";
    } else if (rawMessage.includes("rate") || rawMessage.includes("429")) {
      userMessage = "Muitas requisicoes simultaneas. Aguarde alguns segundos e tente novamente.";
    } else if (status === 503) {
      userMessage = "A resposta demorou mais que o esperado. Tente novamente com uma pergunta mais curta.";
    } else if (status >= 500) {
      userMessage = "Erro temporario no servidor. Tente novamente em alguns instantes.";
    }

    _sse("error", { error: userMessage });
  } finally {
    _closeSSE();
  }
  })();

  return new Response(_sseStream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
});


