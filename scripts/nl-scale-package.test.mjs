import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {renderImport,renderRollback} from './nl-scale-release-sql.mjs';
import {loadSnapshot} from './nl-scale-snapshot.mjs';
import {selectStrictEdition} from '../lib/books/strict-edition.ts';
const root=new URL('../catalog/nl-scale-20261102/',import.meta.url);
const read=n=>JSON.parse(fs.readFileSync(new URL(n,root),'utf8'));
test('frozen release hashes bind only the 498 accepted presentations and exact unchanged migration',()=>{
 const manifest=read('release/release-hashes.json'),plan=read('release/production-plan.json');
 assert.equal(manifest.status,'REVIEW_READY_NOT_AUTHORISED');assert.equal(manifest.productionWrites,0);
 assert.equal(plan.actions.length,1492);assert.equal(manifest.summary.netDutchAvailability,235);
 for(const [name,hash]of Object.entries(manifest.files))assert.equal(createHash('sha256').update(fs.readFileSync(new URL('release/'+name,root))).digest('hex'),hash,name);
 const accepted=read('release/hosted-acceptance.json');assert.equal(accepted.rows.length,498);assert(accepted.rows.every(r=>r.accepted));
 assert.equal(accepted.rows.filter(r=>r.documentedPlaceholder).length,84);
 const exclusions=read('release/exclusions.json');assert.equal(exclusions.excludedActions.length,6);
 const deferred=read('release/deferred-research.json');assert.equal(deferred.completedDossiers,589);assert.equal(deferred.openLogicalDossiers,411);
});
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

test('phase003 exact owned mirrors import, replay and undo without altering shared authors',async()=>{
 const baseline=read('subbatches/003/test-author-preflight.json').readback;
 const db=await fixture('test',baseline),plan=read('subbatches/003/test-fixture-plan.json');
 const snapshot=async()=>{const out={};for(const t of ['authors','works','editions','catalog_work_descriptions','catalog_edition_metadata','synthetic_ratings','synthetic_progress','synthetic_accounts'])out[t]=(await db.query(`select to_jsonb(t) r from ${t} t order by to_jsonb(t)::text`)).rows;return out;};
 try{
  const before=await snapshot(),first=(await db.exec(renderImport(plan))).find(x=>x.rows?.[0]?.receipt)?.rows[0].receipt;
  assert.equal(first.rows.length,47);assert.equal(plan.summary.newWorks,18);assert.equal(plan.summary.netDutchAvailability,0);
  assert.equal((await db.exec(renderImport(plan))).find(x=>x.rows?.[0]?.receipt)?.rows[0].receipt.rows.length,0);
  await db.query("select set_config('lumiscore.catalog_release_receipt',$1,false)",[JSON.stringify(first)]);
  await db.exec(renderRollback(plan));assert.deepEqual(await snapshot(),before);
 }finally{await db.close();}
});

test('phase003 exact hosted-schema mapping preserves edition identity through committed recovery',async()=>{
 const baseline=read('subbatches/003/test-fixture-full-readback.json').readback;
 const db=await fixture('test',{...baseline,author_corpora:baseline.works}),plan=read('subbatches/003/test-plan.json');
 try{
  await db.query('insert into editions select * from jsonb_populate_recordset(null::editions,$1)',[JSON.stringify(baseline.editions)]);
  const before=(await db.query('select jsonb_agg(to_jsonb(t) order by id) r from editions t')).rows[0].r;
  const first=(await db.exec(renderImport(plan))).find(x=>x.rows?.[0]?.receipt)?.rows[0].receipt;
  assert.equal(first.rows.length,38);assert.equal((await db.query('select count(*)::int n from catalog_edition_metadata')).rows[0].n,18);
  assert.equal((await db.query('select count(*)::int n from catalog_work_descriptions')).rows[0].n,18);
  assert.equal((await db.exec(renderImport(plan))).find(x=>x.rows?.[0]?.receipt)?.rows[0].receipt.rows.length,0);
  await db.query("select set_config('lumiscore.catalog_release_receipt',$1,false)",[JSON.stringify(first)]);
  await db.exec(renderRollback(plan));assert.deepEqual((await db.query('select jsonb_agg(to_jsonb(t) order by id) r from editions t')).rows[0].r,before);
 }finally{await db.close();}
});

