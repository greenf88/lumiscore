// Explicit loopback-only fixture. Never loaded by the app/build; no Auth or DB access.
import {createServer} from 'vite';
import vinext from 'vinext';
import tailwindcss from '@tailwindcss/postcss';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),port=3182;
for(const key of Object.keys(process.env))if(/SUPABASE|DATABASE|SECRET|TOKEN|GOOGLE_BOOKS/.test(key))delete process.env[key];
const modules={
 'lib/supabase/client.ts':'export const supabase=null;',
 'lib/supabase/proxy.ts':'export async function refreshSupabaseSession(){return {cookies:{getAll:()=>[]},headers:new Headers()}}',
 'lib/server-environment.ts':"export function logServerEnvironmentPresence(){};export function readServerEnvironment(){return 'LOCAL_FIXTURE_ONLY'}",
 'app/book/[workId]/page.tsx':`import {LumiScoreBookDetail} from '@/app/components/LumiScoreBookDetail';
 export default function Review(){return <LumiScoreBookDetail
 book={{id:'work-6',workId:'6',title:'Local synthetic menu review',author:'Test fixture',cover:'orbit',coverUrls:[],score:null,ratingsCount:0,match:null}}
 description={null} initialReadingStatus={null} collectionContext={null}
 initialRatingState={{authenticated:true,userEmail:'synthetic@example.invalid',userRating:null,lumiscore:null,ratingCount:0}}
 personalization={{authenticated:true,hasEvidence:false,candidate:null,match:null}}
 authState={{authenticated:true,displayName:'Synthetic reviewer',avatarLetter:'S'}}
 returnNavigation={{kind:'browse',href:'/browse'}}/>}`,
};
const server=await createServer({root,configFile:false,envFile:false,cacheDir:root+'.wrangler/node_modules/account-review',
 css:{postcss:{plugins:[tailwindcss()]}},resolve:{alias:{'@':root}},plugins:[{
 name:'loopback-account-review',enforce:'pre',load(id){return modules[id.replaceAll('\\','/').replace(root.replaceAll('\\','/'),'').split('?')[0]]??null},
 configureServer(vite){vite.middlewares.use((req,res,next)=>{
  if(req.url.startsWith('/api/')){res.writeHead(req.method==='GET'?200:405,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify({onboardingDismissed:false,statuses:{}}));}next();
 });}
 },vinext()],server:{host:'127.0.0.1',port,strictPort:true}});
await server.listen();console.log(`LOCAL SYNTHETIC MENU REVIEW http://127.0.0.1:${port}/en/book/6 — no database or account writes`);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await server.close();process.exit(0)});
