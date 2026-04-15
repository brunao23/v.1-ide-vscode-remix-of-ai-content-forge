import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type RuntimeSecretRow = {
  key_name: string;
  secret_value: string;
  provider?: string | null;
};

let cache: {
  expiresAt: number;
  values: Record<string, string>;
} | null = null;

const CACHE_TTL_MS = 60_000;

function getSupabaseServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function fetchSecretsFromTable(
  keys: string[],
): Promise<Record<string, string>> {
  const supabase = getSupabaseServiceClient();
  if (!supabase || keys.length === 0) return {};

  const normalize = (value: string) =>
    String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "_");

  const providerKeyMap: Record<string, string[]> = {
    ANTHROPIC_API_KEY: ["ANTHROPIC"],
    OPENAI_API_KEY: ["OPENAI"],
    OPENROUTER_API_KEY: ["OPENROUTER"],
    PERPLEXITY_API_KEY: ["PERPLEXITY"],
    APIFY_API_TOKEN: ["APIFY"],
    PINECONE_API_KEY: ["PINECONE"],
  };

  const { data, error } = await supabase
    .from("internal_api_keys")
    .select("key_name, secret_value, provider")
    .eq("is_active", true);

  if (error || !data?.length) {
    if (error) {
      console.error("Failed to load internal_api_keys:", error.message);
    }
    return {};
  }

  const byNormalizedName = new Map<string, string>();
  const byNormalizedProvider = new Map<string, string>();

  for (const row of data as RuntimeSecretRow[]) {
    if (!row?.secret_value) continue;
    const normalizedName = normalize(row.key_name);
    if (normalizedName) {
      byNormalizedName.set(normalizedName, row.secret_value);
    }
    const normalizedProvider = normalize(String(row.provider || ""));
    if (normalizedProvider && !byNormalizedProvider.has(normalizedProvider)) {
      byNormalizedProvider.set(normalizedProvider, row.secret_value);
    }
  }

  const mapped: Record<string, string> = {};
  for (const key of keys) {
    const normalizedRequested = normalize(key);
    const exact = byNormalizedName.get(normalizedRequested);
    if (exact) {
      mapped[key] = exact;
      continue;
    }

    const providerCandidates = providerKeyMap[normalizedRequested] || [];
    for (const providerCandidate of providerCandidates) {
      const providerValue = byNormalizedProvider.get(providerCandidate);
      if (providerValue) {
        mapped[key] = providerValue;
        break;
      }
    }
  }

  return mapped;
}

export async function resolveRuntimeSecrets(
  keys: string[],
): Promise<Record<string, string>> {
  const requestedKeys = Array.from(
    new Set(keys.map((key) => String(key || "").trim()).filter(Boolean)),
  );

  if (requestedKeys.length === 0) return {};

  const now = Date.now();
  if (cache && now < cache.expiresAt) {
    const cachedSelection: Record<string, string> = {};
    for (const key of requestedKeys) {
      if (cache.values[key]) {
        cachedSelection[key] = cache.values[key];
      }
    }

    if (Object.keys(cachedSelection).length === requestedKeys.length) {
      return cachedSelection;
    }
  }

  const envSecrets: Record<string, string> = {};
  for (const key of requestedKeys) {
    const envValue = Deno.env.get(key);
    if (envValue) envSecrets[key] = envValue;
  }

  const tableSecrets = await fetchSecretsFromTable(requestedKeys);
  const resolved = { ...envSecrets, ...tableSecrets };

  cache = {
    expiresAt: now + CACHE_TTL_MS,
    values: resolved,
  };

  return resolved;
}
