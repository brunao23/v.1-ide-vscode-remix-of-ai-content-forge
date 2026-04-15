import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ALLOWED_DOMAINS = [
  "cdninstagram.com",
  "fbcdn.net",
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  "tiktokv.com",
  "muscdn.com",
  "p16-sign.tiktokcdn-us.com",
  "p16-sign-va.tiktokcdn.com",
  "p77-sign.tiktokcdn-us.com",
];

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_DOMAINS.some((d) => parsed.hostname.endsWith(d));
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey",
      },
    });
  }

  const url = new URL(req.url).searchParams.get("url");

  if (!url) {
    return new Response("Missing url parameter", { status: 400 });
  }

  if (!isAllowedUrl(url)) {
    return new Response("URL not allowed", { status: 403 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8",
        "Referer": "https://www.instagram.com/",
        "Sec-Fetch-Dest": "image",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Site": "cross-site",
      },
    });

    if (!response.ok) {
      return new Response(`Upstream error: ${response.status}`, {
        status: response.status,
      });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const body = await response.arrayBuffer();

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
        "Access-Control-Allow-Origin": "*",
        "Cross-Origin-Resource-Policy": "cross-origin",
      },
    });
  } catch (err) {
    return new Response(`Proxy error: ${err}`, { status: 502 });
  }
});
