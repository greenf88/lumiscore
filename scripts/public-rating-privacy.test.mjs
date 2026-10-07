// Disposable PGlite only. Actual SQL/roles; no environment, credentials or hosted writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { setupDiscoveryFixture } from './discovery-test-fixture.mjs';
const migration = await readFile(new URL('../supabase/migrations/20261006173806_public_rating_privacy_b.sql',import.meta.url),'utf8');
const thresholdMigration = await readFile(new URL('../supabase/migrations/20261007080316_public_rating_threshold_three.sql',import.meta.url),'utf8');
test('Three-rater public scores protect all SQL routes, preserve owners and never write existing data',async t=>{
  const db=new PGlite();
  const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
      alter default privileges in schema public grant execute on functions to anon,authenticated;`);
    await setupDiscoveryFixture(db);
    for(let n=1;n<=51;n++) await db.query('insert into auth.users values($1)',[uid(n)]);
    const bands=[[0,null],[1,null],[2,null],[3,'3–4'],[4,'3–4'],[5,'5–9'],[6,'5–9'],[9,'5–9'],[10,'10–19'],[19,'10–19'],[20,'20–49'],[49,'20–49'],[50,'50+']];
    for(let i=0;i<bands.length;i++) for(let n=1;n<=bands[i][0];n++)
      await db.query('insert into public.ratings(user_id,work_id,rating) values($1,$2,8)',[uid(n),8800001+i]);
    const before=(await db.query('select user_id,work_id,rating from public.ratings order by user_id,work_id')).rows;
    const defaults=(await db.query('select * from pg_default_acl order by oid')).rows;
    await db.exec(migration); // Upgrade from the already deployed five-rater policy.
    assert.equal((await db.query('select lumiscore from public.get_work_rating_summaries_v2(array[8800004]::bigint[])')).rows[0].lumiscore,null);
    const protectedFunctions = async () => (await db.query(`select oid::regprocedure::text as signature,
      pg_get_functiondef(oid) as definition, proacl::text as acl from pg_proc
      where pronamespace='public'::regnamespace and proname in
      ('get_work_rating_summary','get_work_rating_summaries','catalog_discovery_page',
       'get_collaborative_recommendation_signals','taste_rating_state') order by oid`)).rows;
    const functionsBefore = await protectedFunctions();
    await db.exec(thresholdMigration);
    await db.exec(thresholdMigration); // Idempotent replacement, no duplicate data or privileges.
    assert.deepEqual(await protectedFunctions(),functionsBefore);
    assert.deepEqual((await db.query('select user_id,work_id,rating from public.ratings order by user_id,work_id')).rows,before);
    assert.deepEqual((await db.query('select * from pg_default_acl order by oid')).rows,defaults);
    await t.test('anon sees threshold, bands and no exact counts through old or new APIs',async()=>{
      await db.exec('set role anon');
      for(let i=0;i<bands.length;i++){
        const [n,band]=bands[i],id=8800001+i;
        const v2=(await db.query('select * from public.get_work_rating_summaries_v2(array[$1]::bigint[])',[id])).rows[0];
        assert.equal(v2.rating_count_band,band); assert.equal(v2.evidence_status,n>=3?'available':'insufficient_evidence');
        assert.equal(v2.lumiscore,n>=3?'8.0':null); assert.equal('rating_count' in v2,false);
        for(const call of ['public.get_work_rating_summary($1::bigint)','public.get_work_rating_summaries(array[$1]::bigint[])']){
          const row=(await db.query('select * from '+call,[id])).rows[0];
          assert.equal(row.rating_count,null); assert.equal(row.lumiscore,n>=3?'8.0':null);
        }
      }
      await assert.rejects(()=>db.query('select * from public.ratings'),e=>e.code==='42501');
      for(const fn of ['get_work_rating_summaries_v2','get_work_rating_summaries']){
        await assert.rejects(()=>db.query('select * from public.'+fn+'($1::bigint[])',[Array(101).fill(1)]),e=>e.code==='22023');
        await assert.rejects(()=>db.query('select * from public.'+fn+'(array[[1,2],[3,4]]::bigint[])'),e=>e.code==='22023');
        assert.equal((await db.query('select * from public.'+fn+'($1::bigint[])',[Array.from({length:100},(_,i)=>i+1)])).rows.length,100);
      }
      const ranked=(await db.query("select public.catalog_discovery_page(p_sort=>'highest',p_page_size=>128) as data")).rows[0].data;
      assert.equal(ranked.total,389); assert.ok(ranked.workIds.includes(8800001),'unpublishable works remain discoverable');
      assert.ok(ranked.workIds.indexOf(8800004)<ranked.workIds.indexOf(8800001),'published scores precede unknowns');
      assert.equal(JSON.stringify(ranked).includes('rating_count'),false);
      const threeIds=bands.flatMap(([n],i)=>n===3?[8800001+i]:[]);
      assert.ok(threeIds.every(id=>ranked.workIds.indexOf(id)>=0&&ranked.workIds.indexOf(id)<ranked.workIds.indexOf(8800001)));
      await db.exec('reset role');
    });
    await t.test('authenticated owns exact ratings; state RPC remains anon-denied; five distinct peers required',async()=>{
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid(1)]);
      await db.exec('set role authenticated');
      assert.ok((await db.query('select user_id,rating from public.ratings')).rows.every(r=>r.user_id===uid(1)&&r.rating===8));
      await db.query("select public.taste_rating_state()"); // invoker works with existing isolation
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid(2)]);
      const secondOwner = (await db.query('select user_id,rating from public.ratings')).rows;
      assert.ok(secondOwner.length > 0);
      assert.ok(secondOwner.every(r=>r.user_id===uid(2)&&r.rating===8));
      await db.query("select public.taste_rating_state()");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid(1)]);
      await db.exec('reset role');
      for(const fn of ['public.taste_rating_state()','public.get_collaborative_recommendation_signals(integer)'])
        assert.equal((await db.query("select has_function_privilege('anon',$1,'EXECUTE') as yes",[fn])).rows[0].yes,false);
      const a=8800101,b=8800102,c=8800103;
      for(let n=1;n<=5;n++) for(const id of n===1?[a,b]:[a,b,c])
        await db.query('insert into public.ratings(user_id,work_id,rating) values($1,$2,9)',[uid(n),id]);
      await db.exec('set role authenticated');
      assert.equal((await db.query('select * from public.get_collaborative_recommendation_signals() where work_id=$1',[c])).rows.length,0);
      await db.exec('reset role');
      for(const id of [a,b,c]) await db.query('insert into public.ratings(user_id,work_id,rating) values($1,$2,9)',[uid(6),id]);
      await db.exec('set role authenticated');
      assert.equal((await db.query('select * from public.get_collaborative_recommendation_signals() where work_id=$1',[c])).rows.length,1);
      await db.exec('reset role');
      for(const fn of ['get_work_rating_summary(bigint)','get_work_rating_summaries(bigint[])','get_work_rating_summaries_v2(bigint[])','get_collaborative_recommendation_signals(integer)']){
        const p=(await db.query("select prosecdef,proconfig,exists(select 1 from aclexplode(proacl) where grantee=0 and privilege_type='EXECUTE') as public from pg_proc where oid=$1::regprocedure",['public.'+fn])).rows[0];
        assert.equal(p.prosecdef,true); assert.deepEqual(p.proconfig,['search_path=""']); assert.equal(p.public,false);
      }
    });
    await t.test('remaining inference risk: five known eights plus one addition can reveal nine',()=>{
      const possible=Array.from({length:10},(_,i)=>i+1).filter(x=>Math.round((40+x)/6*10)/10===8.2);
      assert.deepEqual(possible,[9]); // threshold/bands are not differential privacy
    });
  } finally { await db.close(); }
});
