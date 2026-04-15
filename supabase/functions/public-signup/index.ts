import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServiceClient, HttpError } from "../_shared/auth-tenant.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizeEmail(value: string): string {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "Method not allowed");
    }

    const body = await req.json();
    const email = normalizeEmail(body?.email);
    const password = String(body?.password || "");
    const fullName = String(body?.fullName || "").trim();

    if (!email || !password) {
      throw new HttpError(400, "Email e senha sao obrigatorios");
    }
    if (!isValidEmail(email)) {
      throw new HttpError(400, "Email invalido");
    }
    if (password.length < 8) {
      throw new HttpError(400, "Senha deve ter ao menos 8 caracteres");
    }

    const supabase = getServiceClient();

    const createRes = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || undefined,
      },
    });

    if (createRes.error) {
      const message = createRes.error.message || "Falha ao criar usuario";

      if (message.toLowerCase().includes("already") || message.toLowerCase().includes("exists")) {
        throw new HttpError(409, "Ja existe uma conta com esse e-mail");
      }

      throw new HttpError(400, message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId: createRes.data.user?.id || null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    const status = error instanceof HttpError
      ? error.status
      : (typeof error?.status === "number" ? error.status : 500);

    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || "Erro interno no cadastro",
      }),
      {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
