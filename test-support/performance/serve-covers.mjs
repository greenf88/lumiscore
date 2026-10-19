// Loopback only. Real RSC/card UI and edition evidence resolver; slow public fixture.
// Never loaded by the application or deployment; no DB, cookies or credentials.
import {createServer} from 'vite';
import vinext from 'vinext';
import tailwindcss from '@tailwindcss/postcss';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=fileURLToPath(new URL('../../',import.meta.url));
const before=process.argv.includes('--before'),failure=process.argv.includes('--failure'),port=failure?3164:before?3162:3163;
for(const key of Object.keys(process.env))if(/SUPABASE|DATABASE|GOOGLE_BOOKS/.test(key))delete process.env[key];
const fixture=`import {withEditionCoverEvidence,deferEditionCoverEvidence,clearEditionCoverEvidenceCacheForTests} from '@/lib/books/edition-cover-evidence';
const fetcher=async input=>{await new Promise(r=>setTimeout(r,3500));const keys=JSON.parse(new URL(String(input)).searchParams.get('keys'));return new Response(JSON.stringify({status:'ok',result:Object.fromEntries(keys.map(key=>[key,{key,title:'Local cover timing book',works:[{key:'/works/OL1W'}],languages:[{key:'/languages/eng'}],covers:[]}]))}));};
const books=Array.from({length:8},(_,i)=>({id:'work-'+(i+1),workId:String(i+1),title:'Local cover timing book',author:'Synthetic author',source:'supabase',cover:'orbit',score:8,ratingsCount:4,ratingBand:'3–4',match:null,editionAvailable:true,editionId:String(i+1),openLibraryEditionId:'OL'+(i+1)+'M',openLibraryWorkId:'OL1W',editionLanguage:'eng',strictEditionLanguage:'en',coverUrls:[]}));
export async function loadHighestRatedCatalog(){clearEditionCoverEvidenceCacheForTests();${failure ? "throw Error('Local catalog failure');" : `return {books:${before?'await withEditionCoverEvidence(books,fetcher)':'deferEditionCoverEvidence(books,fetcher)'},total:8};`}}
`;
const modules={
 'lib/supabase/proxy.ts':`import {NextResponse} from 'next/server';export async function refreshSupabaseSession(request){return NextResponse.next({request})}`,
 'lib/server-environment.ts':`export const readServerEnvironment=()=> 'local-fixture';export function logServerEnvironmentPresence(){}`,
 'lib/supabase/auth.ts':`export async function loadHeaderAuthState(){return {authenticated:false}};export async function getVerifiedServerUser(){return {client:null,user:null}}`,
 'lib/supabase/books.ts':fixture,
 'lib/supabase/categories.ts':`export async function loadPublicCategories(){return []}`,
 'lib/supabase/taste-test.ts':`export async function loadHomepagePersonalization(){throw Error('Guest must never call personal loader')}`,
 'lib/supabase/collections.ts':`export async function loadHomepageSeriesContinuations(){throw Error('Guest must never call personal loader')}`,
};
if(before)modules['app/page.tsx']=execFileSync('git',['show','22387fe61bdabfb2d0795cc97a3d4479af1d7974:app/page.tsx'],{cwd:root,encoding:'utf8',windowsHide:true});
if(failure)modules['app/page.tsx']=(await readFile(new URL('../../app/page.tsx',import.meta.url),'utf8')).replaceAll("process.env.NODE_ENV === 'production'",'true');
const probe=`(()=>{const m={lcp:null,cls:0,hero:null,cards:null};const publish=()=>{const n=performance.getEntriesByType('navigation')[0];m.ttfb=n?.responseStart;m.responseEnd=n?.responseEnd;m.fcp=performance.getEntriesByName('first-contentful-paint')[0]?.startTime;document.documentElement.setAttribute('data-local-performance',JSON.stringify(m));};for(const type of ['largest-contentful-paint','layout-shift'])try{new PerformanceObserver(list=>{for(const e of list.getEntries()){if(type==='largest-contentful-paint')m.lcp=e.startTime;else if(!e.hadRecentInput)m.cls+=e.value;}publish();}).observe({type,buffered:true});}catch{}new MutationObserver(()=>{if(m.hero===null&&document.querySelector('.primary-cta'))m.hero=performance.now();if(m.cards===null&&document.querySelector('.book-card'))m.cards=performance.now();publish();}).observe(document.body||document.documentElement,{childList:true,subtree:true});addEventListener('load',publish);})();`;
modules['app/layout.tsx']=(await readFile(new URL('../../app/layout.tsx',import.meta.url),'utf8')).replace('<head>',`<head><script dangerouslySetInnerHTML={{__html:${JSON.stringify(probe)}}}/>`);
modules['app/components/LumiScoreHome.tsx']=(await readFile(new URL('../../app/components/LumiScoreHome.tsx',import.meta.url),'utf8')).replace("window.addEventListener('keydown', handleShortcut);","document.documentElement.setAttribute('data-local-header-hydrated',String(performance.now()));window.addEventListener('keydown', handleShortcut);");
const server=await createServer({root,configFile:false,envFile:false,cacheDir:root+'node_modules/.vite-cover-measure-'+port,resolve:{alias:{'@':root}},css:{postcss:{plugins:[tailwindcss()]}},plugins:[{name:'local-cover-timing-only',enforce:'pre',load(id){return modules[id.replaceAll('\\','/').replace(root.replaceAll('\\','/'),'').split('?')[0]]??null;}},vinext()],server:{host:'127.0.0.1',port,strictPort:true}});
await server.listen();console.log(`LOCAL ONLY http://127.0.0.1:${port} ${before?'BEFORE':'AFTER'}; source3500ms, no DB/Auth`);
