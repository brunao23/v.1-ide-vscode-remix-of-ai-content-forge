import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  HttpError,
  getServiceClient,
  requireGlobalAdmin,
} from "../_shared/auth-tenant.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Action =
  | "listOverview"
  | "listTenantUsers"
  | "listGlobalAdmins"
  | "createTenant"
  | "createUser"
  | "setMembership";

function slugify(input: string): string {
  return String(input || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function listOverview(supabase: ReturnType<typeof getServiceClient>) {
  const [{ data: tenants, error: tenantsError }, { data: memberships, error: membershipsError }] =
    await Promise.all([
      supabase
        .from("tenants")
        .select("id, slug, name, is_active, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("tenant_memberships")
        .select("tenant_id, user_id, role, is_active"),
    ]);

  if (tenantsError) throw new HttpError(500, tenantsError.message);
  if (membershipsError) throw new HttpError(500, membershipsError.message);

  const membershipsByTenant = new Map<string, { users: Set<string>; activeUsers: Set<string>; owners: number }>();
  for (const row of memberships || []) {
    const key = String(row.tenant_id);
    if (!membershipsByTenant.has(key)) {
      membershipsByTenant.set(key, {
        users: new Set<string>(),
        activeUsers: new Set<string>(),
        owners: 0,
      });
    }
    const bucket = membershipsByTenant.get(key)!;
    bucket.users.add(String(row.user_id));
    if (row.is_active) {
      bucket.activeUsers.add(String(row.user_id));
    }
    if (String(row.role) === "owner") {
      bucket.owners += 1;
    }
  }

  return (tenants || []).map((tenant) => {
    const stats = membershipsByTenant.get(String(tenant.id));
    return {
      ...tenant,
      users_count: stats?.users.size || 0,
      active_users_count: stats?.activeUsers.size || 0,
      owners_count: stats?.owners || 0,
    };
  });
}

async function listTenantUsers(
  supabase: ReturnType<typeof getServiceClient>,
  tenantId: string,
) {
  if (!tenantId) throw new HttpError(400, "tenantId is required");

  const { data: memberships, error } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, user_id, role, is_active, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  if (error) throw new HttpError(500, error.message);

  const usersResponse = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (usersResponse.error) {
    throw new HttpError(500, usersResponse.error.message);
  }

  const usersById = new Map(
    (usersResponse.data?.users || []).map((user) => [user.id, user]),
  );

  const membershipUserIds = (memberships || []).map((membership) => String(membership.user_id));
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("user_id, full_name, avatar_url, default_tenant_id")
    .in("user_id", membershipUserIds.length > 0 ? membershipUserIds : ["00000000-0000-0000-0000-000000000000"]);

  const profilesById = new Map((profiles || []).map((profile) => [String(profile.user_id), profile]));

  return (memberships || []).map((membership) => {
    const userId = String(membership.user_id);
    const authUser = usersById.get(userId);
    const profile = profilesById.get(userId);
    return {
      user_id: userId,
      email: authUser?.email || null,
      full_name: profile?.full_name || authUser?.user_metadata?.full_name || null,
      avatar_url: profile?.avatar_url || null,
      role: membership.role,
      is_active: membership.is_active,
      created_at: membership.created_at,
      default_tenant_id: profile?.default_tenant_id || null,
    };
  });
}

async function listGlobalAdmins(supabase: ReturnType<typeof getServiceClient>) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");

  if (error) throw new HttpError(500, error.message);

  const uniqueIds = Array.from(new Set((data || []).map((row) => String(row.user_id))));
  return uniqueIds;
}

async function createTenant(
  supabase: ReturnType<typeof getServiceClient>,
  body: any,
  requesterId: string,
) {
  const name = String(body?.name || "").trim();
  const slug = slugify(String(body?.slug || name));
  const ownerUserId = String(body?.ownerUserId || "").trim() || null;

  if (!name) throw new HttpError(400, "name is required");
  if (!slug) throw new HttpError(400, "slug is required");

  const { data: tenant, error } = await supabase
    .from("tenants")
    .insert({
      name,
      slug,
      created_by: requesterId,
    })
    .select("id, name, slug, is_active, created_at")
    .single();

  if (error || !tenant) throw new HttpError(500, error?.message || "Failed to create tenant");

  if (ownerUserId) {
    const { error: membershipError } = await supabase
      .from("tenant_memberships")
      .upsert({
        tenant_id: tenant.id,
        user_id: ownerUserId,
        role: "owner",
        is_active: true,
        created_by: requesterId,
      }, { onConflict: "tenant_id,user_id" });

    if (membershipError) {
      throw new HttpError(500, membershipError.message);
    }

    await supabase
      .from("user_profiles")
      .upsert({
        user_id: ownerUserId,
        default_tenant_id: tenant.id,
      }, { onConflict: "user_id" });
  }

  return tenant;
}

async function createUser(
  supabase: ReturnType<typeof getServiceClient>,
  body: any,
  requesterId: string,
) {
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "").trim();
  const fullName = String(body?.fullName || "").trim();
  const tenantId = String(body?.tenantId || "").trim();
  const role = String(body?.role || "member");

  if (!email || !password || !tenantId) {
    throw new HttpError(400, "email, password and tenantId are required");
  }
  if (!["owner", "admin", "member", "viewer"].includes(role)) {
    throw new HttpError(400, "Invalid tenant role");
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant?.id) {
    throw new HttpError(404, "Tenant not found");
  }

  const userResponse = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName || undefined,
    },
  });

  if (userResponse.error || !userResponse.data?.user) {
    throw new HttpError(500, userResponse.error?.message || "Failed to create auth user");
  }

  const newUser = userResponse.data.user;

  const { error: profileError } = await supabase
    .from("user_profiles")
    .upsert({
      user_id: newUser.id,
      full_name: fullName || null,
      default_tenant_id: tenantId,
    }, { onConflict: "user_id" });

  if (profileError) throw new HttpError(500, profileError.message);

  const { error: membershipError } = await supabase
    .from("tenant_memberships")
    .upsert({
      tenant_id: tenantId,
      user_id: newUser.id,
      role,
      is_active: true,
      created_by: requesterId,
    }, { onConflict: "tenant_id,user_id" });

  if (membershipError) throw new HttpError(500, membershipError.message);

  return {
    user_id: newUser.id,
    email: newUser.email,
    tenant_id: tenantId,
    role,
  };
}

