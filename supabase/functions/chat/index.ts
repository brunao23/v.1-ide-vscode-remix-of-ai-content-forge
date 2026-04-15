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
  "marketing-manager",
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
  "marketing-manager": ["brand-book", "pesquisa", "icp", "pilares", "matriz"],
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
  "marketing-manager": "calendario",
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
  "calendario": ["calendario", "calendar", "marketing-manager", "gerente de marketing"],
  "roteiro": ["roteiro", "scriptwriter", "copywriter-campanhas", "copywriter campanhas"],
  "outro": ["outro", "other", "voz-de-marca", "voz de marca", "voice-profile"],
};

const MAX_SYSTEM_DOC_TOKENS = 2200;
const MAX_SYSTEM_DOCS_IN_PROMPT = 8;
const MAX_USER_DOC_TOKENS = 4200;
const MAX_USER_DOC_CHUNKS_IN_PROMPT = 10;
const MAX_SINGLE_CHUNK_TOKENS = 420;

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

type RuntimeModelProvider = "anthropic" | "openai" | "openrouter";
type MarketingMode = "calendar" | "idea";
type MarketingWebSearchDecision = {
  shouldSearch: boolean;
  reason: string;
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
  return modelId.startsWith("claude-");
}

function isOpenAIModel(modelId: string): boolean {
  return modelId.startsWith("gpt-") || modelId.startsWith("o");
}

