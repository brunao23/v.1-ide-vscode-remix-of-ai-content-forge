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

    if (!API_KEY || !CALENDAR_ID) {
      return new Response(
        JSON.stringify({ error: "ADDEVENT_API_KEY ou ADDEVENT_CALENDAR_ID não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try AddEvent API v2
    const eventsUrl = `https://api.addevent.com/calevent/v2/calendars/${CALENDAR_ID}/events`;
    const eventsRes = await fetch(eventsUrl, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        Accept: "application/json",
      },
    });

    if (!eventsRes.ok) {
      const errText = await eventsRes.text();
      let errMsg = `AddEvent API retornou status ${eventsRes.status}`;
      
      try {
        const errJson = JSON.parse(errText);
        if (errJson.error_message) {
          errMsg = errJson.error_message;
          if (errMsg.includes("plan does not allow")) {
            errMsg = "O plano da sua conta AddEvent não permite acesso à API. Faça upgrade do plano no dashboard do AddEvent ou torne o calendário público para usar o feed iCal.";
          }
        }
      } catch {}

      // Fallback: try iCal feed (public calendar)
      console.log("API failed, trying iCal feed...");
      const icalUrl = `https://www.addevent.com/calendar/${CALENDAR_ID}.ics`;
      const icalRes = await fetch(icalUrl);
      const icalText = await icalRes.text();

      if (icalText.includes("BEGIN:VCALENDAR")) {
        const events = parseICalToJSON(icalText);
        return new Response(JSON.stringify(events), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If calendar is not public, return empty array gracefully
      if (icalText.includes("unavailable to view")) {
        console.log("Calendar is not public, returning empty array");
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ error: errMsg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await eventsRes.json();
    const rawEvents = data.data || data.events || [];
    const events = rawEvents.map((e: any) => ({
      id: String(e.id || crypto.randomUUID()),
      title: e.title || e.summary || e.name || "",
      description: e.description || e.notes || null,
      start: e.date_start || e.start_date || e.start || null,
      end: e.date_end || e.end_date || e.end || null,
      location: e.location || null,
      url: e.url || e.link || null,
      timezone: e.timezone || null,
    })).filter((e: any) => e.title);

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
    const unfolded = block.replace(/\r?\n[ \t]/g, "");

    const getField = (name: string): string | null => {
      const regex = new RegExp(`^${name}(?:;[^:]*)?:(.+)$`, "m");
      const match = unfolded.match(regex);
      return match ? match[1].replace(/\\n/g, "\n").replace(/\\,/g, ",").trim() : null;
    };

    const parseDate = (s: string | null): string | null => {
      if (!s) return null;
      const c = s.replace(/[^0-9TZ]/g, "");
      if (c.length < 8) return null;
      return `${c.slice(0,4)}-${c.slice(4,6)}-${c.slice(6,8)}T${c.slice(9,11)||"00"}:${c.slice(11,13)||"00"}:00`;
    };

    const title = getField("SUMMARY");
    const start = parseDate(getField("DTSTART"));
    if (title && start) {
      events.push({
        id: getField("UID") || `event-${i}`,
        title,
        description: getField("DESCRIPTION"),
        start,
        end: parseDate(getField("DTEND")),
        location: getField("LOCATION"),
        url: getField("URL"),
      });
    }
  }
  return events;
}
