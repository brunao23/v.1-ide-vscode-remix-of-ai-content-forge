import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SB_CLIENT_ID = "cli_69150c2fcfb9eaa7420d6388";
const SB_TOKEN = "c10994b1bc9685545c0ec2908d36f09c5a25a8a8807ab26a3d621dc8c83c2ac7";
const SB_BASE = "https://matrix.sbapis.com/b";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const params = new URL(req.url).searchParams;
  const platform = params.get("platform");
  const query = params.get("query");

  if (!platform || !query) {
    return new Response(JSON.stringify({ error: "Parâmetros platform e query são obrigatórios" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const allowed = ["instagram", "youtube", "tiktok"];
  if (!allowed.includes(platform)) {
    return new Response(JSON.stringify({ error: "Plataforma inválida" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const url = `${SB_BASE}/${platform}/statistics?query=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        clientid: SB_CLIENT_ID,
        token: SB_TOKEN,
      },
    });

    const body = await res.text();

    return new Response(body, {
      status: res.status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: `Proxy error: ${err}` }), {
      status: 502,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
