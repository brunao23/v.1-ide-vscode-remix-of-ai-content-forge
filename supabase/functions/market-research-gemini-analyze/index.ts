import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { resolveRuntimeSecrets } from "../_shared/runtime-secrets.ts";
import { HttpError, getServiceClient, resolveTenantForRequest } from "../_shared/auth-tenant.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AnalysisResult {
  summary: string;
  hook: string;
  content_strategy: string;
  tone: string;
  emotional_triggers: string[];
  content_structure: string;
  cta: string;
  keywords: string[];
  recommendations: string[];
  virality_score: number;
}

function buildYouTubePrompt(): string {
  return `Você é um estrategista de conteúdo especializado em mídias sociais. Assista este vídeo do YouTube e retorne uma análise estratégica de conteúdo em JSON.

Retorne SOMENTE um objeto JSON válido com exatamente esta estrutura (sem markdown, sem explicações):
{
  "summary": "resumo conciso do conteúdo em 2-3 frases",
  "hook": "como o vídeo prende a atenção nos primeiros segundos",
  "content_strategy": "estratégia de conteúdo identificada no vídeo",
  "tone": "tom e estilo de comunicação utilizado",
  "emotional_triggers": ["gatilho emocional 1", "gatilho emocional 2", "gatilho emocional 3"],
  "content_structure": "como o conteúdo está estruturado (introdução, desenvolvimento, conclusão)",
  "cta": "call to action identificado ou implícito",
  "keywords": ["palavra-chave 1", "palavra-chave 2", "palavra-chave 3"],
  "recommendations": ["recomendação aplicável 1", "recomendação aplicável 2", "recomendação aplicável 3"],
  "virality_score": 7
}

O virality_score deve ser um número inteiro de 0 a 10 indicando o potencial viral do conteúdo.`;
}

function buildTextPrompt(params: {
  platform: string;
  caption: string;
  hashtags: string[];
  mentions: string[];
  published_at: string;
}): string {
  const lines = [
    `Você é um estrategista de conteúdo especializado em mídias sociais. Analise este post e retorne uma análise estratégica em JSON.`,
    ``,
    `Post:`,
    `Plataforma: ${params.platform}`,
    `Caption: ${params.caption || "(sem legenda)"}`,
    `Hashtags: ${params.hashtags.length > 0 ? params.hashtags.join(" ") : "(nenhuma)"}`,
    `Menções: ${params.mentions.length > 0 ? params.mentions.join(" ") : "(nenhuma)"}`,
    `Publicado em: ${params.published_at}`,
    ``,
    `Retorne SOMENTE um objeto JSON válido com exatamente esta estrutura (sem markdown, sem explicações):`,
    `{`,
    `  "summary": "resumo conciso do conteúdo em 2-3 frases",`,
    `  "hook": "estratégia de abertura e captura de atenção",`,
    `  "content_strategy": "estratégia de conteúdo identificada",`,
    `  "tone": "tom e estilo de comunicação utilizado",`,
    `  "emotional_triggers": ["gatilho 1", "gatilho 2", "gatilho 3"],`,
    `  "content_structure": "como o conteúdo está estruturado",`,
    `  "cta": "call to action identificado ou implícito",`,
    `  "keywords": ["palavra-chave 1", "palavra-chave 2", "palavra-chave 3"],`,
    `  "recommendations": ["recomendação aplicável 1", "recomendação aplicável 2", "recomendação aplicável 3"],`,
    `  "virality_score": 7`,
    `}`,
    ``,
    `O virality_score deve ser um número inteiro de 0 a 10.`,
  ];
  return lines.join("\n");
}

function isYouTubeUrl(url: string): boolean {
  return /youtube\.com\/watch|youtu\.be\//i.test(url || "");
}

