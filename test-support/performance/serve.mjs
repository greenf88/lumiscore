// Loopback-only comparison: real router/UI; deterministic delayed public fixtures.
// No database, credentials, authenticated session or production performance claim.
import {createServer} from 'vite';
import vinext from 'vinext';
import tailwindcss from '@tailwindcss/postcss';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const baseline=process.argv.includes('--baseline'),port=baseline?3147:3148;
for(const key of Object.keys(process.env))if(/SUPABASE|DATABASE|GOOGLE_BOOKS/.test(key))delete process.env[key];
const bookSource=`const books=Array.from({length:8},(_,i)=>({id:'fixture-'+i,workId:String(i+1),title:'Measured fixture '+(i+1),author:'Synthetic author',cover:'orbit',score:null,ratingsCount:null,match:null}));`;
const modules={
 'lib/supabase/proxy.ts':`import {NextResponse} from 'next/server';export async function refreshSupabaseSession(request){return NextResponse.next({request})}`,
 'lib/server-environment.ts':`export const readServerEnvironment=()=> 'local-fixture';export function logServerEnvironmentPresence(){}`,
 'lib/supabase/auth.ts':`export async function loadHeaderAuthState(){return {authenticated:false}};export async function getVerifiedServerUser(){return {client:null,user:null}}`,
 'lib/supabase/books.ts':bookSource+`export async function loadHighestRatedCatalog(){await new Promise(r=>setTimeout(r,3500));return {books,total:10210}}`,
 'lib/supabase/categories.ts':`export async function loadPublicCategories(){return Array.from({length:20},(_,i)=>({id:String(i),en:'Category',nl:'Categorie'}))}`,
 'lib/supabase/taste-test.ts':`export async function loadHomepagePersonalization(){throw Error('Guest must never call personal loader')}`,
 'lib/supabase/collections.ts':`export async function loadHomepageSeriesContinuations(){throw Error('Guest must never call personal loader')}`,
};
if(baseline)modules['app/page.tsx']=execFileSync('git',['show','8f337dd4ee98fbfd5af45918ffb480b9bc5e0fd6:app/page.tsx'],{cwd:root,encoding:'utf8',windowsHide:true});
// Native performance observers exist only in this local measurement adapter.
const probe=`(()=>{const m={lcp:null,cls:0,paint:[],longTasks:[],ctaParsed:null};const publish=()=>{const n=performance.getEntriesByType('navigation')[0];m.nav=n?{ttfb:n.responseStart,body:n.responseEnd,domInteractive:n.domInteractive,load:n.loadEventEnd}:null;m.paint=performance.getEntriesByType('paint').map(e=>({name:e.name,start:e.startTime}));document.documentElement.setAttribute('data-local-performance',JSON.stringify(m));};for(const type of ['largest-contentful-paint','layout-shift','longtask'])try{new PerformanceObserver(list=>{for(const e of list.getEntries()){if(type==='largest-contentful-paint')m.lcp=e.startTime;if(type==='layout-shift'&&!e.hadRecentInput)m.cls+=e.value;if(type==='longtask')m.longTasks.push({start:e.startTime,duration:e.duration});}publish();}).observe({type,buffered:true});}catch{}const observe=new MutationObserver(()=>{if(m.ctaParsed===null&&document.querySelector('.primary-cta')){m.ctaParsed=performance.now();publish();}});observe.observe(document.documentElement,{childList:true,subtree:true});addEventListener('load',publish);addEventListener('DOMContentLoaded',publish);})();`;
let layout=await readFile(new URL('../../app/layout.tsx',import.meta.url),'utf8');
layout=layout.replace('<head>',`<head><script dangerouslySetInnerHTML={{__html:${JSON.stringify(probe)}}}/>`);
modules['app/layout.tsx']=layout;
modules['app/components/LumiScoreHome.tsx']=(await readFile(new URL('../../app/components/LumiScoreHome.tsx',import.meta.url),'utf8')).replace("window.addEventListener('keydown', handleShortcut);","document.documentElement.setAttribute('data-local-header-hydrated',String(performance.now()));window.addEventListener('keydown', handleShortcut);");
const server=await createServer({root,configFile:false,envFile:false,cacheDir:root+'node_modules/.vite-home-measure-'+port,resolve:{alias:{'@':root}},css:{postcss:{plugins:[tailwindcss()]}},plugins:[{name:'local-only-home-measure',enforce:'pre',load(id){const key=id.replaceAll('\\','/').replace(root.replaceAll('\\','/'),'').split('?')[0];return modules[key]??null;}},vinext()],server:{host:'127.0.0.1',port,strictPort:true}});
await server.listen();console.log(`LOCAL ONLY ${baseline?'BEFORE':'AFTER'} http://127.0.0.1:${port} — fixed3500ms public loader, no DB/Auth`);
