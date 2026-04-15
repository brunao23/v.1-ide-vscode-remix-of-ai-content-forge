import { supabase } from '@/integrations/supabase/client';

function getErrorStatus(error: unknown): number | null {
  const anyError = error as any;
  const directStatus = Number(anyError?.status);
  if (Number.isFinite(directStatus) && directStatus > 0) {
    return directStatus;
  }

  const contextStatus = Number(anyError?.context?.status);
  if (Number.isFinite(contextStatus) && contextStatus > 0) {
    return contextStatus;
  }

  return null;
}

function isAuthLikeError(error: unknown): boolean {
  const status = getErrorStatus(error);
  if (status === 401 || status === 403) return true;

  const raw = String((error as any)?.message || '').toLowerCase();
  return (
    raw.includes('401') ||
    raw.includes('403') ||
    raw.includes('auth') ||
    raw.includes('token') ||
    raw.includes('jwt') ||
    raw.includes('expired') ||
    raw.includes('unauthorized')
  );
}

function normalizeFunctionError(functionName: string, error: unknown): string {
  const status = getErrorStatus(error);
  const message = String((error as any)?.message || '').trim();
  if (message) {
    return status
      ? `Falha na função ${functionName} (${status}): ${message}`
      : message;
  }
  return status
    ? `Falha na função ${functionName} (${status})`
    : `Falha na função ${functionName}`;
}

async function isAccessTokenValid(accessToken: string): Promise<boolean> {
  const { data, error } = await supabase.auth.getUser(accessToken);
  return Boolean(!error && data?.user?.id);
}

async function ensureValidSession(): Promise<void> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(`Falha ao validar sessão: ${error.message}`);
  }
  if (data.session?.access_token) {
    const valid = await isAccessTokenValid(data.session.access_token);
    if (valid) return;
  }

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  const refreshedToken = refreshed.session?.access_token;
  if (refreshError || !refreshedToken) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  const refreshedValid = await isAccessTokenValid(refreshedToken);
  if (!refreshedValid) {
    throw new Error('Sessão inválida. Faça logout e login novamente.');
  }
}

export async function invokeSupabaseFunctionWithRetry<T = unknown>(
  functionName: string,
  body?: Record<string, unknown>,
): Promise<T> {
  await ensureValidSession();

  const execute = async () => supabase.functions.invoke(functionName, { body });

  let { data, error } = await execute();

  if (error && isAuthLikeError(error)) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError && refreshed.session?.access_token) {
      ({ data, error } = await execute());
    }
  }

  if (error) {
    throw new Error(normalizeFunctionError(functionName, error));
  }

  return data as T;
}
