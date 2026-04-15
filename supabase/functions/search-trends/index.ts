import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { resolveRuntimeSecrets } from "../_shared/runtime-secrets.ts";
import { HttpError, resolveTenantForRequest } from "../_shared/auth-tenant.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SearchInput = {
  mercado?: string;
  nicho?: string;
  tenantId?: string;
  limit?: number;
};

type PerplexityResult = {
  title?: string;
  url?: string;
  link?: string;
  snippet?: string;
  summary?: string;
  description?: string;
  published_at?: string;
  publishedAt?: string;
  date?: string;
  image?: string;
  thumbnail?: string;
  source?: string;
  source_name?: string;
};

type NewsStory = {
  id: string;
  title: string;
  url: string;
  summary: string;
  source: string;
  source_domain: string;
  source_favicon: string;
  published_at: string | null;
  image_url: string | null;
  query_tag: string;
};

const STOPWORDS = new Set([
  "a", "o", "e", "de", "do", "da", "dos", "das", "em", "na", "no", "nas", "nos", "com",
  "para", "por", "que", "um", "uma", "os", "as", "the", "and", "for", "from", "with", "latest",
  "news", "sobre", "mercado", "nicho", "tech", "tecnologia", "ai", "ia", "2026", "2025", "2024",
]);

function safeString(value: unknown): string {
  return String(value || "").trim();
}

function hostnameFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname || "";
    return host.replace(/^www\./i, "") || "Fonte";
  } catch {
    return "Fonte";
  }
}

function buildFallbackImageUrl(url: string): string {
  const encoded = encodeURIComponent(url);
  return `https://image.thum.io/get/width/1200/crop/640/noanimate/${encoded}`;
}

function toIsoOrNull(value: unknown): string | null {
  const raw = safeString(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function normalizeResult(item: PerplexityResult, queryTag: string, index: number): NewsStory | null {
  const url = safeString(item.url || item.link);
  const title = safeString(item.title);

  if (!url || !title) return null;

  const summary = safeString(item.snippet || item.summary || item.description).slice(0, 420);
  const sourceDomain = hostnameFromUrl(url);
  const source = safeString(item.source || item.source_name) || sourceDomain;
  const image = safeString(item.image || item.thumbnail) || buildFallbackImageUrl(url);
  const favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(sourceDomain)}&sz=32`;

  return {
    id: `${queryTag}-${index}-${url}`,
    title,
    url,
    summary,
    source,
    source_domain: sourceDomain,
    source_favicon: favicon,
    published_at: toIsoOrNull(item.published_at || item.publishedAt || item.date),
    image_url: image || null,
    query_tag: queryTag,
  };
}

function dedupeStories(stories: NewsStory[]): NewsStory[] {
  const seen = new Set<string>();
  const output: NewsStory[] = [];

  for (const story of stories) {
    const key = safeString(story.url).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(story);
  }

  return output;
}

function buildQueries(mercado: string, nicho: string): Array<{ tag: string; query: string }> {
  return [
    { tag: "geral", query: `${mercado} ${nicho} noticias recentes tendencias` },
    { tag: "concorrencia", query: `${mercado} ${nicho} concorrentes lancamentos movimentos` },
    { tag: "viral", query: `${mercado} ${nicho} temas virais redes sociais` },
    { tag: "oportunidade", query: `${mercado} ${nicho} oportunidades de negocio e crescimento` },
    { tag: "riscos", query: `${mercado} ${nicho} riscos desafios mudancas de mercado` },
  ];
}

function computeTopSources(stories: NewsStory[]) {
  const map = new Map<string, number>();
  for (const story of stories) {
    map.set(story.source, (map.get(story.source) || 0) + 1);
  }

  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

function computeTopTopics(stories: NewsStory[]) {
  const map = new Map<string, number>();

  for (const story of stories) {
    const text = `${story.title} ${story.summary}`.toLowerCase();
    const tokens = text
      .replace(/[^\p{L}\p{N}\s-]/gu, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 4 && !STOPWORDS.has(token));

    for (const token of tokens) {
      map.set(token, (map.get(token) || 0) + 1);
    }
  }

  return Array.from(map.entries())
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 14);
}

async function callPerplexitySearch(params: {
  apiKey: string;
  query: string;
  maxResults: number;
  maxTokensPerPage: number;
}) {
  const response = await fetch("https://api.perplexity.ai/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: params.query,
      max_results: params.maxResults,
      max_tokens_per_page: params.maxTokensPerPage,
    }),
  });

  const rawBody = await response.text();

  if (!response.ok) {
    throw new Error(`Perplexity search failed (${response.status}): ${rawBody || "sem detalhes"}`);
  }

  try {
    return rawBody ? JSON.parse(rawBody) : {};
  } catch {
    throw new Error("Perplexity retornou resposta invalida");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as SearchInput;
    await resolveTenantForRequest({
      req,
      body,
      allowImplicitDefault: true,
    });

    const mercado = safeString(body.mercado);
    const nicho = safeString(body.nicho);
    const limit = Math.min(80, Math.max(12, Number(body.limit || 36)));

    if (!mercado || !nicho) {
      return new Response(JSON.stringify({ error: "Mercado e nicho sao obrigatorios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const runtimeSecrets = await resolveRuntimeSecrets([
      "PERPLEXITY_API_KEY",
      "OPENROUTER_API_KEY",
    ]);

    const perplexityApiKey = runtimeSecrets.PERPLEXITY_API_KEY || null;
    if (!perplexityApiKey) {
      return new Response(JSON.stringify({
        error: "PERPLEXITY_API_KEY nao configurada nas chaves internas",
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const queries = buildQueries(mercado, nicho);
    const perQueryLimit = Math.max(5, Math.min(12, Math.ceil(limit / queries.length) + 2));

    const storiesBuffer: NewsStory[] = [];
    const queryErrors: Array<{ tag: string; message: string }> = [];

    for (const [queryIndex, item] of queries.entries()) {
      try {
        const payload = await callPerplexitySearch({
          apiKey: perplexityApiKey,
          query: item.query,
          maxResults: perQueryLimit,
          maxTokensPerPage: 320,
        });

        const rawResults = Array.isArray(payload?.results)
          ? payload.results
          : Array.isArray(payload?.data?.results)
            ? payload.data.results
            : Array.isArray(payload?.search_results)
              ? payload.search_results
              : [];

        for (const [resultIndex, raw] of rawResults.entries()) {
          const normalized = normalizeResult(raw as PerplexityResult, item.tag, queryIndex * 100 + resultIndex);
          if (normalized) storiesBuffer.push(normalized);
        }
      } catch (queryError) {
        const message = queryError instanceof Error ? queryError.message : "Falha na query da Perplexity";
        console.error(`search-trends query error (${item.tag}):`, message);
        queryErrors.push({ tag: item.tag, message });
      }
    }

    const deduped = dedupeStories(storiesBuffer)
      .sort((a, b) => {
        const aTime = a.published_at ? new Date(a.published_at).getTime() : 0;
        const bTime = b.published_at ? new Date(b.published_at).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, limit);

    const responsePayload = {
      generated_at: new Date().toISOString(),
      query_context: { mercado, nicho },
      total_stories: deduped.length,
      stories: deduped,
      top_sources: computeTopSources(deduped),
      top_topics: computeTopTopics(deduped),
      warnings: queryErrors,
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("search-trends error:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), {
      status: error instanceof HttpError ? error.status : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