test('phase003 reuses eighteen editions, restores one excluded NL language, protects users and undoes committed changes',async()=>{
 const baseline=read('subbatches/003/production-preflight.json').readback;
 const db=await fixture('production',{...baseline,author_corpora:baseline.works}),plan=read('subbatches/003/production-plan.json');
 const snapshot=async()=>{const out={};for(const t of ['authors','works','editions','catalog_work_descriptions','catalog_edition_metadata','synthetic_ratings','synthetic_progress','synthetic_accounts'])out[t]=(await db.query(`select to_jsonb(t) r from ${t} t order by to_jsonb(t)::text`)).rows;return out;};
 try{
  await db.query('insert into editions select * from jsonb_populate_recordset(null::editions,$1)',[JSON.stringify(baseline.editions)]);
  const before=await snapshot(),first=(await db.exec(renderImport(plan))).find(x=>x.rows?.[0]?.receipt)?.rows[0].receipt;
  assert.equal(first.rows.length,38);assert.equal(plan.summary.netDutchAvailability,1);
  assert(first.rows.filter(x=>x.relation==='editions').every(x=>x.before_row!==null));
  assert.equal((await db.query('select count(*)::int n from editions')).rows[0].n,baseline.editions.length);
  assert.equal((await db.exec(renderImport(plan))).find(x=>x.rows?.[0]?.receipt)?.rows[0].receipt.rows.length,0);
  await db.query("select set_config('lumiscore.catalog_release_receipt',$1,false)",[JSON.stringify(first)]);
  const text=first.rows.find(x=>x.relation==='catalog_work_descriptions');
  await db.query("update catalog_work_descriptions set text=text||' Later independent review.' where work_id=$1",[text.key.work_id]);
  await assert.rejects(db.exec(renderRollback(plan)),/Later legitimate change/);await db.exec('rollback');
  await db.query('update catalog_work_descriptions set text=$1 where work_id=$2',[text.after_row.text,text.key.work_id]);
  await db.exec(renderRollback(plan));assert.deepEqual(await snapshot(),before);
 }finally{await db.close();}
});
for(const env of ['test','production'])test('phase004 '+env+': twenty exact new identities, repeat import and committed recovery',async()=>{
 const baseline=read('subbatches/004/'+env+'-identity-preflight.json').readback;
 const db=await fixture(env,baseline),plan=read('subbatches/004/'+env+'-plan.json');
 const snapshot=async()=>{const out={};for(const t of ['authors','works','editions','catalog_work_descriptions','catalog_edition_metadata','synthetic_ratings','synthetic_progress','synthetic_accounts'])out[t]=(await db.query(`select to_jsonb(t) r from ${t} t order by to_jsonb(t)::text`)).rows;return out;};
 try{
  const before=await snapshot(),first=(await db.exec(renderImport(plan))).find(x=>x.rows?.[0]?.receipt)?.rows[0].receipt;
  assert.equal(first.rows.length,env==='test'?94:84);assert.equal(plan.summary.newWorks,20);assert.equal(plan.summary.netDutchAvailability,20);
  assert.equal((await db.query("select count(*)::int n from works w join authors a on a.id=w.author_id where w.title in('Roseanna','Den skrattande polisen','Brandbilen som försvann') and a.name='Maj Sjöwall'")).rows[0].n,3);
  assert.equal((await db.query('select count(*)::int n from catalog_work_descriptions')).rows[0].n,20);
  assert.equal((await db.query('select count(*)::int n from catalog_edition_metadata')).rows[0].n,20);
  assert.equal((await db.exec(renderImport(plan))).find(x=>x.rows?.[0]?.receipt)?.rows[0].receipt.rows.length,0);
  await db.query("select set_config('lumiscore.catalog_release_receipt',$1,false)",[JSON.stringify(first)]);
  await db.exec(renderRollback(plan));assert.deepEqual(await snapshot(),before);
 }finally{await db.close();}
});

