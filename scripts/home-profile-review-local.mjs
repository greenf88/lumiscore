// Loopback real SSR routes/components, synthetic adapters only. No credentials,
// remote Supabase, production data, sign-in, database or session-security proof.
import {createServer} from 'vite';
import vinext from 'vinext';
import tailwindcss from '@tailwindcss/postcss';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const largeText=process.argv.includes('--large-text'),port=largeText?3125:3124;
for(const key of Object.keys(process.env))if(/SUPABASE|DATABASE|SECRET|TOKEN|GOOGLE_BOOKS/.test(key))delete process.env[key];
const fixture=JSON.stringify(root.replaceAll('\\','/')+'test-support/reading-profile/fixture.ts');
const auth=`import {cookies} from 'next/headers';import {requestPagePath} from '@/lib/i18n/server';import {fixtureUser,fixtureClient} from ${fixture};
 export async function getVerifiedServerUser(){const mode=new URL(await requestPagePath(),'http://local').searchParams.get('review')??(await cookies()).get('profile-review-${port}')?.value??'reader';return {user:fixtureUser(mode),client:fixtureClient(mode)}};
 export async function loadHeaderAuthState(){const {user}=await getVerifiedServerUser();return user?{authenticated:true,displayName:user.user_metadata.display_name,avatarLetter:'L'}:{authenticated:false}}`;
const modules={
 'lib/supabase/auth.ts':auth,
 'lib/supabase/books.ts':`export {books,loadHighestRatedCatalog,loadCatalogBooksByIds,loadCatalogBooksByIdsWithStoredCovers,loadCatalogBook} from ${fixture};`,
 'lib/server-environment.ts':`export function logServerEnvironmentPresence(){};export function readServerEnvironment(){return 'LOCAL_FIXTURE_ONLY'}`,
 'lib/supabase/proxy.ts':`export async function refreshSupabaseSession(){return {cookies:{getAll:()=>[]},headers:new Headers()}}`,
 'lib/supabase/categories.ts':'export async function loadPublicCategories(){return []}',
 'lib/supabase/taste-test.ts':`import {books} from ${fixture};export async function loadHomepagePersonalization(){return {authenticated:true,hasEvidence:true,ratingCount:10,tasteTestAnsweredCount:10,recommendations:books.slice(0,3).map(book=>({book,matchScore:null,matchLabel:null,matchConfidence:'low',explanation:'Lokale synthetische visuele fixture.',coverageLevel:'partial',metadataConfidence:.7,collaborativeExplanation:''}))}}`,
 'lib/supabase/collections.ts':'export async function loadHomepageSeriesContinuations(){return []}',
};
const json=(res,data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
let round=null,position=0;
const server=await createServer({root,configFile:false,envFile:false,cacheDir:root+'.wrangler/node_modules/profile-review-vite',css:{postcss:{plugins:[tailwindcss()]}},resolve:{alias:{'@':root}},plugins:[{
 name:'loopback-profile-review',enforce:'pre',load(id){return modules[id.replaceAll('\\','/').replace(root.replaceAll('\\','/'),'').split('?')[0]]??null;},
 transform(code,id){
  if(largeText&&id.replaceAll('\\','/').split('?')[0]===root.replaceAll('\\','/')+'app/globals.css')return code+`
  /* LOCAL synthetic 200% text stress, not browser zoom or production CSS. */
  .reading-profile-page h1,.taste-direct-test h1 {font-size:60px!important}
  .reading-profile-page .reading-profile-name {font-size:36px!important}
  .reading-profile-page .reading-profile-email,.reading-profile-totals dt,.reading-profile-count-note {font-size:28px!important}
  .reading-profile-totals dd {font-size:88px!important}
  .reading-profile-page .taste-profile h2 {font-size:48px!important}
  .reading-profile-page .taste-profile p,.reading-profile-page .taste-preferences,.reading-profile-page a,.reading-profile-page button,.taste-entry-actions a,.taste-direct-test .taste-result-link {font-size:32px!important}
  .hero-copy h1 {font-size:calc(var(--type-hero)*2)!important}
  .hero-primary,.hero-paper-copy {font-size:28px!important}
  .hero .hero-eyebrow,.learn-link {font-size:26px!important}
  `;
 },
 configureServer(vite){vite.middlewares.use(async(req,res,next)=>{
  const url=new URL(req.url,`http://127.0.0.1:${port}`);
  const mode=url.searchParams.get('review')??new RegExp('profile-review-'+port+'=([a-z]+)').exec(req.headers.cookie??'')?.[1]??'reader';
  req.headers['x-local-profile-review']=mode;
  if(url.searchParams.has('review'))res.setHeader('Set-Cookie',`profile-review-${port}=${mode}; Path=/; HttpOnly; SameSite=Lax`);
  if(url.pathname==='/profile-review-cover.svg'){res.writeHead(200,{'Content-Type':'image/svg+xml'});return res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><rect width="200" height="300" fill="#23464d"/><circle cx="120" cy="130" r="64" fill="#d1a963"/><text x="16" y="38" fill="#f7f3eb" font-family="Georgia" font-size="18">Een nieuwe horizon</text></svg>');}
  if(url.pathname==='/api/book-status')return json(res,{authenticated:mode!=='guest',statuses:{}});
  if(url.pathname==='/api/account/reading-preferences')return json(res,{onboardingDismissed:true});
  if(url.pathname==='/api/taste-test/result'){const f=await vite.ssrLoadModule('/test-support/reading-profile/fixture.ts');return json(res,f.profileResult());}
  if(url.pathname==='/api/taste-test/rounds'){
   const f=await vite.ssrLoadModule('/test-support/reading-profile/fixture.ts');
   if(req.method==='POST'){let text='';for await(const chunk of req){text+=chunk;if(text.length>2048)return json(res,{},413);}const action=JSON.parse(text);
    if(action.action==='start'){position=0;round={id:'dddddddd-0000-4000-8000-000000000001',number:1,language:action.language,goal:action.goal,complete:false,ratedCount:0,offeredCount:1};}
    if(action.action==='rate'&&round){round.ratedCount++;position++;round.complete=round.ratedCount>=round.goal;}
    if(action.action==='skip'&&round)position++;
   }
   const complete={id:'dddddddd-0000-4000-8000-000000000002',number:1,language:'nl',goal:10,complete:true,ratedCount:10,offeredCount:10};
   const current=mode==='completed'?complete:round;
   return json(res,{authenticated:mode!=='guest',available:true,state:mode==='guest'?null:{round:current,currentWorkId:current&&!current.complete?f.books[position].workId:null,exhausted:false},book:current&&!current.complete?f.books[position]:null});
  }
  if(url.pathname.startsWith('/api/'))return json(res,{syntheticUIOnly:true},404);
  next();
 });}
},vinext()],server:{host:'127.0.0.1',port,strictPort:true}});
await server.listen();console.log(`LOCAL SYNTHETIC SSR ONLY — http://127.0.0.1:${port}/nl/account — ?review=reader|guest|empty|many|b|error|completed`);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await server.close();process.exit(0);});
