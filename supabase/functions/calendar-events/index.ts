import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const API_KEY = Deno.env.get("ADDEVENT_API_KEY");
    const CALENDAR_ID = Deno.env.get("ADDEVENT_CALENDAR_ID");

    if (!API_KEY) {
      return new Response(
        JSON.stringify({ error: "ADDEVENT_API_KEY não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!CALENDAR_ID) {
      return new Response(
        JSON.stringify({ error: "ADDEVENT_CALENDAR_ID não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("API_KEY length:", API_KEY.length);
    console.log("CALENDAR_ID:", CALENDAR_ID);

    // Try AddEvent API v1 (token as query param) first, then v2
    const urls = [
      `https://www.addevent.com/api/v1/me/calendars/events/list/?token=${API_KEY}&calendar_id=${CALENDAR_ID}`,
      `https://api.addevent.com/calevent/v2/calendars/${CALENDAR_ID}/events`,
    ];

    let events: any[] = [];
    let lastError = "";

    for (const url of urls) {
      console.log("Trying:", url.replace(API_KEY, "***"));
      const isV2 = url.includes("api.addevent.com");

      const response = await fetch(url, {
        headers: isV2
          ? { Authorization: `Bearer ${API_KEY}`, Accept: "application/json" }
          : { Accept: "application/json" },
      });

      const text = await response.text();
      console.log("Response status:", response.status, "body length:", text.length, "preview:", text.slice(0, 300));

      if (!response.ok) {
        lastError = `${response.status}: ${text.slice(0, 200)}`;
        continue;
      }

      try {
        const data = JSON.parse(text);
        // v1 format
        if (data.events) {
          events = data.events.map((e: any) => ({
            id: e.id || e.uid || crypto.randomUUID(),
            title: e.title || e.summary || "",
            description: e.description || null,
            start: e.date_start || e.start_date || e.start || null,
            end: e.date_end || e.end_date || e.end || null,
            location: e.location || null,
            url: e.url || null,
            timezone: e.timezone || null,
          }));
          break;
        }
        // v2 format
        if (data.data) {
          events = data.data.map((e: any) => ({
            id: e.id || crypto.randomUUID(),
            title: e.title || e.summary || e.name || "",
            description: e.description || null,
            start: e.start_date || e.date_start || null,
            end: e.end_date || e.date_end || null,
            location: e.location || null,
            url: e.url || null,
            timezone: e.timezone || null,
          }));
          break;
        }
        // Try as array
        if (Array.isArray(data)) {
          events = data.map((e: any) => ({
            id: e.id || crypto.randomUUID(),
            title: e.title || e.summary || "",
            description: e.description || null,
            start: e.date_start || e.start_date || e.start || null,
            end: e.date_end || e.end_date || e.end || null,
            location: e.location || null,
            url: e.url || null,
          }));
          break;
        }

        // Unknown format - log and continue
        console.log("Unknown data format, keys:", Object.keys(data));
        lastError = "Unknown response format";
      } catch (parseErr) {
        console.error("Parse error:", parseErr);
        lastError = `Parse error: ${parseErr}`;
      }
    }

    console.log("Final events count:", events.length);

    if (events.length === 0 && lastError) {
      console.error("All endpoints failed. Last error:", lastError);
    }

    return new Response(JSON.stringify(events), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