test('phase001 has thirteen distinct reviewed identities, no taxonomy or private-data writes',()=>{
 const p=read('subbatches/001/production-plan.json'),ids=new Set(p.actions.filter(x=>x.relation==='works').map(x=>x.after.open_library_id)),d=read('final-research-decisions.json').decisions.filter(x=>x.importApproved&&ids.has(x.work?.sourceWorkId));
 assert.equal(d.length,13);assert.equal(new Set(d.map(x=>x.candidateId)).size,13);
 assert.deepEqual(Object.fromEntries(['authors','works','editions','catalog_work_descriptions','catalog_edition_metadata'].map(t=>[t,p.actions.filter(a=>a.relation===t).length])),{authors:4,works:13,editions:13,catalog_work_descriptions:13,catalog_edition_metadata:13});
 for(const x of d){assert(x.summary.text.trim().split(/\s+/).length>=50);assert(x.evidence.coverSha256);assert(['paperback','hardcover'].includes(x.edition.format));assert.equal(x.edition.language,'dut');}
 assert(p.actions.filter(x=>x.relation==='works'&&x.after.work_type===null).length>=4);
});

test('phase005 reuses exact existing editions and protects corrected language and later edits',async()=>{
 const baseline=read('subbatches/005/production-preflight.json').readback,plan=read('subbatches/005/production-plan.json');
 const db=await fixture('production',{...baseline,author_corpora:baseline.works});
 const snapshot=async()=>{const out={};for(const t of ['authors','works','editions','catalog_work_descriptions','catalog_edition_metadata','synthetic_ratings','synthetic_progress','synthetic_accounts'])out[t]=(await db.query(`select to_jsonb(t) r from ${t} t order by to_jsonb(t)::text`)).rows;return out;};
 try{
  await db.query('insert into editions select * from jsonb_populate_recordset(null::editions,$1)',[JSON.stringify(baseline.editions)]);
  const before=await snapshot(),first=(await db.exec(renderImport(plan))).find(x=>x.rows?.[0]?.receipt)?.rows[0].receipt;
  assert.equal(first.rows.length,96);assert.equal(plan.summary.netDutchAvailability,1);assert.equal(plan.summary.newWorks,0);
  assert.equal(plan.summary.newDutchEditions,0);assert.equal(plan.summary.newDutchSummaries,44);
  assert.equal((await db.query('select count(*)::int n from editions')).rows[0].n,45);
  assert.equal((await db.query('select language from editions where id=1698')).rows[0].language,'dut');
  const m=(await db.query('select * from catalog_edition_metadata where edition_id=1698')).rows[0];
  assert.equal(m.bound_isbn13,'9789056726126');assert(m.cover_url.includes('/13126795-L'));
  assert.equal((await db.exec(renderImport(plan))).find(x=>x.rows?.[0]?.receipt)?.rows[0].receipt.rows.length,0);
  await db.query("select set_config('lumiscore.catalog_release_receipt',$1,false)",[JSON.stringify(first)]);
  await db.query("update catalog_work_descriptions set text=text||' Later reviewed text.' where work_id=1585");
  await assert.rejects(db.exec(renderRollback(plan)),/Later legitimate change/);await db.exec('rollback');
  await db.query('update catalog_work_descriptions set text=$1 where work_id=1585',[first.rows.find(x=>x.relation==='catalog_work_descriptions'&&x.key.work_id===1585).after_row.text]);
  await db.exec(renderRollback(plan));assert.deepEqual(await snapshot(),before);
 }finally{await db.close();}
});

