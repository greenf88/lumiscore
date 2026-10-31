import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {capturedWorks,reviewedProposalWorks,sourceEditions} from '../test-support/edition-presentation/cases.ts';
test('actual catalog/search/detail loaders share NL/EN edition identity, locale changes and neutral cover fallback',async t=>{
 const root=fileURLToPath(new URL('../',import.meta.url)),marker='__editionPresentationTransport';
 const fixture={rows:structuredClone(capturedWorks),queries:[],sourceCalls:0};
 fixture.client={from(table){const filters=[];let range=null;const q={select(){return q;},in(k,ids){filters.push(r=>ids.map(String).includes(String(r[k])));return q;},eq(k,v){filters.push(r=>String(r[k])===String(v));return q;},ilike(k,v){const text=v.replaceAll('%','').toLowerCase();filters.push(r=>String(r[k]).toLowerCase().includes(text));return q;},order(){return q;},range(a,b){range=[a,b];return q;},limit(){return q;},abortSignal(){return q;},async maybeSingle(){return {data:fixture.rows.filter(r=>filters.every(f=>f(r)))[0]??null,error:null};},async then(resolve){fixture.queries.push(table);let rows=table==='works'?fixture.rows:table==='editions'?fixture.rows.flatMap(w=>w.editions):table==='authors'?fixture.rows.map(w=>w.authors):[];rows=rows.filter(r=>filters.every(f=>f(r)));if(range)rows=rows.slice(range[0],range[1]+1);return resolve({data:rows,error:null,count:rows.length});}};return q;}};
 globalThis[marker]=fixture;
 t.mock.method(globalThis,'fetch',async input=>{const u=new URL(String(input));assert.equal(u.origin,'https://openlibrary.org');assert.equal(u.pathname,'/api/get_many');fixture.sourceCalls++;const keys=JSON.parse(u.searchParams.get('keys'));return new Response(JSON.stringify({status:'ok',result:Object.fromEntries(keys.filter(k=>sourceEditions[k]).map(k=>[k,sourceEditions[k]]))}));});
 const modules={
  'lib/supabase/client.ts':`export const supabase=globalThis.${marker}.client`,
  'lib/supabase/cover-resolutions.ts':`export async function loadStoredCoverResolutionsBatched(){return {available:true,entries:[{workId:'1456',source:'open_library',sourceKey:'OL17641518W',coverUrl:'https://example.invalid/old-hebrew.jpg',verifiedAt:'2026-10-01',state:'resolved'}]}}`,
  'lib/supabase/public-rating-summaries.ts':`export async function loadPublicRatingSummariesBatched(){return new Map()};export const loadPublicRatingSummaries=loadPublicRatingSummariesBatched;`,
 };
 const vite=await createServer({root,configFile:false,envFile:false,cacheDir:root+'.wrangler/node_modules/edition-surfaces-vite',resolve:{alias:{'@':root}},plugins:[{name:'isolated-read-only-transport',enforce:'pre',load(id){return modules[id.replaceAll('\\','/').replace(root.replaceAll('\\','/'),'').split('?')[0]]??null;}}],server:{middlewareMode:true,hmr:false}});
 try{
  const books=await vite.ssrLoadModule('/lib/supabase/books.ts');
  const nl=await books.loadCatalogBooksByIdsWithStoredCovers(['1342','1456'],undefined,'nl');
  assert.deepEqual(nl.map(b=>b.title),['Waar de zon de sneeuw raakt']);assert.equal(nl[0].englishEditionFallback,false);
  assert.ok(nl.every(b=>b.coverUrls.length===1&&!b.coverUrls[0].includes('old-hebrew')));
  const en=await books.loadCatalogBooksByIdsWithStoredCovers(['1342','1456'],undefined,'en');assert.deepEqual(en.map(b=>b.title),['Homo Deus']);
  assert.equal((await books.loadCatalogBook('1342','en')).editionAvailable,false,'direct Work link remains available, not a French/Dutch suitable edition');
  assert.equal((await books.loadCatalogBook('1456','en')).editionId,'1523');
  const again=await books.loadCatalogBooksByIdsWithStoredCovers(['1456'],undefined,'en');assert.equal(again[0].workId,en[0].workId);assert.equal(again[0].title,en[0].title);
  // Search now delegates to the strict SQL selection, covered end-to-end by
  // catalog-integrity.test.mjs. This transport fixture tests real by-ID/detail loaders.
  fixture.rows=structuredClone(reviewedProposalWorks);
  assert.equal((await books.loadCatalogBook('1410','nl')).editionAvailable,false,'only after separate metadata correction; no runtime per-book exception');
  assert.ok(fixture.queries.every(table=>['works','editions','authors','catalog_work_descriptions','catalog_edition_metadata'].includes(table)),'no ratings/status/Auth writes or queries');
  assert.ok(fixture.sourceCalls<=3,'batched and cached, no per-Work metadata request waterfall');
 }finally{await vite.close();delete globalThis[marker];}
});
