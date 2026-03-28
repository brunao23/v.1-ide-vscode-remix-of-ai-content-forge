import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { mercado, nicho } = await req.json();

    if (!mercado || !nicho) {
      return new Response(JSON.stringify({ error: "Mercado e nicho são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Preciso de notícias, fofocas, polêmicas e coisas interessantes do mundo da cultura popular, cultura pop e tecnologia relacionado a:
Mercado: "${mercado}"
Nicho: "${nicho}"

Não pode ser chato, tem que ser algo sexy, visceral, interessante e que chame atenção e desperte curiosidade. Pode ser relacionado à famosos/figuras públicas, deve ser algo em tom de fofoca. Quero saber fatos reais, sem floreios. Sua tarefa é encontrar pautas quentes, informações, fatos e dados super interessantes. É proibido fabricar informações ou fontes. Busque por fontes do mundo inteiro, publicadas a partir de janeiro de 2024.

Me informe:
- os 10 fatos mais chocantes, curiosos, disruptivos, contra-intuitivos, bombásticos ou bizarros.
- as 10 notícias e/ou histórias mais chocantes, curiosas, disruptivas, contra-intuitivas, bombásticas ou bizarras.
- as 5 principais fofocas (verdadeiras ou falsas) relacionadas ao assunto.
- as 5 principais pautas quentes e virais sobre meu nicho e mercado em 2026.

Busque fatos e notícias inéditos e distintos dentro de cada categoria, sem repetir caso nem angulação.

Responda em JSON:
{
  "fatos_chocantes": ["fato 1", "fato 2", ...],
  "noticias_historias": ["notícia 1", "notícia 2", ...],
  "fofocas": ["fofoca 1", "fofoca 2", ...],
  "pautas_virais": ["pauta 1", "pauta 2", ...]
}

Retorne APENAS o JSON válido, sem markdown.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://storybot-workbench.lovable.app",
        "X-Title": "AI Content Forge",
      },
      body: JSON.stringify({
        model: "perplexity/sonar",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenRouter error:", response.status, errText);
      return new Response(JSON.stringify({ error: "Erro na API de busca" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Try to parse JSON from the response
    let parsed;
    try {
      // Remove possible markdown code fences
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "Resposta inválida da IA. Tente novamente." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("search-trends error:", error);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
