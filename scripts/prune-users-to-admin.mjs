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

const keepEmail = (process.argv[2] || 'admin@gemz.ai').trim().toLowerCase();
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function listAllUsers() {
  const all = [];
  let page = 1;
  const perPage = 200;
  while (true) {
    const res = await supabase.auth.admin.listUsers({ page, perPage });
    if (res.error) throw res.error;
    const users = res.data?.users || [];
    all.push(...users);
    if (users.length < perPage) break;
    page += 1;
  }
  return all;
}

async function deleteNonAdminUsers() {
  const users = await listAllUsers();
  const keepUser = users.find((u) => (u.email || '').toLowerCase() === keepEmail);
  if (!keepUser) {
    throw new Error(`Keep user not found: ${keepEmail}`);
  }

  let deleted = 0;
  for (const user of users) {
    const email = (user.email || '').toLowerCase();
    if (email === keepEmail) continue;

    const del = await supabase.auth.admin.deleteUser(user.id);
    if (del.error) {
      throw new Error(`Failed to delete ${email || user.id}: ${del.error.message}`);
    }
    deleted += 1;
  }

  const [{ data: tenants, error: tenantErr }, { data: memberships, error: membErr }] = await Promise.all([
    supabase.from('tenants').select('id,slug'),
    supabase.from('tenant_memberships').select('tenant_id'),
  ]);
  if (tenantErr) throw tenantErr;
  if (membErr) throw membErr;

  const usedTenantIds = new Set((memberships || []).map((m) => String(m.tenant_id)));
  let removedOrphans = 0;

  for (const tenant of tenants || []) {
    const tenantId = String(tenant.id);
    const slug = String(tenant.slug || '');
    if (slug === 'legacy-unassigned') continue;
    if (usedTenantIds.has(tenantId)) continue;

    const delTenant = await supabase.from('tenants').delete().eq('id', tenantId);
    if (delTenant.error) {
      throw new Error(`Failed to delete orphan tenant ${tenantId}: ${delTenant.error.message}`);
    }
    removedOrphans += 1;
  }

  return { deleted, removedOrphans };
}

async function ensureAdminTenant() {
  const adminBootstrapPath = path.join(projectRoot, 'scripts', 'bootstrap-admin.mjs');
  if (!fs.existsSync(adminBootstrapPath)) return;

  const { spawnSync } = await import('node:child_process');
  const run = spawnSync('node', [adminBootstrapPath, keepEmail, 'Gemz@2026!', 'Administrador GEMZ', 'Conta Principal'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  if (run.status !== 0) {
    throw new Error(`bootstrap-admin failed: ${run.stderr || run.stdout}`);
  }
}

async function main() {
  const before = await listAllUsers();
  const result = await deleteNonAdminUsers();
  await ensureAdminTenant();
  const after = await listAllUsers();

  console.log(JSON.stringify({
    keepEmail,
    usersBefore: before.length,
    usersAfter: after.length,
    deletedUsers: result.deleted,
    removedOrphanTenants: result.removedOrphans,
    remainingUsers: after.map((u) => ({ id: u.id, email: u.email })),
  }, null, 2));
}

main().catch((err) => {
  console.error('Prune users failed:', err?.message || err);
  process.exit(1);
});