async function setMembership(
  supabase: ReturnType<typeof getServiceClient>,
  body: any,
  requesterId: string,
) {
  const tenantId = String(body?.tenantId || "").trim();
  const userId = String(body?.userId || "").trim();
  const role = String(body?.role || "member").trim();
  const isActive = body?.isActive !== false;

  if (!tenantId || !userId) {
    throw new HttpError(400, "tenantId and userId are required");
  }
  if (!["owner", "admin", "member", "viewer"].includes(role)) {
    throw new HttpError(400, "Invalid tenant role");
  }

  const { error } = await supabase
    .from("tenant_memberships")
    .upsert({
      tenant_id: tenantId,
      user_id: userId,
      role,
      is_active: isActive,
      created_by: requesterId,
    }, { onConflict: "tenant_id,user_id" });

  if (error) throw new HttpError(500, error.message);

  return { tenant_id: tenantId, user_id: userId, role, is_active: isActive };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getServiceClient();
    const requester = await requireGlobalAdmin(req, supabase);
    const body = await req.json();
    const action = String(body?.action || "listOverview") as Action;

    let result: unknown;
    if (action === "listOverview") {
      result = await listOverview(supabase);
    } else if (action === "listTenantUsers") {
      result = await listTenantUsers(supabase, String(body?.tenantId || ""));
    } else if (action === "listGlobalAdmins") {
      result = await listGlobalAdmins(supabase);
    } else if (action === "createTenant") {
      result = await createTenant(supabase, body, requester.id);
    } else if (action === "createUser") {
      result = await createUser(supabase, body, requester.id);
    } else if (action === "setMembership") {
      result = await setMembership(supabase, body, requester.id);
    } else {
      throw new HttpError(400, "Invalid action");
    }

    return new Response(
      JSON.stringify({ success: true, action, data: result }),
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
        error: error?.message || "Internal error",
      }),
      {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
