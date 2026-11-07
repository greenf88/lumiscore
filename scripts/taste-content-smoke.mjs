// Isolated post-refinement acceptance. Credentials remain in process memory.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServerClient } from '@supabase/ssr';
const [origin,appSha]=process.argv.slice(2), project='hlvujbrmfdlrfxdjwsmb';
if(!/^https:\/\/lumiscore-[a-z0-9]+-rgkgroeneveld-9102\.vercel\.app$/.test(origin)||!/^\w{40}$/.test(appSha)||!process.env.VERCEL_OIDC_TOKEN)throw Error('Exact isolated Preview and SHA required');
const safeEnv=Object.fromEntries(['PATH','SystemRoot','WINDIR','TEMP','TMP','USERPROFILE','LOCALAPPDATA','APPDATA'].map(k=>[k,process.env[k]]));
const cli=spawnSync('C:/Users/rickg/AppData/Local/npm-cache/_npx/b96a6bd565c470ce/node_modules/@supabase/cli-windows-x64/bin/supabase.exe',['projects','api-keys','--project-ref',project,'--output','json'],{encoding:'utf8',windowsHide:true,env:safeEnv});
if(cli.status!==0)throw Error('Existing test authorization unavailable');
const keys=JSON.parse(cli.stdout),admin=keys.find(k=>k.name==='service_role')?.api_key,pub=keys.find(k=>k.type==='publishable')?.api_key??keys.find(k=>k.name==='anon')?.api_key;
if(!admin||JSON.parse(Buffer.from(admin.split('.')[1],'base64url')).ref!==project)throw Error('Test project mismatch');
const base='https://'+project+'.supabase.co',ah={apikey:admin,Authorization:'Bearer '+admin,'Content-Type':'application/json'},records=[];let uid;
try{
 const email='even-simpel-final-'+randomBytes(8).toString('hex')+'@example.test',password=randomBytes(32).toString('base64url');
 const created=await fetch(base+'/auth/v1/admin/users',{method:'POST',headers:ah,body:JSON.stringify({email,password,email_confirm:true,user_metadata:{test_purpose:'even-simpel-final-smoke-20261107'}})});
 if(!created.ok)throw Error('Synthetic account unavailable');uid=(await created.json()).id;
 const cookies=[];const client=createServerClient(base,pub,{cookies:{getAll:()=>[],setAll:v=>cookies.push(...v)}});
 if((await client.auth.signInWithPassword({email,password})).error)throw Error('Synthetic login failed');
 const headers={'x-vercel-trusted-oidc-idp-token':process.env.VERCEL_OIDC_TOKEN,Cookie:cookies.map(c=>c.name+'='+c.value).join('; ')};
 for(const locale of ['nl','en']){
  const allowed=await client.rpc('taste_rating_allowed',{p_work_id:990710001,p_language:locale});
  if(allowed.error||allowed.data!==false)throw Error('Exact cookbook eligibility mismatch');records.push({locale,check:'exact proposed edition excluded',allowed:false});
  const r=await fetch(origin+'/api/taste-test/candidates?locale='+locale+'&q=Even%20simpel',{headers});const b=await r.json();
  if(r.status!==200||b.results.length)throw Error('Cookbook taste search mismatch');records.push({locale,check:'authenticated taste search',status:r.status,count:0});
 }
 const catalog=await fetch(origin+'/api/catalog/search?locale=nl&q=Even%20simpel',{headers}).then(r=>r.json());
 if(!catalog.results.some(w=>w.workId==='990710001'))throw Error('Ordinary catalogue entry missing');records.push({check:'ordinary catalogue retains exact Work',workId:990710001});
 const guest=await fetch(origin+'/api/taste-test/candidates?locale=nl&q=Even%20simpel',{headers:{'x-vercel-trusted-oidc-idp-token':process.env.VERCEL_OIDC_TOKEN}});
 if(guest.status!==401)throw Error('Guest endpoint access mismatch');records.push({check:'server-side access control',guestStatus:401});
} finally {
 if(uid){
  for(const table of ['ratings','user_book_status','taste_rating_offers','taste_rating_rounds']){
   const r=await fetch(base+'/rest/v1/'+table+'?user_id=eq.'+uid+'&select=*',{headers:ah});if(!r.ok||(await r.json()).length)throw Error('Unexpected synthetic dependency; preserve actor');
  }
  const r=await fetch(base+'/auth/v1/admin/users/'+uid,{method:'DELETE',headers:ah});if(!r.ok)throw Error('Synthetic cleanup failed');
 }
}
fs.writeFileSync('catalog/even-simpel-20261107/taste-final-hosted-smoke.json',JSON.stringify({at:new Date().toISOString(),origin,appSha,records,syntheticAccountRemoved:true},null,2)+'\n');
console.log(JSON.stringify({checks:records.length,syntheticAccountRemoved:true,appSha}));
