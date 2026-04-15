import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import mammoth from "npm:mammoth@1.8.0";
import pdfParse from "npm:pdf-parse@1.1.1";
import { Buffer } from "node:buffer";
import {
  HttpError,
  resolveTenantForRequest,
} from "../_shared/auth-tenant.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_FILE_BYTES = 8 * 1024 * 1024;

function extractExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? `.${parts[parts.length - 1]}` : "";
}

function decodeBase64ToBytes(input: string): Uint8Array {
  const cleanBase64 = input.includes(",") ? input.split(",")[1] : input;
  const binary = atob(cleanBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractText(params: {
  extension: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<string> {
  const { extension, mimeType, bytes } = params;

  if (extension === ".txt" || extension === ".md" || mimeType.startsWith("text/")) {
    return new TextDecoder().decode(bytes);
  }

  if (
    extension === ".docx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({
      arrayBuffer: bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ),
    });
    return result.value || "";
  }

  if (extension === ".pdf" || mimeType === "application/pdf") {
    const result = await pdfParse(Buffer.from(bytes));
    return result.text || "";
  }

  throw new Error("Formato nao suportado. Use .pdf, .docx, .md ou .txt");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    await resolveTenantForRequest({
      req,
      body,
      allowImplicitDefault: true,
    });

    const fileName = String(body?.fileName || "").trim();
    const mimeType = String(body?.mimeType || "application/octet-stream").trim();
    const fileBase64 = String(body?.fileBase64 || "").trim();

    if (!fileName || !fileBase64) {
      throw new Error("fileName and fileBase64 are required");
    }

    const extension = extractExtension(fileName);
    const bytes = decodeBase64ToBytes(fileBase64);

    if (bytes.byteLength === 0) {
      throw new Error("Arquivo vazio");
    }
    if (bytes.byteLength > MAX_FILE_BYTES) {
      throw new Error("Arquivo maior que 8MB. Divida em partes menores.");
    }

    const extractedText = await extractText({
      extension,
      mimeType,
      bytes,
    });
    const normalized = normalizeText(extractedText);

    if (!normalized) {
      throw new Error("Nao foi possivel extrair texto do arquivo");
    }

    return new Response(
      JSON.stringify({
        success: true,
        content: normalized,
        chars: normalized.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Erro ao extrair conteudo do arquivo",
      }),
      {
        status: error instanceof HttpError
          ? error.status
          : (typeof error?.status === "number" ? error.status : 400),
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
