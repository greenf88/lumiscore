// Real app routes + Supabase SSR/PKCE client against a loopback-only fake Auth
// provider. No accounts, emails, credentials or external requests are involved.
import assert from 'node:assert/strict';
import {createServer as createHttpServer} from 'node:http';
import {createServer} from 'vite';
import vinext from 'vinext';
import tailwindcss from '@tailwindcss/postcss';
import {fileURLToPath} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url)).replaceAll('\\','/');
for(const key of Object.keys(process.env))if(/SUPABASE|GOOGLE_BOOKS|DATABASE/.test(key))delete process.env[key];
const calls=[],rows=[];
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',
 email:'synthetic@example.test',email_confirmed_at:'2026-11-24T00:00:00Z',identities:[],user_metadata:{},app_metadata:{},created_at:'2026-11-24T00:00:00Z'};
const token=[{alg:'HS256',typ:'JWT'},{sub:user.id,exp:4102444800,aud:'authenticated'},'synthetic-test-signature']
 .map(value=>typeof value==='string'?value:Buffer.from(JSON.stringify(value)).toString('base64url')).join('.');
const session={access_token:token,refresh_token:'synthetic-refresh-token',expires_in:3600,token_type:'bearer',user};
const provider=createHttpServer(async(req,res)=>{
 let body='';for await(const chunk of req)body+=chunk;
 const data=body?JSON.parse(body):{},scenario=String(data.email??'').split('@')[0];
 const path=new URL(req.url,'http://localhost').pathname;
 calls.push({path,scenario,method:req.method});
 res.setHeader('Content-Type','application/json');
 res.setHeader('X-Supabase-Api-Version','2024-01-01');
 if(scenario==='rate'){res.writeHead(429);res.end(JSON.stringify({code:'over_request_rate_limit',msg:'synthetic provider detail'}));return;}
 if(scenario==='unavailable'){res.writeHead(503);res.end(JSON.stringify({code:'unexpected_failure',msg:'synthetic provider detail'}));return;}
 if(scenario==='invalid'){res.writeHead(400);res.end(JSON.stringify({code:'invalid_credentials',msg:'synthetic provider detail'}));return;}
 if(scenario==='unconfirmed'){res.writeHead(400);res.end(JSON.stringify({code:'email_not_confirmed',msg:'synthetic provider detail'}));return;}
 if(path.endsWith('/signup')){res.end(JSON.stringify({...user,email_confirmed_at:null}));return;}
 if(path.endsWith('/token')){res.end(JSON.stringify(scenario==='empty'?{}:session));return;}
 if(path.endsWith('/user')){res.end(JSON.stringify(user));return;}
 if(path.endsWith('/recover')){res.end('{}');return;}
 res.writeHead(404);res.end('{}');
});
await new Promise(resolve=>provider.listen(0,'127.0.0.1',resolve));
process.env.NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:'+provider.address().port;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='sb_publishable_synthetic_test_only';
const modules={'lib/supabase/proxy.ts':`import {NextResponse} from 'next/server';export async function refreshSupabaseSession(){return NextResponse.next()}`};
const baseline=process.argv.find(arg=>arg.startsWith('--baseline='))?.slice(11);
if(baseline){
 if(!/^[a-f0-9]{40}$/.test(baseline))throw Error('Expected an exact baseline SHA');
 for(const path of ['app/auth/sign-in/route.ts','lib/i18n/translations.ts'])
  modules[path]=execFileSync('git',['-c','safe.directory='+root.replace(/\/$/,''),'show',baseline+':'+path],{cwd:root,encoding:'utf8',windowsHide:true});
}
const server=await createServer({root,configFile:false,envFile:false,
 cacheDir:root+'outputs/node_modules/.vite-auth-availability',
 css:{postcss:{plugins:[tailwindcss()]}},resolve:{alias:{'@':root}},
 plugins:[{name:'loopback-auth-fixture',enforce:'pre',load(id){return modules[id.replaceAll('\\','/').replace(root,'').split('?')[0]]??null}},vinext()],
 server:{host:'127.0.0.1',port:0,strictPort:true,watch:{ignored:['**/outputs/**']}}});
await server.listen();
const origin=server.resolvedUrls.local[0].replace(/\/$/,'');
const privateResponse=r=>{
 assert.match(r.headers.get('cache-control')??'',/private.*no-store/);
 assert.equal(r.headers.get('pragma'),'no-cache');
};
const post=(path,form,headers={})=>fetch(origin+path,{method:'POST',headers:{origin,...headers},
 body:new URLSearchParams(form),redirect:'manual',signal:AbortSignal.timeout(60000)});
