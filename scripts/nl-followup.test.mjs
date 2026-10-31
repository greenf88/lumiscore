import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import{createHash}from'node:crypto';
import{PGlite}from'@electric-sql/pglite';
import{selectStrictEdition,withStrictEdition}from'../lib/books/strict-edition.ts';
import{applyStoredPresentation,storedPresentationSelection}from'../lib/books/stored-presentation.ts';
const root=new URL('../catalog/nl-followup-002-20261031/',import.meta.url),json=n=>JSON.parse(fs.readFileSync(new URL(n,root))),sql=n=>fs.readFileSync(new URL(n,root),'utf8');
const plan=json('production-plan.json'),before=json('production-before.json'),dossiers=json('dossiers.json').dossiers;
async function fixture(beforeData=before){const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create sequence editions_seq start 300000;
 create table authors(id bigint primary key,open_library_id text unique,name text,created_at timestamptz);
 create table works(id bigint primary key,open_library_id text unique,title text,subtitle text,author_id bigint references authors,first_publish_year int,cover_id bigint,subjects text[],created_at timestamptz,source_type text,work_type text,native_identity_key text unique);
 create table editions(id bigint primary key default nextval('editions_seq'),work_id bigint references works,open_library_edition_id text unique,isbn_10 text,isbn_13 text,language text,publisher text,created_at timestamptz default now(),title text);
 create table synthetic_ratings(work_id bigint references works,score integer);
 create table synthetic_progress(work_id bigint references works,status text);
 create table synthetic_edition_dependency(edition_id bigint references editions on delete cascade);`);
 for(const t of['authors','works','editions'])await db.query(`insert into ${t} select * from jsonb_populate_recordset(null::${t},$1)`,[JSON.stringify(beforeData[t])]);
 for(const f of['20261030063949_nl_pilot_reviewed_presentation.sql','20261030120602_catalog_integrity_presentation_guards.sql'])await db.exec(fs.readFileSync(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
 for(const[t,k]of[['catalog_work_descriptions','descriptions'],['catalog_edition_metadata','metadata']])await db.query(`insert into ${t} select * from jsonb_populate_recordset(null::${t},$1)`,[JSON.stringify(beforeData[k]??[])]);
 await db.query('insert into synthetic_ratings values($1,9)',[beforeData.works[0].id]);await db.query("insert into synthetic_progress values($1,'read')",[beforeData.works[1].id]);return db;}
const snapshot=async db=>Object.fromEntries(await Promise.all(['authors','works','editions','catalog_work_descriptions','catalog_edition_metadata','synthetic_ratings','synthetic_progress'].map(async t=>[t,(await db.query(`select * from ${t} order by 1,2`)).rows])));
const run=async db=>(await db.exec(sql('production-import.sql'))).find(r=>r.rows?.[0]?.receipt)?.rows[0].receipt;
const undo=async(db,receipt)=>{await db.query("select set_config('lumiscore.catalog_release_receipt',$1,false)",[JSON.stringify(receipt)]);return db.exec(sql('production-rollback.sql'));};
test('separate10-action proposal: committed local import, safe replay and committed receipt rollback preserve all baseline rows',async()=>{const db=await fixture();try{const baseline=await snapshot(db),receipt=await run(db);assert.equal(receipt.rows.length,10);assert.equal((await run(db)).rows.length,0);await undo(db,receipt);await undo(db,receipt);assert.deepEqual(await snapshot(db),baseline);}finally{await db.close();}});
test('rollback refuses later reviewed edits and incoming dependencies, including CASCADE; no partial undo',async()=>{const db=await fixture();try{const receipt=await run(db),desc=receipt.rows.find(r=>r.relation==='catalog_work_descriptions');await db.query('update catalog_work_descriptions set text=text||$1 where work_id=$2 and language=$3',[' Latere gecontroleerde aanvulling.',desc.key.work_id,'nl']);const changed=await snapshot(db);await assert.rejects(undo(db,receipt),/Later legitimate change/);await db.exec('rollback');assert.deepEqual(await snapshot(db),changed);await db.query('update catalog_work_descriptions set text=$1 where work_id=$2 and language=$3',[desc.after_row.text,desc.key.work_id,'nl']);const id=receipt.rows.find(r=>r.relation==='editions').after_row.id;await db.query('insert into synthetic_edition_dependency values($1)',[id]);await assert.rejects(undo(db,receipt),/Later dependency/);await db.exec('rollback');assert.equal((await db.query('select count(*)::int n from editions')).rows[0].n,before.editions.length+4);assert.equal((await db.query('select * from synthetic_edition_dependency')).rows.length,1);}finally{await db.close();}});
test('ISBN10-only equivalent collision, corpus drift and retained-text drift stop before any import',async()=>{for(const mode of['isbn10','corpus','text']){const db=await fixture();try{if(mode==='isbn10')await db.exec("insert into editions(work_id,title,language,isbn_10)values(1,'Project Hail Mary','nld','9401614075')");if(mode==='corpus')await db.exec("update editions set publisher='Later bibliographic correction' where id=17");if(mode==='text')await db.exec("update catalog_work_descriptions set text=text||' Later reviewed addition.' where work_id=1 and language='nl'");const pre=await snapshot(db);await assert.rejects(run(db),/collision|drift/i);await db.exec('rollback');assert.deepEqual(await snapshot(db),pre);}finally{await db.close();}}});
test('four Works: same NL edition/title/cover/summary on all shared presentation consumers; EN retained, locale caches isolated',async()=>{const db=await fixture();try{await run(db);const editions=(await db.query('select * from editions')).rows,descriptions=(await db.query('select * from catalog_work_descriptions')).rows,metadata=(await db.query('select * from catalog_edition_metadata')).rows,keys=[];
 for(const d of dossiers.filter(x=>x.status==='approved_local_proposal')){
  const w=before.works.find(w=>w.id===d.workId),base={workId:String(w.id),authorId:String(w.author_id),title:w.title,author:d.author,lumiscore:8.2,ratingCountBand:'5–9'};
  const nl=selectStrictEdition(editions.filter(e=>e.work_id===w.id),'nl',w.title),en=selectStrictEdition(editions.filter(e=>e.work_id===w.id),'en',w.title);
  assert.equal(nl.isbn_13,d.isbn13);assert.equal(en.id,before.editions.find(e=>e.work_id===w.id).id);
  for(const locale of['nl','en','nl']){const selected=locale==='nl'?nl:en,book=applyStoredPresentation([withStrictEdition(base,selected,locale)],locale,descriptions,metadata)[0];assert.equal(book.lumiscore,8.2);assert.equal(book.ratingCountBand,'5–9');if(locale==='nl'){assert.equal(book.title,d.dutchTitle);assert.equal(book.storedDescription?.language,'nl');assert.equal(book.coverUrls[0],metadata.find(m=>m.edition_id===nl.id).cover_url);assert.equal(book.englishEditionFallback,false);}else{assert.equal(book.title,en.title);assert.equal(book.storedDescription?.language,'en');}keys.push([w.id,locale,storedPresentationSelection([book],locale).key]);}
  // Same actual selector/presentation function is used by list/detail/recommendations; no alternate Work identity.
  assert.equal(selectStrictEdition(editions.filter(e=>e.work_id===w.id&&e.language==null),'nl',w.title),null);
 }
 for(let i=0;i<keys.length;i+=3){assert.equal(keys[i][2],keys[i+2][2]);assert.notEqual(keys[i][2],keys[i+1][2]);}
 assert.equal((await db.query("select count(*)::int n from editions where language='nld'")).rows[0].n,4);
 assert.equal((await db.query('select count(*)::int n from works')).rows[0].n,before.works.length);
 fs.writeFileSync(new URL('local-proof.json',root),JSON.stringify({environment:'Local PGlite with fresh public production rows and clearly synthetic private stand-ins; NOT hosted proof',actions:10,approvedWorks:4,newEditions:4,newNlTexts:2,retainedNlTexts:2,commitReplayAndCommittedUndo:true,laterEditAndDependencyRefused:true,isbn10EquivalenceCollisionRefused:true,strictNlEnAndCacheIsolation:true,unchangedScoresAndProgress:true,actualProductionExpansion:0,hostedTestWrites:0,productionWrites:0},null,2)+'\n');
 }finally{await db.close();}});
test('every original NL text is50–90words and identity-held dossier excluded from executable plan',()=>{assert.equal(dossiers.length,5);for(const d of dossiers.filter(d=>d.summary.text)){const n=d.summary.text.trim().split(/\s+/u).length;assert(n>=50&&n<=90,`${d.workId}: ${n}`);assert(d.summary.sourceUrl.startsWith('https://'));}assert(!plan.actions.some(a=>[1993,8111].includes(a.after.work_id)));assert.equal(plan.summary.actualExtraDutchWorks,0);assert.equal(plan.actions.filter(a=>a.relation==='catalog_work_descriptions').length,2);});
test('actual published RPCs: original and translated queries find same Work; selection precedes count and three stable unique pages',async()=>{const db=await fixture();try{await run(db);await db.exec(`
 create table catalog_work_title_aliases(work_id bigint,title text);
 create table catalog_selection_members(work_id bigint,selection_slug text);
 create table work_catalog_categories(work_id bigint,category_id text);
 create table catalog_categories(id text);
 create function get_work_rating_summaries(bigint[])returns table(work_id bigint,lumiscore numeric,rating_count bigint)language sql stable as $$select x,null::numeric,null::bigint from unnest($1)x$$;`);
 await db.exec(fs.readFileSync(new URL('../supabase/operations/catalog-integrity-release-20261031.sql',import.meta.url),'utf8'));
 const search=async(q,locale)=>(await db.query('select catalog_search_selection_v2($1,$2) data',[q,locale])).rows[0].data.candidates;
 const queryProof=[];
 for(const d of dossiers.filter(x=>x.status==='approved_local_proposal'))for(const q of[d.originalTitle,d.dutchTitle])for(const locale of['nl','en']){
  const rows=await search(q,locale);assert.equal(rows.length,1);assert.equal(rows[0].workId,String(d.workId));assert.equal(rows[0].title,locale==='nl'?d.dutchTitle:before.editions.find(e=>e.work_id===d.workId).title);queryProof.push({query:q,locale,workId:d.workId,selectedTitle:rows[0].title});
 }
 assert.equal((await search('No such invented test book','nl')).length,0);
 await db.exec(`insert into works(id,title,author_id) select 1000000+i,'Clearly synthetic paging '||lpad(i::text,3,'0'),1 from generate_series(1,48)i;
 insert into editions(work_id,title,language)select id,title,case when id%2=0 then 'nld' else null end from works where id>1000000;
 insert into editions(work_id,title,language)select id,title||' Dutch','nld' from works where id>1000000 and id%2=1;
 insert into catalog_selection_members select id,'synthetic-test-only' from works where id>1000000;`);
 const page=async n=>(await db.query("select catalog_browse_page_v3('nl','',array[]::text[],'synthetic-test-only',array[]::text[],'highest',$1,16) data",[n])).rows[0].data;
 const pages=[];for(let n=1;n<=3;n++){const p=await page(n);assert.equal(p.total,48);assert.equal(p.workIds.length,16);pages.push(...p.workIds);assert.deepEqual(await page(n),p);}
 assert.equal(new Set(pages).size,48);assert.equal((await page(4)).page,3);
 fs.writeFileSync(new URL('local-search-proof.json',root),JSON.stringify({environment:'Local PGlite, existing production SQL unchanged; synthetic paging records local only',queries:queryProof,threePages:{pageSize:16,total:48,unique:48,stableReplay:true},productionWrites:0,hostedTestWrites:0},null,2)+'\n');
 }finally{await db.close();}});
test('next100 additional four: NULL→nld only,12actions, same edition IDs, own summaries/covers, safe replay and committed rollback',async()=>{
 const nextBefore=json('next100-production-before.json'),nextPlan=json('next100-production-plan.json'),nextDossiers=json('next100-reviewed.json').dossiers.filter(d=>d.status==='approved_local_proposal');
 const db=await fixture(nextBefore);try{const original=await snapshot(db),receipt=(await db.exec(sql('next100-production-import.sql'))).find(r=>r.rows?.[0]?.receipt)?.rows[0].receipt;
 assert.equal(receipt.rows.length,12);assert.equal((await db.exec(sql('next100-production-import.sql'))).find(r=>r.rows?.[0]?.receipt)?.rows[0].receipt.rows.length,0);
 const editions=(await db.query('select * from editions')).rows,metadata=(await db.query('select * from catalog_edition_metadata')).rows,descriptions=(await db.query('select * from catalog_work_descriptions')).rows;
 for(const d of nextDossiers){const old=original.editions.find(e=>e.id===d.existingEditionId),now=editions.find(e=>e.id===old.id);assert.deepEqual(now,{...old,language:'nld'});const e=selectStrictEdition(editions.filter(e=>e.work_id===d.workId),'nl',d.originalTitle);assert.equal(e.id,old.id);assert.equal(selectStrictEdition(editions.filter(e=>e.work_id===d.workId),'en',d.originalTitle),null,'No invented English fallback');const book=applyStoredPresentation([withStrictEdition({workId:String(d.workId),authorId:String(d.authorId),title:d.originalTitle},e,'nl')],'nl',descriptions,metadata)[0];assert.equal(book.storedDescription.text,d.summary.text);assert(book.coverUrls[0].startsWith('https://metadata.isbn.nl/ie_fcache/'));assert.equal(book.editionFormat,d.format);const words=d.summary.text.trim().split(/\s+/u).length;assert(words>=50&&words<=90);}
 assert.equal(editions.find(e=>e.id===1016).language,null,'Graphic adaptation remains excluded');assert.equal(nextPlan.summary.newEditions,0);assert.equal(nextPlan.summary.languageCorrections,4);
 await db.query("select set_config('lumiscore.catalog_release_receipt',$1,false)",[JSON.stringify(receipt)]);await db.exec(sql('next100-production-rollback.sql'));await db.exec(sql('next100-production-rollback.sql'));assert.deepEqual(await snapshot(db),original);
 fs.writeFileSync(new URL('next100-local-proof.json',root),JSON.stringify({environment:'Local PGlite only, actual fresh public rows plus synthetic private stand-ins',approvedWorks:4,editionLanguageCorrections:4,newEditions:0,newNlTexts:4,newCoverBindings:4,actions:12,sameEditionIds:true,noEnglishFabrication:true,adaptationExcluded:true,commitReplayAndCommittedUndo:true,allOriginalDataPreserved:true,actualProductionExpansion:0,productionWrites:0,hostedTestWrites:0},null,2)+'\n');
 }finally{await db.close();}
});
test('research accounting:100 unique selected is not100 completed, blocked records never enter executable imports',()=>{
 const queue=fs.readFileSync(new URL('next100-register.jsonl',root),'utf8').trim().split(/\r?\n/u).map(JSON.parse),progress=json('research-progress.json');assert.equal(queue.length,100);assert.equal(new Set(queue.map(q=>q.workId)).size,100);assert.equal(queue.filter(q=>q.researchStatus==='selected_not_substantively_completed').length,95);assert(queue.every(q=>q.noDutchEditionClaim===false&&q.inspected.sources.length>0));
 assert.equal(Object.values(progress.perAspectGlobalDistribution).reduce((a,b)=>a+b,0),10223);assert.equal(progress.currentRequest.dossiersInvestigated,10);assert.equal(progress.currentRequest.approvedLocal,8);assert.equal(progress.currentRequest.blockedIdentity,2);assert.equal(progress.proposedSeparatePackages.distinctExtraNlWorks,8);assert.equal(progress.actualProduction.writesThisRequest,0);
 const actions=[...plan.actions,...json('next100-production-plan.json').actions];assert.equal(actions.length,22);assert(!actions.some(a=>[1993,8111,1016].includes(a.after.work_id)));assert(actions.every(a=>['editions','catalog_edition_metadata','catalog_work_descriptions'].includes(a.relation)));
 for(const p of['import-hashes.json','next100-import-hashes.json'])for(const[name,hash]of Object.entries(json(p))){const actual=createHash('sha256').update(fs.readFileSync(new URL(name,root))).digest('hex');assert.equal(actual,hash);}
});
