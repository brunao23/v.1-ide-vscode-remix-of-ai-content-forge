import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Pinecone } from "npm:@pinecone-database/pinecone@3.0.2";
import { resolveRuntimeSecrets } from "../_shared/runtime-secrets.ts";
import { HttpError, resolveTenantForRequest } from "../_shared/auth-tenant.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function resolveTenantNamespace(basePrefix: string, tenantId: string): string {
  const cleanTenantId = tenantId.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const namespace = `${basePrefix}-tenant-${cleanTenantId}`;
  return namespace.slice(0, 63);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { user, tenantId } = await resolveTenantForRequest({
      req,
      body,
      allowImplicitDefault: true,
    });

    const { documentId, userId } = body;
    if (!documentId) {
      throw new Error("documentId is required");
    }

    const effectiveUserId = String(userId || user.id);
    if (effectiveUserId !== user.id) {
      throw new HttpError(403, "You cannot delete vectors for another user");
    }

    let runtimeSecrets: Record<string, string> = {};
    try {
      runtimeSecrets = await resolveRuntimeSecrets([
        "PINECONE_API_KEY",
        "PINECONE_INDEX",
        "PINECONE_NAMESPACE",
      ]);
    } catch (secretsError: any) {
      console.error("Failed to resolve Pinecone secrets:", secretsError);
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: "pinecone_secrets_unavailable",
          warning: secretsError?.message || "Could not resolve Pinecone secrets",
          documentId,
          userId: effectiveUserId,
          tenantId,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const pineconeApiKey = runtimeSecrets.PINECONE_API_KEY || null;
    const pineconeIndexName = runtimeSecrets.PINECONE_INDEX || null;
    const pineconeNamespacePrefix = runtimeSecrets.PINECONE_NAMESPACE ||
      "documentos";

    if (!pineconeApiKey || !pineconeIndexName) {
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: "pinecone_not_configured",
          warning: "PINECONE_API_KEY or PINECONE_INDEX is missing",
          documentId,
          userId: effectiveUserId,
          tenantId,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const namespace = resolveTenantNamespace(
      pineconeNamespacePrefix,
      String(tenantId),
    );

    try {
      const pinecone = new Pinecone({ apiKey: pineconeApiKey });
      const index = pinecone.index(pineconeIndexName).namespace(namespace);

      await index.deleteMany({
        document_id: { "$eq": String(documentId) },
        tenant_id: { "$eq": String(tenantId) },
        user_id: { "$eq": String(effectiveUserId) },
      });
    } catch (pineconeError: any) {
      console.error("Pinecone vector delete failed:", pineconeError);
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: "pinecone_delete_failed",
          warning: pineconeError?.message || "Failed to delete vectors in Pinecone",
          documentId,
          userId: effectiveUserId,
          tenantId,
          pineconeNamespace: namespace,
          pineconeIndex: pineconeIndexName,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        userId: effectiveUserId,
        tenantId,
        pineconeNamespace: namespace,
        pineconeIndex: pineconeIndexName,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      {
        status: error instanceof HttpError
          ? error.status
          : (typeof error?.status === "number" ? error.status : 500),
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
