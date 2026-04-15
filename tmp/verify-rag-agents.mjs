import fs from 'node:fs';
import path from 'node:path';

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

async function postJson(url, headers, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

async function getJson(url, headers) {
  const res = await fetch(url, { method: 'GET', headers });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

const projectRoot = process.cwd();
const envMain = parseEnvFile(path.join(projectRoot, '.env'));
const envFunctions = parseEnvFile(path.join(projectRoot, 'supabase', 'functions', '.env'));

const SUPABASE_URL = envMain.VITE_SUPABASE_URL || envFunctions.SUPABASE_URL;
const PUBLISHABLE_KEY = envMain.VITE_SUPABASE_PUBLISHABLE_KEY || envMain.VITE_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = envFunctions.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !PUBLISHABLE_KEY || !SERVICE_ROLE_KEY) {
  throw new Error('Missing required envs for test runner');
}

const email = `rag-check-${Date.now()}@gmail.com`;
const password = `RagCheck!${Date.now()}aA1`;

let session = null;

const signUp = await postJson(`${SUPABASE_URL}/auth/v1/signup`, {
  apikey: PUBLISHABLE_KEY,
  authorization: `Bearer ${PUBLISHABLE_KEY}`,
}, {
  email,
  password,
  data: { full_name: 'RAG Check User' },
});

if (signUp.ok && signUp.data?.session?.access_token) {
  session = signUp.data.session;
}

if (!session) {
  const signIn = await postJson(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    apikey: PUBLISHABLE_KEY,
    authorization: `Bearer ${PUBLISHABLE_KEY}`,
  }, {
    email,
    password,
  });

  if (!signIn.ok || !signIn.data?.access_token) {
    console.log(JSON.stringify({
      step: 'auth',
      status: 'failed',
      signUpStatus: signUp.status,
      signUpError: signUp.data,
      signInStatus: signIn.status,
      signInError: signIn.data,
    }, null, 2));
    process.exit(1);
  }

  session = {
    access_token: signIn.data.access_token,
    user: signIn.data.user,
  };
}

const userId = session.user?.id;
const accessToken = session.access_token;
if (!userId || !accessToken) {
  throw new Error('No user/token after auth');
}

const tenantRpc = await postJson(`${SUPABASE_URL}/rest/v1/rpc/get_default_tenant_id`, {
  apikey: PUBLISHABLE_KEY,
  authorization: `Bearer ${accessToken}`,
}, { _user_id: userId });

let tenantId = tenantRpc.data;
if (!tenantId) {
  const memberships = await getJson(`${SUPABASE_URL}/rest/v1/tenant_memberships?select=tenant_id&user_id=eq.${encodeURIComponent(userId)}&is_active=eq.true&limit=1`, {
    apikey: SERVICE_ROLE_KEY,
    authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  });
  tenantId = memberships.data?.[0]?.tenant_id || null;
}

if (!tenantId) {
  console.log(JSON.stringify({ step: 'tenant', status: 'failed', tenantRpc }, null, 2));
  process.exit(1);
}

const baseDocs = [
  { type: 'brand-book', content: 'Marca premium de consultoria para creators. Tom: direto, sem jargao.' },
  { type: 'pesquisa', content: 'Concorrentes focam em promessas vagas. Oportunidade: plano pratico semanal.' },
  { type: 'icp', content: 'ICP: infoprodutores iniciantes com dor de inconsistencia e baixa conversao.' },
  { type: 'pilares', content: 'Pilares: posicionamento, conteudo, oferta, rotina comercial.' },
  { type: 'matriz', content: 'Matriz de ideias: bastidores, estudos de caso, provas sociais e frameworks.' },
  { type: 'calendario', content: 'Calendario: 4 posts semanais, 2 reels, 1 carrossel, 1 live curta.' },
  { type: 'roteiro', content: 'Roteiro padrao: gancho forte, contexto rapido, prova, CTA objetivo.' },
];

const docsPayload = baseDocs.map((d, i) => ({
  user_id: userId,
  tenant_id: tenantId,
  name: `qa-rag-${d.type}-${i}-${Date.now()}`,
  type: d.type,
  content: d.content,
  processing_status: 'ready',
  agent_id: null,
}));

const insertDocs = await fetch(`${SUPABASE_URL}/rest/v1/documents`, {
  method: 'POST',
  headers: {
    apikey: SERVICE_ROLE_KEY,
    authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'content-type': 'application/json',
    Prefer: 'return=representation',
  },
  body: JSON.stringify(docsPayload),
});

const docsText = await insertDocs.text();
let insertedDocs = [];
try { insertedDocs = JSON.parse(docsText); } catch {}

if (!insertDocs.ok) {
  console.log(JSON.stringify({ step: 'insert-docs', status: 'failed', code: insertDocs.status, body: docsText }, null, 2));
  process.exit(1);
}

const agents = ['marketing-manager', 'scriptwriter', 'copywriter-campanhas'];
const results = [];

for (const agentId of agents) {
  const chatRes = await postJson(`${SUPABASE_URL}/functions/v1/chat`, {
    apikey: PUBLISHABLE_KEY,
    authorization: `Bearer ${accessToken}`,
  }, {
    agentId,
    modelId: 'claude-3-5-haiku-20241022',
    modelProvider: 'anthropic',
    maxTokens: 180,
    messages: [
      { role: 'user', content: `Use meus documentos e responda de forma objetiva para ${agentId}.` },
    ],
  });

  results.push({
    agentId,
    ok: chatRes.ok,
    status: chatRes.status,
    error: chatRes.ok ? null : chatRes.data,
    documentsContext: chatRes.ok ? chatRes.data?.documentsContext : null,
    routing: chatRes.ok ? chatRes.data?.routing : null,
  });
}

console.log(JSON.stringify({
  authUserId: userId,
  tenantId,
  insertedDocs: insertedDocs.length,
  results,
}, null, 2));
