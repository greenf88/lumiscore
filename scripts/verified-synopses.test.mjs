import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{createHash}from'node:crypto';import{PGlite}from'@electric-sql/pglite';
import{applyStoredPresentation,safePublicSource}from'../lib/books/stored-presentation.ts';import{loadPublicBookDescriptionState}from'../lib/books/public-description.ts';import{withStrictEdition,selectStrictEdition}from'../lib/books/strict-edition.ts';
const root=new URL('../catalog/verified-synopses-20261107/',import.meta.url),text=n=>fs.readFileSync(new URL(n,root),'utf8'),read=n=>JSON.parse(text(n));
test('exact ten-action package is nine original summaries plus one verified alias; no new production Works',()=>{
 const manifest=read('release-hashes.json'),review=read('summary-review.json'),p=read('production-plan.json');
 for(const[n,h]of Object.entries(manifest.sha256))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(n,root))).digest('hex'),h,n);
 assert.equal(p.actions.length,10);assert.equal(p.actions.filter(a=>a.relation==='catalog_work_descriptions').length,9);
 const alias=p.actions.find(a=>a.relation==='works');assert.equal(alias.key.id,8856);assert.equal(alias.before.open_library_id,'OL7989537W');assert.equal(alias.after.open_library_id,'OL3741471W');
 const before={...alias.before},after={...alias.after};delete before.open_library_id;delete after.open_library_id;assert.deepEqual(before,after);
 for(const i of review.items){assert(i.wordCount>=50&&i.wordCount<=90);assert.equal(i.wordCount,i.summary.text.split(/\s+/u).length);assert(safePublicSource(i.summary.sourceUrl));assert.equal(i.expectedWork.author_id,i.expectedAuthor.id);assert.equal(i.expectedEdition.work_id,i.workId);assert(i.sourceFacts.length>=2);}
 assert.equal(review.items.filter(i=>i.language==='nl').length,1);
});
test('all nine exact editions use reviewed locale text offline on repeated/cold page resolution; scores and titles survive',async()=>{
 const p=read('production-plan.json');
 for(const i of read('summary-review.json').items){
  const e=i.expectedEdition,row=p.actions.find(a=>a.relation==='catalog_work_descriptions'&&a.key.work_id===i.workId).after;
  const book=withStrictEdition({id:String(i.workId),workId:String(i.workId),authorId:String(i.expectedAuthor.id),title:i.title,author:i.author,source:'supabase',cover:'orbit',score:8.5,ratingBand:'5–9',ratingsCount:null,match:null},selectStrictEdition([e],i.language,i.title),i.language);
  const selected=applyStoredPresentation([book],i.language,[row],[])[0];let requests=0;
  for(let n=0;n<3;n++){const r=await loadPublicBookDescriptionState(selected,i.language,async()=>{requests++;throw Error('Synthetic provider unavailable');});assert.equal(r.state,'resolved');assert.equal(r.description.text,i.summary.text);assert.equal(r.description.sourceUrl,i.summary.sourceUrl);}
  assert.equal(requests,0);assert.equal(selected.editionId,String(e.id));assert.equal(selected.score,8.5);assert.equal(selected.ratingsCount,null);assert.equal(selected.ratingBand,'5–9');
  assert.equal(applyStoredPresentation([book],i.language==='en'?'nl':'en',[row],[])[0].storedDescription,undefined);
 }
 const kitchen=read('production-before.json').editions.find(e=>e.work_id===917);assert.equal(selectStrictEdition([kitchen],'en','Kitchen'),null,'Kitchen lacks a verified English edition; never exclude by synopsis instead');
});
async function fixture(target){
 const db=new PGlite();await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create table authors(id bigint primary key,open_library_id text unique,name text,created_at timestamptz);create table works(id bigint primary key,open_library_id text unique,title text,subtitle text,author_id bigint references authors,first_publish_year int,cover_id bigint,subjects text[],created_at timestamptz,source_type text,work_type text,native_identity_key text unique);create table editions(id bigint primary key,work_id bigint references works,open_library_edition_id text unique,isbn_10 text,isbn_13 text,language text,publisher text,created_at timestamptz,title text);create table synthetic_ratings(work_id bigint references works,score int);create table synthetic_progress(work_id bigint references works,status text);");
 if(target!=='production')await db.exec("alter table authors drop column created_at;alter table works drop column created_at,drop column subjects,drop column subtitle;alter table editions drop column created_at,add column publish_date text,add column cover_id bigint;");
 const before=read(target==='production'?'production-before.json':target==='fixture'?'test-before.json':'fixture-state.json');
 for(const[t,rows]of[['authors',before.authors],['works',before.works],['editions',before.editions]])await db.query('insert into '+t+' select * from jsonb_populate_recordset(null::'+t+',$1)',[JSON.stringify(rows)]);
 for(const f of['20261030063949_nl_pilot_reviewed_presentation.sql','20261030120602_catalog_integrity_presentation_guards.sql'])await db.exec(fs.readFileSync(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
 if(before.works.length){await db.query('insert into synthetic_ratings values($1,9)',[before.works[0].id]);await db.query("insert into synthetic_progress values($1,'read')",[before.works[0].id]);}return db;
}
async function snapshot(db){const out={};for(const t of['authors','works','editions','catalog_work_descriptions','catalog_edition_metadata','synthetic_ratings','synthetic_progress'])out[t]=(await db.query('select to_jsonb(t) r from '+t+' t order by to_jsonb(t)::text')).rows;return out;}
for(const target of['production','test','fixture'])test(target+': dryrun, committed import/replay/restore, own-scope and later-change/dependency guards',async()=>{
 const db=await fixture(target);try{
  const original=await snapshot(db),plan=read(target+'-plan.json');
  const getReceipt=results=>results.find(r=>r.rows?.[0]?.receipt)?.rows[0].receipt;
  const dry=getReceipt(await db.exec(text(target+'-dry-run.sql')));assert.equal(dry.rows.length,plan.actions.length);assert.deepEqual(await snapshot(db),original);
  const receipt=getReceipt(await db.exec(text(target+'-apply.sql')));assert.equal(receipt.rows.length,plan.actions.length);
  const applied=await snapshot(db);assert.equal(getReceipt(await db.exec(text(target+'-apply.sql'))).rows.length,0);assert.deepEqual(await snapshot(db),applied);
  const set=r=>db.query("select set_config('lumiscore.catalog_release_receipt',$1,false)",[JSON.stringify(r)]);
  const wrong=structuredClone(receipt);wrong.rows[0].key={id:42};await set(wrong);
  await assert.rejects(db.exec(text(target+'-restore.sql')),/Receipt outside exact reviewed scope/);await db.exec('rollback');await set(receipt);
  const d=receipt.rows.find(r=>r.relation==='catalog_work_descriptions');
  if(d){await db.query('update catalog_work_descriptions set text=text||$1 where work_id=$2 and language=$3',[' Later review.',d.key.work_id,d.key.language]);await assert.rejects(db.exec(text(target+'-restore.sql')),/Later legitimate change/);await db.exec('rollback');await db.query('update catalog_work_descriptions set text=$1 where work_id=$2 and language=$3',[d.after_row.text,d.key.work_id,d.key.language]);}
  if(target==='fixture'){const w=receipt.rows.find(r=>r.relation==='works');await db.query('insert into synthetic_ratings values($1,8)',[w.after_row.id]);await assert.rejects(db.exec(text(target+'-restore.sql')),/Later dependency/);await db.exec('rollback');await db.query('delete from synthetic_ratings where work_id=$1',[w.after_row.id]);}
  if(target!=='fixture'){const e=plan.editionBindings[0];await db.query('update editions set publisher=$1 where id=$2',['Later review',e.id]);await assert.rejects(db.exec(text(target+'-restore.sql')),/Exact edition drift/);await db.exec('rollback');await db.query('update editions set publisher=$1 where id=$2',[e.publisher,e.id]);}
  await db.exec(text(target+'-restore.sql'));assert.deepEqual(await snapshot(db),original);
  await db.exec(text(target+'-apply.sql'));assert.deepEqual(await snapshot(db),applied);
 }finally{await db.close();}
});

