import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Anthropic from "npm:@anthropic-ai/sdk@0.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const {
      messages,
      systemPrompt,
      modelId,
      extendedThinking,
      maxTokens,
      contextDocuments,
    } = await req.json();

    const anthropic = new Anthropic({ apiKey });

    // Build API messages
    const apiMessages = messages
      .filter((msg: any) => msg.role === "user" || msg.role === "assistant")
      .map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      }));

    // Build system prompt with context
    let fullSystemPrompt = systemPrompt || "Você é um assistente útil e inteligente.";

    if (contextDocuments) {
      fullSystemPrompt += "\n\n## DOCUMENTOS DE CONTEXTO:\n";
      for (const [key, value] of Object.entries(contextDocuments)) {
        if (value) {
          fullSystemPrompt += `\n### ${key}:\n${value}\n`;
        }
      }
    }

    // Build request params
    const requestParams: any = {
      model: modelId || "claude-sonnet-4-5-20250514",
      max_tokens: maxTokens || 8000,
      system: fullSystemPrompt,
      messages: apiMessages,
    };

    // Extended thinking
    if (extendedThinking) {
      requestParams.thinking = {
        type: "enabled",
        budget_tokens: 10000,
      };
      // When thinking is enabled, max_tokens must be larger than budget
      requestParams.max_tokens = Math.max(requestParams.max_tokens, 16000);
    }

    const startTime = Date.now();
    const response = await anthropic.messages.create(requestParams);
    const thinkingDuration = (Date.now() - startTime) / 1000;

    // Process response
    let content = "";
    let thinking = "";

    for (const block of response.content) {
      if (block.type === "text") {
        content += block.text;
      } else if (block.type === "thinking") {
        thinking = (block as any).thinking;
      }
    }

    return new Response(
      JSON.stringify({
        content,
        thinking: thinking || undefined,
        thinkingDuration: extendedThinking ? thinkingDuration : undefined,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Chat function error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Erro interno do servidor",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
