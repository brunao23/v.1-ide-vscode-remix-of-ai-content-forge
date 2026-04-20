import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const ACTIVE_TENANT_STORAGE_KEY = "gemz_active_tenant_id_v2";

export type TenantRole = "owner" | "admin" | "member" | "viewer";

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  role: TenantRole;
  isActive: boolean;
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  activeTenant: TenantSummary | null;
  tenants: TenantSummary[];
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (params: {
    fullName: string;
    email: string;
    password: string;
  }) => Promise<{ error: Error | null; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function toTenantSummary(row: any): TenantSummary {
  return {
    id: String(row.tenant_id),
    name: String(row.tenants?.name || row.tenant_id),
    slug: String(row.tenants?.slug || ""),
    role: String(row.role || "member") as TenantRole,
    isActive: Boolean(row.is_active),
  };
}

async function loadUserState(authUser: User) {
  const [profileRes, membershipsRes, adminRoleRes] = await Promise.all([
    (supabase as any)
      .from("user_profiles")
      .select("full_name, avatar_url, default_tenant_id")
      .eq("user_id", authUser.id)
      .maybeSingle(),
    (supabase as any)
      .from("tenant_memberships")
      .select("tenant_id, role, is_active, tenants:tenant_id(id, name, slug, is_active)")
      .eq("user_id", authUser.id)
      .eq("is_active", true),
    supabase.rpc("has_role", { _user_id: authUser.id, _role: "admin" }),
  ]);

  const profile = profileRes.data || null;
  const memberships = (membershipsRes.data || []).map(toTenantSummary);
  const isGlobalAdmin = Boolean(adminRoleRes.data);
  let resolvedTenants = memberships;

  // Global admin may not be explicitly attached to tenant_memberships.
  // In this case, load available tenants to avoid a "Sem tenant" state.
  if (resolvedTenants.length === 0 && isGlobalAdmin) {
    const adminTenantsRes = await (supabase as any)
      .from("tenants")
      .select("id, name, slug, is_active")
      .eq("is_active", true)
      .limit(50);

    if (!adminTenantsRes.error) {
      resolvedTenants = (adminTenantsRes.data || []).map((row: any) => ({
        id: String(row.id),
        name: String(row.name || row.id),
        slug: String(row.slug || ""),
        role: "admin" as TenantRole,
        isActive: Boolean(row.is_active),
      }));
    }
  }

  const profileName = String(
    profile?.full_name ||
      authUser.user_metadata?.full_name ||
      authUser.user_metadata?.name ||
      authUser.email?.split("@")[0] ||
      "Usuario",
  );
  const avatarUrl = profile?.avatar_url || authUser.user_metadata?.avatar_url || null;

  const localPreferredTenant = localStorage.getItem(ACTIVE_TENANT_STORAGE_KEY);
  const defaultTenantFromProfile = profile?.default_tenant_id
    ? String(profile.default_tenant_id)
    : null;

  let activeTenantId =
    (localPreferredTenant && resolvedTenants.find((tenant) => tenant.id === localPreferredTenant)?.id) ||
    (defaultTenantFromProfile && resolvedTenants.find((tenant) => tenant.id === defaultTenantFromProfile)?.id) ||
    resolvedTenants[0]?.id ||
    null;

  if (activeTenantId) {
    localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, activeTenantId);
  } else {
    localStorage.removeItem(ACTIVE_TENANT_STORAGE_KEY);
  }

  const activeTenant = activeTenantId
    ? resolvedTenants.find((tenant) => tenant.id === activeTenantId) || null
    : null;

  return {
    user: {
      id: authUser.id,
      email: String(authUser.email || ""),
      name: profileName,
      avatarUrl,
    } as AppUser,
    tenants: resolvedTenants,
    activeTenant,
    // "isAdmin" in app UI means global/super admin only.
    // Tenant owner/admin should not gain access to platform-level admin panel.
    isAdmin: isGlobalAdmin,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [activeTenant, setActiveTenant] = useState<TenantSummary | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const clearClientAuthState = useCallback(async () => {
    localStorage.removeItem(ACTIVE_TENANT_STORAGE_KEY);
    try {
      await supabase.auth.signOut({ scope: "local" as any });
    } catch {
      // no-op: still clear local app state below
    }
    setSession(null);
    setUser(null);
    setTenants([]);
    setActiveTenant(null);
    setIsAdmin(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    const authUser = session?.user;
    if (!authUser) {
      setUser(null);
      setTenants([]);
      setActiveTenant(null);
      setIsAdmin(false);
      return;
    }

    const state = await loadUserState(authUser);
    setUser(state.user);
    setTenants(state.tenants);
    setActiveTenant(state.activeTenant);
    setIsAdmin(state.isAdmin);
  }, [session?.user]);

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) {
        setLoading(false);
      }
      // Se há sessão, o segundo effect cuida do loading após carregar o perfil
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let canceled = false;

    const sync = async () => {
      if (!session?.user) {
        if (!canceled) {
          setUser(null);
          setTenants([]);
          setActiveTenant(null);
          setIsAdmin(false);
          // loading já tratado pelo primeiro effect via getSession quando não há sessão
        }
        return;
      }

      try {
        const { data: checkedUser, error: checkedUserError } = await supabase.auth.getUser();
        if (checkedUserError || !checkedUser?.user) {
          if (!canceled) {
            await clearClientAuthState();
            setLoading(false);
          }
          return;
        }

        const nextState = await loadUserState(checkedUser.user);
        if (!canceled) {
          setUser(nextState.user);
          setTenants(nextState.tenants);
          setActiveTenant(nextState.activeTenant);
          setIsAdmin(nextState.isAdmin);
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    };

    setLoading(true);
    void sync();
    return () => {
      canceled = true;
    };
  }, [session?.user?.id, clearClientAuthState]);

  const signIn = useCallback(async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const rawPassword = password;

    const loginAttempt = async (attemptPassword: string) =>
      supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: attemptPassword,
      });

    let { error } = await loginAttempt(rawPassword);
    const firstErrorMessage = String(error?.message || "").toLowerCase();

    // Recupera estado local quando houve troca de projeto/chaves e a sessao antiga ficou invalida.
    if (error && firstErrorMessage.includes("invalid login credentials")) {
      try {
        await supabase.auth.signOut({ scope: "local" as any });
      } catch {
        // no-op
      }
      ({ error } = await loginAttempt(rawPassword));
    }

    // Fallback para casos de copiar/colar senha com espaco no inicio/fim.
    if (error && rawPassword !== rawPassword.trim()) {
      ({ error } = await loginAttempt(rawPassword.trim()));
    }

    return { error: error as Error | null };
  }, []);

  const signUp = useCallback(
    async (params: { fullName: string; email: string; password: string }) => {
      const normalizedEmail = params.email.trim().toLowerCase();
      const normalizedName = params.fullName.trim();

      const { data, error } = await supabase.functions.invoke("public-signup", {
        body: {
          fullName: normalizedName,
          email: normalizedEmail,
          password: params.password,
        },
      });

      if (error) {
        return { error: error as Error, needsEmailConfirmation: false };
      }
      if (!data?.success) {
        return {
          error: new Error(String(data?.error || "Falha ao criar conta")),
          needsEmailConfirmation: false,
        };
      }

      const login = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: params.password,
      });

      if (login.error) {
        return {
          error: login.error as Error,
          needsEmailConfirmation: false,
        };
      }

      return {
        error: null,
        needsEmailConfirmation: false,
      };
    },
    [],
  );

  const signOut = useCallback(async () => {
    localStorage.removeItem(ACTIVE_TENANT_STORAGE_KEY);
    await supabase.auth.signOut({ scope: "local" as any });
  }, []);

  const switchTenant = useCallback(async (tenantId: string) => {
    if (!tenantId || !session?.user) return;

    let nextTenant = tenants.find((tenant) => tenant.id === tenantId) || null;

    if (!nextTenant && isAdmin) {
      const { data } = await (supabase as any)
        .from("tenants")
        .select("id, name, slug")
        .eq("id", tenantId)
        .maybeSingle();

      if (data?.id) {
        nextTenant = {
          id: String(data.id),
          name: String(data.name),
          slug: String(data.slug || ""),
          role: "admin",
          isActive: true,
        };
      }
    }

    if (!nextTenant) return;

    localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, nextTenant.id);
    setActiveTenant(nextTenant);

    await (supabase as any)
      .from("user_profiles")
      .upsert({
        user_id: session.user.id,
        default_tenant_id: nextTenant.id,
      }, { onConflict: "user_id" });
  }, [session?.user, tenants, isAdmin]);

  const value: AuthContextType = useMemo(() => ({
    user,
    session,
    loading,
    isAuthenticated: Boolean(user && session),
    isAdmin,
    activeTenant,
    tenants,
    signIn,
    signUp,
    signOut,
    switchTenant,
    refreshProfile,
  }), [
    user,
    session,
    loading,
    isAdmin,
    activeTenant,
    tenants,
    signIn,
    signUp,
    signOut,
    switchTenant,
    refreshProfile,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
