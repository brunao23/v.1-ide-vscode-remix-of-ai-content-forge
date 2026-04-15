import fs from 'node:fs';
import path from 'node:path';

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const i = s.indexOf('=');
    if (i <= 0) continue;
    const k = s.slice(0, i).trim();
    let v = s.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[k] = v;
  }
  return out;
}

async function req(method, url, headers, body) {
  const res = await fetch(url, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

const root = process.cwd();
const envMain = parseEnvFile(path.join(root, '.env'));
const envFn = parseEnvFile(path.join(root, 'supabase', 'functions', '.env'));

const URL = envMain.VITE_SUPABASE_URL || envFn.SUPABASE_URL;
const PUB = envMain.VITE_SUPABASE_PUBLISHABLE_KEY || envMain.VITE_SUPABASE_ANON_KEY;
const SRK = envFn.SUPABASE_SERVICE_ROLE_KEY;

const email = `rag-brandbook-check-${Date.now()}@gmail.com`;
const password = `RagCheck!${Date.now()}aA1`;

const createUser = await req('POST', `${URL}/auth/v1/admin/users`, {
  apikey: SRK,
  authorization: `Bearer ${SRK}`,
}, {
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: 'RAG Brandbook Check User' },
});
if (!createUser.ok) throw new Error(`create user fail: ${JSON.stringify(createUser.data)}`);

const signIn = await req('POST', `${URL}/auth/v1/token?grant_type=password`, {
  apikey: PUB,
  authorization: `Bearer ${PUB}`,
}, { email, password });
if (!signIn.ok) throw new Error(`signin fail: ${JSON.stringify(signIn.data)}`);

const userId = signIn.data.user.id;
const accessToken = signIn.data.access_token;
const tenantRpc = await req('POST', `${URL}/rest/v1/rpc/get_default_tenant_id`, {
  apikey: PUB,
  authorization: `Bearer ${accessToken}`,
}, { _user_id: userId });
let tenantId = tenantRpc.data;
if (!tenantId) {
  const m = await req('GET', `${URL}/rest/v1/tenant_memberships?select=tenant_id&user_id=eq.${userId}&is_active=eq.true&limit=1`, {
    apikey: SRK,
    authorization: `Bearer ${SRK}`,
  });
  tenantId = m.data?.[0]?.tenant_id;
}

const docs = [
  {
    user_id: userId,
    tenant_id: tenantId,
    name: `qa-brandbook-${Date.now()}`,
    type: 'brand-book',
    content: 'Brand Book existente: tom direto, posicionamento premium e publico de consultores independentes.',
    processing_status: 'ready',
  },
];

const ins = await req('POST', `${URL}/rest/v1/documents`, {
  apikey: SRK,
  authorization: `Bearer ${SRK}`,
  Prefer: 'return=representation',
}, docs);
if (!ins.ok) throw new Error(`insert docs fail: ${JSON.stringify(ins.data)}`);

const chat = await req('POST', `${URL}/functions/v1/chat`, {
  apikey: PUB,
  authorization: `Bearer ${accessToken}`,
}, {
  agentId: 'brand-book',
  modelId: 'claude-sonnet-4-20250514',
  modelProvider: 'anthropic',
  maxTokens: 220,
  messages: [{ role: 'user', content: 'Quero revisar meu Brand Book existente.' }],
});

console.log(JSON.stringify({
  ok: chat.ok,
  status: chat.status,
  error: chat.ok ? null : chat.data,
  docs: chat.ok ? chat.data?.documentsContext : null,
  routing: chat.ok ? chat.data?.routing : null,
  contentPreview: chat.ok ? String(chat.data?.content || '').slice(0, 220) : null,
}, null, 2));