function parseGeminiJson(raw: string): AnalysisResult {
  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return {
      summary: raw.slice(0, 500),
      hook: "",
      content_strategy: "",
      tone: "",
      emotional_triggers: [],
      content_structure: "",
      cta: "",
      keywords: [],
      recommendations: [],
      virality_score: 0,
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const { user, tenantId, supabase: client } = await resolveTenantForRequest({
      req,
      body,
    });
    const userId = user.id;

    const secrets = await resolveRuntimeSecrets(["GEMINI_API_KEY"]);
    const geminiKey = secrets.GEMINI_API_KEY;
    if (!geminiKey) {
      throw new HttpError(500, "GEMINI_API_KEY not configured");
    }

    const { post_id, post_url, platform, caption, hashtags, mentions, published_at } = body;

    if (!post_id || !post_url) {
      throw new HttpError(400, "post_id and post_url are required");
    }

    const serviceClient = getServiceClient();

    // Return cached completed analysis if available
    const { data: existing } = await serviceClient
      .from("market_research_gemini_analyses")
      .select("*")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .eq("post_id", post_id)
      .maybeSingle();

    if (existing?.status === "completed") {
      return new Response(JSON.stringify({ success: true, analysis: existing }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark as processing
    await serviceClient.from("market_research_gemini_analyses").upsert(
      {
        user_id: userId,
        tenant_id: tenantId,
        post_id,
        post_url,
        platform: platform || "unknown",
        status: "processing",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,tenant_id,post_id" },
    );

    const isYT = isYouTubeUrl(post_url);
    const model = "gemini-2.5-flash";

    let requestBody: any;

    if (isYT) {
      requestBody = {
        contents: [
          {
            parts: [
              {
                fileData: {
                  mimeType: "video/youtube",
                  fileUri: post_url,
                },
              },
              {
                text: buildYouTubePrompt(),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json",
        },
      };
    } else {
      requestBody = {
        contents: [
          {
            parts: [
              {
                text: buildTextPrompt({
                  platform: platform || "instagram",
                  caption: caption || "",
                  hashtags: Array.isArray(hashtags) ? hashtags : [],
                  mentions: Array.isArray(mentions) ? mentions : [],
                  published_at: published_at || "",
                }),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json",
        },
      };
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      },
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error:", geminiRes.status, errText);

      let geminiErrorMsg = `Gemini API error: ${geminiRes.status}`;
      try {
        const parsed = JSON.parse(errText);
        const detail = parsed?.error?.message || parsed?.message;
        if (detail) geminiErrorMsg = detail;
      } catch { /* keep default message */ }

      await serviceClient.from("market_research_gemini_analyses").upsert(
        {
          user_id: userId,
          tenant_id: tenantId,
          post_id,
          post_url,
          platform: platform || "unknown",
          status: "error",
          error_message: geminiErrorMsg,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,tenant_id,post_id" },
      );

      throw new HttpError(502, geminiErrorMsg);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const analysis = parseGeminiJson(rawText);

    // Track Gemini API call in token_usage
    const geminiUsage = geminiData.usageMetadata || {};
    const inputTok = Number(geminiUsage.promptTokenCount || 0);
    const outputTok = Number(geminiUsage.candidatesTokenCount || 0);
    const geminiCostUsd = (inputTok / 1_000_000) * 0.15 + (outputTok / 1_000_000) * 0.60;
    serviceClient.from("token_usage").insert({
      tenant_id: tenantId,
      user_id: userId,
      model_id: model,
      provider: "google",
      agent_id: null,
      input_tokens: inputTok,
      output_tokens: outputTok,
      cost_usd: Number(geminiCostUsd.toFixed(6)),
      tool_call_count: 0,
      rag_docs_retrieved: 0,
    }).then(({ error }: { error: any }) => {
      if (error) console.error("[TokenUsage] Gemini insert failed:", error.message);
      else console.log(`[TokenUsage] Gemini tracked: in=${inputTok} out=${outputTok}`);
    });

    const { data: savedAnalysis, error: saveErr } = await serviceClient
      .from("market_research_gemini_analyses")
      .upsert(
        {
          user_id: userId,
          tenant_id: tenantId,
          post_id,
          post_url,
          platform: platform || "unknown",
          status: "completed",
          model_used: model,
          analysis,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,tenant_id,post_id" },
      )
      .select()
      .single();

    if (saveErr) {
      console.error("Failed to save analysis:", saveErr);
    }

    return new Response(
      JSON.stringify({ success: true, analysis: savedAnalysis || { post_id, status: "completed", analysis } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("market-research-gemini-analyze error:", message);

    return new Response(JSON.stringify({ success: false, error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
