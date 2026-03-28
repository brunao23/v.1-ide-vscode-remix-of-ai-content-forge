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
    const CALENDAR_ID = Deno.env.get("ADDEVENT_CALENDAR_ID");

    if (!CALENDAR_ID) {
      return new Response(
        JSON.stringify({ error: "ADDEVENT_CALENDAR_ID não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ICAL_URL = `https://www.addevent.com/calendar/${CALENDAR_ID}.ics`;
    const icalResponse = await fetch(ICAL_URL);

    if (!icalResponse.ok) {
      return new Response(
        JSON.stringify({ error: `Erro ao buscar calendário: ${icalResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const icalText = await icalResponse.text();
    console.log("iCal length:", icalText.length);
    console.log("iCal preview:", icalText.slice(0, 500));
    console.log("Contains VEVENT:", icalText.includes("BEGIN:VEVENT"));
    const events = parseICalToJSON(icalText);
    console.log("Parsed events count:", events.length);

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

function parseICalToJSON(icalText: string) {
  const events: any[] = [];
  const eventBlocks = icalText.split("BEGIN:VEVENT");

  for (let i = 1; i < eventBlocks.length; i++) {
    const block = eventBlocks[i].split("END:VEVENT")[0];

    // Unfold lines (RFC 5545: lines starting with space/tab are continuations)
    const unfolded = block.replace(/\r?\n[ \t]/g, "");

    const getField = (name: string): string | null => {
      const regex = new RegExp(`^${name}(?:;[^:]*)?:(.+)$`, "m");
      const match = unfolded.match(regex);
      return match ? match[1].replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\\\/g, "\\").trim() : null;
    };

    const parseICalDate = (dateStr: string | null): string | null => {
      if (!dateStr) return null;
      const clean = dateStr.replace(/[^0-9TZ]/g, "");
      if (clean.length < 8) return null;
      const year = clean.slice(0, 4);
      const month = clean.slice(4, 6);
      const day = clean.slice(6, 8);
      const hour = clean.length > 8 ? clean.slice(9, 11) || "00" : "00";
      const min = clean.length > 8 ? clean.slice(11, 13) || "00" : "00";
      return `${year}-${month}-${day}T${hour}:${min}:00`;
    };

    const title = getField("SUMMARY");
    const start = parseICalDate(getField("DTSTART"));

    if (title && start) {
      events.push({
        id: getField("UID") || `event-${i}`,
        title,
        description: getField("DESCRIPTION"),
        start,
        end: parseICalDate(getField("DTEND")),
        location: getField("LOCATION"),
        url: getField("URL"),
      });
    }
  }

  return events;
}
