// Run against existing authorised PUBLIC test configuration only; never copy secrets.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
const [mode, source, localPort='3187'] = process.argv.slice(2);
if (!/^\d+$/.test(localPort) || Number(localPort)<1024 || Number(localPort)>65535) throw new Error('Invalid loopback test port');
if (!['dev','build','preview'].includes(mode) || !source) throw new Error('Usage: dev|build|preview existing-test-env-file');
const text = readFileSync(source,'utf8');
const publicEnv = {};
for (const key of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']) {
  const value = text.match(new RegExp('^'+key+'=(.*)$','m'))?.[1]?.trim().replace(/^['"]|['"]$/g,'');
  if (!value) throw new Error('Required public test configuration missing: '+key);
  publicEnv[key]=value;
}
if (new URL(publicEnv.NEXT_PUBLIC_SUPABASE_URL).hostname !== 'hlvujbrmfdlrfxdjwsmb.supabase.co') throw new Error('Not the authorised test project');
const env = { ...process.env, ...publicEnv, VERCEL:'1', VERCEL_ENV:'preview', NITRO_PRESET:'vercel' };
if (mode === 'dev') { delete env.VERCEL; delete env.NITRO_PRESET; }
delete env.SUPABASE_SECRET_KEY;
delete env.SUPABASE_SERVICE_ROLE_KEY;
delete env.GOOGLE_BOOKS_API_KEY;
console.log('Public test project validated; no privileged keys loaded.');
if (mode === 'preview') { env.NODE_ENV='production'; if(process.argv[4])env.LUMISCORE_REVIEW_PORT=localPort; }
const args = mode==='preview' ? [resolve('scripts/catalog-selection-production-preview.mjs')]
  : [resolve('node_modules/vite/bin/vite.js'), ...(mode==='build'?['build']:['--host','127.0.0.1','--port',localPort])];
const child=spawn(process.execPath,args,{env,stdio:'inherit'});
child.on('exit',code=>{process.exitCode=code??1;});
