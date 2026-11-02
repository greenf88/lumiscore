import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {renderImport,renderRollback} from './catalog-release-sql.mjs';
const root=new URL('../catalog/nl-scale-20261102/',import.meta.url);
const read=n=>JSON.parse(fs.readFileSync(new URL(n,root),'utf8'));
async function fixture(env,baseline){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create sequence authors_seq start 100000;create sequence works_seq start 200000;create sequence editions_seq start 300000;
 create table authors(id bigint primary key ${env==='production'?"default nextval('authors_seq')":''},open_library_id text unique,name text${env==='production'?',created_at timestamptz default now()':''});
 create table works(id bigint primary key ${env==='production'?"default nextval('works_seq')":''},title text,author_id bigint references authors,first_publish_year int,open_library_id text unique,cover_id bigint,source_type text,work_type text,native_identity_key text unique${env==='production'?',subtitle text,subjects text[],created_at timestamptz default now()':''});
 create table editions(id bigint primary key ${env==='production'?"default nextval('editions_seq')":''},work_id bigint references works,title text,language text,open_library_edition_id text unique,isbn_10 text,isbn_13 text,publisher text${env==='production'?',created_at timestamptz default now()':',publish_date text,cover_id bigint'});
 create table synthetic_ratings(id integer primary key,work_id bigint references works,score integer);
 create table synthetic_progress(work_id bigint references works,status text);
 create table synthetic_accounts(id integer primary key,label text);
 create table synthetic_cascade_dependency(work_id bigint references works on delete cascade);
 insert into synthetic_accounts values(1,'owned synthetic safety stand-in');`);
 const before=baseline??read(env+'-initial15-identity-preflight.json').readback;
 for(const [name,rows] of [['authors',before.authors],['works',before.author_corpora]])await db.query(`insert into ${name} select * from jsonb_populate_recordset(null::${name},$1)`,[JSON.stringify(rows)]);
 for(const f of ['20261030063949_nl_pilot_reviewed_presentation.sql','20261030120602_catalog_integrity_presentation_guards.sql'])await db.exec(fs.readFileSync(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
 const w=before.author_corpora[0].id;await db.query('insert into synthetic_ratings values(1,$1,9);',[w]);await db.query("insert into synthetic_progress values($1,'read')",[w]);
 return db;
}
for(const env of ['test','production'])test('exact '+env+' manifest: committed import, replay, CAS and CASCADE dependency safety, committed undo',async()=>{
 const db=await fixture(env),plan=read('subbatches/001/'+env+'-plan.json');
 const digest=async()=>{const out={};for(const t of ['authors','works','editions','catalog_work_descriptions','catalog_edition_metadata','synthetic_ratings','synthetic_progress','synthetic_accounts'])out[t]=(await db.query(`select to_jsonb(t) r from ${t} t order by to_jsonb(t)::text`)).rows;return out;};
 try{
  const before=await digest();
  const first=(await db.exec(renderImport(plan))).find(x=>x.rows?.[0]?.receipt)?.rows[0].receipt;
  assert.equal(first.rows.length,plan.actions.length);
  const replay=(await db.exec(renderImport(plan))).find(x=>x.rows?.[0]?.receipt)?.rows[0].receipt;assert.equal(replay.rows.length,0);
  assert.equal((await db.query('select count(*)::int n from catalog_work_descriptions')).rows[0].n,13);
  assert.equal((await db.query('select count(*)::int n from catalog_edition_metadata')).rows[0].n,13);
  await db.query("select set_config('lumiscore.catalog_release_receipt',$1,false)",[JSON.stringify(first)]);
  const work=first.rows.find(x=>x.relation==='works').after_row.id;
  await db.query('insert into synthetic_cascade_dependency values($1)',[work]);
  await assert.rejects(db.exec(renderRollback(plan)),/Later dependency/);await db.exec('rollback');
  assert.equal((await db.query('select count(*)::int n from synthetic_cascade_dependency')).rows[0].n,1);
  await db.query('delete from synthetic_cascade_dependency where work_id=$1',[work]);
  const description=first.rows.find(x=>x.relation==='catalog_work_descriptions');
  await db.query("update catalog_work_descriptions set text=text||' Later independently reviewed addition.' where work_id=$1",[description.key.work_id]);
  await assert.rejects(db.exec(renderRollback(plan)),/Later legitimate change/);await db.exec('rollback');
  await db.query('update catalog_work_descriptions set text=$1 where work_id=$2',[description.after_row.text,description.key.work_id]);
  await db.exec(renderRollback(plan));await db.exec(renderRollback(plan));assert.deepEqual(await digest(),before);
  await db.exec(renderImport(plan));assert.equal((await db.query('select count(*)::int n from catalog_work_descriptions')).rows[0].n,13);
 }finally{await db.close();}
});

test('phase002 owned mirror baseline commits, replays and restores without touching prior author Works',async()=>{
 const baseline=read('subbatches/002/test-author-preflight.json').readback;
 const db=await fixture('test',baseline),plan=read('subbatches/002/test-fixture-plan.json');
 const catalogue=async()=>{const out={};for(const t of ['authors','works','editions','catalog_work_descriptions','catalog_edition_metadata','synthetic_ratings','synthetic_progress','synthetic_accounts'])out[t]=(await db.query(`select to_jsonb(t) r from ${t} t order by to_jsonb(t)::text`)).rows;return out;};
 try{
  const before=await catalogue();
  const first=(await db.exec(renderImport(plan))).find(x=>x.rows?.[0]?.receipt)?.rows[0].receipt;
  assert.equal(first.rows.length,33);assert.equal(plan.summary.netDutchAvailability,0);
  const replay=(await db.exec(renderImport(plan))).find(x=>x.rows?.[0]?.receipt)?.rows[0].receipt;assert.equal(replay.rows.length,0);
  await db.query("select set_config('lumiscore.catalog_release_receipt',$1,false)",[JSON.stringify(first)]);
  await db.exec(renderRollback(plan));assert.deepEqual(await catalogue(),before);
 }finally{await db.close();}
});

test('phase002 production proposal adds translations to exact existing identities and restores changed years',async()=>{
 const baseline=read('subbatches/002/production-preflight.json').readback;
 const db=await fixture('production',{...baseline,author_corpora:baseline.works}),plan=read('subbatches/002/production-plan.json');
 try{
  await db.query('insert into editions select * from jsonb_populate_recordset(null::editions,$1)',[JSON.stringify(baseline.editions)]);
  const before=(await db.query('select jsonb_agg(to_jsonb(t) order by id) rows from works t')).rows[0].rows;
  const first=(await db.exec(renderImport(plan))).find(x=>x.rows?.[0]?.receipt)?.rows[0].receipt;
  assert.equal(first.rows.length,43);assert.equal(first.rows.filter(x=>x.relation==='works'&&x.before_row===null).length,0);
  assert.equal((await db.query("select count(*)::int n from editions where language='dut'")).rows[0].n,13);
  assert.equal((await db.exec(renderImport(plan))).find(x=>x.rows?.[0]?.receipt)?.rows[0].receipt.rows.length,0);
  await db.query("select set_config('lumiscore.catalog_release_receipt',$1,false)",[JSON.stringify(first)]);
  await db.exec(renderRollback(plan));assert.deepEqual((await db.query('select jsonb_agg(to_jsonb(t) order by id) rows from works t')).rows[0].rows,before);
  assert.equal((await db.query('select count(*)::int n from editions')).rows[0].n,13);
 }finally{await db.close();}
});
test('phase001 has thirteen distinct reviewed identities, no taxonomy or private-data writes',()=>{
 const p=read('subbatches/001/production-plan.json'),ids=new Set(p.actions.filter(x=>x.relation==='works').map(x=>x.after.open_library_id)),d=read('final-research-decisions.json').decisions.filter(x=>x.importApproved&&ids.has(x.work.sourceWorkId));
 assert.equal(d.length,13);assert.equal(new Set(d.map(x=>x.candidateId)).size,13);
 assert.deepEqual(Object.fromEntries(['authors','works','editions','catalog_work_descriptions','catalog_edition_metadata'].map(t=>[t,p.actions.filter(a=>a.relation===t).length])),{authors:4,works:13,editions:13,catalog_work_descriptions:13,catalog_edition_metadata:13});
 for(const x of d){assert(x.summary.text.trim().split(/\s+/).length>=50);assert(x.evidence.coverSha256);assert(['paperback','hardcover'].includes(x.edition.format));assert.equal(x.edition.language,'dut');}
 assert(p.actions.filter(x=>x.relation==='works'&&x.after.work_type===null).length>=4);
});
test('exact hosted safety probes reject later edits and dependencies without retained probe rows',async()=>{
 const db=await fixture('test'),plan=read('subbatches/001/test-plan.json');
 try{
  await db.exec(renderImport(plan));
  const out=await db.exec(fs.readFileSync(new URL('subbatches/001/test-safety-probes.sql',root),'utf8'));
  const proof=out.find(r=>r.rows?.[0]?.proof)?.rows[0].proof;
  assert.equal(proof.probes.length,2);assert(proof.probes.every(p=>p.refused));
  assert.equal(proof.own_records,13);assert.equal(proof.probe_records,0);
  assert.equal((await db.query('select count(*)::int n from catalog_work_descriptions')).rows[0].n,13);
 }finally{await db.close();}
});
