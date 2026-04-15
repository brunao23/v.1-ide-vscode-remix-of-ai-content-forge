import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

function loadEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'tenant';
}

const projectRoot = process.cwd();
const fnEnvPath = path.join(projectRoot, 'supabase', 'functions', '.env');
const rootEnvPath = path.join(projectRoot, '.env');
const fnEnv = loadEnvFile(fnEnvPath);
const rootEnv = loadEnvFile(rootEnvPath);

const supabaseUrl = fnEnv.SUPABASE_URL || rootEnv.VITE_SUPABASE_URL;
const serviceRoleKey = fnEnv.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const email = process.argv[2] || 'admin@gemz.ai';
const password = process.argv[3] || 'Gemz@2026!';
const fullName = process.argv[4] || 'Administrador GEMZ';
const tenantName = process.argv[5] || 'Conta Principal';
const tenantSlug = slugify(tenantName);

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  let userId;

  const usersRes = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersRes.error) throw usersRes.error;

  const existing = (usersRes.data.users || []).find((u) => (u.email || '').toLowerCase() === email.toLowerCase());

  if (existing) {
    userId = existing.id;
    await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: {
        ...(existing.user_metadata || {}),
        full_name: fullName,
      },
    });
    console.log(`Using existing user: ${email}`);
  } else {
    const created = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (created.error || !created.data.user) throw created.error || new Error('Failed to create user');
    userId = created.data.user.id;
    console.log(`Created user: ${email}`);
  }

  let tenantId;
  const tenantLookup = await supabase
    .from('tenants')
    .select('id, slug')
    .eq('slug', tenantSlug)
    .maybeSingle();

  if (tenantLookup.error && tenantLookup.error.code !== 'PGRST116') {
    throw tenantLookup.error;
  }

  if (tenantLookup.data?.id) {
    tenantId = tenantLookup.data.id;
  } else {
    const tenantInsert = await supabase
      .from('tenants')
      .insert({ name: tenantName, slug: tenantSlug, created_by: userId })
      .select('id')
      .single();
    if (tenantInsert.error || !tenantInsert.data?.id) throw tenantInsert.error || new Error('Failed to create tenant');
    tenantId = tenantInsert.data.id;
  }

  const profileUpsert = await supabase
    .from('user_profiles')
    .upsert(
      {
        user_id: userId,
        full_name: fullName,
        default_tenant_id: tenantId,
      },
      { onConflict: 'user_id' },
    );
  if (profileUpsert.error) throw profileUpsert.error;

  const membershipUpsert = await supabase
    .from('tenant_memberships')
    .upsert(
      {
        tenant_id: tenantId,
        user_id: userId,
        role: 'owner',
        is_active: true,
        created_by: userId,
      },
      { onConflict: 'tenant_id,user_id' },
    );
  if (membershipUpsert.error) throw membershipUpsert.error;

  const roleInsert = await supabase
    .from('user_roles')
    .upsert(
      {
        user_id: userId,
        role: 'admin',
      },
      { onConflict: 'user_id,role' },
    );
  if (roleInsert.error) {
    console.warn('Warning: could not set user_roles admin:', roleInsert.error.message);
  }

  console.log('Bootstrap admin completed.');
  console.log(`email=${email}`);
  console.log(`tenantId=${tenantId}`);
}

main().catch((err) => {
  console.error('Bootstrap failed:', err?.message || err);
  process.exit(1);
});
