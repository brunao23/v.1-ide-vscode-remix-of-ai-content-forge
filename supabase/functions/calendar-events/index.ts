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

    // Use AddEvent API v2 to list events
    const apiUrl = `https://api.addevent.com/calevent/v2/calendars/${CALENDAR_ID}/events`;
    console.log("Fetching from:", apiUrl);

    const response = await fetch(apiUrl, {
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `Erro na API AddEvent: ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("API response keys:", Object.keys(data));

    // Map the API response to our event format
    const events = (data.data || data.events || data || []).map((event: any) => ({
      id: event.id || event.uid || crypto.randomUUID(),
      title: event.title || event.summary || event.name || "",
      description: event.description || event.notes || null,
      start: event.start_date || event.date_start || event.start || null,
      end: event.end_date || event.date_end || event.end || null,
      location: event.location || null,
      url: event.url || event.link || null,
      timezone: event.timezone || null,
    }));

    console.log("Parsed events:", events.length);

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
