// Explicit loopback synthetic review only. Not imported by app/build; no hosted bypass.
import {createServer} from 'vite';
import vinext from 'vinext';
import tailwindcss from '@tailwindcss/postcss';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),port=Number(process.env.COLLECTION_REVIEW_PORT??3132);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid local review port');
for(const key of Object.keys(process.env))if(/SUPABASE|DATABASE|SECRET|TOKEN|GOOGLE_BOOKS/.test(key))delete process.env[key];
const fixture=JSON.stringify(root.replaceAll('\\','/')+'test-support/collection-quick-rating/fixture.ts');
const context=`import {cookies} from 'next/headers';import {requestPagePath} from '@/lib/i18n/server';export async function reviewMode(){return new URL(await requestPagePath(),'http://local').searchParams.get('review')??(await cookies()).get('collection-review-mode')?.value??'reader'}`;
const modules={
 'lib/supabase/auth.ts':`${context};import {userFor} from ${fixture};export async function getVerifiedServerUser(){const id=userFor(await reviewMode());return {user:id?{id,email:'synthetic@example.invalid',user_metadata:{display_name:'Lokale reviewer'}}:null,client:{}}};export async function loadHeaderAuthState(){return {authenticated:Boolean((await getVerifiedServerUser()).user),displayName:'Lokale reviewer',avatarLetter:'L'}}`,
 'lib/supabase/collections.ts':`${context};import {dataFor} from ${fixture};export async function loadCollectionPageData(slug){return slug==='suzanne-vermeer'?dataFor(await reviewMode()):null};export async function loadHomepageSeriesContinuations(){return []}`,
 'lib/supabase/proxy.ts':'export async function refreshSupabaseSession(){return {cookies:{getAll:()=>[]},headers:new Headers()}}',
 'lib/server-environment.ts':`export function logServerEnvironmentPresence(){};export function readServerEnvironment(){return 'LOCAL_FIXTURE_ONLY'}`,
};
const json=(res,body,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
const server=await createServer({root,configFile:false,envFile:false,cacheDir:root+'.wrangler/node_modules/collection-review-3132-vite',resolve:{alias:{'@':root}},css:{postcss:{plugins:[tailwindcss()]}},plugins:[{
 name:'loopback-collection-review',enforce:'pre',load(id){return modules[id.replaceAll('\\','/').replace(root.replaceAll('\\','/'),'').split('?')[0]]??null;},
 configureServer(vite){vite.middlewares.use(async(req,res,next)=>{
  const url=new URL(req.url,`http://127.0.0.1:${port}`),mode=url.searchParams.get('review')??/collection-review-mode=([a-z]+)/.exec(req.headers.cookie??'')?.[1]??'reader';
  if(url.searchParams.has('review'))res.setHeader('Set-Cookie',`collection-review-mode=${mode}; Path=/; HttpOnly; SameSite=Lax`);
  if(url.pathname==='/collection-review-cover.svg'){res.writeHead(200,{'Content-Type':'image/svg+xml'});return res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><rect width="200" height="300" fill="#244a50"/><circle cx="130" cy="175" r="85" fill="#b59051"/><text x="16" y="35" fill="#fff" font-size="17">LOKALE TESTCOVER</text><text x="16" y="65" fill="#fff" font-size="20">Een winter aan zee</text></svg>');}
  if(url.pathname==='/api/book-status')return json(res,{authenticated:mode!=='guest',statuses:{}});
  if(url.pathname==='/api/account/reading-preferences')return json(res,{onboardingDismissed:true});
  if(url.pathname==='/api/collections/suzanne-vermeer/rating-session'){
   const f=await vite.ssrLoadModule('/test-support/collection-quick-rating/fixture.ts');return json(res,{data:f.dataFor(mode),userId:f.userFor(mode)},mode==='guest'?401:200);
  }
  if(url.pathname.startsWith('/api/ratings/')&&req.method==='PUT'){
   const f=await vite.ssrLoadModule('/test-support/collection-quick-rating/fixture.ts');let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2048)return json(res,{},413);}
   const body=JSON.parse(raw),result=await f.save(mode,url.pathname.split('/').at(-1),body.rating,body.onlyIfUnrated===true,body.expectedUserId??f.userFor(mode));return json(res,result.body,result.status);
  }
  if(url.pathname==='/__review/state'){const f=await vite.ssrLoadModule('/test-support/collection-quick-rating/fixture.ts');return json(res,f.metrics());}
  next();
 });}
},vinext()],server:{host:'127.0.0.1',port,strictPort:true}});
await server.listen();console.log(`LOCAL SYNTHETIC REVIEW ONLY http://127.0.0.1:${port}/nl/collection/suzanne-vermeer/rate — ?review=reader|guest|b|empty|all|error|slow|ambiguous`);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await server.close();process.exit(0);});
