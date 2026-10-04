// Local review only: reads exactly public client configuration, never DB/service credentials.
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
const args=process.argv.slice(2), mode=args[0], file=args[1];
if (!['dev','build','vercel-build'].includes(mode) || !file || args.length!==2) throw new Error('Usage: discovery-public-dev.mjs dev|build|vercel-build <existing-public-env-file>');
const env={...process.env};
for(const key of Object.keys(env)) if (/SECRET|SERVICE_ROLE|DATABASE_URL|CATALOG_DATABASE|GOOGLE_BOOKS_API_KEY/.test(key)) delete env[key];
const allowed=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];
let text=await readFile(file,'utf8');
for(const line of text.split(/\r?\n/)) {
  const match=/^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if(match && allowed.includes(match[1])) env[match[1]]=match[2].trim().replace(/^(['"])(.*)\1$/,'$2');
}
text='';
if(allowed.some(key=>!env[key])) throw new Error('Public client configuration is incomplete.');
env.NODE_USE_SYSTEM_CA='1';
env.WRANGLER_WRITE_LOGS='false';
env.WRANGLER_LOG_PATH='.wrangler/logs';
env.MINIFLARE_REGISTRY_PATH='.wrangler/registry';
if(mode==='vercel-build') {env.VERCEL='1';env.VERCEL_ENV='preview';env.NITRO_PRESET='vercel';}
const child=spawn(process.execPath,mode==='vercel-build'?['node_modules/vite/bin/vite.js','build']:['node_modules/vinext/dist/cli.js',mode,...(mode==='dev'?['--port','3015']:[])],{env,stdio:'inherit',windowsHide:true});
for(const key of allowed) delete env[key];
child.on('exit',code=>{process.exitCode=code??1;});
