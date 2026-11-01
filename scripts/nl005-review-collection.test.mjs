import fs from'node:fs';import assert from'node:assert/strict';import test from'node:test';import{PGlite}from'@electric-sql/pglite';
test('test-only review grouping replays and commits guarded recovery without touching existing memberships',async()=>{
 const dir=new URL('../catalog/nl-research-005-20261101/',import.meta.url),read=n=>fs.readFileSync(new URL(n,dir),'utf8'),m=JSON.parse(read('test-review-collection-manifest.json')),db=new PGlite();try{
 await db.exec(`create table works(id bigint primary key);create table collections(id bigint generated always as identity primary key,slug text unique,name text,collection_type text,description text,created_at timestamptz default now(),updated_at timestamptz default now(),expected_main_series_total integer);create table collection_books(collection_id bigint references collections on delete cascade,work_id bigint references works,sequence_number integer,publication_order integer,subgroup text,created_at timestamptz default now(),primary key(collection_id,work_id));insert into works values(1);insert into collections(id,slug,name)overriding system value values(1,'retained','Retained');insert into collection_books(collection_id,work_id)values(1,1);`);
 for(const x of m.members)await db.query('insert into works values($1)',[x.work_id]);
 const r=(await db.exec(read('test-review-collection-apply.sql'))).find(r=>r.rows?.[0]?.receipt).rows[0].receipt;assert.equal(r.members.length,50);
 const replay=(await db.exec(read('test-review-collection-apply.sql'))).find(r=>r.rows?.[0]?.receipt).rows[0].receipt;assert.deepEqual(replay,r);
 await db.query("select set_config('lumiscore.nl005_review_collection_receipt',$1,false)",[JSON.stringify(r)]);
 await db.exec("update collections set name='Later legitimate change' where id=976400001");await assert.rejects(db.exec(read('test-review-collection-rollback.sql')),/Later collection change/);await db.exec('rollback');
 await db.query('update collections set name=$1 where id=976400001',[r.collection.name]);await db.exec(read('test-review-collection-rollback.sql'));
 assert.equal((await db.query('select count(*)::integer n from collections')).rows[0].n,1);assert.equal((await db.query('select count(*)::integer n from collection_books')).rows[0].n,1);
 }finally{await db.close();}
});