function mapModelToOpenRouter(modelId: string): string {
  if (!modelId) return "openrouter/auto";

  const normalized = String(modelId).trim();
  const lower = normalized.toLowerCase();

  const knownMappings: Record<string, string> = {
    "claude-opus-4-20250514": "anthropic/claude-opus-4",
    "claude-sonnet-4-20250514": "anthropic/claude-sonnet-4",
    "claude-3-5-haiku-20241022": "anthropic/claude-3.5-haiku",
    // backward compatibility with previous ids used in the app
    "claude-opus-4-5-20250514": "anthropic/claude-opus-4",
    "claude-sonnet-4-5-20250514": "anthropic/claude-sonnet-4",
    "claude-haiku-4-5-20250514": "anthropic/claude-3.5-haiku",
  };

  if (knownMappings[lower]) {
    return knownMappings[lower];
  }

  if (lower.startsWith("anthropic/") || lower.includes("/")) {
    return normalized;
  }

  if (lower.startsWith("claude-")) {
    return "anthropic/claude-sonnet-4";
  }

  return normalized || "openrouter/auto";
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

function shouldFallbackToOpenRouter(error: any): boolean {
  if (isAuthenticationError(error)) return true;
  if (isTransientUpstreamError(error)) return true;
  const status = getProviderErrorStatus(error);
  return status >= 500;
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

function extractAffordableTokensFromOpenRouterError(rawErrorText: string): number | null {
  const errorText = String(rawErrorText || "");
  const match = errorText.match(/can only afford\s+(\d+)/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

function extractPromptTokenLimitFromOpenRouterError(
  rawErrorText: string,
): { promptTokens: number; promptLimit: number } | null {
  const errorText = String(rawErrorText || "");
  const match = errorText.match(/prompt tokens limit exceeded:\s*(\d+)\s*>\s*(\d+)/i);
  if (!match) return null;

  const promptTokens = Number(match[1]);
  const promptLimit = Number(match[2]);

  if (
    !Number.isFinite(promptTokens) ||
    !Number.isFinite(promptLimit) ||
    promptTokens <= 0 ||
    promptLimit <= 0
  ) {
    return null;
  }

  return {
    promptTokens: Math.floor(promptTokens),
    promptLimit: Math.floor(promptLimit),
  };
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
  if (
    provider === "anthropic" ||
    provider === "openai" ||
    provider === "openrouter"
  ) {
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
    // Approval patterns — user confirming AI should search
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
    normalized.includes("nao pesquisar na web") ||
    normalized.includes("não busque na web") ||
    normalized.includes("não pesquisar na web")
  );
}

function hasRecentResearchInConversation(messages: ChatMessage[]): boolean {
  const recentMessages = messages.slice(-8);
  return recentMessages.some((message) => containsResearchSignals(message.content));
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

  // Only search if explicitly approved by user (button click) or explicit text request
  if (webSearchApproved) {
    return { shouldSearch: true, reason: "user-approved-via-button" };
  }

  if (userExplicitlyRequestsWebSearch(latestUserText)) {
    return { shouldSearch: true, reason: "explicit-web-search-request" };
  }

  return { shouldSearch: false, reason: "awaiting-user-approval" };
}

function extractKeywords(text: string, limit = 6): string[] {
  const stopwords = new Set([
    "de", "da", "do", "das", "dos", "em", "no", "na", "nos", "nas",
    "e", "ou", "para", "com", "por", "que", "uma", "um", "como",
    "sobre", "meu", "minha", "quero", "preciso", "fazer", "criar",
    "calendario", "conteudo", "ideia", "solta", "marketing",
  ]);

  const normalized = String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ");

  const tokens = normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !stopwords.has(token));

  return Array.from(new Set(tokens)).slice(0, limit);
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
  ];
  const hasOnlySearchRequest = searchPhrases.some((p) => n.includes(p));
  // If it's a short sentence (< 60 chars) that's mainly asking for search, treat as trigger
  return hasOnlySearchRequest && n.length < 80;
}

/**
 * Extracts the real topic from the full conversation history.
 * When the user says "pode buscar" or "queria enriquecer com busca na web",
 * looks through the full message history to find what the conversation is actually about.
 */
function extractConversationTopic(messages: ChatMessage[], latestUserText: string): string {
  if (!isSearchTriggerMessage(latestUserText)) {
    // Latest message has real substance — use it
    return latestUserText;
  }

  // It's a search trigger — look back for the REAL topic
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

  // Nothing useful in history — fallback to the trigger message itself
  return latestUserText;
}

async function callPerplexitySearch(
  apiKey: string,
  query: string,
  maxResults = 4,
): Promise<Array<{ title: string; url: string; summary: string }>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch("https://api.perplexity.ai/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        max_results: maxResults,
        max_tokens_per_page: 400,
      }),
      signal: controller.signal,
    });

    const rawText = await response.text();
    if (!response.ok) {
      console.error(`Perplexity /search failed (${response.status}): ${rawText?.slice(0, 300)}`);
      return [];
    }

    let parsed: any = null;
    try {
      parsed = rawText ? JSON.parse(rawText) : {};
    } catch {
      return [];
    }

    // /search returns { results: [{ title, url, content, ... }] }
    const results: Array<{ title: string; url: string; summary: string }> = [];
    const items = Array.isArray(parsed?.results) ? parsed.results : [];

    for (const item of items.slice(0, maxResults)) {
      const url = String(item?.url || "").trim();
      const title = String(item?.title || "").trim();
      const summary = String(item?.content || item?.snippet || item?.text || "").slice(0, 500).trim();

      if (!url && !summary) continue;

      results.push({
        title: title || url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] || `Fonte ${results.length + 1}`,
        url,
        summary,
      });
    }

    console.log(`[Perplexity] query="${query.slice(0, 80)}" → ${results.length} results`);
    return results;
  } catch (err: any) {
    const msg = err?.name === "AbortError"
      ? `Perplexity timeout: ${query.slice(0, 60)}`
      : `Perplexity error: ${String(err?.message || err).slice(0, 150)}`;
    console.error(msg);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function buildMarketingManagerWebContext(params: {
  apiKey: string;
  userPrompt: string;
  messages: ChatMessage[];
  mode: MarketingMode;
}): Promise<{
  context: string;
  queryCount: number;
  resultCount: number;
  sources: Array<{ title: string; url: string; summary: string }>;
}> {
  // Use the full conversation to determine what to search for
  const realTopic = extractConversationTopic(params.messages, params.userPrompt);
  const keywords = extractKeywords(realTopic);
  const keywordBlock = keywords.join(" ");
  const baseTopic = keywordBlock || realTopic.slice(0, 180);

  console.log(`[WebSearch] Real topic resolved: "${baseTopic}" (from: "${params.userPrompt.slice(0, 60)}")`);

  // Use full real topic for richer queries
  const topicDescription = realTopic.slice(0, 300);

  // Queries are DIRECT about the topic — no marketing framing added.
  // The AI will apply the marketing angle; Perplexity just finds facts.
  const queries = [
    `${topicDescription} dados estatisticas fatos recentes 2024 2025`,
    `${baseTopic} tendencias cases estudos pesquisas mercado brasileiro`,
  ];

  console.log(`[WebSearch] Queries: ${JSON.stringify(queries)}`);

  const snippets: Array<{ title: string; url: string; summary: string; query: string }> = [];

  // Global budget: if ALL queries together take > 18s, stop and use whatever came back
  const budgetMs = 18_000;
  let budgetTimerId: ReturnType<typeof setTimeout> | null = null;
  const allResults = await Promise.race([
    Promise.all(
      queries.map((query) =>
        callPerplexitySearch(params.apiKey, query, 4).then(
          (results) => results.map((r) => ({ ...r, query })),
        ),
      ),
    ),
    new Promise<Array<Array<{ title: string; url: string; summary: string; query: string }>>>(
      (resolve) => {
        budgetTimerId = setTimeout(() => {
          console.error(`Web search budget exceeded (${budgetMs}ms) — continuing without results`);
          resolve([]);
        }, budgetMs);
      },
    ),
  ]).finally(() => {
    // Always clear the budget timer so it doesn't keep the isolate alive
    if (budgetTimerId !== null) clearTimeout(budgetTimerId);
  });

  for (const results of allResults) {
    snippets.push(...results);
  }

  const dedupedByUrl = Array.from(
    new Map(snippets.filter((s) => s.url).map((item) => [item.url.toLowerCase(), item])).values(),
  ).slice(0, 10);

  let context = "## PESQUISA WEB RECENTE\n";
  context += `Topico pesquisado: "${baseTopic}"\n`;
  context += `Modo selecionado: ${params.mode === "calendar" ? "calendario" : "ideia solta"}.\n\n`;
  context += "### INSTRUCOES DE USO DOS DADOS (OBRIGATORIO)\n";
  context += "- Voce DEVE usar estes dados para construir sua resposta. Eles sao o alicerce factual.\n";
  context += "- Conecte CADA dado/insight ao tema que o usuario pediu na conversa.\n";
  context += "- Se um dado nao tem relacao com o pedido do usuario, IGNORE-O. Nao inclua dados irrelevantes.\n";
  context += "- Cite a fonte ao lado do dado: ex. 'Segundo pesquisa da Gartner (2025)...'.\n\n";
  context += "### REGRAS DE LINKS\n";
  context += "- SOMENTE cite URLs que aparecem EXATAMENTE nos dados abaixo.\n";
  context += "- NUNCA invente URLs. Se nao tem URL exata, cite a fonte por nome.\n";
  context += "- Ao final, inclua '## Fontes' SOMENTE com URLs reais dos dados abaixo.\n\n";
  context += "### DADOS DA PESQUISA:\n";
  dedupedByUrl.forEach((item, index) => {
    context += `\n[${index + 1}] ${item.title}\nURL: ${item.url}\nConteudo: ${item.summary || "Sem resumo"}\n`;
  });

  const sources = dedupedByUrl
    .filter((item) => item.url)
    .map((item) => ({
      title: item.title,
      url: item.url,
      summary: item.summary,
    }));

  return {
    context,
    queryCount: queries.length,
    resultCount: dedupedByUrl.length,
    sources,
  };
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
    normalized.includes("revisão") ||
    normalized.includes("consultar") ||
    normalized.includes("analisar") ||
    normalized.includes("existente") ||
    normalized.includes("documento") ||
    normalized.includes("documentos") ||
    normalized.includes("contexto") ||
    normalized.includes("meu brand book") ||
    normalized.includes("meu brandbook") ||
    normalized.includes("ja tenho") ||
    normalized.includes("já tenho") ||
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
    if (n.includes("banlist") || n.includes("lista de banimento")) return 0;
    if (n.includes("prompt principal") || n.includes("instru")) return 1;
    return 10;
  };

  return normalizedDocs.sort((a, b) => {
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
      content: truncateTextToTokenBudget(content, 380),
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
        .limit(1);

      const firstChunk = chunkRows?.[0];
      const chunkContent = normalizeChunkContent(String(firstChunk?.content || ""));
      if (!chunkContent) continue;

      fallbackChunks.push({
        content: truncateTextToTokenBudget(chunkContent, 380),
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

      const queryResponse = await index.query({
        topK: 14,
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
          match_count: 14,
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
    userDocumentChunks.forEach((chunk, index) => {
      output += `\n[Trecho ${index + 1} - ${chunk.source} - relevancia ${(chunk.similarity * 100).toFixed(1)}%]\n${chunk.content}\n`;
    });
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
  systemPrompt: string;
  messages: ChatMessage[];
  timeoutMs?: number;
}) {
  // Single hard deadline covering ALL retries combined — prevents 3×timeout blowup
  const deadlineMs = params.timeoutMs ?? 180_000;
  const deadline = Date.now() + deadlineMs;

  const anthropic = new Anthropic({ apiKey: params.apiKey });
  const requestParams: any = {
    model: params.modelId || "claude-sonnet-4-20250514",
    max_tokens: params.maxTokens || 8000,
    system: params.systemPrompt,
    messages: params.messages,
  };

  if (params.extendedThinking) {
    requestParams.thinking = {
      type: "enabled",
      budget_tokens: 6000,
    };
    requestParams.max_tokens = Math.max(requestParams.max_tokens, 12000);
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

    // Per-attempt timeout = remaining budget (never more than 170s)
    const attemptTimeout = Math.min(remaining, 170_000);

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

      // Don't retry timeouts — just fail immediately
      const isTimeout = msg.includes("timed out") || msg.includes("timeout") || msg.includes("AbortError");
      if (isTimeout) break;

      // Only retry proper transient errors (429, 503, overloaded)
      if (attempt < 2 && isTransientUpstreamError(error)) {
        await waitForRetry(800);
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
    thinkingDuration: params.extendedThinking ? thinkingDuration : undefined,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
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
      max_tokens: params.maxTokens || 8000,
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

async function callOpenRouter(params: {
  apiKey: string;
  modelId: string;
  maxTokens: number;
  extendedThinking: boolean;
  systemPrompt: string;
  messages: ChatMessage[];
  timeoutMs?: number;
}) {
  const mappedModelId = mapModelToOpenRouter(params.modelId);
  const requestedMaxTokens = Number(params.maxTokens || 8000);
  let requestMaxTokens = requestedMaxTokens;
  let requestSystemPrompt = String(params.systemPrompt || "");
  let requestMessages = [...params.messages];
  const fetchTimeout = params.timeoutMs ?? 100_000;

  const makeRequest = async (
    maxTokens: number,
    systemPrompt: string,
    messages: ChatMessage[],
  ) => {
    const reasoningBudget = Math.max(
      256,
      Math.min(4096, Math.floor(maxTokens * 0.35)),
    );
    const reasoning = params.extendedThinking
      ? {
          enabled: true,
          max_tokens: reasoningBudget,
          exclude: false,
        }
      : {
          enabled: false,
          exclude: true,
        };

    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), fetchTimeout);
    return fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://storybot-workbench.lovable.app",
        "X-Title": "AI Content Forge",
      },
      body: JSON.stringify({
        model: mappedModelId,
        max_tokens: maxTokens,
        reasoning,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
      }),
      signal: ctl.signal,
    }).finally(() => clearTimeout(t));
  };

  const extractOpenRouterThinking = (data: any): string | undefined => {
    const message = data?.choices?.[0]?.message || {};
    const direct = message?.reasoning ?? data?.choices?.[0]?.reasoning ?? data?.reasoning;

    if (typeof direct === "string" && direct.trim()) {
      return direct.trim();
    }

    if (Array.isArray(direct)) {
      const flattened = direct
        .map((item: any) => {
          if (typeof item === "string") return item;
          return String(item?.text || item?.reasoning || item?.summary || "");
        })
        .filter(Boolean)
        .join("\n");
      if (flattened) return flattened;
    }

    const details = message?.reasoning_details ?? data?.choices?.[0]?.reasoning_details;
    if (Array.isArray(details)) {
      const flattened = details
        .map((item: any) => {
          if (typeof item === "string") return item;
          return String(item?.text || item?.reasoning || item?.summary || "");
        })
        .filter(Boolean)
        .join("\n");
      if (flattened) return flattened;
    }

    return undefined;
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const startedAt = Date.now();
    const response = await makeRequest(
      requestMaxTokens,
      requestSystemPrompt,
      requestMessages,
    );

    if (response.ok) {
      const data = await response.json();
      const content = String(data?.choices?.[0]?.message?.content || "");
      const thinking = extractOpenRouterThinking(data);
      const thinkingDuration = (Date.now() - startedAt) / 1000;

      return {
        content,
        thinking: params.extendedThinking ? thinking : undefined,
        thinkingDuration: params.extendedThinking ? thinkingDuration : undefined,
        usage: {
          inputTokens: Number(data?.usage?.prompt_tokens || 0),
          outputTokens: Number(data?.usage?.completion_tokens || 0),
        },
        provider: "openrouter",
      };
    }

    const errText = await response.text();

    if (response.status === 401 || response.status === 403) {
      throw new Error("OpenRouter authentication failed. Verifique OPENROUTER_API_KEY.");
    }

    let adjusted = false;

    if (response.status === 402) {
      const affordableTokens = extractAffordableTokensFromOpenRouterError(errText);
      if (affordableTokens && affordableTokens < requestMaxTokens) {
        requestMaxTokens = Math.max(64, affordableTokens - 8);
        adjusted = true;
      }

      const promptLimit = extractPromptTokenLimitFromOpenRouterError(errText);
      if (promptLimit) {
        const safeInputBudget = Math.max(
          256,
          promptLimit.promptLimit - requestMaxTokens - 96,
        );

        const promptBudget = Math.max(96, Math.floor(safeInputBudget * 0.45));
        const messagesBudget = Math.max(96, safeInputBudget - promptBudget);

        requestSystemPrompt = truncateTextToTokenBudget(
          requestSystemPrompt,
          promptBudget,
        );
        requestMessages = trimMessagesToTokenBudget(
          requestMessages,
          messagesBudget,
        );
        adjusted = true;
      }
    }

    if (!adjusted || attempt === 2) {
      throw new Error(`OpenRouter request failed (${response.status}): ${errText}`);
    }
  }

  throw new Error("OpenRouter request failed after retries");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Track wall-clock time so AI calls get the remaining budget
  const requestStartMs = Date.now();

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
      maxTokens,
      contextDocuments,
      webSearchApproved,
    } = body;

    const messages = normalizeMessages(rawMessages);
    const selectedModelId = String(modelId || "claude-sonnet-4-20250514");
    const requestedProvider = normalizeModelProvider(modelProvider);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const runtimeSecrets = await resolveRuntimeSecrets([
      "OPENAI_API_KEY",
      "OPENROUTER_API_KEY",
      "ANTHROPIC_API_KEY",
      "PERPLEXITY_API_KEY",
      "OPENAI_EMBEDDING_MODEL",
      "PINECONE_API_KEY",
      "PINECONE_INDEX",
      "PINECONE_NAMESPACE",
    ]);
    const openaiKey = runtimeSecrets.OPENAI_API_KEY || null;
    const openRouterKey = runtimeSecrets.OPENROUTER_API_KEY || null;
    const anthropicKey = runtimeSecrets.ANTHROPIC_API_KEY || null;
    const perplexityKey = runtimeSecrets.PERPLEXITY_API_KEY || null;
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

    let fullSystemPrompt = String(systemPrompt ||
      "Voce e um assistente util e inteligente.");
    fullSystemPrompt += "\n\nREGRA CRITICA: Voce NUNCA deve incluir tags XML, HTML ou qualquer markup de ferramentas na sua resposta. Nunca escreva <function_calls>, <invoke>, <parameter_name>, <parameter_value>, <function_calls>, <invoke>, <parameter> ou qualquer tag similar. Responda sempre em texto puro com markdown quando necessario. Se voce precisar pesquisar algo, os dados ja foram pesquisados e fornecidos no contexto — use-os diretamente. Nunca simule chamadas de ferramentas.";
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
        fullSystemPrompt = data.system_prompt;
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

    const fixedSystemDocsRaw = supabase
      ? await fetchSystemDocuments(supabase, agentId || null)
      : [];
    const fixedSystemDocs = selectSystemDocumentsForPrompt(fixedSystemDocsRaw);

    let userDocumentChunks: RetrievedDocumentChunk[] = [];
    if (shouldAttachDocuments && openaiKey && lastUserMessage?.content) {
      try {
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
      } catch (error) {
        console.error("Failed to retrieve documentos context:", error);
      }
    } else if (shouldAttachDocuments && !openaiKey) {
      console.warn(
        "OPENAI_API_KEY not available for semantic retrieval. Falling back to latest required documents.",
      );
    }

    if (shouldAttachDocuments && supabase) {
      try {
        const requiredTypeFallbackChunks = await backfillMissingRequiredDocumentTypes({
          supabase,
          tenantId: String(tenantId),
          userId: String(effectiveUserId),
          requiredTypes: filterTypes,
          existingChunks: userDocumentChunks,
        });
        userDocumentChunks.push(...requiredTypeFallbackChunks);
      } catch (fallbackError) {
        console.error(
          "Failed to backfill mandatory required document types:",
          fallbackError,
        );
      }
    }

    userDocumentChunks = selectUserChunksForPrompt(userDocumentChunks);

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
      queryCount: number;
      resultCount: number;
      skippedReason?: string;
      error?: string;
      sources?: Array<{ title: string; url: string; summary: string }>;
    } = {
      enabled: false,
      mode: null,
      searched: false,
      used: false,
      queryCount: 0,
      resultCount: 0,
    };

    if (agentId === "marketing-manager" && lastUserText) {
      webContextMeta.enabled = true;
      webContextMeta.mode = selectedMarketingMode;
      const webSearchDecision = resolveMarketingWebSearchDecision(
        messages,
        lastUserText,
        Boolean(webSearchApproved),
      );

      if (!webSearchDecision.shouldSearch) {
        webContextMeta.skippedReason = webSearchDecision.reason;
      } else if (perplexityKey) {
        try {
          webContextMeta.searched = true;
          const webContext = await buildMarketingManagerWebContext({
            apiKey: perplexityKey,
            userPrompt: lastUserText,
            messages,
            mode: selectedMarketingMode,
          });

          webContextMeta.queryCount = webContext.queryCount;
          webContextMeta.resultCount = webContext.resultCount;
          webContextMeta.sources = webContext.sources;
          if (webContext.resultCount > 0) {
            fullSystemPrompt += `\n\n${webContext.context}`;
            webContextMeta.used = true;
          } else {
            webContextMeta.skippedReason = "no-web-results";
          }
        } catch (webError: any) {
          const message = String(webError?.message || "Falha no web scraping");
          console.error("Marketing manager web context error:", message);
          webContextMeta.error = message;
        }
      } else {
        webContextMeta.error = "PERPLEXITY_API_KEY nao configurada";
        webContextMeta.skippedReason = "missing-perplexity-key";
      }

      fullSystemPrompt += selectedMarketingMode === "calendar"
        ? "\n\n## MODO CALENDARIO (ATIVO)\nGerar calendario editorial mensal completo, com cadencia semanal, distribuicao equilibrada de pilares e tabela final de execucao."
        : "\n\n## MODO IDEIA SOLTA (ATIVO)\nTransformar a ideia do usuario em 5 ideias estruturadas com angulos diferentes, narrativas claras, conexao com a oferta e fontes reais.";

      // If no web context was used, instruct agent to converse first
      if (!webContextMeta.used) {
        fullSystemPrompt += `\n\n## COMPORTAMENTO CONVERSACIONAL (OBRIGATORIO QUANDO NAO HA DADOS DE PESQUISA)
Voce NAO tem dados de pesquisa web nesta conversa ainda. Siga estas regras:

1. PRIMEIRO: Converse com o usuario. Faca perguntas para entender o tema, o angulo, o publico-alvo e o objetivo.
2. NAO gere conteudo final estruturado (com Big Idea, ICP, etc.) sem ter dados reais de pesquisa.
3. Quando voce entender o tema e sentir que precisa de dados reais da web para gerar conteudo de qualidade, SUGIRA ao usuario que faca uma pesquisa.
4. Para sugerir pesquisa, adicione EXATAMENTE esta tag na ULTIMA LINHA da sua resposta, sozinha, sem nenhum texto antes ou depois na mesma linha:
[SUGERIR_PESQUISA_WEB]
5. Essa tag sera convertida automaticamente em um botao clicavel para o usuario.
6. NAO simule dados, estatisticas ou fontes. Se nao tem dados reais, diga que precisa pesquisar.
7. Seja natural e conversacional. Demonstre interesse genuino pelo tema do usuario.

### PROIBICOES ABSOLUTAS:
- NUNCA invente tags diferentes. A UNICA tag permitida e [SUGERIR_PESQUISA_WEB]. Nada mais.
- NUNCA use [EXECUTAR_PESQUISA_WEB], [BUSCAR_WEB], [INICIAR_PESQUISA] ou qualquer variacao.
- NUNCA finja estar buscando na web. Voce NAO tem acesso a internet. A busca e feita pelo sistema.
- NUNCA escreva "Aguarde enquanto busco..." ou frases similares — isso e falso.
- NUNCA coloque texto ou parametros dentro dos colchetes da tag.`;
      }

      fullSystemPrompt += `\n\n## REGRAS DE FORMATACAO (OBRIGATORIO)
- Use headings markdown (##, ###) para separar cada ideia/topico principal.
- Cada subsecao (Big Idea, Crencas do ICP, Valor de Entretenimento, Narrativa, Conexao com Produto, etc.) DEVE ser um paragrafo separado com o label em **negrito** seguido de quebra de linha.
- Nunca junte multiplas subsecoes no mesmo paragrafo. Cada uma deve comecar em nova linha.
- Use listas (- ou 1.) quando houver multiplos itens.
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
          provider: string;
        };
    let routedPrimaryProvider = requestedProvider || (
      isAnthropicModel(selectedModelId)
        ? "anthropic"
        : (isOpenAIModel(selectedModelId) ? "openai" : "openrouter")
    );
    let fallbackUsed = false;
    let fallbackReason: string | null = null;

    // wall_clock_limit = 400s (set in config.toml). Reserve 20s buffer → 380s total.
    // AI gets whatever is left after web search and other pre-processing.
    const elapsedMs = Date.now() - requestStartMs;
    const remainingBudget = Math.max(0, 370_000 - elapsedMs);
    // Cap per-attempt timeout at 180s (generous, won't stack because timeouts don't retry)
    const aiTimeoutMs = Math.min(remainingBudget, 180_000);
    console.log(`[AI] elapsed=${Math.round(elapsedMs / 1000)}s remaining=${Math.round(remainingBudget / 1000)}s aiTimeout=${Math.round(aiTimeoutMs / 1000)}s thinking=${effectiveThinking}`);

    // When web search was used, disable extended thinking to save time budget
    const effectiveThinking = Boolean(extendedThinking) && !webContextMeta.used;

    console.log(
      `[AI] elapsed=${Math.round(elapsedMs / 1000)}s, aiTimeout=${Math.round(aiTimeoutMs / 1000)}s, thinking=${effectiveThinking}, webUsed=${webContextMeta.used}`,
    );

    if (requestedProvider === "anthropic" || isAnthropicModel(selectedModelId)) {
      if (anthropicKey) {
        try {
          result = await callAnthropic({
            apiKey: anthropicKey,
            modelId: selectedModelId,
            maxTokens: Number(maxTokens || 8000),
            extendedThinking: effectiveThinking,
            systemPrompt: fullSystemPrompt,
            messages,
            timeoutMs: aiTimeoutMs,
          });
        } catch (anthropicError) {
          if (!openRouterKey || !shouldFallbackToOpenRouter(anthropicError)) {
            throw anthropicError;
          }
          fallbackUsed = true;
          fallbackReason = `anthropic_error:${String((anthropicError as any)?.message || "unknown")}`;
          result = await callOpenRouter({
            apiKey: openRouterKey,
            modelId: selectedModelId,
            maxTokens: Number(maxTokens || 8000),
            extendedThinking: effectiveThinking,
            systemPrompt: fullSystemPrompt,
            messages,
            timeoutMs: aiTimeoutMs,
          });
        }
      } else if (openRouterKey) {
        result = await callOpenRouter({
          apiKey: openRouterKey,
          modelId: selectedModelId,
          maxTokens: Number(maxTokens || 8000),
          extendedThinking: effectiveThinking,
          systemPrompt: fullSystemPrompt,
          messages,
          timeoutMs: aiTimeoutMs,
        });
      } else {
        throw new Error("ANTHROPIC_API_KEY or OPENROUTER_API_KEY not configured");
      }
    } else if (requestedProvider === "openrouter") {
      if (!openRouterKey) {
        throw new Error("OPENROUTER_API_KEY not configured");
      }
      result = await callOpenRouter({
        apiKey: openRouterKey,
        modelId: selectedModelId,
        maxTokens: Number(maxTokens || 8000),
        extendedThinking: effectiveThinking,
        systemPrompt: fullSystemPrompt,
        messages,
        timeoutMs: aiTimeoutMs,
      });
    } else if (requestedProvider === "openai" || isOpenAIModel(selectedModelId)) {
      if (openaiKey) {
        try {
          result = await callOpenAI({
            apiKey: openaiKey,
            modelId: selectedModelId,
            maxTokens: Number(maxTokens || 8000),
            systemPrompt: fullSystemPrompt,
            messages,
          });
        } catch (openAiError) {
          if (!openRouterKey || !shouldFallbackToOpenRouter(openAiError)) {
            throw openAiError;
          }
          fallbackUsed = true;
          fallbackReason = `openai_error:${String((openAiError as any)?.message || "unknown")}`;
          result = await callOpenRouter({
            apiKey: openRouterKey,
            modelId: selectedModelId,
            maxTokens: Number(maxTokens || 8000),
            extendedThinking: effectiveThinking,
            systemPrompt: fullSystemPrompt,
            messages,
            timeoutMs: aiTimeoutMs,
          });
        }
      } else if (openRouterKey) {
        result = await callOpenRouter({
          apiKey: openRouterKey,
          modelId: selectedModelId,
          maxTokens: Number(maxTokens || 8000),
          extendedThinking: effectiveThinking,
          systemPrompt: fullSystemPrompt,
          messages,
          timeoutMs: aiTimeoutMs,
        });
      } else {
        throw new Error("OPENAI_API_KEY or OPENROUTER_API_KEY not configured");
      }
    } else {
      if (!openRouterKey) {
        throw new Error("OPENROUTER_API_KEY not configured");
      }
      result = await callOpenRouter({
        apiKey: openRouterKey,
        modelId: selectedModelId,
        maxTokens: Number(maxTokens || 8000),
        extendedThinking: effectiveThinking,
        systemPrompt: fullSystemPrompt,
        messages,
        timeoutMs: aiTimeoutMs,
      });
    }

    const sanitizedContent = sanitizeLeakedToolCalls(result.content);

    return new Response(
      JSON.stringify({
        content: sanitizedContent,
        thinking: result.thinking,
        thinkingDuration: result.thinkingDuration,
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
        },
        webContext: webContextMeta,
        routing: {
          requestedProvider: requestedProvider || null,
          primaryProvider: routedPrimaryProvider,
          finalProvider: result.provider,
          fallbackUsed,
          fallbackReason,
          selectedModelId,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
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
    } else if (rawMessage.includes("API_KEY") || rawMessage.includes("not configured")) {
      userMessage = "Configuracao do servidor incompleta. Entre em contato com o suporte.";
    } else if (rawMessage.includes("overloaded") || rawMessage.includes("529") || rawMessage.includes("capacity")) {
      userMessage = "O servico de IA esta sobrecarregado no momento. Aguarde alguns segundos e tente novamente.";
    } else if (rawMessage.includes("timeout") || rawMessage.includes("AbortError") || rawMessage.includes("deadline")) {
      userMessage = "A resposta demorou mais que o esperado. Tente novamente — funciona melhor com perguntas mais curtas.";
    } else if (rawMessage.includes("rate") || rawMessage.includes("429")) {
      userMessage = "Muitas requisicoes simultaneas. Aguarde alguns segundos e tente novamente.";
    } else if (status >= 500) {
      userMessage = "Erro temporario no servidor. Tente novamente em alguns instantes.";
    }

    return new Response(
      JSON.stringify({
        error: userMessage,
      }),
      {
        status: status >= 500 ? 200 : status, // Return 200 for server errors so frontend parses the JSON
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
