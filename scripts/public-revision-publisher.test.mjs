import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import fs from 'node:fs/promises';
const read=f=>fs.readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8');
test('reviewed hash journal publishes idempotently, preserves locale and chronology, bounds errors and resumes',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create table works(id bigint primary key);insert into works values(1),(2);create table ratings(work_id bigint,rating int);insert into ratings values(2,8);`);
 for(const f of ['20261108121441_public_page_revision_ledger.sql','20261108210128_reviewed_public_revision_publisher.sql'])await db.exec(await read(f));
 const h=n=>String(n).repeat(64);const enq=async(locale,expected,next,date,receipt)=> (await db.query('select enqueue_catalog_public_revision(1,$1,$2,$3,$4,$5) id',[locale,expected,next,date,receipt])).rows[0].id;
 const run=async()=> (await db.query('select publish_catalog_public_revisions(100) result')).rows[0].result;
 const eid=await enq('en',null,h('a'),'2026-11-01',h('1'));assert.equal(await enq('en',null,h('a'),'2026-11-01',h('1')),eid);
 await assert.rejects(enq('en',null,h('b'),'2026-11-01',h('1')),/Receipt reused/);
 assert.equal((await run()).published,1);assert.equal((await run()).published,0);
 const ledger=()=>db.query('select * from catalog_public_page_revisions order by locale');const original=(await ledger()).rows[0];
 await enq('en',h('a'),h('a'),'2026-11-02',h('2'));await run();assert.deepEqual((await ledger()).rows[0],original,'no-op does not create a new lastmod');
 await enq('nl',null,h('c'),'2026-11-02',h('3'));await run();assert.equal((await ledger()).rows.length,2);
 // Two separate real revisions, bounded processing and no loss of an intermediate event.
 await enq('en',h('a'),h('b'),'2026-11-03',h('4'));await enq('en',h('b'),h('d'),'2026-11-04',h('5'));
 assert.equal((await db.query('select publish_catalog_public_revisions(1) result')).rows[0].result.published,1);assert.equal((await run()).published,1);
 assert.equal((await ledger()).rows.find(x=>x.locale==='en').presentation_hash,h('d'));
 // A late old revision cannot roll the date backwards; after three errors it stops.
 const late=await enq('en',h('d'),h('e'),'2026-10-01',h('6'));
 assert.equal((await run()).deferred_or_failed,1);assert.equal((await run()).deferred_or_failed,0,'backoff honoured');
 for(let i=0;i<2;i++){await db.query("update catalog_public_revision_events set next_attempt_at=now()-interval '1 minute' where event_id=$1",[late]);await run();}
 const failed=(await db.query('select state,attempts,error_code from catalog_public_revision_events where event_id=$1',[late])).rows[0];assert.deepEqual(failed,{state:'failed',attempts:3,error_code:'P0001'});
 assert.equal((await run()).deferred_or_failed,0);assert.equal((await ledger()).rows.find(x=>x.locale==='en').presentation_hash,h('d'));
 // A temporarily absent predecessor is preserved and resumes after its committed publication.
 const waiting=await enq('en',h('f'),h('0'),'2026-11-06',h('7'));await run();
 await enq('en',h('d'),h('f'),'2026-11-05',h('8'));await run();
 await db.query("update catalog_public_revision_events set next_attempt_at=now()-interval '1 minute' where event_id=$1",[waiting]);assert.equal((await run()).published,1);
 assert.equal((await ledger()).rows.find(x=>x.locale==='en').presentation_hash,h('0'));
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select * from catalog_public_revision_events'),/permission denied/);await assert.rejects(run(),/permission denied/);await assert.rejects(enq('en',null,h('a'),'2026-11-01',h('9')),/permission denied/);await db.exec('reset role');}
 assert.deepEqual((await db.query('select * from ratings')).rows,[{work_id:2,rating:8}]);
 assert.equal((await db.query('select count(*)::int n from catalog_public_revision_events')).rows[0].n,8,'receipts remain as operational evidence, no source bodies');
 }finally{await db.close();}
});
