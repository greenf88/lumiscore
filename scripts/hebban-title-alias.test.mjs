import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';
import {renderAliasImport,renderAliasRollback} from './hebban-title-alias.mjs';
test('source-bound alias COMMIT/replay/receipt undo is isolated; stale identities and empty receipts refuse',async()=>{
 const db=new PGlite();const plan={project:'hlvujbrmfdlrfxdjwsmb',work:{id:962100006,title:'De zeven zussen',author_id:758},edition:{id:962200008,work_id:962100006,isbn_13:'9789401609371',language:'nld'},title:'The Seven Sisters'};
 try{
  await db.exec("create table works(id bigint primary key,title text,author_id bigint);create table editions(id bigint primary key,work_id bigint references works(id),isbn_13 text,language text);create table catalog_work_title_aliases(work_id bigint references works(id),title text,primary key(work_id,title));create table ratings(work_id bigint,score int);create table user_book_status(work_id bigint,status text);insert into works values(962100006,'De zeven zussen',758),(8476,'The Seven Sisters',758);insert into editions values(962200008,962100006,'9789401609371','nld');insert into catalog_work_title_aliases values(8476,'Untouched');insert into ratings values(962100006,8);insert into user_book_status values(962100006,'read');");
  const before=await db.query('select * from ratings');
  const first=(await db.exec(renderAliasImport(plan))).flatMap(r=>r.rows).find(r=>r.receipt)?.receipt;
  assert.equal(first.changes.length,1);
  const replay=(await db.exec(renderAliasImport(plan))).flatMap(r=>r.rows).find(r=>r.receipt)?.receipt;assert.deepEqual(replay.changes,[]);
  const undo=async receipt=>{await db.query("select set_config('app.pr63_alias_receipt',$1,false)",[JSON.stringify(receipt)]);try{await db.exec(renderAliasRollback(plan));}catch(e){await db.exec('rollback');throw e;}};
  await assert.rejects(undo(replay),/Exact own alias receipt/);
  await db.exec("update editions set language='eng' where id=962200008");
  await assert.rejects(undo(first),/Later edition change/);
  await assert.rejects(db.exec(renderAliasImport(plan)),/Alias edition drift/);await db.exec('rollback');
  await db.exec("update editions set language='nld' where id=962200008");await undo(first);
  assert.deepEqual((await db.query('select * from catalog_work_title_aliases')).rows,[{work_id:8476,title:'Untouched'}]);
  assert.deepEqual(await db.query('select * from ratings'),before);assert.equal((await db.query('select * from user_book_status')).rows.length,1);
  assert.equal((await db.query('select * from works')).rows.length,2);
 }finally{await db.close();}
});
