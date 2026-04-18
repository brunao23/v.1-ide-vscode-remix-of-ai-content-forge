import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Pinecone } from "npm:@pinecone-database/pinecone@3.0.2";
import { resolveRuntimeSecrets } from "../_shared/runtime-secrets.ts";
import { HttpError, resolveTenantForRequest } from "../_shared/auth-tenant.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 150;

function resolveNamespace(
  basePrefix: string,
  tenantId: string,
  scope: "user" | "system",
): string {
  if (scope === "system") {
    return `${basePrefix}-system`.slice(0, 63);
  }
  const cleanTenantId = tenantId.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return `${basePrefix}-tenant-${cleanTenantId}`.slice(0, 63);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let currentDocumentId: string | null = null;

  try {
    const runtimeSecrets = await resolveRuntimeSecrets([
      "OPENAI_API_KEY",
      "OPENAI_EMBEDDING_MODEL",
      "PINECONE_API_KEY",
      "PINECONE_INDEX",
      "PINECONE_NAMESPACE",
    ]);
    const openaiKey = runtimeSecrets.OPENAI_API_KEY || null;
    if (!openaiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const pineconeApiKey = runtimeSecrets.PINECONE_API_KEY || null;
    const pineconeIndexName = runtimeSecrets.PINECONE_INDEX || null;
    const pineconeNamespacePrefix = runtimeSecrets.PINECONE_NAMESPACE ||
      "documentos";
    const pineconeConfigured = Boolean(pineconeApiKey && pineconeIndexName);

    const embeddingModel = runtimeSecrets.OPENAI_EMBEDDING_MODEL ||
      "text-embedding-3-small";

    const body = await req.json();
    const authContext = await resolveTenantForRequest({
      req,
      body,
      supabase,
      allowImplicitDefault: true,
    });

    const authenticatedUserId = authContext.user.id;
    const tenantId = authContext.tenantId;

    const {
      documentId,
      content,
      userId,
      documentType,
      agentDocument,
      agentId,
      documentScope,
    } = body;

    currentDocumentId = String(documentId || "");

    if (!documentId || !content) {
      throw new Error(
        "Missing required fields: documentId, content",
      );
    }

    const effectiveUserId = String(userId || authenticatedUserId);
    if (effectiveUserId !== authenticatedUserId) {
      throw new HttpError(403, "You cannot process documents for another user");
    }

    await supabase
      .from("documents")
      .update({
        processing_status: "processing",
        processing_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId)
      .eq("user_id", effectiveUserId)
      .eq("tenant_id", tenantId);

    const chunks = splitIntoChunks(content, CHUNK_SIZE, CHUNK_OVERLAP);
    if (chunks.length === 0) {
      throw new Error("Document content is empty");
    }

    const namespace = resolveNamespace(
      pineconeNamespacePrefix,
      String(tenantId),
      documentScope === "system" ? "system" : "user",
    );
    const pinecone = pineconeConfigured
      ? new Pinecone({ apiKey: pineconeApiKey! })
      : null;
    const index = pineconeConfigured && pinecone && pineconeIndexName
      ? pinecone.index(pineconeIndexName).namespace(namespace)
      : null;

    let pineconeWarning: string | null = null;

    // Generate embeddings in batches
    const batchSize = 100;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const embeddingsResponse = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: embeddingModel,
          input: batch,
        }),
      });

      if (!embeddingsResponse.ok) {
        const errText = await embeddingsResponse.text();
        console.error("OpenAI embeddings error:", errText);
        throw new Error(
          `OpenAI embeddings error: ${embeddingsResponse.status}`,
        );
      }

      const embData = await embeddingsResponse.json();
      for (const item of embData.data) {
        allEmbeddings.push(item.embedding);
      }
    }

    // Track OpenAI embedding call in token_usage
    const totalEmbedTokens = chunks.reduce((s, c) => s + estimateTokens(c), 0);
    const embCostUsd = (totalEmbedTokens / 1_000_000) * 0.02;
    supabase.from("token_usage").insert({
      tenant_id: tenantId,
      user_id: effectiveUserId,
      model_id: embeddingModel,
      provider: "openai",
      agent_id: agentId || null,
      input_tokens: totalEmbedTokens,
      output_tokens: 0,
      cost_usd: Number(embCostUsd.toFixed(8)),
      tool_call_count: 0,
      rag_docs_retrieved: chunks.length,
    }).then(({ error }: { error: any }) => {
      if (error) console.error("[TokenUsage] Embedding insert failed:", error.message);
      else console.log(`[TokenUsage] Embedding tracked: chunks=${chunks.length} tokens=${totalEmbedTokens}`);
    });

    // Clear previous chunks/vectors for reprocessing
    await supabase
      .from("document_chunks")
      .delete()
      .eq("document_id", documentId);

    if (index) {
      try {
        await index.deleteMany({
          document_id: { "$eq": String(documentId) },
          user_id: { "$eq": String(effectiveUserId) },
          tenant_id: { "$eq": String(tenantId) },
        });
      } catch (error: any) {
        console.error("Pinecone deleteMany warning:", error);
        pineconeWarning = error?.message || "Falha ao limpar vetores anteriores";
      }
    } else {
      pineconeWarning = "Pinecone não configurado. Indexação vetorial em fallback SQL.";
    }

    const normalizedType = String(documentType || "outro");
    const isAgentDocument = Boolean(agentDocument);
    const scope = documentScope === "system" ? "system" : "user";

    // Insert chunks in DB (fallback and audit)
    const chunksToInsert = chunks.map((chunkContent, chunkIndex) => ({
      document_id: documentId,
      user_id: effectiveUserId,
      tenant_id: tenantId,
      content: chunkContent,
      chunk_index: chunkIndex,
      embedding: JSON.stringify(allEmbeddings[chunkIndex]),
      tokens: estimateTokens(chunkContent),
    }));

    for (let i = 0; i < chunksToInsert.length; i += 50) {
      const batch = chunksToInsert.slice(i, i + 50);
      const { error: insertError } = await supabase
        .from("document_chunks")
        .insert(batch);

      if (insertError) {
        console.error("Insert chunk error:", insertError);
        throw new Error(`Failed to insert chunks: ${insertError.message}`);
      }
    }

    // Upsert vectors in Pinecone (best-effort)
    const vectors = chunks.map((chunkContent, chunkIndex) => ({
      id: `${tenantId}:${effectiveUserId}:${documentId}:${chunkIndex}`,
      values: allEmbeddings[chunkIndex],
      metadata: {
        scope,
        tenant_id: String(tenantId),
        user_id: String(effectiveUserId),
        document_id: String(documentId),
        document_type: normalizedType,
        agent_document: isAgentDocument,
        agent_id: agentId ? String(agentId) : "none",
        chunk_index: chunkIndex,
        content: chunkContent,
      },
    }));

    let pineconeVectorsUpserted = 0;
    if (index) {
      try {
        for (let i = 0; i < vectors.length; i += 50) {
          const batch = vectors.slice(i, i + 50);
          await index.upsert(batch);
          pineconeVectorsUpserted += batch.length;
        }
      } catch (error: any) {
        console.error("Pinecone upsert warning:", error);
        pineconeWarning = error?.message || "Falha ao sincronizar vetores no Pinecone";
      }
    }

    await supabase
      .from("documents")
      .update({
        updated_at: new Date().toISOString(),
        processing_status: "ready",
        processing_error: null,
      })
      .eq("id", documentId)
      .eq("user_id", effectiveUserId)
      .eq("tenant_id", tenantId);

    return new Response(
      JSON.stringify({
        success: true,
        chunksCreated: chunks.length,
        pineconeEnabled: pineconeConfigured,
        pineconeVectorsUpserted,
        pineconeNamespace: namespace,
        pineconeIndex: pineconeIndexName,
        warning: pineconeWarning,
        tenantId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Process document error:", error);

    if (currentDocumentId) {
      await supabase
        .from("documents")
        .update({
          processing_status: "error",
          processing_error: error?.message || "Erro ao indexar documento",
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentDocumentId);
    }

    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: error instanceof HttpError
          ? error.status
          : (typeof error?.status === "number" ? error.status : 500),
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

function splitIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const chunks: string[] = [];
  let i = 0;

  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    if (chunk.trim()) {
      chunks.push(chunk.trim());
    }
    i += chunkSize - overlap;
    if (i >= words.length && chunks.length === 0) break;
  }

  return chunks;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}
