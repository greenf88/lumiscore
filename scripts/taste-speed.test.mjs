// Actual adapters, synthetic SDK only: no production writes or fabricated timing claims.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';

test('round presentation overlaps permission and stored data; failures never expose an offer',async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url)),marker='__tasteSpeedRoundFixture';
  const f={locale:'nl',allowed:true,permissionError:null,book:{id:'work-7',workId:'7',title:'Stored edition',cover:'orbit'},fallback:false,events:[]};
  f.client={async rpc(name){
    if(name==='taste_rating_state')return {data:{currentWorkId:'7',round:null,exhausted:false},error:null};
    assert.equal(name,'taste_rating_allowed');f.events.push('permission-start');
    await f.bookStarted;return {data:f.allowed,error:f.permissionError};
  }};
  globalThis[marker]=f;
  const modules={
    'next/server':`export const NextResponse={json:(body,init)=>Response.json(body,init)}`,
    'lib/supabase/auth.ts':`export async function getVerifiedServerUser(){return {user:{id:'synthetic'},client:globalThis.${marker}.client}}`,
    'lib/i18n/server.ts':`export async function resolveRequestLocale(){return {locale:globalThis.${marker}.locale}}`,
    'lib/server-environment.ts':`export function readServerEnvironment(){return 'synthetic'}`,
    'lib/supabase/review-target.ts':`export function isProductionBackedReview(){return false}`,
    'lib/supabase/books.ts':`const f=globalThis.${marker};export async function loadCatalogBooksByIds(ids,client,locale){f.events.push('book-start');f.bookArgs=[ids,locale];f.releaseBook();return f.fallback?[]:[f.book]};export async function loadCatalogBook(id,locale,stream,options){if(!options.skipExternalCovers)throw Error('Optional cover blocked');return {...f.book,editionAvailable:false}}`,
  };
  const vite=await createServer({root,configFile:false,envFile:false,cacheDir:root+'.wrangler/node_modules/taste-speed-round',resolve:{alias:{'@':root}},plugins:[{name:'synthetic-taste-speed',enforce:'pre',resolveId(id){if(id==='next/server')return '\0speed-next';},load(id){if(id==='\0speed-next')return modules['next/server'];return modules[id.replaceAll('\\','/').replace(root.replaceAll('\\','/'),'').split('?')[0]]??null;}}],server:{middlewareMode:true,hmr:false}});
  try{
    const route=await vite.ssrLoadModule('/app/api/taste-test/rounds/route.ts');
    for(const locale of ['nl','en'])for(const mode of ['allowed','denied','error','missing-cover']){
      f.locale=locale;f.allowed=mode!=='denied';f.permissionError=mode==='error'?new Error('permission unavailable'):null;f.fallback=mode==='missing-cover';f.events=[];
      f.bookStarted=new Promise(resolve=>{f.releaseBook=resolve;});
      const response=await route.GET(new Request('http://local/api/taste-test/rounds'));
      const body=await response.json();
      assert.deepEqual(f.events,['permission-start','book-start']);assert.deepEqual(f.bookArgs,[['7'],locale]);
      assert.match(response.headers.get('cache-control'),/no-store/);
      if(mode==='error'){assert.equal(response.status,503);assert.equal(body.book,undefined);}
      else if(mode==='denied')assert.equal(body.book,null);
      else {assert.equal(body.book.workId,'7');assert.equal(body.book.editionCoverUrls,undefined);if(f.fallback)assert.equal(body.book.editionAvailable,false);}
    }
  }finally{await vite.close();delete globalThis[marker];}
});

test('catalog coalesces anonymous reads by language, retries failure, and never waits for optional covers in taste results',async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url)),marker='__tasteSpeedCatalogFixture';
  const f={publicClient:{public:true},calls:0,fail:false,coverCalls:0,book:{id:'work-7',workId:'7',title:'Stored edition',cover:'orbit'}};
  globalThis[marker]=f;
  const modules={
    'lib/supabase/client.ts':`export const supabase=globalThis.${marker}.publicClient`,
    'lib/supabase/auth.ts':`export async function getVerifiedServerUser(){throw Error('Private auth must not run')}`,
    'lib/supabase/server.ts':`export async function createServerSupabaseClient(){throw Error('Private client must not run')}`,
    'lib/supabase/books.ts':`const f=globalThis.${marker};export function mapCatalogWorks(rows,locale){return rows};export async function loadCatalogBooksByIds(){return [f.book]}`,
    'lib/supabase/recommendation-catalog.ts':`export async function loadRecommendationCatalog(client){const f=globalThis.${marker};if(client!==f.publicClient)throw Error('Private client in shared cache');f.calls++;if(f.fail)throw Error('Synthetic unavailable');return {candidates:[],traitsById:new Map()}}`,
    'lib/books/edition-cover-evidence.ts':`export async function withRecommendationEditionCovers(rows){globalThis.${marker}.coverCalls++;return rows}`,
  };
  const vite=await createServer({root,configFile:false,envFile:false,cacheDir:root+'.wrangler/node_modules/taste-speed-catalog',resolve:{alias:{'@':root}},plugins:[{name:'synthetic-taste-catalog',enforce:'pre',load(id){return modules[id.replaceAll('\\','/').replace(root.replaceAll('\\','/'),'').split('?')[0]]??null;}}],server:{middlewareMode:true,hmr:false}});
  try{
    const m=await vite.ssrLoadModule('/lib/supabase/taste-test.ts');
    const [a,b]=await Promise.all([m.loadGuestRecommendationCatalog({private:true},'nl'),m.loadCachedPublicRecommendationCatalog('nl')]);
    assert.equal(a,b);assert.equal(f.calls,1);
    f.fail=true;await assert.rejects(m.loadCachedPublicRecommendationCatalog('en'));
    f.fail=false;await m.loadCachedPublicRecommendationCatalog('en');assert.equal(f.calls,3);
    await m.loadCachedPublicRecommendationCatalog('nl');assert.equal(f.calls,3);
    const input=[{book:{workId:'7'},explanation:'Evidence-based'}];
    const hydrated=await m.hydratePublicRecommendations(input,'nl',true);
    assert.equal(hydrated[0].book,f.book);assert.equal(f.coverCalls,0);
    await m.hydratePublicRecommendations(input,'en');assert.equal(f.coverCalls,1,'unrelated streaming/enrichment remains available');
  }finally{await vite.close();delete globalThis[marker];}
});
