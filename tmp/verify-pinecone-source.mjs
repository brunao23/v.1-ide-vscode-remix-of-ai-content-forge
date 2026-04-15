import fs from 'node:fs';
import path from 'node:path';

function parseEnv(file){
  const out={}; if(!fs.existsSync(file)) return out;
  for(const l of fs.readFileSync(file,'utf8').split(/\r?\n/)){
    const s=l.trim(); if(!s||s.startsWith('#')) continue; const i=s.indexOf('='); if(i<1) continue;
    const k=s.slice(0,i).trim(); let v=s.slice(i+1).trim();
    if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1);
    out[k]=v;
  }
  return out;
}
async function req(method,url,headers,body){
  const res=await fetch(url,{method,headers:{...(body?{'content-type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});
  const text=await res.text(); let data; try{data=JSON.parse(text);}catch{data=text;}
  return {ok:res.ok,status:res.status,data};
}

const root=process.cwd();
const envMain=parseEnv(path.join(root,'.env'));
const envFn=parseEnv(path.join(root,'supabase/functions/.env'));
const URL=envMain.VITE_SUPABASE_URL||envFn.SUPABASE_URL;
const PUB=envMain.VITE_SUPABASE_PUBLISHABLE_KEY||envMain.VITE_SUPABASE_ANON_KEY;
const SRK=envFn.SUPABASE_SERVICE_ROLE_KEY;

const email=`rag-pinecone-${Date.now()}@gmail.com`;
const password=`RagCheck!${Date.now()}aA1`;
await req('POST',`${URL}/auth/v1/admin/users`,{apikey:SRK,authorization:`Bearer ${SRK}`},{email,password,email_confirm:true});
const signIn=await req('POST',`${URL}/auth/v1/token?grant_type=password`,{apikey:PUB,authorization:`Bearer ${PUB}`},{email,password});
if(!signIn.ok) throw new Error(JSON.stringify(signIn));
const token=signIn.data.access_token; const userId=signIn.data.user.id;
let tenantId=(await req('POST',`${URL}/rest/v1/rpc/get_default_tenant_id`,{apikey:PUB,authorization:`Bearer ${token}`},{_user_id:userId})).data;
if(!tenantId){
  const m=await req('GET',`${URL}/rest/v1/tenant_memberships?select=tenant_id&user_id=eq.${userId}&is_active=eq.true&limit=1`,{apikey:SRK,authorization:`Bearer ${SRK}`});
  tenantId=m.data?.[0]?.tenant_id;
}

const ins=await req('POST',`${URL}/rest/v1/documents`,{apikey:SRK,authorization:`Bearer ${SRK}`,Prefer:'return=representation'},[{user_id:userId,tenant_id:tenantId,name:`qa-pinecone-brandbook-${Date.now()}`,type:'brand-book',content:'Brand Book para validar Pinecone: tom direto e foco em criadores de conteudo.',processing_status:'pending'}]);
if(!ins.ok) throw new Error(JSON.stringify(ins));
const docId=ins.data[0].id;

const proc=await req('POST',`${URL}/functions/v1/process-document`,{apikey:PUB,authorization:`Bearer ${token}`},{documentId:docId,content:ins.data[0].content,userId,documentType:'brand-book'});

const chat=await req('POST',`${URL}/functions/v1/chat`,{apikey:PUB,authorization:`Bearer ${token}`},{agentId:'brand-book',modelId:'claude-sonnet-4-20250514',modelProvider:'anthropic',maxTokens:220,messages:[{role:'user',content:'Quero revisar meu Brand Book existente.'}]});

console.log(JSON.stringify({processOk:proc.ok,processStatus:proc.status,processBody:proc.data,chatOk:chat.ok,chatStatus:chat.status,docs:chat.ok?chat.data?.documentsContext:null,error:chat.ok?null:chat.data},null,2));
