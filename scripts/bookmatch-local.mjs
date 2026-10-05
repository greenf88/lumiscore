// Reuse the existing synthetic stack; never provisions, migrates or seeds.
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {createServerClient} from '@supabase/ssr';
import {assertLocalTarget,FIXTURE_ID} from './discovery-test-fixture.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),mode=process.argv[2];
const fixture=process.env.BOOKMATCH_FIXTURE_WORKDIR??path.resolve(root,'../lumiscore-taste-results-20261004/outputs/pr8-local');
const output=path.join(root,'outputs','bookmatch'),baseline=path.join(output,'preservation-baseline.json');
const safeEnv={...process.env};
for(const key of Object.keys(safeEnv)) if(/SECRET|TOKEN|SERVICE_ROLE|DATABASE|SUPABASE|GOOGLE_BOOKS|NEXT_PUBLIC_/.test(key)) delete safeEnv[key];
safeEnv.SUPABASE_TELEMETRY_DISABLED='1';
const exec=promisify(execFile);
let status,db;
try {
  assert.ok(['dev','vinext-build','vercel-build','production-check','before','after','after-save','api'].includes(mode));
  const config=await readFile(path.join(fixture,'supabase','config.toml'));
  assert.ok(config.equals(await readFile(new URL('../test-support/discovery/config.toml',import.meta.url))));
  try {await readFile(path.join(fixture,'supabase','.temp','project-ref'));throw new Error();} catch(e) {assert.equal(e.code,'ENOENT');}
  const cli=path.join(process.env.APPDATA,'npm/node_modules/supabase/dist/supabase.js');
  const docker=path.join(process.env.LOCALAPPDATA,'Programs/DockerDesktop/resources/bin/docker.exe');
  for(const name of ['supabase_db_lumiscore-pr8-discovery','supabase_kong_lumiscore-pr8-discovery']) {
    const [info]=JSON.parse((await exec(docker,['inspect',name],{env:safeEnv,windowsHide:true})).stdout);
    assert.equal(info.Config.Labels['com.supabase.cli.project'],'lumiscore-pr8-discovery');
    assert.equal(path.resolve(info.Config.Labels['com.supabase.cli.workdir']),path.resolve(fixture));
    assert.ok(info.State.Running);
    for(const entries of Object.values(info.NetworkSettings.Ports??{})) for(const binding of entries??[]) assert.ok(['127.0.0.1','::1'].includes(binding.HostIp));
  }
  let raw=(await exec(process.execPath,[cli,'status','-o','json','--workdir',fixture],{env:safeEnv,windowsHide:true})).stdout;
  status=JSON.parse(raw);raw='';assertLocalTarget(status);
  db=new pg.Client({connectionString:status.DB_URL,ssl:false,connectionTimeoutMillis:5000});await db.connect();
  await db.query('begin read only');
  assert.deepEqual((await db.query('select identity from discovery_test_private.marker')).rows.map(x=>x.identity),[FIXTURE_ID]);
  assert.equal((await db.query('select count(*)::int n from public.works')).rows[0].n,389);
  if(['before','after','after-save'].includes(mode)) {
    const snapshot={};
    for(const table of ['works','editions','catalog_categories','collections','ratings','user_book_status','user_reading_preferences','taste_rating_rounds','taste_rating_offers']) {
      const rows=(await db.query(`select to_jsonb(t) as row from public.${table} t`)).rows.map(x=>JSON.stringify(x.row)).sort();
      snapshot[table]={count:rows.length,hash:createHash('sha256').update(rows.join('\n')).digest('hex')};
    }
    await mkdir(output,{recursive:true});
    if(mode==='before') {await writeFile(baseline,JSON.stringify(snapshot),{flag:'wx'});console.log('LOCAL SYNTHETIC PRESERVATION BASELINE SAVED — NO DATA VALUES');}
    else {
      const previous=JSON.parse(await readFile(baseline,'utf8'));
      for(const [table,value] of Object.entries(snapshot)) if(mode!=='after-save' || table!=='user_book_status') assert.deepEqual(value,previous[table]);
      if(mode==='after-save') {
        assert.equal(snapshot.user_book_status.count,previous.user_book_status.count+1);
        const record=JSON.parse(await readFile(path.join(process.env.USERPROFILE,'Documents/Codex/lumiscore-local-taste-secrets/credentials.json'),'utf8'));
        assert.equal(record.api,status.API_URL);
        const work=process.env.BOOKMATCH_SAVED_WORK_ID??'8800030';assert.match(work,/^[1-9]\d+$/);
        const rows=(await db.query('select to_jsonb(t) as row from public.user_book_status t where not (user_id=$1 and work_id=$2)',[record.users[1].id,work])).rows.map(x=>JSON.stringify(x.row)).sort();
        assert.equal(createHash('sha256').update(rows.join('\n')).digest('hex'),previous.user_book_status.hash);
        for(const user of record.users) {user.email='';user.password='';}
      }
      console.log(JSON.stringify({syntheticOnly:true,unchangedTables:Object.keys(snapshot).filter(t=>mode!=='after-save'||t!=='user_book_status'),ratings:snapshot.ratings.count,statuses:snapshot.user_book_status.count,explicitWishlistInsert:mode==='after-save'}));
    }
  }
  await db.query('rollback');await db.end();db=null;
  if(mode==='api') {
    const saved=JSON.parse(await readFile(path.join(process.env.USERPROFILE,'Documents/Codex/lumiscore-local-taste-secrets/credentials.json'),'utf8'));
    assert.equal(saved.api,status.API_URL);assert.equal(saved.users.length,2);
    const summaries=[];
    try {
      for(let i=0;i<2;i++) {
        let cookies=[];
        const client=createServerClient(status.API_URL,status.ANON_KEY,{cookies:{getAll:()=>cookies,setAll:next=>{cookies=next;}}});
        const signed=await client.auth.signInWithPassword({email:saved.users[i].email,password:saved.users[i].password});assert.equal(signed.error,null);assert.equal(signed.data.user.id,saved.users[i].id);
        assert.equal(signed.data.user.app_metadata.discovery_fixture,FIXTURE_ID);assert.equal(signed.data.user.app_metadata.taste_results_fixture,true);
        const headers={cookie:cookies.map(x=>`${x.name}=${x.value}`).join('; '),origin:'http://127.0.0.1:3016','content-type':'application/json'};
        const started=performance.now();
        const deck=await fetch('http://127.0.0.1:3016/api/bookmatch?seed=12345678-abcd-abcd-abcd-123456789abc',{headers});
        assert.equal(deck.status,200);assert.match(deck.headers.get('cache-control'),/private.*no-store/);
        const text=await deck.text(),payload=JSON.parse(text),deckDurationMs=Math.round(performance.now()-started);
        assert.equal(payload.owner,saved.users[i].id);assert.equal(payload.cards.length,80);assert.equal(new Set(payload.cards.map(x=>x.book.workId)).size,80);
        const rated=await client.from('ratings').select('work_id').limit(1);assert.equal(rated.error,null);
        assert.ok(!payload.cards.some(x=>x.book.workId===String(rated.data[0].work_id)));
        const allWorks=await client.from('works').select('id').order('id').limit(1000);assert.equal(allWorks.error,null);assert.equal(allWorks.data.length,389);
        const empty=await fetch('http://127.0.0.1:3016/api/bookmatch?seed=12345678-abcd-abcd-abcd-123456789abc&seen='+allWorks.data.map(x=>x.id).join(','),{headers});
        assert.equal(empty.status,200);assert.equal((await empty.json()).cards.length,0);
        const keep=new Set(payload.cards.slice(0,5).map(x=>x.book.workId));
        const small=await fetch('http://127.0.0.1:3016/api/bookmatch?seed=12345678-abcd-abcd-abcd-123456789abc&seen='+allWorks.data.filter(x=>!keep.has(String(x.id))).map(x=>x.id).join(','),{headers});
        assert.equal(small.status,200);assert.equal((await small.json()).cards.length,5);
        const resultStarted=performance.now(),ratingResult=await fetch('http://127.0.0.1:3016/api/taste-test/result',{headers});
        assert.equal(ratingResult.status,200);assert.match(ratingResult.headers.get('cache-control'),/private.*no-store/);
        const resultText=await ratingResult.text(),resultPayload=JSON.parse(resultText);
        assert.equal(resultPayload.profile.ratingCount,i===0?50:55);assert.equal(resultPayload.recommendations.length,20);
        const resultDurationMs=Math.round(performance.now()-resultStarted);
        const preserved=await fetch('http://127.0.0.1:3016/api/bookmatch/wishlist',{method:'POST',headers,body:JSON.stringify({workId:String(rated.data[0].work_id)})});
        assert.equal(preserved.status,200);assert.equal((await preserved.json()).status,'read');
        if(i===1) for(let retry=0;retry<2;retry++) {
          const response=await fetch('http://127.0.0.1:3016/api/bookmatch/wishlist',{method:'POST',headers,body:JSON.stringify({workId:process.env.BOOKMATCH_SAVED_WORK_ID??'8800030'})});
          assert.equal(response.status,200);assert.equal((await response.json()).status,'want_to_read');
        }
        const badOrigin=await fetch('http://127.0.0.1:3016/api/bookmatch/wishlist',{method:'POST',headers:{...headers,origin:'http://untrusted.invalid'},body:'{"workId":"8800030"}'});assert.equal(badOrigin.status,403);
        summaries.push({reader:i===0?'a':'b',deckCards:80,decodedBytes:Buffer.byteLength(text),deckDurationMs,resultDecodedBytes:Buffer.byteLength(resultText),resultDurationMs,emptyCards:0,smallCards:5,private:true,ownOwner:true,ratedExcluded:true,readStatusPreserved:true});
        await client.auth.signOut({scope:'local'});cookies=[];
      }
      const anonymous=await fetch('http://127.0.0.1:3016/api/bookmatch/wishlist',{method:'POST',headers:{origin:'http://127.0.0.1:3016','content-type':'application/json'},body:'{"workId":"8800030"}'});assert.equal(anonymous.status,401);
      console.log(JSON.stringify({syntheticOnly:true,realAuth:true,anonymousWriterDenied:true,idempotentWishlist:true,summaries}));
    } finally {for(const user of saved.users) {user.email='';user.password='';}}
  }
  if(['dev','vinext-build','vercel-build','production-check'].includes(mode)) {
    const env={...safeEnv,NEXT_PUBLIC_SUPABASE_URL:status.API_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:status.ANON_KEY,NEXT_PUBLIC_SITE_ORIGIN:'http://127.0.0.1:3016',WRANGLER_WRITE_LOGS:'false',WRANGLER_LOG_PATH:'.wrangler/logs',MINIFLARE_REGISTRY_PATH:'.wrangler/registry'};
    let args;
    if(mode==='dev') args=['node_modules/vinext/dist/cli.js','dev','--hostname','127.0.0.1','--port','3016'];
    else if(mode==='vercel-build') {Object.assign(env,{VERCEL:'1',VERCEL_ENV:'preview',NITRO_PRESET:'vercel'});args=['node_modules/vite/bin/vite.js','build'];}
    else if(mode==='vinext-build') {Object.assign(env,{VERCEL_ENV:'production'});args=['node_modules/vinext/dist/cli.js','build'];}
    else {Object.assign(env,{NODE_ENV:'production',VERCEL_ENV:'production'});args=['node_modules/vinext/dist/cli.js','start','--hostname','127.0.0.1','--port','3017'];}
    const child=spawn(process.execPath,args,{cwd:root,env,stdio:'inherit',windowsHide:true});
    await new Promise(resolve=>child.on('exit',code=>{process.exitCode=code??1;resolve();}));
  }
} catch {console.error('BOOKMATCH LOCAL CHECK BLOCKED — target or operation failed; credential-bearing details withheld.');process.exitCode=1;}
finally {if(db) await db.end().catch(()=>{});if(status) for(const key of Object.keys(status)) status[key]='';}
