// Real Vinext router/SSR/metadata and UI; synthetic loader substitutes in this
// loopback-only dev process. No DB, credentials, Auth writes or external fetches.
import { createServer } from 'vite';
import vinext from 'vinext';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
// An isolated header fixture, not a real session or hosted Auth connection.
const headerFixture = process.argv.includes('--header-authenticated');
const portOption=process.argv.find(arg=>arg.startsWith('--port='))?.slice(7);
if(portOption && (!/^\d{4,5}$/.test(portOption)||Number(portOption)<1024||Number(portOption)>65535))throw Error('Invalid loopback review port');
const port = portOption ? Number(portOption) : headerFixture ? 3121 : 3120;
for (const key of Object.keys(process.env)) if (/SUPABASE|GOOGLE_BOOKS|DATABASE/.test(key)) delete process.env[key];
const bookSource = `export const books = Array.from({length:80},(_,i)=>({id:'synthetic-'+i,source:'supabase',workId:String(i+1),editionId:String(i+1),title:'Synthetic book '+(i+1),author:'Synthetic author',firstPublishYear:2000,score:null,ratingsCount:null,match:null,cover:'orbit',openLibraryWorkId:'OL'+(i+1)+'W'}));`;
const modules = {
  'lib/supabase/auth.ts': `export async function loadHeaderAuthState(){return {authenticated:${headerFixture}}};export async function getVerifiedServerUser(){return {client:null,user:null}}`,
  'lib/supabase/books.ts': bookSource + `export async function loadCatalogBook(id){return books.find(b=>b.workId===id)??null};export async function loadHighestRatedCatalog(limit){return {books:books.slice(0,limit),total:80}};export async function loadCatalogBooksByIds(ids){return books.filter(b=>ids.includes(b.workId))};export const loadCatalogBooksByIdsWithStoredCovers=loadCatalogBooksByIds;`,
  'lib/supabase/editorial-catalog.ts': bookSource + `export function unavailableEditorialPage(s){return {books:[],total:0,page:1,pageSize:s.pageSize,pageCount:1,sort:s.sort,facets:{},selectionCount:0,available:false,categories:[],selectedAuthor:null,discoveryAvailable:true}};export async function loadEditorialCatalog(s){return {...unavailableEditorialPage(s),books:books.slice((s.page-1)*s.pageSize,s.page*s.pageSize),total:80,page:s.page,pageCount:Math.ceil(80/s.pageSize),available:true}}`,
  'lib/supabase/categories.ts': `export async function loadPublicCategories(){return [{id:'fiction',en:'Fiction',nl:'Fictie'}]}`,
  'lib/supabase/ratings.ts': `export async function loadBookRatingState(){return {authenticated:false,userEmail:null,userRating:null,lumiscore:null,ratingCount:null}}`,
  'lib/supabase/book-status.ts': `export async function loadUserBookStatuses(){return {authenticated:false,statuses:new Map()}};export async function loadMyBooksPageData(){return {authenticated:false,available:true,items:[]}}`,
  'lib/supabase/taste-test.ts': `export async function loadBookDetailPersonalization(){return {authenticated:false,hasEvidence:false,candidate:null,match:null}};export async function loadHomepagePersonalization(){return {authenticated:false,hasEvidence:false,recommendations:[],ratingCount:0,tasteTestAnsweredCount:0}}`,
  'lib/books/public-description.ts': `export async function loadPublicBookDescriptionState(book,locale){const description=book.workId==='2'?null:{text:locale==='nl'?'Dit is een synthetische Nederlandse beschrijving. Een reiziger ontdekt een onbekende wereld.':'This is a synthetic English description. A traveller discovers an unknown world.',source:'open_library',sourceKey:book.openLibraryWorkId,verifiedAt:'2026-10-07',language:locale};return {state:description?'resolved':'confirmed_missing',description}}`,
  'lib/supabase/collections.ts': bookSource + `const collection={id:'1',slug:'synthetic-series',name:'Synthetic series',collectionType:'series',description:'Synthetic English series description.',expectedMainSeriesTotal:2};export async function loadCollectionsDirectory(){return {collections:[],total:0}};export async function loadCollectionPageData(slug){return slug!==collection.slug?null:{collection,books:books.slice(0,2).map((book,i)=>({book,workId:book.workId,sequenceNumber:i+1,publicationOrder:i+1,subgroup:null})),authenticated:false,statuses:{},ratedWorkIds:[],userRatings:{},progress:{read:0,cataloguedTotal:2,total:2,percentage:0},highlightedUnreadWorkId:null}};export async function loadBookCollectionContext(){return null};export async function loadVerifiedBookCollectionReturnTarget(id,slug){return slug===collection.slug?{slug,name:collection.name}:null};export async function loadHomepageSeriesContinuations(){return []}`,
  'lib/supabase/client.ts': `export const supabase={from(table){const rows=table==='works'?[{id:1},{id:2}]:[{slug:'synthetic-series'}];return {select(){return this},order(){return this},async range(start){return {data:start?[]:rows,error:null}}}}}`,
};
// Explicit loopback-only fault/performance comparison. Neither the source
// replacement nor this probe is part of a deployment or production build.
if(process.argv.includes('--slow-cover')){
 modules['lib/supabase/books.ts']=modules['lib/supabase/books.ts'].replace('return books.find(b=>b.workId===id)??null',"const book=books.find(b=>b.workId===id);return book?{...book,strictEditionLanguage:'en',editionAvailable:true,editionCoverUrls:new Promise(r=>setTimeout(()=>r(['https://example.invalid/reviewed-cover.jpg']),2000))}:null");
}
if(process.argv.includes('--slow-description')){
 const original=modules['lib/books/public-description.ts'];
 modules['lib/books/public-description.ts']=original.replace('const description=',"await new Promise(r=>setTimeout(r,2000));const description=")+`;export async function loadPublicBookDescription(...args){return (await loadPublicBookDescriptionState(...args)).description}`;
 if(process.argv.includes('--baseline'))for(const file of ['app/book/[workId]/page.tsx','app/components/LumiScoreBookDetail.tsx','app/components/LumiScoreBookDescription.tsx']){
  modules[file]=execFileSync('git',['-c','safe.directory='+root.replace(/\/$/,''),'show','571108e181e2db406aac2886b3ee1eb08ac7f37d:'+file],{cwd:root,encoding:'utf8',windowsHide:true});
 }
 const probe=`(()=>{const m={firstMain:null,lcp:null,cls:0};const publish=()=>{const n=performance.getEntriesByType('navigation')[0];m.ttfb=n?.responseStart;m.responseEnd=n?.responseEnd;document.documentElement.setAttribute('data-local-performance',JSON.stringify(m));};new MutationObserver(()=>{if(m.firstMain===null&&document.querySelector('main h1'))m.firstMain=performance.now();publish();}).observe(document.documentElement,{childList:true,subtree:true});for(const type of ['largest-contentful-paint','layout-shift'])try{new PerformanceObserver(list=>{for(const e of list.getEntries()){if(type==='largest-contentful-paint')m.lcp=e.startTime;else if(!e.hadRecentInput)m.cls+=e.value;}publish();}).observe({type,buffered:true});}catch{}addEventListener('load',publish);})();`;
 modules['app/layout.tsx']=(await readFile(root+'app/layout.tsx','utf8')).replace('<head>',`<head><script dangerouslySetInnerHTML={{__html:${JSON.stringify(probe)}}}/>`);
}
const server = await createServer({ root, configFile:false, envFile:false, cacheDir:root+'node_modules/.vite-seo-critical-'+port,
  css:{postcss:{plugins:[tailwindcss()]}}, resolve:{alias:{'@':root}},
  plugins:[{name:'loopback-synthetic-seo-loaders',enforce:'pre',load(id){const relative=id.replaceAll('\\','/').replace(root.replaceAll('\\','/'),'').split('?')[0];return modules[relative]??null}},vinext()],
  server:{host:'127.0.0.1',port,strictPort:true},
});
await server.listen();
console.log(`SYNTHETIC SEO SSR PREVIEW http://127.0.0.1:${port}/en and /nl — no database${headerFixture ? ', authenticated header fixture only' : ''}`);
