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
if (!URL || !PUB || !SRK) throw new Error('Missing env vars');

const email = `rag-admin-check-${Date.now()}@gmail.com`;
const password = `RagCheck!${Date.now()}aA1`;

const createUser = await req('POST', `${URL}/auth/v1/admin/users`, {
  apikey: SRK,
  authorization: `Bearer ${SRK}`,
}, {
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: 'RAG Admin Check User' },
});

if (!createUser.ok) {
  console.log(JSON.stringify({ step: 'createUser', createUser }, null, 2));
  process.exit(1);
}

const signIn = await req('POST', `${URL}/auth/v1/token?grant_type=password`, {
  apikey: PUB,
  authorization: `Bearer ${PUB}`,
}, {
  email,
  password,
});

if (!signIn.ok || !signIn.data?.access_token || !signIn.data?.user?.id) {
  console.log(JSON.stringify({ step: 'signin', signIn }, null, 2));
  process.exit(1);
}

const accessToken = signIn.data.access_token;
const userId = signIn.data.user.id;

const tenantRpc = await req('POST', `${URL}/rest/v1/rpc/get_default_tenant_id`, {
  apikey: PUB,
  authorization: `Bearer ${accessToken}`,
}, { _user_id: userId });

let tenantId = tenantRpc.data;

if (!tenantId) {
  const memberships = await req('GET', `${URL}/rest/v1/tenant_memberships?select=tenant_id&user_id=eq.${userId}&is_active=eq.true&limit=1`, {
    apikey: SRK,
    authorization: `Bearer ${SRK}`,
  });
  tenantId = memberships.data?.[0]?.tenant_id || null;
}

if (!tenantId) {
  const t = await req('POST', `${URL}/rest/v1/tenants`, {
    apikey: SRK,
    authorization: `Bearer ${SRK}`,
    Prefer: 'return=representation',
  }, [{ slug: `qa-${Date.now()}`, name: 'QA Workspace', created_by: userId }]);

  if (!t.ok || !t.data?.[0]?.id) {
    console.log(JSON.stringify({ step: 'createTenant', t }, null, 2));
    process.exit(1);
  }
  tenantId = t.data[0].id;

  await req('POST', `${URL}/rest/v1/tenant_memberships`, {
    apikey: SRK,
    authorization: `Bearer ${SRK}`,
  }, [{ tenant_id: tenantId, user_id: userId, role: 'owner', is_active: true, created_by: userId }]);

  await req('POST', `${URL}/rest/v1/user_profiles`, {
    apikey: SRK,
    authorization: `Bearer ${SRK}`,
    Prefer: 'resolution=merge-duplicates',
  }, [{ user_id: userId, default_tenant_id: tenantId, full_name: 'RAG Admin Check User' }]);
}

const docs = [
  ['brand-book', 'Brand Book: marca premium, tom direto, sem jargao.'],
  ['pesquisa', 'Pesquisa: concorrentes superficiais, oportunidade em plano semanal pratico.'],
  ['icp', 'ICP: infoprodutores iniciantes com dor de consistencia.'],
  ['pilares', 'Pilares: posicionamento, conteudo, oferta, vendas.'],
  ['matriz', 'Matriz: ideias com provas, bastidores e tutorial aplicado.'],
  ['calendario', 'Calendario: 4 conteudos semanais e 1 live quinzenal.'],
  ['roteiro', 'Roteiro: gancho, problema, solucao, prova, CTA.'],
].map(([type, content], i) => ({
  user_id: userId,
  tenant_id: tenantId,
  name: `qa-rag-${type}-${i}-${Date.now()}`,
  type,
  content,
  processing_status: 'ready',
}));

const ins = await req('POST', `${URL}/rest/v1/documents`, {
  apikey: SRK,
  authorization: `Bearer ${SRK}`,
  Prefer: 'return=representation',
}, docs);

if (!ins.ok) {
  console.log(JSON.stringify({ step: 'insertDocs', ins }, null, 2));
  process.exit(1);
}

const agents = ['marketing-manager', 'scriptwriter', 'copywriter-campanhas'];
const out = [];

for (const agentId of agents) {
  const chat = await req('POST', `${URL}/functions/v1/chat`, {
    apikey: PUB,
    authorization: `Bearer ${accessToken}`,
  }, {
    agentId,
    modelId: 'claude-sonnet-4-20250514',
    modelProvider: 'anthropic',
    maxTokens: 180,
    messages: [{ role: 'user', content: `Responda usando meus documentos para ${agentId}.` }],
  });

  out.push({
    agentId,
    ok: chat.ok,
    status: chat.status,
    error: chat.ok ? null : chat.data,
    docs: chat.ok ? chat.data?.documentsContext : null,
    routing: chat.ok ? chat.data?.routing : null,
  });
}

console.log(JSON.stringify({
  userId,
  tenantId,
  insertedDocs: ins.data?.length || 0,
  results: out,
}, null, 2));
