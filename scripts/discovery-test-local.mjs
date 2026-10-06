// Only the exact disposable local stack. NO --linked/--db-url/hosted target support.
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { assertLocalTarget, FIXTURE_ID, reviewedFixtureInputs, setupDiscoveryFixture } from './discovery-test-fixture.mjs';
import { verifyLocalDiscoveryApi } from './discovery-test-api.mjs';
import { confineLocalPorts } from './discovery-test-loopback.mjs';
import { verifyFunctionPermissions } from './discovery-permissions.mjs';
const exec=promisify(execFile), root=fileURLToPath(new URL('../',import.meta.url));
const workdir=path.join(root,'outputs','pr8-local'), project='lumiscore-pr8-discovery', network='lumiscore-pr8-discovery';
const mode=process.argv[2];
const safeEnv={...process.env};
for(const key of Object.keys(safeEnv)) if(/SECRET|TOKEN|SERVICE_ROLE|DATABASE|SUPABASE|GOOGLE_BOOKS|NEXT_PUBLIC_/.test(key)) delete safeEnv[key];
safeEnv.SUPABASE_TELEMETRY_DISABLED='1';
const docker=process.platform==='win32'?path.join(process.env.LOCALAPPDATA,'Programs','DockerDesktop','resources','bin','docker.exe'):'docker';
const cliEntry=process.platform==='win32'?path.join(process.env.APPDATA,'npm','node_modules','supabase','dist','supabase.js'):null;
const run=async(file,args)=>{
  try { return (await exec(file,args,{cwd:root,env:safeEnv,windowsHide:true,maxBuffer:32*1024*1024,timeout:240000})).stdout; }
  catch { throw new Error('Local tool operation failed; raw output withheld (may contain credentials).'); }
};
const cli=args=>run(cliEntry?process.execPath:'supabase',[...(cliEntry?[cliEntry]:[]),...args,'--workdir',workdir]);
async function checkConfig({cleanup=false}={}) {
  const actual=await readFile(path.join(workdir,'supabase','config.toml'));
  const expected=await readFile(new URL('../test-support/discovery/config.toml',import.meta.url));
  if(cleanup) {
    if(!/^project_id = "lumiscore-pr8-discovery"$/m.test(actual.toString())) throw new Error('Cleanup project identity mismatch.');
  } else if(!actual.equals(expected)) throw new Error('Isolated local config differs from reviewed template.');
  try {await readFile(path.join(workdir,'supabase','.temp','project-ref'));throw new Error('Linked target forbidden.');}
  catch(e) {if(e.code!=='ENOENT') throw e;}
}
async function checkContainers({requireLoopback=true,requireRunning=true}={}) {
  const names=JSON.parse('['+(await run(docker,['ps','--all','--format','{{json .Names}}'])).trim().split('\n').filter(Boolean).join(',')+']');
  const owned=names.filter(n=>n.endsWith('_'+project));
  if(!owned.includes('supabase_db_'+project)||!owned.includes('supabase_kong_'+project)) throw new Error('Exact isolated test containers unavailable.');
  for(const name of owned) {
    const [info]=JSON.parse(await run(docker,['inspect',name]));
    if(info.Config.Labels?.['com.supabase.cli.project']!==project||path.resolve(info.Config.Labels?.['com.supabase.cli.workdir']??'')!==path.resolve(workdir)) throw new Error('Container ownership mismatch.');
    if(requireRunning&&(!info.State.Running||info.State.Restarting)) throw new Error('Isolated test container is not running.');
    for(const entries of Object.values(info.NetworkSettings.Ports??{})) for(const binding of entries??[]) {
      if(!requireLoopback) continue; // Owned-stack cleanup must work after a failed binding gate.
      if(!['127.0.0.1','::1'].includes(binding.HostIp)) throw new Error('Local test ports must be loopback-only; do not change global Docker settings.');
    }
  }
}
async function localStatus() {
  stage='status-config';await checkConfig();stage='status-container-bindings';await checkContainers();
  stage='local-health';
  for(let attempt=0;attempt<30;attempt++) {
    const [info]=JSON.parse(await run(docker,['inspect','supabase_db_'+project]));
    if(info.State.Health?.Status==='healthy') break;
    if(attempt===29) throw new Error('Local database did not become healthy.');
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  stage='status-cli';let raw=await cli(['status','-o','json']);const status=JSON.parse(raw);raw='';
  stage='status-target';assertLocalTarget(status);return status;
}
async function checkDisposableData(client) {
  const data=(await client.query(`select
    (select count(*) from discovery_test_private.marker where identity=$1)::int as markers,
    (select count(*) from discovery_test_private.marker)::int as marker_total,
    (select count(*) from auth.users where coalesce(raw_app_meta_data->>'discovery_fixture','')<>$1)::int as other_users,
    (select count(*) from public.works)::int as works,
    (select count(*) from public.editions)::int as editions`,[FIXTURE_ID])).rows[0];
  if(data.markers!==1||data.marker_total!==1||data.other_users!==0||data.works!==389||data.editions!==608) throw new Error('Disposable synthetic target identity/data mismatch.');
}
let status, db, stage='input-review';
try {
  if(!['prepare','start','reset','verify','evidence','dev','vercel-build','stop'].includes(mode)||process.argv.length!==3) throw new Error('Usage: discovery-test-local.mjs prepare|start|reset|verify|evidence|dev|vercel-build|stop');
  await reviewedFixtureInputs();
  if(mode==='prepare') {
    await mkdir(path.join(workdir,'supabase'),{recursive:true});
    await copyFile(new URL('../test-support/discovery/config.toml',import.meta.url),path.join(workdir,'supabase','config.toml'));
    console.log('ISOLATED LOCAL TEST CONFIG PREPARED');
  } else {
    stage='config-check';
    await checkConfig({cleanup:mode==='stop'});
    if(mode==='start') {
      stage='network-check';
      const names=(await run(docker,['network','ls','--format','{{.Name}}'])).trim().split('\n');
      if(!names.includes(network)) await run(docker,['network','create','--label','lumiscore.discovery=pr8','--opt','com.docker.network.bridge.host_binding_ipv4=127.0.0.1',network]);
      const [info]=JSON.parse(await run(docker,['network','inspect',network]));
      if(info.Labels?.['lumiscore.discovery']!=='pr8'||info.Options?.['com.docker.network.bridge.host_binding_ipv4']!=='127.0.0.1') throw new Error('Local network identity/binding mismatch.');
      console.log('STARTING ISOLATED LOCAL SUPABASE (OUTPUT CAPTURED)');
      stage='local-start';
      await cli(['start','--network-id',network,'--exclude','realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor']);
      stage='local-status';
      try {stage='loopback-confinement';await confineLocalPorts(run,docker,workdir);stage='local-status';status=await localStatus();}
      catch(error) {await checkContainers({requireLoopback:false,requireRunning:false});await cli(['stop']);throw error;}
    } else if(mode==='stop') {
      await checkContainers({requireLoopback:false,requireRunning:false}); await cli(['stop']); console.log('ISOLATED LOCAL TEST STACK STOPPED; VOLUMES RETAINED');
    } else {
      status=await localStatus();
      if(mode==='reset') {
        stage='reset-synthetic-target-gate';
        const guard=new pg.Client({connectionString:status.DB_URL,ssl:false,connectionTimeoutMillis:5000});
        try {await guard.connect();await guard.query('begin read only');await checkDisposableData(guard);await guard.query('rollback');}
        finally {await guard.end();}
        await cli(['db','reset','--local','--no-seed','--network-id',network]);
        // CLI reset recreates gateway bindings; re-confine this owned stack before use.
        await confineLocalPorts(run,docker,workdir); status=await localStatus();
      }
    }
    if(['start','reset','verify','evidence'].includes(mode)) {
      stage='database-identity';
      db=new pg.Client({connectionString:status.DB_URL,ssl:false,connectionTimeoutMillis:5000});await db.connect();
      const identity=(await db.query('select current_database() as db,current_user as role,session_user as session')).rows[0];
      if(identity.db!=='postgres'||identity.role!=='postgres'||identity.session!=='postgres') throw new Error('Local database identity mismatch.');
      const exists=(await db.query("select to_regclass('discovery_test_private.marker') is not null as present")).rows[0].present;
      if(!exists) {
        if(['verify','evidence'].includes(mode)) throw new Error('Synthetic target marker absent.');
        stage='synthetic-schema-setup';
        await setupDiscoveryFixture({query:(...args)=>db.query(...args),exec:sql=>db.query(sql)});
      }
      const marker=(await db.query('select identity from discovery_test_private.marker')).rows;
      if(marker.length!==1||marker[0].identity!==FIXTURE_ID) throw new Error('Synthetic target marker mismatch.');
      await checkDisposableData(db);
      if(mode==='verify') {stage='effective-function-permissions';console.log(JSON.stringify(await verifyFunctionPermissions(db)));stage='real-auth-postgrest-tests';console.log(JSON.stringify(await verifyLocalDiscoveryApi(status)));}
      else if(mode==='evidence') {
        stage='read-only-cleanup-evidence';await db.query('begin read only');
        const counts=(await db.query(`select (select count(*) from auth.users)::int as synthetic_users,
          (select count(*) from public.ratings)::int as ratings,
          (select count(*) from public.user_book_status)::int as reading_statuses,
          (select count(*) from public.user_reading_preferences)::int as preferences,
          (select count(*) from public.taste_rating_rounds)::int as rounds,
          (select count(*) from public.taste_rating_offers)::int as offers,
          (select count(*) from public.works)::int as works,
          (select count(*) from public.editions)::int as editions`)).rows[0];
        await db.query('rollback');
        if(Object.entries(counts).some(([key,value])=>!['works','editions'].includes(key)&&value!==0)) throw new Error('Synthetic account cleanup is incomplete.');
        console.log(JSON.stringify({loopbackOnly:true,cleanupVerified:true,...counts}));
      }
      else console.log('ISOLATED SYNTHETIC CATALOG READY');
    }
    if(mode==='dev'||mode==='vercel-build') {
      const env={...safeEnv,NEXT_PUBLIC_SUPABASE_URL:status.API_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:status.ANON_KEY,NEXT_PUBLIC_SITE_ORIGIN:'http://127.0.0.1:3015',WRANGLER_WRITE_LOGS:'false',WRANGLER_LOG_PATH:'.wrangler/logs',MINIFLARE_REGISTRY_PATH:'.wrangler/registry'};
      if(mode==='vercel-build') Object.assign(env,{VERCEL:'1',VERCEL_ENV:'preview',NITRO_PRESET:'vercel'});
      const child=spawn(process.execPath,mode==='dev'?['node_modules/vinext/dist/cli.js','dev','--hostname','127.0.0.1','--port','3015']:['node_modules/vite/bin/vite.js','build'],{cwd:root,env,stdio:'inherit',windowsHide:true});
      await new Promise(resolve=>child.on('exit',code=>{process.exitCode=code??1;resolve();}));
    }
  }
} catch(error) {
  const safeReasons=['Disposable container identity mismatch.','Unexpected disposable port mapping.','Unexpected disposable container network.','Local Docker unavailable.','Local Docker timeout.','Local Docker operation failed; response withheld.','Bounded response exceeded.'];
  const reason=safeReasons.includes(error.message)?error.message:'details withheld';
  console.error(`LOCAL DISCOVERY TEST BLOCKED — ${stage}; ${reason}; raw credential-bearing output withheld.`);process.exitCode=1;
}
finally {if(db) await db.end().catch(()=>{}); if(status) for(const key of Object.keys(status)) status[key]='';}
