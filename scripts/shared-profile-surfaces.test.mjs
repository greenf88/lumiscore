// Actual consumer functions with an isolated synthetic SDK transport. The separate
// PGlite test proves the real schema/RLS/pagination; this is not hosted/Auth proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {buildEffectiveWorkTraitVector,evidenceRowsForTraits,reliableProfileTraits} from '../lib/recommendations/work-trait-evidence.ts';

test('actual result/account/home/detail adapters agree, retain guest answers and isolate users in NL/EN',async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url)),marker='__lumiscoreSharedProfileSyntheticTest';
 const rows=[],effective=new Map();
 for(const [id,traits] of [...Array.from({length:15},(_,i)=>[i+1,i<10?{fantasy:1,worldbuilding:.8}:{classic:1}]),[5001,{fantasy:1,worldbuilding:.8}],[5002,{science_fiction:1,complex:.6}],[5003,{thriller_mystery:1,dark:1}]]){
  const e=evidenceRowsForTraits({workId:String(id),traits,confidence:1,source:'manual',sourceKey:'synthetic',rawLabels:[],verifiedAt:'2026-10-15'});effective.set(String(id),buildEffectiveWorkTraitVector(e));
  rows.push(...e.map(r=>({work_id:id,trait:r.trait,weight:r.weight,confidence:r.confidence,source:r.source,source_key:r.sourceKey,raw_labels:[],mapping_version:r.mappingVersion,verified_at:r.verifiedAt})));
 }
 const books=[5001,5002,5003].map(id=>({id:'work-'+id,workId:String(id),source:'supabase',title:'Synthetic '+id,author:'Synthetic '+id,cover:'fallback',score:null,ratingsCount:null,match:null}));
 const fixture={owner:'synthetic-a',books,catalog:{traitsById:effective,candidates:books.map(book=>({...effective.get(book.workId),book,traits:reliableProfileTraits(effective.get(book.workId))}))}};
 const data={ratings:[...Array.from({length:15},(_,i)=>({user_id:'synthetic-a',work_id:i+1,rating:10})),{user_id:'synthetic-b',work_id:5001,rating:1}],user_book_status:[{user_id:'synthetic-a',work_id:99,status:'read'}],taste_test_responses:[{user_id:'synthetic-a',quiz_version:'taste_test_v1',question_key:'fantasy-or-science-fiction',choice:'right'}],work_trait_evidence:rows,collection_books:[],editions:books.flatMap((b,i)=>['en','nl'].map((language,j)=>({id:i*2+j+1,work_id:Number(b.workId),title:b.title,language,isbn_13:null,open_library_edition_id:null})))};
 fixture.client={auth:{async getUser(){return {data:{user:{id:fixture.owner}},error:null};}},async rpc(name){assert.equal(name,'taste_rating_state');return {data:{round:null},error:null};},from(table){assert.ok(Object.hasOwn(data,table));const filters=[];let order=[],range=null;
  const q={select(){return q;},eq(k,v){filters.push(r=>String(r[k])===String(v));return q;},in(k,ids){filters.push(r=>ids.map(String).includes(String(r[k])));return q;},or(value){const language=value.includes('.nl')?'nl':'en';filters.push(r=>r.language===language);return q;},order(k){order.push(k);return q;},range(lo,hi){range=[lo,hi];return q;},async then(resolve){let result=data[table].filter(r=>!r.user_id||r.user_id===fixture.owner).filter(r=>filters.every(f=>f(r)));result.sort((a,b)=>{for(const k of order){const c=typeof a[k]==='number'?a[k]-b[k]:String(a[k]).localeCompare(String(b[k]),'en');if(c)return c;}return 0;});if(range)result=result.slice(range[0],range[1]+1);return resolve({data:result,error:null});}};return q;}};
 globalThis[marker]=fixture;
 const modules={
  'lib/supabase/auth.ts':`const f=globalThis.${marker};export async function getVerifiedServerUser(){return {client:f.client,user:{id:f.owner}}}`,
  'lib/supabase/server.ts':`export async function createServerSupabaseClient(){return globalThis.${marker}.client}`,
  'lib/supabase/client.ts':`export const supabase=globalThis.${marker}.client`,
  'lib/supabase/books.ts':`const f=globalThis.${marker};export const mapCatalogWorks=()=>f.books;export async function loadCatalogBooksByIds(ids){return f.books.filter(b=>ids.includes(b.workId))};export const loadCatalogBooksByIdsWithStoredCovers=loadCatalogBooksByIds;`,
  'lib/supabase/recommendation-catalog.ts':`export async function loadRecommendationCatalog(){return globalThis.${marker}.catalog}`,
  'lib/supabase/collaborative.ts':'export async function loadCollaborativeRecommendationSignals(){return new Map()}',
  'lib/supabase/reading-preferences.ts':'export async function loadReaderEraPreferences(){return null}',
  'lib/supabase/cover-resolutions.ts':'export async function loadStoredCoverResolutionsBatched(){return {available:true,entries:[]}}',
 };
 const vite=await createServer({root,configFile:false,envFile:false,cacheDir:root+'.wrangler/node_modules/shared-surfaces-vite',resolve:{alias:{'@':root}},plugins:[{name:'synthetic-transport-only',enforce:'pre',load(id){return modules[id.replaceAll('\\','/').replace(root.replaceAll('\\','/'),'').split('?')[0]]??null;}}],server:{middlewareMode:true,hmr:false}});
 try{
  const home=await vite.ssrLoadModule('/lib/supabase/taste-test.ts'),result=await vite.ssrLoadModule('/lib/supabase/rating-result.ts'),account=await vite.ssrLoadModule('/lib/supabase/reading-profile.ts');
  for(const owner of ['synthetic-a','synthetic-b'])for(const locale of ['nl','en']){
   fixture.owner=owner;
   const context=await home.loadHomepageReaderContext(locale),reading=await account.loadReadingProfileForOwner(fixture.client,owner,locale),rated=await result.loadRatingResult(locale),recommendations=await home.loadHomepagePersonalization(locale,3);
   assert.equal(rated.kind,'result');assert.deepEqual(reading.profile,context.profile);assert.deepEqual(rated.profile,context.profile);
   assert.equal(context.profile.ratingCount,owner==='synthetic-a'?15:1);assert.equal(context.profile.selectedCount,owner==='synthetic-a'?1:0);
   assert.equal(reading.totals.rated,context.profile.ratingCount);assert.equal(reading.totals.read,owner==='synthetic-a'?16:1);
   assert.equal(recommendations.unavailable,undefined);
   if(owner==='synthetic-a')assert.ok(recommendations.recommendations.length>0,'real strict-edition adapter must not silently filter every candidate');
   for(const recommendation of [...recommendations.recommendations,...rated.recommendations])assert.equal(recommendation.book.strictEditionLanguage,locale);
   for(const book of books){const detail=await home.loadBookDetailPersonalization(book.workId,locale),fromHome=recommendations.recommendations.find(r=>r.book.workId===book.workId),fromResult=rated.recommendations.find(r=>r.book.workId===book.workId);
    assert.equal(detail.authenticated,true);if(fromHome){assert.equal(fromHome.matchScore,detail.match.matchScore);assert.equal(fromHome.matchConfidence,detail.match.matchConfidence);}if(fromResult){assert.equal(fromResult.matchScore,detail.match.matchScore);assert.equal(fromResult.matchConfidence,detail.match.matchConfidence);}
   }
  }
 }finally{await vite.close();delete globalThis[marker];}
});
