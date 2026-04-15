import fs from 'node:fs';
import path from 'node:path';

function parseEnv(file){const out={}; if(!fs.existsSync(file)) return out; for(const l of fs.readFileSync(file,'utf8').split(/\r?\n/)){const s=l.trim(); if(!s||s.startsWith('#')) continue; const i=s.indexOf('='); if(i<1) continue; const k=s.slice(0,i).trim(); let v=s.slice(i+1).trim(); if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1); out[k]=v;} return out;}
async function req(method,url,headers,body){const r=await fetch(url,{method,headers:{...(body?{'content-type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined}); const t=await r.text(); let d; try{d=JSON.parse(t);}catch{d=t;} return {ok:r.ok,status:r.status,data:d};}

const root=process.cwd();
const envMain=parseEnv(path.join(root,'.env'));
const envFn=parseEnv(path.join(root,'supabase/functions/.env'));
const URL=envMain.VITE_SUPABASE_URL||envFn.SUPABASE_URL;
const PUB=envMain.VITE_SUPABASE_PUBLISHABLE_KEY||envMain.VITE_SUPABASE_ANON_KEY;
const SRK=envFn.SUPABASE_SERVICE_ROLE_KEY;

const email=`think-gemini-${Date.now()}@gmail.com`; const password=`ThinkGem!${Date.now()}aA1`;
await req('POST',`${URL}/auth/v1/admin/users`,{apikey:SRK,authorization:`Bearer ${SRK}`},{email,password,email_confirm:true});
const sign=await req('POST',`${URL}/auth/v1/token?grant_type=password`,{apikey:PUB,authorization:`Bearer ${PUB}`},{email,password});
if(!sign.ok) throw new Error(JSON.stringify(sign));
const token=sign.data.access_token; const userId=sign.data.user.id;
const tenant=(await req('POST',`${URL}/rest/v1/rpc/get_default_tenant_id`,{apikey:PUB,authorization:`Bearer ${token}`},{_user_id:userId})).data;

const chat=await req('POST',`${URL}/functions/v1/chat`,{apikey:PUB,authorization:`Bearer ${token}`},{
  agentId:'brand-book',
  tenantId:tenant,
  userId,
  modelId:'google/gemini-2.5-pro',
  modelProvider:'openrouter',
  extendedThinking:true,
  maxTokens:400,
  messages:[{role:'user',content:'Faça um resumo curto em 3 bullets sobre posicionamento de marca.'}],
});

console.log(JSON.stringify({ok:chat.ok,status:chat.status,provider:chat.data?.provider,hasThinking:Boolean(chat.data?.thinking),thinkingPreview:String(chat.data?.thinking||'').slice(0,120),error:chat.ok?null:chat.data},null,2));
