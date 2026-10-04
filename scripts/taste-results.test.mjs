import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fixture,asUser,state,act,a,b } from '../test-support/taste-results/fixture.mjs';
const sql = await readFile(new URL('../supabase/migrations/20261004164419_flexible_taste_rounds.sql',import.meta.url),'utf8');
const v2=async(db,action,r=null,work=null,score=null,goal=10)=>(await db.query(
  "select public.taste_rating_advance_v2($1,$2,$3,$4,'en',$5) as state",[action,r,work,score,goal])).rows[0].state;
test('real PostgreSQL: forward migration preserves legacy 20; new 10/15/30, extension, retries and owner permissions',async()=>{
  const db=await fixture();
  try {
    await asUser(db);
    let old=await act(db,'start');
    old=await act(db,'rate',old.round.id,old.currentWorkId,8);
    assert.equal(old.round.ratedCount,1);
    await db.exec('reset role');
    const before=(await db.query('select * from public.ratings order by user_id,work_id')).rows;
    await db.exec(sql);
    assert.deepEqual((await db.query('select * from public.ratings order by user_id,work_id')).rows,before);
    for(const fn of ['public.taste_rating_state()','public.taste_rating_advance_v2(text,uuid,bigint,integer,text,integer)','taste_private.advance_round_v2(text,uuid,bigint,integer,text,integer)']) {
      const rights=(await db.query("select has_function_privilege('anon',$1,'EXECUTE') as anon,has_function_privilege('authenticated',$1,'EXECUTE') as authenticated",[fn])).rows[0];
      assert.deepEqual(rights,{anon:false,authenticated:true});
      const publicRights=(await db.query("select count(*)::int as n from pg_proc p cross join lateral aclexplode(p.proacl) acl where p.oid=$1::regprocedure and acl.grantee=0",[fn])).rows[0].n;
      assert.equal(publicRights,0);
    }
    await db.exec('set role anon');
    await assert.rejects(()=>state(db),e=>e.code==='42501');
    await assert.rejects(()=>v2(db,'start'),e=>e.code==='42501');
    for(const table of ['taste_rating_rounds','taste_rating_offers']) await assert.rejects(()=>db.query('select * from public.'+table),e=>e.code==='42501');
    await asUser(db);
    assert.equal((await state(db)).round.goal,20);
    let current=await state(db);
    for(let i=1;i<20;i++) current=await act(db,'rate',current.round.id,current.currentWorkId,8);
    assert.equal(current.round.complete,true);
    await assert.rejects(()=>v2(db,'extend',current.round.id,null,null,30),e=>e.code==='22023');
    current=await v2(db,'start');
    assert.equal(current.round.ratedCount,0);assert.equal(current.round.goal,10);
    current=await v2(db,'skip',current.round.id,current.currentWorkId);
    assert.equal(current.round.ratedCount,0);
    const seen=new Set();
    for(let i=0;i<10;i++) {
      const prev=current;seen.add(prev.currentWorkId);
      current=await v2(db,'rate',prev.round.id,prev.currentWorkId,7);
      assert.deepEqual(await v2(db,'rate',prev.round.id,prev.currentWorkId,7),current);
      await asUser(db,b);assert.equal((await state(db)).round,null);
      await assert.rejects(()=>v2(db,'resume',prev.round.id),e=>e.code==='22023');
      assert.equal((await db.query('select count(*)::int n from public.ratings')).rows[0].n,1);
      await asUser(db,a);assert.deepEqual(await state(db),current);
    }
    assert.equal(current.round.complete,true);
    current=await v2(db,'extend',current.round.id,null,null,15);assert.equal(current.round.complete,false);
    assert.deepEqual(await v2(db,'extend',current.round.id,null,null,15),current);
    for(let i=10;i<15;i++) {assert.ok(!seen.has(current.currentWorkId));seen.add(current.currentWorkId);current=await v2(db,'rate',current.round.id,current.currentWorkId,5);}
    assert.equal(current.round.complete,true);
    current=await v2(db,'extend',current.round.id,null,null,30);
    for(let i=15;i<30;i++) {assert.ok(!seen.has(current.currentWorkId));seen.add(current.currentWorkId);current=await v2(db,'rate',current.round.id,current.currentWorkId,1);}
    assert.equal(current.round.complete,true);assert.equal(current.round.ratedCount,30);
    assert.equal((await db.query('select count(*)::int n from public.ratings')).rows[0].n,51);
    for(const goal of [15,30]) {
      current=await v2(db,'start',null,null,null,goal);assert.equal(current.round.goal,goal);assert.equal(current.round.ratedCount,0);
      for(let i=0;i<goal;i++) current=await v2(db,'rate',current.round.id,current.currentWorkId,9,goal);
      assert.equal(current.round.complete,true);
    }
    current=await v2(db,'start');await db.exec('reset role;delete from public.editions');
    await asUser(db);current=await v2(db,'skip',current.round.id,current.currentWorkId);
    assert.equal(current.exhausted,true);assert.equal(current.round.ratedCount,0);
    assert.equal((await db.query('select rating from public.ratings where work_id=1')).rows[0].rating,6);
    await db.exec('reset role;grant authenticated to anon');
    assert.equal((await db.query("select has_function_privilege('anon','public.taste_rating_advance_v2(text,uuid,bigint,integer,text,integer)','EXECUTE') as yes")).rows[0].yes,true,'effective check catches inheritance');
    await db.exec('revoke authenticated from anon');
  } finally {await db.close();}
});
