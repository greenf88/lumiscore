import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('three-book proposal is dry-run by default, guarded, idempotent and exactly recoverable locally',async()=>{
 const db=new PGlite(); await db.waitReady;
 try {
  await db.exec(`create table authors(id bigint primary key,name text);
   create table works(id bigint primary key,author_id bigint,open_library_id text);
   create table editions(id bigint primary key,work_id bigint,title text,language text,isbn_10 text,isbn_13 text,publisher text,open_library_edition_id text);
   create table synthetic_ratings(work_id bigint,score int); create table synthetic_progress(work_id bigint,status text);
   insert into authors values(99,'Delia Owens'),(2,'George Orwell');
   insert into works values(114,99,'OL18766691W'),(1381,2,'OL1168007W');
   insert into editions values(114,114,'Where the Crawdads Sing',null,null,'9780735219090','G.P. Putnam''s Sons','OL26702293M'),
    (1421,1381,'Dierenboerderij','dut','9041330364',null,'Singel Pockets','OL18430168M');
   insert into synthetic_ratings values(114,8); insert into synthetic_progress values(1381,'read');`);
  const root=new URL('../catalog/technical-recovery-20261021/',import.meta.url);
  const proposal=await readFile(new URL('three-book-production-proposal.sql',root),'utf8');
  const recovery=await readFile(new URL('three-book-production-recovery.sql',root),'utf8');
  const state=async()=>(await db.query('select * from editions order by id')).rows;
  const before=await state(); await db.exec(proposal);assert.deepEqual(await state(),before);
  const committed=proposal.replace(/rollback;\s*$/,'commit;');
  const first=await db.exec(committed);assert.equal(first.flatMap(x=>x.rows).filter(x=>x.action).length,4);
  const changed=await state();assert.equal(changed.length,4);
  const second=await db.exec(committed);assert.equal(second.flatMap(x=>x.rows).filter(x=>x.action).length,0);
  assert.deepEqual(await state(),changed);
  const recovered=recovery.replace('crawdads_added_id bigint := null','crawdads_added_id bigint := 1422')
    .replace('animal_added_id bigint := null','animal_added_id bigint := 1423').replace(/rollback;\s*$/,'commit;');
  await db.exec(recovered);assert.deepEqual(await state(),before);
  assert.deepEqual((await db.query('select * from synthetic_ratings')).rows,[{work_id:114,score:8}]);
  assert.deepEqual((await db.query('select * from synthetic_progress')).rows,[{work_id:1381,status:'read'}]);
  await db.exec("update editions set language='deu' where id=114");
  await assert.rejects(db.exec(committed),/identity changed/);await db.exec('rollback');
  assert.equal((await state()).length,2,'conflict cannot add another edition');
 } finally {await db.close();}
});
