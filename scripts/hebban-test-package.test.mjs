import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';import {renderImport,renderRollback} from './catalog-release-sql.mjs';
import {selectStrictEdition} from '../lib/books/strict-edition.ts';import{applyStoredPresentation}from'../lib/books/stored-presentation.ts';import{withStrictEdition}from'../lib/books/strict-edition.ts';
const root=new URL('../catalog/hebban-priority-20261031/',import.meta.url),read=n=>JSON.parse(fs.readFileSync(new URL(n,root)));
test('Hebban: exact test fixtures, 17 corrections, replay, complete NL12, locale isolation and committed recovery',async()=>{
 const db=new PGlite(),baseline=JSON.parse(fs.readFileSync(new URL('../catalog/nl-availability-20261031/test-before-public.json',import.meta.url)));
 try{await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create sequence editions_seq start 600000;
 create table authors(id bigint primary key,name text,open_library_id text unique);
 create table works(id bigint primary key,open_library_id text unique,title text,author_id bigint references authors,first_publish_year int,cover_id bigint,source_type text,work_type text,native_identity_key text unique);
 create table editions(id bigint primary key default nextval('editions_seq'),work_id bigint references works,open_library_edition_id text unique,isbn_10 text,isbn_13 text,language text,publisher text,publish_date text,cover_id bigint,title text);
 create table synthetic_ratings(work_id bigint references works,score int);create table synthetic_progress(work_id bigint references works,status text);`);
 for(const name of ['authors','works','editions'])await db.query(`insert into ${name} select * from jsonb_populate_recordset(null::${name},$1::jsonb)`,[JSON.stringify(baseline[name])]);
 for(const f of ['20261030063949_nl_pilot_reviewed_presentation.sql','20261030120602_catalog_integrity_presentation_guards.sql'])await db.exec(fs.readFileSync(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
 for(const [table,name]of[['catalog_edition_metadata','metadata'],['catalog_work_descriptions','descriptions']])await db.query(`insert into ${table} select * from jsonb_populate_recordset(null::${table},$1::jsonb)`,[JSON.stringify(baseline[name])]);
 await db.exec("insert into synthetic_ratings values(921100114,8);insert into synthetic_progress values(921100114,'read');");
 const tables=['authors','works','editions','catalog_work_descriptions','catalog_edition_metadata','synthetic_ratings','synthetic_progress'];
 const snapshot=async()=>Object.fromEntries(await Promise.all(tables.map(async name=>[name,(await db.query(`select to_jsonb(t) v from ${name} t order by to_jsonb(t)::text`)).rows])));
 const before=await snapshot(),fixtures=read('test-fixture-plan.json'),plan=read('test-plan.json');
 const execPlan=async p=>(await db.exec(renderImport(p))).find(r=>r.rows?.[0]?.receipt)?.rows[0].receipt;
 const fixtureReceipt=await execPlan(fixtures);assert.equal(fixtureReceipt.rows.length,18);assert.equal((await execPlan(fixtures)).rows.length,0);
 const receipt=await execPlan(plan);assert.equal(receipt.rows.length,17);assert.equal((await execPlan(plan)).rows.length,0);
 const mapping=read('test-mapping.json').workMap,review=read('reviewed-changes.json');
 const metadata=(await db.query('select * from catalog_edition_metadata')).rows,descs=(await db.query('select * from catalog_work_descriptions')).rows;
 const selections=[];for(const p of review.priorities){const id=mapping[p.workId],w=(await db.query('select * from works where id=$1',[id])).rows[0],eds=(await db.query('select * from editions where work_id=$1',[id])).rows;
  const edition=selectStrictEdition(eds,'nl',w.title);assert.equal(edition?.isbn_13,p.isbn);
  const b=applyStoredPresentation([withStrictEdition({id:String(id),workId:String(id),authorId:String(w.author_id),title:w.title,author:'',cover:'orbit',score:null,ratingsCount:null,match:null},edition,'nl')],'nl',descs,metadata)[0];
  assert.ok(b.storedDescription);assert.ok(b.storedDescription.sourceUrl);selections.push({workId:p.workId,testWorkId:id,editionId:edition.id,isbn:edition.isbn_13,descriptionWords:b.storedDescription.text.split(/\s+/).length});
  const en=selectStrictEdition(eds,'en',w.title);if(en)assert.notEqual(en.id,edition.id);}
 const undo=async(p,r)=>{await db.query("select set_config('lumiscore.catalog_release_receipt',$1,false)",[JSON.stringify(r)]);await db.exec(renderRollback(p));};
 const d=receipt.rows.find(r=>r.relation==='catalog_work_descriptions');await db.query("update catalog_work_descriptions set text=text||' Later legitimate correction.' where work_id=$1 and language=$2",[d.key.work_id,d.key.language]);
 await assert.rejects(undo(plan,receipt),/Later legitimate change/);await db.exec('rollback');await db.query('update catalog_work_descriptions set text=$1 where work_id=$2 and language=$3',[d.after_row.text,d.key.work_id,d.key.language]);
 await undo(plan,receipt);await undo(plan,receipt);
 const newWork=fixtureReceipt.rows.find(r=>r.relation==='works').after_row.id;await db.query('insert into synthetic_ratings values($1,7)',[newWork]);await assert.rejects(undo(fixtures,fixtureReceipt),/Later dependency/);await db.exec('rollback');await db.query('delete from synthetic_ratings where work_id=$1',[newWork]);
 await undo(fixtures,fixtureReceipt);assert.deepEqual(await snapshot(),before);
 fs.writeFileSync(new URL('local-test-proof.json',root),JSON.stringify({environment:'local PGlite with exact public TEST snapshot and synthetic private stand-ins',fixtures:18,corrections:17,replayChanges:0,NLSelections:selections,committedReceiptUndo:true,laterChangeRefused:true,laterDependencyRefused:true,allPreexistingRowsRestored:true,noHostedRecoveryClaim:true},null,2)+'\n');
 }finally{await db.close();}
});
