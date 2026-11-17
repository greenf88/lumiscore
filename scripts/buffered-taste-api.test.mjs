import test from 'node:test';import assert from 'node:assert/strict';
import {createServer} from 'vite';import {fileURLToPath} from 'node:url';
test('real batch API protects owner, origin and private responses and hydrates UI-language books without promises',async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url)),marker='__bufferedApiTest';
 const f={user:{id:'owner-a'},review:false,calls:[],locale:'en',error:null,state:{round:{id:'11111111-1111-4111-8111-111111111111',language:'nl',goal:10,complete:false,ratedCount:1},currentWorkId:'2',exhausted:false}};
 f.client={async rpc(name,args){f.calls.push([name,args]);if(name==='taste_rating_pool')return {data:[{work_id:2}],error:null};return {data:f.state,error:f.error};},from(){const q={select(){return q;},eq(){return q;},neq(){return Promise.resolve({data:[{work_id:1,score:8}],error:null});}};return q;}};
 globalThis[marker]=f;
 const modules={
  'lib/supabase/auth.ts':`export async function getVerifiedServerUser(){return {user:globalThis.${marker}.user,client:globalThis.${marker}.client}}`,
  'lib/i18n/server.ts':`export async function resolveRequestLocale(){return {locale:globalThis.${marker}.locale}}`,
  'lib/server-environment.ts':`export function readServerEnvironment(){return 'synthetic'}`,
  'lib/supabase/review-target.ts':`export function isProductionBackedReview(){return globalThis.${marker}.review}`,
  'lib/supabase/books.ts':`export async function loadCatalogBooksByIds(ids,unused,locale){globalThis.${marker}.loadedLocale=locale;return ids.map(id=>({workId:id,editionId:'edition-'+locale,title:'Public edition',coverUrls:[]}))}`,
 };
 const vite=await createServer({root,configFile:false,envFile:false,cacheDir:root+'.wrangler/node_modules/buffered-api-test',resolve:{alias:{'@':root}},plugins:[{name:'buffered-api-fixture',enforce:'pre',resolveId(id){if(id==='next/server')return '\0batch-next';},load(id){if(id==='\0batch-next')return `export const NextResponse={json:(body,init)=>Response.json(body,init)}`;return modules[id.replaceAll('\\','/').replace(root.replaceAll('\\','/'),'').split('?')[0]]??null;}}],server:{middlewareMode:true,hmr:false}});
 try{
  const route=await vite.ssrLoadModule('/app/api/taste-test/batch/route.ts');
  const body={owner:'owner-a',roundId:f.state.round.id,decisions:[{workId:'2',score:8}]};
  const request=(payload=body,origin='http://local')=>{const r=new Request('http://local/api/taste-test/batch',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(payload)});r.nextUrl=new URL(r.url);return r;};
  for(const locale of ['nl','en']){f.locale=locale;const r=await route.GET(new Request('http://local/api/taste-test/batch'));const b=await r.json();assert.equal(f.loadedLocale,locale);assert.equal(b.owner,'owner-a');assert.equal(b.books[0].editionCoverUrls,undefined);assert.deepEqual(b.decided,[{workId:'1',score:8}]);assert.match(r.headers.get('cache-control'),/private.*no-store/);}
  f.calls=[];assert.equal((await route.POST(request(body,'http://attacker.invalid'))).status,403);assert.equal(f.calls.length,0);
  assert.equal((await route.POST(request({...body,owner:'owner-b'}))).status,409);assert.equal(f.calls.length,0);
  f.user=null;assert.equal((await route.POST(request())).status,401);f.user={id:'owner-a'};
  f.review=true;assert.equal((await route.POST(request())).status,503);f.review=false;
  assert.equal((await route.POST(request({...body,decisions:[...body.decisions,...body.decisions]}))).status,400);
  const saved=await route.POST(request());assert.equal(saved.status,200);assert.match(saved.headers.get('cache-control'),/private.*no-store/);assert.deepEqual(f.calls,[['taste_rating_save_batch',{p_round_id:body.roundId,p_decisions:body.decisions}]]);
  f.error={code:'23505'};assert.equal((await route.POST(request())).status,409);
 }finally{await vite.close();delete globalThis[marker];}
});
