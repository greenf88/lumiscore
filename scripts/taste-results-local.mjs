// Disposable loopback fixture only. Capture local CLI credentials; never log them.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,stat,unlink} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {assertLocalTarget,FIXTURE_ID} from './discovery-test-fixture.mjs';
import assert from 'node:assert/strict';
import pg from 'pg';
import {createHash} from 'node:crypto';
const exec=promisify(execFile),root=fileURLToPath(new URL('../',import.meta.url));
const store=path.join(process.env.USERPROFILE,'Documents','Codex','lumiscore-local-taste-secrets');
const record=path.join(store,'credentials.json'),mode=process.argv[2];
let status,credentials=[],admin,stage='local-status';
const ok=result=>{if(result.error) {const error=new Error('Synthetic API check failed.');error.code=result.error.code;throw error;}return result.data;};
try {
  if(!['migrate','prepare','verify','counts','cleanup'].includes(mode)) throw new Error('Invalid mode.');
  const cli=path.join(process.env.APPDATA,'npm','node_modules','supabase','dist','supabase.js');
  let raw=(await exec(process.execPath,[cli,'status','-o','json','--workdir',path.join(root,'outputs','pr8-local')],{windowsHide:true,maxBuffer:8*1024*1024})).stdout;
  status=JSON.parse(raw);raw='';assertLocalTarget(status);
  stage='synthetic-marker';
  const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
  admin=createClient(status.API_URL,status.SERVICE_ROLE_KEY,options);
  const marker=await admin.schema('discovery_test_private').from('marker').select('identity');
  // Private marker is not exposed via REST; use exact public synthetic identity/count instead.
  assert.ok(marker.error);
  assert.equal((await admin.from('works').select('id',{count:'exact',head:true})).count,389);
  assert.equal(ok(await admin.from('works').select('native_identity_key').eq('id',8800001))[0].native_identity_key,'pr8-synthetic-1');
  if(mode==='migrate') {
    stage='local-forward-migration';
    const db=new pg.Client({connectionString:status.DB_URL,ssl:false,connectionTimeoutMillis:5000});
    try {
      await db.connect();
      assert.equal((await db.query('select identity from discovery_test_private.marker')).rows[0].identity,FIXTURE_ID);
      const present=(await db.query("select exists(select 1 from information_schema.columns where table_schema='public' and table_name='taste_rating_rounds' and column_name='goal') as yes")).rows[0].yes;
      if(!present) {
        const bytes=await readFile(new URL('../supabase/migrations/20261004164419_flexible_taste_rounds.sql',import.meta.url));
        const hashes=JSON.parse(await readFile(new URL('../test-support/discovery/migration-hashes.json',import.meta.url),'utf8'));
        assert.equal(createHash('sha256').update(bytes).digest('hex'),hashes['20261004164419_flexible_taste_rounds.sql']);
        await db.query(bytes.toString('utf8'));
      }
      await db.query("notify pgrst, 'reload schema'");
      console.log('LOCAL SYNTHETIC FORWARD MIGRATION VERIFIED — HOSTED TARGETS NOT USED');
    } finally {await db.end();}
  } else if(mode==='prepare') {
    stage='credential-directory';
    try {await readFile(record);throw new Error('Existing credentials must be reused.');} catch(error) {if(error.code!=='ENOENT') throw error;}
    // Caller must prepare this external directory with a current-user-only DACL.
    // No credential directory or ACL fallback is created by this script.
    assert.ok((await stat(store)).isDirectory());
    stage='create-two-local-users';
    for(const label of ['a','b']) {
      const email='taste-result-'+label+'-'+randomBytes(8).toString('hex')+'@example.invalid',password=randomBytes(30).toString('base64url');
      const user=ok(await admin.auth.admin.createUser({email,password,email_confirm:true,
        app_metadata:{discovery_fixture:FIXTURE_ID,taste_results_fixture:true},user_metadata:{display_name:'Synthetic Reader '+label.toUpperCase()}})).user;
      credentials.push({id:user.id,email,password});
    }
    await writeFile(record,JSON.stringify({api:status.API_URL,users:credentials}),{encoding:'utf8',flag:'wx'});
    stage='legacy-round';
    const reader=createClient(status.API_URL,status.ANON_KEY,options);ok(await reader.auth.signInWithPassword({email:credentials[0].email,password:credentials[0].password}));
    let state=ok(await reader.rpc('taste_rating_advance',{p_action:'start'}));
    for(let i=0;i<20;i++) state=ok(await reader.rpc('taste_rating_advance',{p_action:'rate',p_round_id:state.round.id,p_work_id:Number(state.currentWorkId),p_score:9}));
    assert.equal(state.round.complete,true);assert.equal(state.round.goal,20);
    ok(await reader.auth.signOut({scope:'global'}));
    console.log('LOCAL SYNTHETIC USERS READY — LEGACY TWENTY ROUND PRESERVED');
  } else {
    stage='read-credential-record';
    const saved=JSON.parse(await readFile(record,'utf8'));
    stage='verify-local-credential-identity';
    assert.equal(saved.api,status.API_URL);assert.equal(saved.users.length,2);credentials=saved.users;
    for(const credential of credentials) {
      stage='verify-local-synthetic-user';
      const user=ok(await admin.auth.admin.getUserById(credential.id)).user;
      assert.equal(user.app_metadata.discovery_fixture,FIXTURE_ID);assert.equal(user.app_metadata.taste_results_fixture,true);
    }
    if(mode==='verify') {
      stage='new-goal-api-tests';
      const anon=createClient(status.API_URL,status.ANON_KEY,options);
      assert.equal((await anon.rpc('taste_rating_advance_v2',{p_action:'start',p_goal:10})).error?.code,'42501');
      const [a,b]=credentials.map(()=>createClient(status.API_URL,status.ANON_KEY,options));
      ok(await a.auth.signInWithPassword({email:credentials[0].email,password:credentials[0].password}));ok(await b.auth.signInWithPassword({email:credentials[1].email,password:credentials[1].password}));
      const before=ok(await a.from('ratings').select('work_id,rating').order('work_id'));
      for(const goal of [10,15,30]) {
        let state=ok(await b.rpc('taste_rating_advance_v2',{p_action:'start',p_goal:goal}));
        const rid=state.round.id,seen=new Set();
        const act=async(action,work,score)=>ok(await b.rpc('taste_rating_advance_v2',{p_action:action,p_round_id:rid,p_work_id:work??null,p_score:score??null,p_goal:goal}));
        state=await act('skip',Number(state.currentWorkId));assert.equal(state.round.ratedCount,0);
        for(let i=0;i<goal;i++) {
          const work=Number(state.currentWorkId);assert.ok(!seen.has(work));seen.add(work);
          state=await act('rate',work,8);assert.deepEqual(await act('rate',work,8),state);
          if(i===4) {
            ok(await b.auth.signOut({scope:'global'}));ok(await b.auth.signInWithPassword({email:credentials[1].email,password:credentials[1].password}));
            assert.deepEqual(ok(await b.rpc('taste_rating_state')),state);
          }
        }
        assert.equal(state.round.complete,true);assert.equal(state.round.ratedCount,goal);
        assert.equal(ok(await a.from('taste_rating_offers').select('work_id').eq('round_id',rid)).length,0);
        assert.equal((await a.rpc('taste_rating_advance_v2',{p_action:'resume',p_round_id:rid})).error?.code,'22023');
      }
      assert.deepEqual(ok(await a.from('ratings').select('work_id,rating').order('work_id')),before);
      assert.equal(ok(await b.from('ratings').select('work_id')).length,55);
      ok(await a.auth.signOut({scope:'global'}));ok(await b.auth.signOut({scope:'global'}));
      console.log(JSON.stringify({realAuthPostgrest:true,goals:[10,15,30],explicitRatings:55,skipsWithoutRatings:3,relogin:true,idempotence:true,twoUserIsolation:true,legacyRatingsPreserved:true,anonymousDenied:true}));
    } else if(mode==='counts') {
      stage='local-counts';
      const counts=[];
      for(const credential of credentials) {
        const reader=createClient(status.API_URL,status.ANON_KEY,options);
        ok(await reader.auth.signInWithPassword({email:credential.email,password:credential.password}));
        counts.push({reader:counts.length===0?'a':'b',
          ratings:(await reader.from('ratings').select('*',{count:'exact',head:true})).count,
          state:ok(await reader.rpc('taste_rating_state')).round,
        });
        ok(await reader.auth.signOut({scope:'global'}));
      }
      console.log(JSON.stringify({localSyntheticOnly:true,counts}));
    } else {
      for(const credential of credentials) ok(await admin.auth.admin.deleteUser(credential.id));
      await unlink(record);
      console.log('ONLY THIS RUN’S TWO LOCAL SYNTHETIC USERS REMOVED — CREDENTIAL RECORD REMOVED');
    }
  }
} catch(error) {console.error('LOCAL RESULT CHECK BLOCKED — '+stage+'; code='+(/^[A-Z0-9_]+$/.test(String(error.code))?error.code:'withheld')+'; no credentials logged.');process.exitCode=1;}
finally {for(const x of credentials){x.password='';x.email='';}if(status)for(const key of Object.keys(status))status[key]='';}
