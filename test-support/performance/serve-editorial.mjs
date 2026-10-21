// LOCAL ONLY: actual public production reads, strictly bounded to the 35 editorial
// Work IDs. No session, secret key, user table, write, or new app endpoint ships.
import {createServer} from 'vite';
import vinext from 'vinext';
import tailwindcss from '@tailwindcss/postcss';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const before=process.argv.includes('--before'),brokenLarge=process.argv.includes('--broken-large'),port=brokenLarge?3170:before?3167:3168;
const envFile=process.env.EDITORIAL_PUBLIC_ENV_FILE;
if(!envFile)throw Error('Explicit existing public-only configuration source required');
const env=await readFile(envFile,'utf8');
const value=name=>env.match(new RegExp('^'+name+'=(.*)$','m'))?.[1]?.trim().replace(/^['"]|['"]$/g,'');
const url=value('NEXT_PUBLIC_SUPABASE_URL'),key=value('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
if(url!=='https://qvplwejffhjvxaypmjut.supabase.co'||!key||!(key.startsWith('sb_publishable_')||key.startsWith('eyJ')))throw Error('Expected existing public production catalogue config');
for(const name of Object.keys(process.env))if(/SUPABASE|DATABASE|GOOGLE_BOOKS/.test(name))delete process.env[name];
// Legacy public JWTs must be anon, never service role.
if(key.startsWith('eyJ')&&JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role!=='anon')throw Error('Non-public key rejected');
const ids=JSON.parse(await readFile(new URL('../../lib/catalog/top-lists.json',import.meta.url),'utf8')).books.map(b=>b.workId);
const client=`import {createClient} from '@supabase/supabase-js';
const allowed=new Set(${JSON.stringify(ids)}),nativeFetch=globalThis.fetch;
export const supabase=createClient(${JSON.stringify(url)},${JSON.stringify(key)},{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(input,init)=>{
  const url=new URL(String(input)),method=init?.method??'GET';
  const rpc=url.pathname==='/rest/v1/rpc/get_work_rating_summaries_v2';
  if(rpc){const ids=JSON.parse(init.body).target_work_ids;if(!Array.isArray(ids)||ids.some(id=>!allowed.has(String(id))))throw Error('Unapproved aggregate IDs');}
  else{if(method!=='GET'||!['/rest/v1/works','/rest/v1/editions'].includes(url.pathname))throw Error('Blocked non-catalogue read or mutation');
    const filter=url.searchParams.get(url.pathname.endsWith('/works')?'id':'work_id');const ids=filter?.match(/\\d+/g)??[];
    if(!ids.length||ids.some(id=>!allowed.has(id)))throw Error('Unbounded or out-of-scope catalogue read');}
  const started=Date.now(),response=await nativeFetch(input,init);let rows=null;
  try{const data=await response.clone().json();rows=Array.isArray(data)?data.length:data?1:0;}catch{}
  console.info(JSON.stringify({event:'editorial_public_query',kind:rpc?'aggregate':url.pathname.split('/').at(-1),method,status:response.status,rows,ms:Date.now()-started}));return response;
}}});`;
const modules={
 'lib/supabase/client.ts':client,
 'lib/supabase/proxy.ts':`import {NextResponse} from 'next/server';export async function refreshSupabaseSession(request){return NextResponse.next({request})}`,
 'lib/supabase/auth.ts':`export async function loadHeaderAuthState(){return {authenticated:false}};export async function getVerifiedServerUser(){return {client:null,user:null}}`,
 // Side panels are outside this public bibliographic inspection. Do not let
 // blocked out-of-scope reads/retries distort the local page comparison.
 'lib/supabase/collections.ts':`export async function loadBookCollectionContext(){return null};export async function loadVerifiedBookCollectionReturnTarget(){return null}`,
 'lib/supabase/taste-test.ts':`export async function loadBookDetailPersonalization(){return {authenticated:false,unavailable:false,hasEvidence:false,candidate:null,match:null}}`,
};
if(before)for(const path of ['app/toplijsten/[slug]/page.tsx','app/components/EditorialTopList.tsx','app/components/LumiScoreHome.tsx','lib/catalog/top-lists.ts','lib/catalog/top-lists.json','lib/supabase/books.ts','lib/books/strict-edition.ts','lib/books/covers.ts','lib/supabase/ratings.ts','lib/ratings/card-summaries.ts','lib/supabase/public-rating-summaries.ts','lib/books/edition-cover-evidence.ts']){
 modules[path]=execFileSync('git',['-c','safe.directory='+root.replace(/\/$/,''),'show','a668d8fd9ff964175ba0b9a55db706d3f5f0b047:'+path],{cwd:root,encoding:'utf8',windowsHide:true});
}
// Failure injection only in this loopback adapter: retain the exact verified
// cover ID, fail L deliberately, forward only M/S of that same ID. No browser
// interception, production route, persisted cover or catalogue change.
if(brokenLarge)for(const path of ['lib/books/covers.ts','lib/books/reviewed-cover-overrides.ts']){
 modules[path]=(await readFile(new URL('../../'+path,import.meta.url),'utf8')).replaceAll('https://covers.openlibrary.org/b',`http://127.0.0.1:${port}/__verified-cover/b`);
}
const probe=`(()=>{const m={firstCard:null,coverLoaded:null,lcp:null,cls:0};const publish=()=>{const n=performance.getEntriesByType('navigation')[0];m.ttfb=n?.responseStart;m.responseEnd=n?.responseEnd;m.fcp=performance.getEntriesByName('first-contentful-paint')[0]?.startTime;document.documentElement.setAttribute('data-local-performance',JSON.stringify(m));};new MutationObserver(()=>{if(m.firstCard===null&&document.querySelector('.book-card'))m.firstCard=performance.now();publish();}).observe(document.documentElement,{childList:true,subtree:true});document.addEventListener('load',e=>{if(m.coverLoaded===null&&e.target.matches?.('.book-cover-image')){m.coverLoaded=performance.now();publish();}},true);for(const type of ['largest-contentful-paint','layout-shift'])try{new PerformanceObserver(list=>{for(const e of list.getEntries()){if(type==='largest-contentful-paint')m.lcp=e.startTime;else if(!e.hadRecentInput)m.cls+=e.value;}publish();}).observe({type,buffered:true});}catch{}addEventListener('load',publish);})();`;
const visibleProbe=`(()=>{let observing=false;new MutationObserver(()=>{const card=document.querySelector('.book-card');if(card&&!observing){observing=true;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){document.documentElement.setAttribute('data-local-first-card-visible',String(performance.now()));observer.disconnect();}});observer.observe(card);}}).observe(document.documentElement,{childList:true,subtree:true});})();`;
modules['app/layout.tsx']=(await readFile(new URL('../../app/layout.tsx',import.meta.url),'utf8')).replace('<head>',`<head><script dangerouslySetInnerHTML={{__html:${JSON.stringify(probe+visibleProbe)}}}/>`);
const server=await createServer({root,configFile:false,envFile:false,cacheDir:root+'node_modules/.vite-editorial-'+port,resolve:{alias:{'@':root}},css:{postcss:{plugins:[tailwindcss()]}},plugins:[{name:'loopback-editorial-public-only',enforce:'pre',load(id){const path=id.replaceAll('\\','/').replace(root.replaceAll('\\','/'),'').split('?')[0];return modules[path]??null;},configureServer(server){if(brokenLarge)server.middlewares.use(async(req,res,next)=>{
 if(!req.url?.startsWith('/__verified-cover/'))return next();
 const image=new URL(req.url,'http://127.0.0.1'),match=image.pathname.match(/^\/__verified-cover\/b\/id\/(7890713|15120650|13160732|8768819|15152462|2787713|12508446|12455001|9157148)-([LMS])\.jpg$/);
 if(!match){res.statusCode=400;return res.end();}
 if(match[2]==='L'){res.statusCode=404;console.info('LOCAL COVER FAULT '+match[1]+' L=404');return res.end();}
 try{const response=await fetch('https://covers.openlibrary.org/b/id/'+match[1]+'-'+match[2]+'.jpg?default=false',{signal:AbortSignal.timeout(8000)});res.statusCode=response.status;res.setHeader('Content-Type',response.headers.get('content-type')??'image/jpeg');res.end(Buffer.from(await response.arrayBuffer()));console.info('LOCAL SAME-ID COVER '+match[1]+' '+match[2]+'='+response.status);}catch{res.statusCode=503;res.end();}
 });}},vinext()],server:{host:'127.0.0.1',port,strictPort:true}});
await server.listen();console.log(`LOCAL ${before?'BASELINE':'FIX'} http://127.0.0.1:${port}; 35 approved public identities, read-only, guest only`);
