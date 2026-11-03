import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
import{PGlite}from'@electric-sql/pglite';import{ROOT,hash}from'./nl-continuation-bootstrap.mjs';
import{renderImport,renderRollback}from'./catalog-release-sql.mjs';
import{selectStrictEdition,withStrictEdition}from'../lib/books/strict-edition.ts';
import{applyStoredPresentation}from'../lib/books/stored-presentation.ts';
const read=n=>JSON.parse(fs.readFileSync(new URL(n,ROOT),'utf8'));
const tables=['authors','works','editions','catalog_work_descriptions','catalog_edition_metadata','synthetic_ratings','synthetic_progress','synthetic_accounts'];
async function fixture(env){
 const baseline=read(env==='production'?'production-preflight-current.json':'test-preflight-expanded.json').data,db=new PGlite(),prod=env==='production';
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create sequence authors_seq start 20000000;create sequence works_seq start 21000000;create sequence editions_seq start 22000000;
 create table authors(id bigint primary key ${prod?"default nextval('authors_seq')":''},open_library_id text unique,name text${prod?',created_at timestamptz default now()':''});
 create table works(id bigint primary key ${prod?"default nextval('works_seq')":''},title text,author_id bigint references authors,first_publish_year int,open_library_id text unique,cover_id bigint,source_type text,work_type text,native_identity_key text unique${prod?',subtitle text,subjects text[],created_at timestamptz default now()':''});
 create table editions(id bigint primary key ${prod?"default nextval('editions_seq')":''},work_id bigint references works,title text,language text,open_library_edition_id text unique,isbn_10 text,isbn_13 text,publisher text${prod?',created_at timestamptz default now()':',publish_date text,cover_id bigint'});
 create table synthetic_ratings(id int primary key,work_id bigint references works,score int);
 create table synthetic_progress(work_id bigint references works,status text);
 create table synthetic_accounts(id int primary key,label text);
 create table synthetic_cascade_dependency(work_id bigint references works on delete cascade);
 insert into synthetic_accounts values(1,'owned safety stand-in');`);
 for(const [table,rows]of[['authors',baseline.authors],['works',baseline.author_corpora],['editions',baseline.editions]])await db.query(`insert into ${table} select * from jsonb_populate_recordset(null::${table},$1)`,[JSON.stringify(rows)]);
 // Exact current production CHECK constraints were independently read back. NOT VALID
 // tolerates historical rows but still rejects invalid newly inserted/updated data.
 await db.exec(`alter table works add constraint works_work_type_check check(work_type is null or work_type in('novel','novella','short_story','collection','audiobook_original')) not valid;
 alter table works add constraint works_source_type_check check(source_type in('open_library','lumiscore_native')) not valid;`);
 for(const file of['20261030063949_nl_pilot_reviewed_presentation.sql','20261030120602_catalog_integrity_presentation_guards.sql'])await db.exec(fs.readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 for(const [table,rows]of[['catalog_work_descriptions',baseline.descriptions],['catalog_edition_metadata',baseline.metadata]])await db.query(`insert into ${table} select * from jsonb_populate_recordset(null::${table},$1)`,[JSON.stringify(rows)]);
 await db.query('insert into synthetic_ratings values(1,$1,9)',[baseline.author_corpora[0].id]);await db.query("insert into synthetic_progress values($1,'read')",[baseline.author_corpora[0].id]);
 return db;
}
async function digest(db){const out={};for(const t of tables)out[t]=(await db.query(`select to_jsonb(t) r from ${t} t order by to_jsonb(t)::text`)).rows;return out;}
const receipt=results=>results.find(x=>x.rows?.[0]?.receipt)?.rows[0].receipt;
test('frozen source subset, hashes, exact ISBN and parked PR71 exclusion',()=>{
 const manifest=read('batch-001/package-hashes.json'),prod=read('batch-001/production-plan.json');
 assert.equal(manifest.parkedPr71OverlapActions,0);assert.equal(prod.summary.presentations,35);assert.equal(prod.summary.newWorks,7);assert.equal(prod.summary.newDutchEditions,14);assert.equal(prod.summary.netDutchAvailability,12);
 for(const p of Object.values(manifest.packages))for(const[file,digest]of Object.entries(p.files))assert.equal(hash(fs.readFileSync(new URL('batch-001/'+file,ROOT))),digest,file);
 assert.equal(prod.actions.length,96);assert.equal(new Set(prod.actions.filter(a=>a.relation==='catalog_work_descriptions').map(a=>a.after.work_id)).size,35);
 assert(prod.actions.every(a=>['authors','works','editions','catalog_work_descriptions','catalog_edition_metadata'].includes(a.relation)));
 for(const r of read('batch-001/selection.json').cases){const d=read('reviewed-'+String(r).padStart(3,'0')+'.json');assert(d.status.startsWith('approved_'));assert(d.summary.text.split(/\s+/).length>=50);assert.equal(d.edition.language,'nl');}
});
for(const env of['production','test'])test(env+': committed import, zero-mutation replay, exact presentation and guarded committed recovery',async()=>{
 const db=await fixture(env),plan=read('batch-001/'+env+'-plan.json');
 try{
  const before=await digest(db),start=performance.now(),first=receipt(await db.exec(renderImport(plan)));assert.equal(first.rows.length,plan.actions.length);
  const initialMs=performance.now()-start,replay=receipt(await db.exec(renderImport(plan)));assert.equal(replay.rows.length,0);
  const presentation=read('batch-001/'+env+'-presentations.json');
  const ids=new Map(plan.actions.filter(a=>a.ref).map(a=>[a.ref,first.rows.find(r=>r.relation===a.relation&&JSON.stringify(r.key)===JSON.stringify(a.key))?.after_row?.id]));
  const resolve=ref=>typeof ref==='string'&&ref.startsWith('@')?ids.get(ref.slice(1)):ref;
  // Actual receipt keys are resolved; use natural Work identities where refs contain parents.
  for(const p of presentation){
   const r=read('reviewed-'+String(p.caseNumber).padStart(3,'0')+'.json');const work=env==='test'?(await db.query('select * from works where id=$1',[p.testWorkId])).rows[0]:r.workId?(await db.query('select * from works where id=$1',[r.workId])).rows[0]:(await db.query('select * from works where open_library_id=$1',[r.proposedWork.sourceWorkKey])).rows[0];
   const editions=(await db.query('select * from editions where work_id=$1',[work.id])).rows,chosen=selectStrictEdition(editions,'nl',work.title);assert.equal(chosen?.isbn_13,p.isbn13,'Chosen edition '+p.caseNumber);assert.equal(chosen?.open_library_edition_id,p.sourceEdition);
   assert.equal(selectStrictEdition([...editions,{id:-1,title:'Unknown language',language:null,isbn_13:'9789057596230',open_library_edition_id:null}],'nl',work.title)?.id,chosen.id);
   const en=selectStrictEdition(editions,'en',work.title);assert(!en||['eng','en'].includes(en.language));
   const descriptions=(await db.query('select * from catalog_work_descriptions where work_id=$1',[work.id])).rows,metadata=(await db.query('select * from catalog_edition_metadata where work_id=$1',[work.id])).rows;
   const book=withStrictEdition({workId:String(work.id),authorId:String(work.author_id),title:work.title},chosen,'nl'),shown=applyStoredPresentation([book],'nl',descriptions,metadata)[0];
   assert.equal(shown.storedDescription?.text,p.summary);assert.equal(shown.storedDescription?.sourceUrl,p.source);assert(shown.coverUrls[0].includes('/'+p.cover.id+'-L.jpg'));assert(shown.cardCoverUrl.includes('/'+p.cover.id+'-M.jpg'));assert.equal(shown.isbn13,p.isbn13);
  }
  await db.query("select set_config('lumiscore.catalog_release_receipt',$1,false)",[JSON.stringify(first)]);
  const newWork=first.rows.find(r=>r.relation==='works'&&!r.before_row).after_row.id;
  await db.query('insert into synthetic_cascade_dependency values($1)',[newWork]);await assert.rejects(db.exec(renderRollback(plan)),/Later dependency/);await db.exec('rollback');assert.equal((await db.query('select count(*)::int n from synthetic_cascade_dependency')).rows[0].n,1);await db.query('delete from synthetic_cascade_dependency where work_id=$1',[newWork]);
  const d=first.rows.find(r=>r.relation==='catalog_work_descriptions');await db.query("update catalog_work_descriptions set text=text||' Later reviewed independent addition.' where work_id=$1 and language='nl'",[d.after_row.work_id]);await assert.rejects(db.exec(renderRollback(plan)),/Later legitimate change/);await db.exec('rollback');await db.query("update catalog_work_descriptions set text=$1 where work_id=$2 and language='nl'",[d.after_row.text,d.after_row.work_id]);
  await db.exec(renderRollback(plan));await db.exec(renderRollback(plan));assert.deepEqual(await digest(db),before);
  assert.equal(receipt(await db.exec(renderImport(plan))).rows.length,plan.actions.length);
  console.log(JSON.stringify({env,actions:first.rows.length,localImportMs:Math.round(initialMs),exactPresentations:35,replayMutations:0,committedUndo:true,laterChangeRefused:true,cascadeRefused:true,hostedEvidence:false}));
  void resolve;
 }finally{await db.close();}
});