try{
 for(const locale of ['nl','en']){
  const next='/'+locale+'/book/1381';
  const start=calls.length;
  const signup=await post('/auth/sign-up',{email:'success@example.test',password:'Synthetic-test-only-123!',displayName:'Synthetic reader',next});
  assert.equal(signup.status,303);privateResponse(signup);
  const target=new URL(signup.headers.get('location'));
  assert.equal(target.pathname,'/'+locale+'/login');assert.equal(target.searchParams.get('message'),'check_email');
  assert.equal(calls.length-start,1,'one incoming POST must call Auth exactly once');
  const cookies=signup.headers.getSetCookie().map(cookie=>cookie.split(';')[0]).join('; ');
  assert.match(cookies,/code-verifier=/,'PKCE original-browser state retained');
  const callback=await fetch(origin+'/auth/callback?code=synthetic-code&next='+encodeURIComponent('/'+locale+'/reading-preferences?next='+encodeURIComponent(next)),
   {headers:{cookie:cookies},redirect:'manual'});
  assert.equal(callback.status,303);privateResponse(callback);
  assert.equal(new URL(callback.headers.get('location')).pathname,'/'+locale+'/reading-preferences');
  assert.ok(callback.headers.getSetCookie().some(cookie=>cookie.includes('auth-token=')),'successful confirmation writes session cookie');
  rows.push({locale,case:'registration-and-pkce-confirmation',status:signup.status,providerCalls:1});
  for(const scenario of ['rate','unavailable']){
   const before=calls.length;
   const response=await post('/auth/sign-up',{email:scenario+'@example.test',password:'Synthetic-test-only-123!',displayName:'Synthetic reader',next});
   assert.equal(response.status,303);privateResponse(response);
   assert.equal(calls.length-before,1);
   const location=new URL(response.headers.get('location'));
   assert.equal(location.searchParams.get('error'),scenario==='rate'?'signup_rate_limited':'signup_unavailable');
   const html=await (await fetch(location)).text();
   assert.match(html,locale==='nl'?/eerdere poging/:/earlier attempt/);
   assert.doesNotMatch(html,/synthetic provider detail/);
   rows.push({locale,case:'registration-'+scenario,status:303,providerCalls:1});
  }
  for(const [scenario,expected] of [['success',null],['rate','sign_in_rate_limited'],['unavailable','sign_in_unavailable'],['invalid','invalid_credentials'],['unconfirmed','email_not_confirmed'],['empty','sign_in_unavailable']]){
   const before=calls.length;
   const response=await post('/auth/sign-in',{email:scenario+'@example.test',password:'Synthetic-test-only-123!',next});
   assert.equal(response.status,303);privateResponse(response);
   const location=new URL(response.headers.get('location'));
   assert.equal(location.pathname,expected?'/'+locale+'/login':next);
   assert.equal(location.searchParams.get('error'),expected);
   assert.equal(calls.length-before,1,'no automatic sign-in retries');
   if(expected){
    const page=await fetch(location);const html=await page.text();
    assert.equal(page.status,200);assert.match(html,/<html lang="(?:en|nl)"/);
    assert.doesNotMatch(html,/synthetic provider detail|synthetic-refresh-token|Synthetic-test-only/);
    if(scenario==='unavailable')assert.match(html,locale==='nl'?/geen wachtwoordfout/:/not a password error/);
   }
   rows.push({locale,case:'sign-in-'+scenario,status:response.status,error:expected,providerCalls:1});
  }
  const forbiddenStart=calls.length;
  const forbidden=await post('/auth/sign-in',{email:'success@example.test',password:'Synthetic-test-only-123!',next},{origin:'https://attacker.invalid'});
  // Vinext may reject Origin before entering the application route.
  assert.equal(forbidden.status,403);assert.equal(calls.length,forbiddenStart);
  rows.push({locale,case:'cross-origin-rejected-before-provider',status:403,providerCalls:0});
 }
 const output=root+'outputs/auth-registration-20261124/';await mkdir(output,{recursive:true});
 await writeFile(output+'http-proof.json',JSON.stringify({at:new Date().toISOString(),kind:'loopback-fake-provider-real-routes-and-sdk',rows},null,2));
 console.log(JSON.stringify({authHttpChecks:rows.length,externalRequests:0,accountWrites:0,pass:true}));
}catch(error){
 console.error(JSON.stringify({authHttpChecks:rows.length,pass:false,baseline:baseline??null,error:String(error.message).split('\n')[0]}));
 process.exitCode=1;
}finally{await server.close();await new Promise(resolve=>provider.close(resolve));}
