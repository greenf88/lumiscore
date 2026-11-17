import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const uid='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const sql=name=>readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
async function fixture(){
  const db=new PGlite();await db.waitReady;
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${uid}'),('${other}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
    create table authors(id bigint primary key,name text);insert into authors select i,'Author '||i from generate_series(1,20)i;
    create table works(id bigint primary key,title text,author_id bigint,first_publish_year integer,cover_id bigint);
    create table editions(id bigint generated always as identity,work_id bigint,title text,language text);
    insert into works select i,'Book '||i,1+i%20,2020,null from generate_series(1,11000)i;
    insert into editions(work_id,title,language) select id,title,'en' from works;
    grant select on authors,works,editions to authenticated;`);
  for(const file of ['20260908052221_secure_ratings_foundation.sql','20260910062625_add_batch_rating_summaries.sql','20260916071439_collections_v1.sql','20260930185834_catalog_selection_v1.sql','20261003183631_discovery_taste_rounds.sql','20261004164419_flexible_taste_rounds.sql'])await db.exec(await sql(file));
  // Eligibility itself is covered against stored production functions by taste-content.test.mjs.
  await db.exec(`create function taste_private.content_eligible_v1(w bigint,l text) returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and l='en' and w between 1 and 99$$;
    alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;`);
  await db.exec(await sql('20261117145752_buffered_taste_rounds.sql'));
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec('set role authenticated');
  return db;
}
const start=async db=>(await db.query("select public.taste_rating_advance_v2('start',null,null,null,'en',10) s")).rows[0].s;
const save=async(db,round,decisions)=>(await db.query('select public.taste_rating_save_batch($1,$2) s',[round,JSON.stringify(decisions)])).rows[0].s;
test('ten explicit ratings save atomically once, skips do not count, complete retries preserve history',async()=>{
  const db=await fixture();try{
    const initial=await start(db),id=initial.round.id;
    const pool=(await db.query('select * from public.taste_rating_pool($1)',[id])).rows;
    assert.equal(pool.length,60);assert.equal(String(pool[0].work_id),initial.currentWorkId);assert(!pool.some(x=>x.work_id===100));
    const decisions=pool.slice(0,12).map((x,i)=>({workId:String(x.work_id),score:i<2?null:8}));
    const result=await save(db,id,decisions);assert.equal(result.round.complete,true);assert.equal(result.round.ratedCount,10);
    assert.equal((await db.query('select count(*)::int n from ratings')).rows[0].n,10);
    const snapshot=(await db.query('select * from taste_rating_offers order by work_id')).rows;
    assert.deepEqual(await save(db,id,decisions),result);assert.deepEqual((await db.query('select * from taste_rating_offers order by work_id')).rows,snapshot);
    assert.equal((await db.query("select count(*)::int n from user_book_status where status='read'")).rows[0].n,10);
  }finally{await db.close();}
});
test('partial save retries do not skip the newly offered book; a later bad decision rolls the entire batch back',async()=>{
  const db=await fixture();try{
    const {round,currentWorkId}=await start(db),one=[{workId:currentWorkId,score:9}];
    const result=await save(db,round.id,one);assert.equal(result.round.ratedCount,1);
    assert.deepEqual(await save(db,round.id,one),result);
    const pool=(await db.query('select * from public.taste_rating_pool($1)',[round.id])).rows;
    await assert.rejects(save(db,round.id,[{workId:String(pool[0].work_id),score:7},{workId:'100',score:8}]),/eligible/);
    assert.equal((await db.query('select count(*)::int n from ratings')).rows[0].n,1);
    await assert.rejects(save(db,round.id,[{workId:currentWorkId,score:2}]),/preserved/);
    assert.equal((await db.query('select rating from ratings')).rows[0].rating,9);
    await assert.rejects(save(db,round.id,[{workId:String(pool[0].work_id),score:7},{workId:String(pool[0].work_id),score:8}]),/Duplicate/);
    await assert.rejects(save(db,round.id,[{workId:String(pool[0].work_id),score:11}]),/score/);
  }finally{await db.close();}
});
test('owner isolation, missing auth, anon and service role grants fail closed',async()=>{
  const db=await fixture();try{
    const {round,currentWorkId}=await start(db);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);
    assert.equal((await db.query('select * from public.taste_rating_pool($1)',[round.id])).rows.length,0);
    await assert.rejects(save(db,round.id,[{workId:currentWorkId,score:8}]),/not current/);
    await db.query("select set_config('request.jwt.claim.sub','',false)");await assert.rejects(save(db,round.id,[{workId:currentWorkId,score:8}]),/Authentication/);
    for(const role of ['anon','service_role'])for(const signature of ['public.taste_rating_pool(uuid)','public.taste_rating_save_batch(uuid,jsonb)','taste_private.round_pool(uuid)','taste_private.save_round_batch(uuid,jsonb)'])assert.equal((await db.query('select has_function_privilege($1,$2,\'execute\') allowed',[role,signature])).rows[0].allowed,false);
  }finally{await db.close();}
});
