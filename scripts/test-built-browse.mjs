import {spawn} from 'node:child_process';
const root=process.cwd();
const run=(args,env=process.env)=>new Promise((resolve,reject)=>{
 const p=spawn(process.execPath,args,{cwd:root,env,stdio:'inherit',windowsHide:true});p.once('error',reject);p.once('exit',code=>code===0?resolve():reject(Error('Built Browse check failed: '+code)));
});
const environment={...process.env};for(const key of Object.keys(environment))if(/SUPABASE|GOOGLE_BOOKS|DATABASE/.test(key))delete environment[key];
await run(['node_modules/vite/bin/vite.js','build'],{...environment,VERCEL:'1',VERCEL_ENV:'preview',NITRO_PRESET:'vercel',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:45431',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'synthetic-public-fixture'});
if(process.argv.includes('--build-only'))process.exit(0); // Local sandbox may build and verify under different OS identities. CI runs both.
const server=spawn(process.execPath,['scripts/browse-built-fixture.mjs'],{cwd:root,stdio:['ignore','pipe','pipe'],windowsHide:true});
let log='';const streams=[server.stdout,server.stderr];
try{
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Built fixture startup timeout')),30000);
  server.once('exit',code=>{clearTimeout(timer);reject(Error('Fixture exited '+code+' '+log.slice(-1000)));});
  for(const stream of streams)stream.on('data',buffer=>{log=(log+buffer).slice(-4000);if(log.includes('BUILT_BROWSE_FIXTURE_READY')){clearTimeout(timer);resolve();}});
 });
 await run(['scripts/verify-built-browse.mjs']);
}finally{server.kill('SIGTERM');}