test('phase006 distinguishes four real Dutch additions from only three net available Works and safely restores Turkish correction',async()=>{
 const baseline=read('subbatches/006/production-preflight.json').readback,plan=read('subbatches/006/production-plan.json');
 const db=await fixture('production',{...baseline,author_corpora:baseline.works});
 const snapshot=async()=>{const out={};for(const t of ['authors','works','editions','catalog_work_descriptions','catalog_edition_metadata','synthetic_ratings','synthetic_progress','synthetic_accounts'])out[t]=(await db.query(`select to_jsonb(t) r from ${t} t order by to_jsonb(t)::text`)).rows;return out;};
 try{
  await db.query('insert into editions select * from jsonb_populate_recordset(null::editions,$1)',[JSON.stringify(baseline.editions)]);
  const before=await snapshot(),first=(await db.exec(renderImport(plan))).find(x=>x.rows?.[0]?.receipt)?.rows[0].receipt;
  assert.equal(first.rows.length,14);assert.equal(plan.summary.newWorks,0);assert.equal(plan.summary.newDutchEditions,4);assert.equal(plan.summary.netDutchAvailability,3);
  assert.equal((await db.query('select language from editions where id=5813')).rows[0].language,'tur');
  const judy=(await db.query("select * from editions where isbn_13='9789026997501'")).rows[0];
  assert.equal(judy.work_id,5654);assert.equal(judy.open_library_edition_id,null);
  assert.equal((await db.query('select count(*)::int n from works')).rows[0].n,4);
  assert.equal((await db.query('select count(*)::int n from catalog_work_descriptions')).rows[0].n,4);
  assert.equal((await db.exec(renderImport(plan))).find(x=>x.rows?.[0]?.receipt)?.rows[0].receipt.rows.length,0);
  await db.query("select set_config('lumiscore.catalog_release_receipt',$1,false)",[JSON.stringify(first)]);
  await db.exec(renderRollback(plan));assert.deepEqual(await snapshot(),before);
 }finally{await db.close();}
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

for(const [number,expected,net]of[['007',7,2],['008',2,0]])test(`phase${number} preserves distinct identities, replays without changes and restores committed rows`,async()=>{
 const baseline=read(`subbatches/${number}/production-preflight.json`).readback,plan=read(`subbatches/${number}/production-plan.json`);
 const db=await fixture('production',{...baseline,author_corpora:baseline.works});
 const snapshot=async()=>{const out={};for(const t of ['authors','works','editions','catalog_work_descriptions','catalog_edition_metadata','synthetic_ratings','synthetic_progress','synthetic_accounts'])out[t]=(await db.query(`select to_jsonb(t) r from ${t} t order by to_jsonb(t)::text`)).rows;return out;};
 try{
  await db.query('insert into editions select * from jsonb_populate_recordset(null::editions,$1)',[JSON.stringify(baseline.editions)]);
  const before=await snapshot(),first=(await db.exec(renderImport(plan))).find(x=>x.rows?.[0]?.receipt)?.rows[0].receipt;
  assert.equal(first.rows.length,expected);assert.equal(plan.summary.netDutchAvailability,net);assert.equal(plan.summary.newWorks,0);
  if(number==='007')assert.equal((await db.query('select first_publish_year from works where id=264')).rows[0].first_publish_year,2001);
  else assert.equal((await db.query('select open_library_id from works where id=2392')).rows[0].open_library_id,'OL1892618W');
  assert.equal((await db.exec(renderImport(plan))).find(x=>x.rows?.[0]?.receipt)?.rows[0].receipt.rows.length,0);
  await db.query("select set_config('lumiscore.catalog_release_receipt',$1,false)",[JSON.stringify(first)]);
  await db.exec(renderRollback(plan));assert.deepEqual(await snapshot(),before);
 }finally{await db.close();}
});

for(const env of['test','production'])test(`phase009 ${env}: eight new identities, no duplicates, safe replay and receipt-bound committed recovery`,async()=>{
 const baseline=read(`subbatches/009/${env}-identity-preflight.json`).readback,plan=read(`subbatches/009/${env}-plan.json`),db=await fixture(env,baseline);
 const snapshot=async()=>{const out={};for(const t of ['authors','works','editions','catalog_work_descriptions','catalog_edition_metadata','synthetic_ratings','synthetic_progress','synthetic_accounts'])out[t]=(await db.query(`select to_jsonb(t) r from ${t} t order by to_jsonb(t)::text`)).rows;return out;};
 try{const before=await snapshot(),first=(await db.exec(renderImport(plan))).find(x=>x.rows?.[0]?.receipt)?.rows[0].receipt;
  assert.equal(plan.summary.newWorks,8);assert.equal(plan.summary.netDutchAvailability,8);
  assert.equal((await db.query("select count(*)::int n from works w join authors a on a.id=w.author_id where w.title in('Mannen som gick upp i rök','Polis, polis, potatismos!','Mannen på balkongen') and a.name='Maj Sjöwall'")).rows[0].n,3);assert.equal(first.rows.length,plan.actions.length);
  assert.equal((await db.query('select count(distinct work_id)::int n from catalog_work_descriptions')).rows[0].n,8);
  assert.equal((await db.query("select count(*)::int n from works where title='Polis, polis, potatismos!'")).rows[0].n,1);
  assert.equal((await db.exec(renderImport(plan))).find(x=>x.rows?.[0]?.receipt)?.rows[0].receipt.rows.length,0);
  await db.query("select set_config('lumiscore.catalog_release_receipt',$1,false)",[JSON.stringify(first)]);await db.exec(renderRollback(plan));assert.deepEqual(await snapshot(),before);
 }finally{await db.close();}
});

for(const [number,expected,net]of[['010',20,0],['011',18,1],['012',21,6]])test(`phase${number} exact existing identities: reuse/addition, missing ISBNs and committed recovery`,async()=>{
 const b=read(`subbatches/${number}/production-preflight.json`).readback,p=read(`subbatches/${number}/production-plan.json`),db=await fixture('production',{...b,author_corpora:b.works});
 const snapshot=async()=>{const out={};for(const t of['authors','works','editions','catalog_work_descriptions','catalog_edition_metadata','synthetic_ratings','synthetic_progress','synthetic_accounts'])out[t]=(await db.query(`select to_jsonb(t) r from ${t} t order by to_jsonb(t)::text`)).rows;return out;};
 try{await db.query('insert into editions select * from jsonb_populate_recordset(null::editions,$1)',[JSON.stringify(b.editions)]);const before=await snapshot(),receipt=(await db.exec(renderImport(p))).find(x=>x.rows?.[0]?.receipt)?.rows[0].receipt;
  assert.equal(receipt.rows.length,expected);assert.equal(p.summary.netDutchAvailability,net);assert.equal(p.summary.newWorks,0);
  if(number==='010'){assert.equal(p.actions.filter(a=>a.relation==='editions').length,0);const m=(await db.query('select evidence from catalog_edition_metadata where work_id=6185')).rows[0];assert(m.evidence.some(e=>e.type==='cover_front_review'&&e.limitation.includes('Ulrich Karger/Uli Waas')));assert(!JSON.stringify(m).includes('Ulf Blanck'));}
  if(number==='011'){const edits=receipt.rows.filter(r=>r.relation==='editions');assert.equal(edits.length,6);assert(edits.every(r=>r.before_row.isbn_13===null&&/^978/.test(r.after_row.isbn_13)));assert.equal((await db.query('select language from editions where id=1201')).rows[0].language,'dut');assert.equal((await db.query('select count(*)::int n from editions')).rows[0].n,b.editions.length);}
  if(number==='012'){assert.equal((await db.query("select count(*)::int n from editions where language in('dut','nld','nl')")).rows[0].n,6);assert.equal((await db.query('select count(*)::int n from editions where language is null')).rows[0].n,6);for(const[id,year]of[[334,1759],[177,1925],[1193,1889]])assert.equal((await db.query('select first_publish_year from works where id=$1',[id])).rows[0].first_publish_year,year);}
  assert.equal((await db.exec(renderImport(p))).find(x=>x.rows?.[0]?.receipt)?.rows[0].receipt.rows.length,0);await db.query("select set_config('lumiscore.catalog_release_receipt',$1,false)",[JSON.stringify(receipt)]);await db.exec(renderRollback(p));assert.deepEqual(await snapshot(),before);
 }finally{await db.close();}
});

for(const env of ['test','production'])test(`phase013 ${env}: nine new identities with independent print/author binding and committed recovery`,async()=>{
 const baseline=read(`subbatches/013/${env}-identity-preflight.json`).readback,plan=read(`subbatches/013/${env}-plan.json`),db=await fixture(env,baseline);
 const snapshot=async()=>{const out={};for(const t of ['authors','works','editions','catalog_work_descriptions','catalog_edition_metadata','synthetic_ratings','synthetic_progress','synthetic_accounts'])out[t]=(await db.query(`select to_jsonb(t) r from ${t} t order by to_jsonb(t)::text`)).rows;return out;};
 try{const before=await snapshot(),receipt=(await db.exec(renderImport(plan))).find(x=>x.rows?.[0]?.receipt)?.rows[0].receipt;assert.equal(plan.summary.newWorks,9);assert.equal(receipt.rows.length,plan.actions.length);assert.equal((await db.query("select count(*)::int n from editions where language='dut'")).rows[0].n,9);assert.equal((await db.query("select count(*)::int n from editions where isbn_13='9789072810014'")).rows[0].n,0);assert.equal((await db.query("select count(*)::int n from catalog_work_descriptions where text like 'In de familie Olson%'")).rows[0].n,1);assert.equal((await db.exec(renderImport(plan))).find(x=>x.rows?.[0]?.receipt)?.rows[0].receipt.rows.length,0);await db.query("select set_config('lumiscore.catalog_release_receipt',$1,false)",[JSON.stringify(receipt)]);await db.exec(renderRollback(plan));assert.deepEqual(await snapshot(),before);}finally{await db.close();}
});

for(const [folder,expectedActions,expectedTexts,expectedMissing]of[['combined-draft',1498,501,281],['release',1492,498,278]])test(folder+' over full public production snapshot: shared authors once, unique NL growth, replay and committed recovery',async()=>{
 const s=loadSnapshot(),plan=read(folder+'/production-plan.json');
 // Public inventory omits subjects/created_at; enrich only missing CAS fields from fresh full-row preflights, rejecting any core-field drift.
 const wm=new Map(s.works.map(w=>[w.id,w])),am=new Map(s.authors.map(a=>[a.id,a])),em=new Map(s.editions.map(e=>[e.id,e]));
 const enrich=(m,row)=>{const old=m.get(row.id);if(!old)throw Error('Preflight identity absent from full snapshot');for(const k of Object.keys(row))if(Object.hasOwn(old,k))assert.deepEqual(old[k],row[k],`Snapshot/preflight core drift ${row.id}:${k}`);m.set(row.id,{...old,...row});};
 for(const b of plan.bindings){enrich(wm,b.work);enrich(am,b.author);}for(const c of plan.authorCorpora)for(const w of c.rows)enrich(wm,w);for(const a of plan.actions.filter(a=>a.relation==='editions'&&a.before))enrich(em,a.before);
 s.works=[...wm.values()];s.authors=[...am.values()];s.editions=[...em.values()];
 const db=await fixture('production',{authors:s.authors,author_corpora:s.works});
 const snapshot=async()=>{const out={};for(const t of ['authors','works','editions','catalog_work_descriptions','catalog_edition_metadata','synthetic_ratings','synthetic_progress','synthetic_accounts'])out[t]=(await db.query(`select to_jsonb(t) r from ${t} t order by to_jsonb(t)::text`)).rows;return out;};
 const available=async()=>{const ws=(await db.query('select * from works')).rows,es=(await db.query('select * from editions')).rows,m=new Map();for(const e of es){const a=m.get(e.work_id)??[];a.push(e);m.set(e.work_id,a);}return new Set(ws.filter(w=>selectStrictEdition(m.get(w.id)??[],'nl',w.title)).map(w=>w.id));};
 try{await db.query('insert into editions select * from jsonb_populate_recordset(null::editions,$1)',[JSON.stringify(s.editions)]);
  for(const[t,rows]of[['catalog_work_descriptions',s.descriptions],['catalog_edition_metadata',s.metadata]])await db.query(`insert into ${t} select * from jsonb_populate_recordset(null::${t},$1)`,[JSON.stringify(rows)]);
  if(folder==='release'){
   const preflight=(await db.exec(fs.readFileSync(new URL('release/production-preflight.sql',root),'utf8'))).find(x=>x.rows?.[0]?.failures!==undefined)?.rows[0];
   assert(preflight);assert.equal(preflight.failures,0);assert.equal(preflight.checks,read('release/preflight-contract.json').checks);
   const preflightSql=fs.readFileSync(new URL('release/production-preflight.sql',root),'utf8');
   const bound=plan.bindings[0].work;
   await db.query("update works set title=title||' synthetic later edit' where id=$1",[bound.id]);
   assert((await db.exec(preflightSql)).find(x=>x.rows?.[0]?.failures!==undefined).rows[0].failures>0);
   await db.query('update works set title=$1 where id=$2',[bound.title,bound.id]);
   const newEdition=plan.actions.find(a=>a.relation==='editions'&&a.before===null).after;
   await db.query('insert into editions(id,work_id,title,isbn_13) values(999999,$1,$2,$3)',[bound.id,'Synthetic duplicate identity probe',newEdition.isbn_13]);
   assert((await db.exec(preflightSql)).find(x=>x.rows?.[0]?.failures!==undefined).rows[0].failures>0);
   await db.query('delete from editions where id=999999');
   assert.equal((await db.exec(preflightSql)).find(x=>x.rows?.[0]?.failures!==undefined).rows[0].failures,0);
  }
  const before=await snapshot(),nlBefore=await available(),started=performance.now(),receipt=(await db.exec(renderImport(plan))).find(x=>x.rows?.[0]?.receipt)?.rows[0].receipt,importMs=performance.now()-started;
  assert.equal(plan.summary.actions,expectedActions);assert.equal(receipt.rows.length,expectedActions);assert.equal(plan.summary.deduplicatedSharedAuthors,4);
  assert.equal(plan.actions.filter(a=>a.relation==='catalog_work_descriptions').length,expectedTexts);
  if(folder==='release'){
   assert(!plan.actions.some(a=>a.relation==='catalog_work_descriptions'&&[5028,1628,6044].includes(a.key.work_id)));
   assert(!plan.actions.some(a=>a.relation==='catalog_edition_metadata'&&[5187,1761,6203].includes(a.key.edition_id)));
   const hosted=read('release/hosted-acceptance.json');assert.equal(hosted.accepted,498);assert.equal(hosted.rows.length,498);assert(hosted.rows.every(r=>r.accepted&&Object.values(r.checks).every(Boolean)));
  }
  const nlAfter=await available();assert.equal(nlBefore.size,3096);assert.equal(nlAfter.size-nlBefore.size,235);assert.equal([...nlBefore].filter(id=>!nlAfter.has(id)).length,0);
  if(folder==='release'){
   const dossiers=read('release/dossiers.json').decisions;
   const metadata=receipt.rows.filter(r=>r.relation==='catalog_edition_metadata').map(r=>r.after_row);
   const rows=dossiers.map(d=>{
    const matches=metadata.filter(m=>m.bound_isbn13===d.edition.isbn13);assert.equal(matches.length,1);
    const workId=matches[0].work_id;
    return {candidateId:d.candidateId,stream:d.stream,productionWorkId:d.productionWorkId??(d.candidateId.startsWith('work:')?Number(d.candidateId.slice(5)):null),sourceWorkId:d.work?.sourceWorkId??null,isbn:d.edition.isbn13,newlyAvailableInDutch:!nlBefore.has(workId)&&nlAfter.has(workId)};
   });
   assert.equal(rows.filter(r=>r.newlyAvailableInDutch).length,235);
   const streams=Object.fromEntries([...new Set(rows.map(r=>r.stream))].map(stream=>[stream,{dossiers:rows.filter(r=>r.stream===stream).length,extraDutchWorks:rows.filter(r=>r.stream===stream&&r.newlyAvailableInDutch).length}]));
   fs.writeFileSync(new URL('release/net-availability.json',root),JSON.stringify({scope:'Computed using unchanged strict edition selector on full current public production snapshot, exact release import and unique Work IDs; projected, not production executed.',before:3096,after:3331,net:235,streams,rows},null,2)+'\n');
  }
  const game=(await db.query("select m.cover_url from catalog_edition_metadata m join editions e on e.id=m.edition_id where e.isbn_13='9789464291513'")).rows;
  assert.equal(game.length,1);assert.equal(game[0].cover_url,'https://metadata.isbn.nl/ie_fcache/0000579782_Gamechanger_0_0.jpg');
  const touch=(await db.query("select m.cover_url,m.card_cover_url from catalog_edition_metadata m join editions e on e.id=m.edition_id where e.isbn_13='9789020550634'")).rows;
  assert.equal(touch.length,1);assert.equal(touch[0].cover_url,'https://covers.openlibrary.org/b/id/15127990-L.jpg?default=false');assert.equal(touch[0].card_cover_url,'https://covers.openlibrary.org/b/id/15127990-M.jpg?default=false');
  for(const[id,year]of[[1362,2015],[3262,2013],[3368,2020],[3482,2014],[1540,1839],[214,2008],[1630,2014],[816,2018]])assert.equal((await db.query('select first_publish_year from works where id=$1',[id])).rows[0].first_publish_year,year);
  // The 2016 Cavia must not be attached to the existing 2024 sequel.
  assert(!plan.actions.some(a=>a.after.work_id===1570||a.relation==='works'&&a.key.id===1570));
  assert.equal((await db.query("select m.format from catalog_edition_metadata m join editions e on e.id=m.edition_id where e.isbn_13='9789025465704'")).rows[0].format,'paperback');
  assert.equal((await db.query('select publisher from editions where id=3469')).rows[0].publisher,'Cossee');assert.equal((await db.query('select publisher from editions where id=3595')).rows[0].publisher,'Meulenhoff');assert.equal((await db.query('select format from catalog_edition_metadata where edition_id=3375')).rows[0].format,'hardcover');assert.equal((await db.query('select first_publish_year from works where id=4976')).rows[0].first_publish_year,2004);assert.equal((await db.query('select first_publish_year from works where id=629')).rows[0].first_publish_year,2005);
  const authors=(await db.query("select name,count(*)::int n from authors where open_library_id in('OL709121A','OL863535A') group by name")).rows;assert.equal(authors.length,2);assert(authors.every(a=>a.n===1));
  assert.equal((await db.exec(renderImport(plan))).find(x=>x.rows?.[0]?.receipt)?.rows[0].receipt.rows.length,0);
  await db.query("select set_config('lumiscore.catalog_release_receipt',$1,false)",[JSON.stringify(receipt)]);await db.exec(renderRollback(plan));assert.deepEqual(await snapshot(),before);
  fs.writeFileSync(new URL(folder+'/local-proof.json',root),JSON.stringify({scope:'Local full public production snapshot plus clearly synthetic private stand-ins; not hosted combined import',baselineWorks:s.works.length,baselineEditions:s.editions.length,actions:receipt.rows.length,newWorks:176,newDutchEditions:234,newDutchSummaries:expectedTexts,coverBindings:220,editionsWithoutImportedCoverBinding:expectedMissing,additionalReviewedOriginalYearCorrections:8,nlBefore:nlBefore.size,nlAfter:nlAfter.size,net:nlAfter.size-nlBefore.size,duplicateNewAuthorsPrevented:4,importMs,commitReplayAndCommittedRecovery:true,allOriginalRowsPreserved:true,productionWrites:0},null,2)+'\n');
 }finally{await db.close();}
});
