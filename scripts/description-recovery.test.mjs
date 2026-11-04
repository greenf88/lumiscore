import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
const root=new URL('../catalog/description-recovery-20261104/',import.meta.url);
const text=n=>fs.readFileSync(new URL(n,root),'utf8'),read=n=>JSON.parse(text(n));
test('reviewed exact file hashes match the release manifest',()=>{for(const[n,hash]of Object.entries(read('release-hashes.json').sha256))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(n,root))).digest('hex'),hash,n);});
async function fixture(target){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table authors(id bigint primary key,open_library_id text unique,name text,created_at timestamptz);
 create table works(id bigint primary key,open_library_id text unique,title text,subtitle text,author_id bigint references authors,first_publish_year int,cover_id bigint,subjects text[],created_at timestamptz,source_type text,work_type text,native_identity_key text unique);
 create table editions(id bigint primary key,work_id bigint references works,open_library_edition_id text unique,isbn_10 text,isbn_13 text,language text,publisher text,created_at timestamptz,title text);
 create table synthetic_ratings(work_id bigint references works,score int);create table synthetic_progress(work_id bigint references works,status text);`);
 if(target==='test')await db.exec(`alter table authors drop column created_at;alter table works drop column created_at,drop column subjects,drop column subtitle;alter table editions drop column created_at,add column publish_date text,add column cover_id bigint;`);
 const before=read(target+'-before.json');
 const works=before.works.map(w=>Object.fromEntries(Object.entries(w).filter(([k])=>k!=='author')));
 const authors=before.authors??[...new Map(before.works.map(w=>[w.author.id,w.author])).values()];
 for(const [t,rows] of [['authors',authors],['works',works],['editions',before.editions]])await db.query(`insert into ${t} select * from jsonb_populate_recordset(null::${t},$1)`,[JSON.stringify(rows)]);
 for(const f of ['20261030063949_nl_pilot_reviewed_presentation.sql','20261030120602_catalog_integrity_presentation_guards.sql'])await db.exec(fs.readFileSync(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
 for(const [t,rows] of [['catalog_work_descriptions',before.descriptions],['catalog_edition_metadata',before.metadata??[]]])await db.query(`insert into ${t} select * from jsonb_populate_recordset(null::${t},$1)`,[JSON.stringify(rows)]);
 const id=works[0].id;await db.query('insert into synthetic_ratings values($1,9);',[id]);await db.query("insert into synthetic_progress values($1,'read')",[id]);return db;
}
async function snapshot(db){const out={};for(const t of ['authors','works','editions','catalog_work_descriptions','catalog_edition_metadata','synthetic_ratings','synthetic_progress'])out[t]=(await db.query(`select to_jsonb(t) r from ${t} t order by to_jsonb(t)::text`)).rows;return out;}
for(const target of ['production','test'])test(target+': exact import, zero-change replay, committed recovery and drift/dependency protection',async()=>{
 const db=await fixture(target);try{
 const original=await snapshot(db),plan=read(target+'-plan.json');
 for(const binding of plan.bindings)assert.deepEqual((await db.query('select to_jsonb(w) r from works w where id=$1',[binding.work.id])).rows[0].r,binding.work);
 const dry=(await db.exec(text(target+'-dry-run.sql'))).find(r=>r.rows?.[0]?.receipt)?.rows[0].receipt;assert.equal(dry.rows.length,plan.actions.length);assert.deepEqual(await snapshot(db),original);
 const receipt=(await db.exec(text(target+'-apply.sql'))).find(r=>r.rows?.[0]?.receipt)?.rows[0].receipt;assert.equal(receipt.rows.length,plan.actions.length);
 assert.equal((await db.exec(text(target+'-apply.sql'))).find(r=>r.rows?.[0]?.receipt)?.rows[0].receipt.rows.length,0);
 await db.query("select set_config('lumiscore.catalog_release_receipt',$1,false)",[JSON.stringify(receipt)]);
 const d=receipt.rows.find(r=>r.relation==='catalog_work_descriptions');
 await db.query('update catalog_work_descriptions set text=text||$1 where work_id=$2 and language=$3',[' Later independent review.',d.key.work_id,d.key.language]);
 await assert.rejects(db.exec(text(target+'-restore.sql')),/Later legitimate change/);await db.exec('rollback');
 await db.query('update catalog_work_descriptions set text=$1 where work_id=$2 and language=$3',[d.after_row.text,d.key.work_id,d.key.language]);
 if(target==='test'){
  const w=receipt.rows.find(r=>r.relation==='works');await db.query('insert into synthetic_ratings values($1,8)',[w.after_row.id]);
  await assert.rejects(db.exec(text(target+'-restore.sql')),/Later dependency/);await db.exec('rollback');await db.query('delete from synthetic_ratings where work_id=$1',[w.after_row.id]);
 }
 const edition=plan.editionBindings[0];await db.query('update editions set publisher=$1 where id=$2',['Later review',edition.id]);
 await assert.rejects(db.exec(text(target+'-restore.sql')),/Exact edition drift/);await db.exec('rollback');await db.query('update editions set publisher=$1 where id=$2',[edition.publisher,edition.id]);
 await db.exec(text(target+'-restore.sql'));assert.deepEqual(await snapshot(db),original);
 await db.exec(text(target+'-restore.sql'));assert.deepEqual(await snapshot(db),original);
 }finally{await db.close();}
});
