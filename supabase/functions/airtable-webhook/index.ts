import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload = await req.json();
    const legacyTenantId = "00000000-0000-4000-8000-000000000001";

    // Support both single record and array
    const records = Array.isArray(payload) ? payload : [payload];

    for (const record of records) {
      const fields = record.fields || record;
      const userId = String(fields["user_id"] || fields["Client ID"] || "").trim();
      if (!userId) {
        return new Response(JSON.stringify({ error: "user_id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let tenantId = String(fields["tenant_id"] || fields["Tenant ID"] || "").trim();
      if (!tenantId) {
        const { data: defaultTenantId, error: defaultTenantError } = await supabase.rpc(
          "get_default_tenant_id",
          { _user_id: userId },
        );
        if (defaultTenantError) {
          console.error("Default tenant resolution error:", defaultTenantError);
        }
        tenantId = String(defaultTenantId || legacyTenantId);
      }

      const metrics = {
        tenant_id: tenantId,
        user_id: userId,
        period_month: parseInt(fields["period_month"] || fields["Month"]),
        period_year: parseInt(fields["period_year"] || fields["Year"]),
        total_new_revenue: fields["total_new_revenue"] ?? fields["Total NEW Revenue"] ?? null,
        total_cash_collected: fields["total_cash_collected"] ?? fields["Total Cash Collected"] ?? null,
        monthly_recurring_revenue: fields["monthly_recurring_revenue"] ?? fields["MRR"] ?? null,
        expenses: fields["expenses"] ?? fields["Expenses"] ?? null,
        profit: fields["profit"] ?? fields["Profit"] ?? null,
        ad_spend: fields["ad_spend"] ?? fields["Ad Spend"] ?? null,
        daily_ad_spend: fields["daily_ad_spend"] ?? fields["Daily Ad Spend"] ?? null,
        advertising_reach_ig: fields["advertising_reach_ig"] ?? fields["Advertising Reach (IG)"] ?? null,
        advertising_impressions_ig: fields["advertising_impressions_ig"] ?? fields["Advertising Impressions (IG)"] ?? null,
        cpm: fields["cpm"] ?? fields["CPM"] ?? null,
        roas: fields["roas"] ?? fields["ROAS"] ?? null,
        short_form_channel_size: fields["short_form_channel_size"] ?? fields["Short Form Channel Size"] ?? null,
        total_reach_ig_impressions_li: fields["total_reach_ig_impressions_li"] ?? fields["Total Reach / Impressions"] ?? null,
        total_posts_made: fields["total_posts_made"] ?? fields["Total Posts Made"] ?? null,
        long_form_channel_size: fields["long_form_channel_size"] ?? fields["Long Form Channel Size"] ?? null,
        long_form_monthly_audience: fields["long_form_monthly_audience"] ?? fields["Long Form Monthly Audience"] ?? null,
        youtube_total_views: fields["youtube_total_views"] ?? fields["YouTube Total Views"] ?? null,
        youtube_total_hours: fields["youtube_total_hours"] ?? fields["YouTube Total Hours"] ?? null,
        total_videos_podcasts_made: fields["total_videos_podcasts_made"] ?? fields["Total Videos/Podcasts Made"] ?? null,
        email_list_size: fields["email_list_size"] ?? fields["Email List Size"] ?? null,
        new_subscribers: fields["new_subscribers"] ?? fields["New Subscribers"] ?? null,
        net_new_subscribers: fields["net_new_subscribers"] ?? fields["Net New Subscribers"] ?? null,
        new_clients: fields["new_clients"] ?? fields["New Clients"] ?? null,
      };

      const { error } = await supabase
        .from("client_metrics")
        .upsert(metrics, { onConflict: "tenant_id,user_id,period_month,period_year" });

      if (error) {
        console.error("Upsert error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
