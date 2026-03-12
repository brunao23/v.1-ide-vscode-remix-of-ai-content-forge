import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sheet_url } = await req.json();
    if (!sheet_url) {
      return new Response(JSON.stringify({ error: "sheet_url is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch CSV from published Google Sheet
    const csvResponse = await fetch(sheet_url);
    if (!csvResponse.ok) {
      throw new Error(`Failed to fetch sheet: ${csvResponse.status}`);
    }
    const csvText = await csvResponse.text();

    // Parse CSV
    const lines = csvText.split("\n").filter((l) => l.trim());
    if (lines.length < 2) {
      return new Response(JSON.stringify({ error: "Sheet is empty" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
    const tasks = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = (values[idx] || "").trim();
      });

      // Expected columns: month_title, month_order, week_title, week_order, task_title, task_order, status, tags, tag_colors, url
      if (!row.task_title && !row.month_title) continue;

      tasks.push({
        month_title: row.month_title || "Sem mês",
        month_order: parseInt(row.month_order) || 0,
        week_title: row.week_title || null,
        week_order: parseInt(row.week_order) || 0,
        task_title: row.task_title || "Sem título",
        task_order: parseInt(row.task_order) || i,
        status: row.status || "not-started",
        tags: row.tags ? row.tags.split("|").map((t: string) => t.trim()) : [],
        tag_colors: row.tag_colors
          ? row.tag_colors.split("|").map((c: string) => c.trim())
          : [],
        url: row.url || null,
      });
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Clear existing and insert new
    const { error: deleteError } = await supabase
      .from("implementation_tasks")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all

    if (deleteError) throw deleteError;

    if (tasks.length > 0) {
      const { error: insertError } = await supabase
        .from("implementation_tasks")
        .insert(tasks);
      if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({ success: true, count: tasks.length }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
