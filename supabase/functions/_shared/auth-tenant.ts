import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type ServiceClient = ReturnType<typeof createClient>;

export function getServiceClient(): ServiceClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new HttpError(500, "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function extractBearerToken(req: Request): string {
  const header = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    throw new HttpError(401, "Missing bearer token");
  }
  return header.slice(7).trim();
}

export async function requireAuthenticatedUser(req: Request, supabase?: ServiceClient) {
  const client = supabase || getServiceClient();
  const token = extractBearerToken(req);
  const { data, error } = await client.auth.getUser(token);

  if (error || !data?.user) {
    throw new HttpError(401, "Invalid or expired auth token");
  }

  return data.user;
}

export async function isGlobalAdmin(client: ServiceClient, userId: string): Promise<boolean> {
  const { data, error } = await client.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  if (error) {
    throw new HttpError(500, `Failed to validate admin role: ${error.message}`);
  }

  return Boolean(data);
}

export async function requireGlobalAdmin(req: Request, supabase?: ServiceClient) {
  const client = supabase || getServiceClient();
  const user = await requireAuthenticatedUser(req, client);
  const allowed = await isGlobalAdmin(client, user.id);

  if (!allowed) {
    throw new HttpError(403, "Admin access required");
  }

  return user;
}

export async function userHasTenantAccess(
  client: ServiceClient,
  userId: string,
  tenantId: string,
): Promise<boolean> {
  const globalAdmin = await isGlobalAdmin(client, userId);
  if (globalAdmin) return true;

  const { data, error } = await client
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, `Failed to validate tenant membership: ${error.message}`);
  }

  return Boolean(data?.tenant_id);
}

export async function getDefaultTenantId(client: ServiceClient, userId: string): Promise<string | null> {
  const { data, error } = await client.rpc("get_default_tenant_id", { _user_id: userId });
  if (error) {
    throw new HttpError(500, `Failed to resolve default tenant: ${error.message}`);
  }
  return data ? String(data) : null;
}

export async function resolveTenantForRequest(params: {
  req: Request;
  body?: any;
  supabase?: ServiceClient;
  allowImplicitDefault?: boolean;
}) {
  const client = params.supabase || getServiceClient();
  const user = await requireAuthenticatedUser(params.req, client);
  const allowImplicitDefault = params.allowImplicitDefault !== false;

  const tenantFromBody = params.body?.tenantId || params.body?.tenant_id;
  const tenantFromHeader = params.req.headers.get("x-tenant-id");
  const requestedTenant = String(tenantFromBody || tenantFromHeader || "").trim() || null;

  let tenantId = requestedTenant;
  if (!tenantId && allowImplicitDefault) {
    tenantId = await getDefaultTenantId(client, user.id);
  }

  if (!tenantId) {
    throw new HttpError(400, "tenantId is required");
  }

  const allowed = await userHasTenantAccess(client, user.id, tenantId);
  if (!allowed) {
    throw new HttpError(403, "You do not have access to this tenant");
  }

  return { user, tenantId, supabase: client };
}

