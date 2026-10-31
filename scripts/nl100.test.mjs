import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{createHash}from'node:crypto';import{performance}from'node:perf_hooks';
import{PGlite}from'@electric-sql/pglite';
import{selectStrictEdition,withStrictEdition}from'../lib/books/strict-edition.ts';
import{applyStoredPresentation,storedPresentationSelection,safePublicSource,safePublicCoverUrl}from'../lib/books/stored-presentation.ts';
const root=new URL('../catalog/nl100-completion-20261031/',import.meta.url),json=n=>JSON.parse(fs.readFileSync(new URL(n,root))),sql=n=>fs.readFileSync(new URL(n,root),'utf8');
const before=json('production-before.json'),dossiers=json('dossiers.json').dossiers,approved=dossiers.filter(d=>d.status==='approved_local_proposal'),batches=json('batches.json').batches;
const checksum=x=>createHash('sha256').update(x).digest('hex');
async function fixture(){const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create sequence editions_seq start300000;
 create table authors(id bigint primary key,open_library_id text unique,name text,created_at timestamptz);
 create table works(id bigint primary key,open_library_id text unique,title text,subtitle text,author_id bigint references authors,first_publish_year int,cover_id bigint,subjects text[],created_at timestamptz,source_type text,work_type text,native_identity_key text unique);
 create table editions(id bigint primary key default nextval('editions_seq'),work_id bigint references works,open_library_edition_id text unique,isbn_10 text,isbn_13 text,language text,publisher text,created_at timestamptz default now(),title text);
 create table synthetic_ratings(work_id bigint references works,score integer);
 create table synthetic_progress(work_id bigint references works,status text);
 create table synthetic_edition_dependency(edition_id bigint references editions on delete cascade);`.replace('start300000','start 300000'));
 for(const table of['authors','works','editions'])await db.query(`insert into ${table} select * from jsonb_populate_recordset(null::${table},$1)`,[JSON.stringify(before[table])]);
 for(const name of['20261030063949_nl_pilot_reviewed_presentation.sql','20261030120602_catalog_integrity_presentation_guards.sql'])await db.exec(fs.readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 for(const[table,key]of[['catalog_work_descriptions','descriptions'],['catalog_edition_metadata','metadata']])await db.query(`insert into ${table} select * from jsonb_populate_recordset(null::${table},$1)`,[JSON.stringify(before[key])]);
 await db.exec("insert into synthetic_ratings values(135,9),(1011,8);insert into synthetic_progress values(135,'read'),(1011,'reading');");return db;}
const snapshot=async db=>Object.fromEntries(await Promise.all(['authors','works','editions','catalog_work_descriptions','catalog_edition_metadata','synthetic_ratings','synthetic_progress','synthetic_edition_dependency'].map(async table=>[table,(await db.query(`select t.* from ${table} t order by to_jsonb(t)::text`)).rows])));
const run=async(db,b,dry=false)=>(await db.exec(sql(b.directory+(dry?'production-dry-run.sql':'production-import.sql')))).find(r=>r.rows?.[0]?.receipt)?.rows[0].receipt;
const undo=async(db,b,receipt)=>{await db.query("select set_config('lumiscore.catalog_release_receipt',$1,false)",[JSON.stringify(receipt)]);await db.exec(sql(b.directory+'production-rollback.sql'));};
test('frozen100 substantive decisions, exact print evidence and original50–90word texts, no held records imported',()=>{
 assert.equal(dossiers.length,100);assert.equal(new Set(dossiers.map(d=>d.workId)).size,100);assert(dossiers.every(d=>d.researchCompleted&&d.sources.length>0&&d.noDutchEditionClaim===false));
 assert.equal(approved.length,80);assert.equal(dossiers.filter(d=>d.status==='approved_reused_proposal').length,4);assert.equal(dossiers.filter(d=>d.status==='identity_conflict').length,5);assert.equal(dossiers.filter(d=>d.status==='insufficient_evidence_after_research').length,11);
 for(const d of approved){assert(['paperback','hardcover'].includes(d.format));assert.equal(d.language,'nld');assert(d.summary.sourceReviewed);assert(safePublicSource(d.summary.sourceUrl));assert.equal(d.summary.wordCount,d.summary.text.trim().split(/\s+/u).length);assert(d.summary.wordCount>=50&&d.summary.wordCount<=90);assert(d.cover.identity.startsWith('manual_'));assert.equal(d.cover.isbn,d.isbn13);assert.equal(d.cover.sha256.length,64);assert(safePublicCoverUrl(d.cover.url));assert(d.sources.some(s=>s.url===d.summary.sourceUrl));assert.equal(d.summary.storedOnHosted,false);}
 const actions=batches.flatMap(b=>json(b.directory+'production-plan.json').actions);assert.equal(actions.length,240);assert(actions.every(a=>['editions','catalog_edition_metadata','catalog_work_descriptions'].includes(a.relation)));assert.equal(new Set(actions.map(a=>a.after.work_id)).size,80);
 const held=dossiers.filter(d=>!d.status.startsWith('approved')).map(d=>d.workId);assert(!actions.some(a=>held.includes(a.after.work_id)));assert.equal(actions.filter(a=>a.relation==='editions'&&!a.before).length,56);assert.equal(actions.filter(a=>a.relation==='editions'&&a.before).length,24);
});
test('previous eight proposals remain byte-for-byte unchanged and are not reimported; hashes and old-new overlap',()=>{
 const frozen=JSON.parse(fs.readFileSync(new URL('../nl100-hosted-20261031/reference-scopes.json',root)));
 for(const[name,hash]of Object.entries(frozen.retainedCanonicalLfHashes))assert.equal(checksum(fs.readFileSync(new URL('../nl-followup-002-20261031/'+name,root),'utf8').replaceAll('\r\n','\n')),hash,name);
 for(const b of batches){assert.equal(b.workIds.length,20);assert.equal(b.actions,60);for(const[name,hash]of Object.entries(b.hashes))assert.equal(checksum(fs.readFileSync(new URL(b.directory+name,root))),hash);}
 const old=[...JSON.parse(fs.readFileSync(new URL('../nl-followup-002-20261031/production-plan.json',root))).actions,...JSON.parse(fs.readFileSync(new URL('../nl-followup-002-20261031/next100-production-plan.json',root))).actions];assert.equal(old.length,22);assert(!old.some(a=>approved.some(d=>d.workId===a.after.work_id)));assert.equal(json('progress.json').combinedWithUnchangedPreviousEight.proposedExtraNlPrintedWorks,88);
});
test('frozen PR62/63, earlier expansion pilot and other approved packets have no Work/ISBN action overlap',()=>{
 const frozen=JSON.parse(fs.readFileSync(new URL('../nl100-hosted-20261031/reference-scopes.json',root)));
 const outcomes=[];for(const r of frozen.references){const ids=new Set(r.workIds),isbns=new Set(r.isbns);
 assert(!approved.some(d=>ids.has(d.workId)||isbns.has(d.isbn13)));outcomes.push({reference:r.source,sha256:r.sha256,workOverlap:0,isbnOverlap:0});}
 const ids=new Set(frozen.pilotWorkIds);assert(!approved.some(d=>ids.has(d.workId)));
 const boundaries=json('pr-boundaries.json');assert.equal(boundaries.prs.find(p=>p.number===63).head,'11795c7b03d04ea0fd267694fe1b36c6b9bc7b0d');assert.equal(boundaries.prs.find(p=>p.number===62).head,'33801703b33e4bee2fa80a50de5cb7229897f8ab');assert(boundaries.prs.every(p=>p.draft&&!p.merged));
 fs.writeFileSync(new URL('overlap-proof.json',root),JSON.stringify({references:outcomes,originalPilotWorkOverlap:0,oldEightWorkOverlap:0,globalIsbnForeignWorkCollisions:json('final-isbn-preflight.json').foreignWorkCollisions,pr63Unchanged:true,productionWrites:0,hostedTestWrites:0},null,2)+'\n');
});
test('all four60-action batches: COMMIT, replay0, committed receipt undo and repeated undo; preserve private stand-ins/full baseline',async()=>{
 const db=await fixture();try{const baseline=await snapshot(db),receipts=[],timings=[];
 for(const b of batches){const start=performance.now(),r=await run(db,b);assert.equal(r.rows.length,60);timings.push({batch:b.batch,localImportMs:performance.now()-start});receipts.push(r);assert.equal((await run(db,b)).rows.length,0);}
 const after=await snapshot(db);assert.equal(after.editions.length,before.editions.length+56);assert.equal(after.catalog_work_descriptions.length,before.descriptions.length+80);assert.equal(after.catalog_edition_metadata.length,80);assert.deepEqual(after.synthetic_ratings,baseline.synthetic_ratings);assert.deepEqual(after.synthetic_progress,baseline.synthetic_progress);assert.deepEqual(after.works,baseline.works);assert.deepEqual(after.authors,baseline.authors);
 for(let i=batches.length-1;i>=0;i--){await undo(db,batches[i],receipts[i]);await undo(db,batches[i],receipts[i]);}assert.deepEqual(await snapshot(db),baseline);
 fs.writeFileSync(new URL('local-import-proof.json',root),JSON.stringify({environment:'Local PGlite only: fresh public production bibliography + synthetic private stand-ins',batches:4,actions:240,newEditions:56,languageCorrections:24,newNlSummaries:80,newMetadata:80,commitReplay0AndCommittedReceiptUndo:true,repeatedUndoSafe:true,allBaselineRowsPreserved:true,sequenceNotReset:true,receiptManifestBound:true,receiptHashes:receipts.map(r=>checksum(JSON.stringify(r))),baselineHash:checksum(JSON.stringify(baseline)),afterCommittedUndoHash:checksum(JSON.stringify(await snapshot(db))),timings,productionWrites:0,hostedTestWrites:0,hostedRecoveryProven:false},null,2)+'\n');
 }finally{await db.close();}
});
test('transactional dry-run is separate from committed recovery; leaves all rows unchanged',async()=>{const db=await fixture();try{const original=await snapshot(db);for(const b of batches){assert.equal((await run(db,b,true)).rows.length,60);assert.deepEqual(await snapshot(db),original);}}finally{await db.close();}});
test('receipt cannot authorize other records, different contents, missing/duplicate sequences or broader generic renderer relations',async()=>{
 const db=await fixture();try{const b=batches[0],r=await run(db,b),expected=await snapshot(db);
 for(const mode of['relation','record','contents','before','sequence','project']){const changed=structuredClone(r);
 if(mode==='relation')changed.rows[0].relation='authors';if(mode==='record')changed.rows[0].key={id:999};if(mode==='contents')changed.rows[0].after_row.title='Not the reviewed title';if(mode==='before')changed.rows[0].before_row=null;if(mode==='sequence')changed.rows[0].seq=changed.rows[1].seq;if(mode==='project')changed.project='hlvujbrmfdlrfxdjwsmb';
 await assert.rejects(undo(db,b,changed),/manifest|reviewed/i);await db.exec('rollback');assert.deepEqual(await snapshot(db),expected);
 }await undo(db,b,r);
 }finally{await db.close();}
});
test('later legitimate description edit or CASCADE dependency aborts whole committed rollback without damage',async()=>{
 for(const mode of['later_edit','incoming_dependency']){const db=await fixture();try{const b=batches[0],r=await run(db,b),description=r.rows.find(r=>r.relation==='catalog_work_descriptions'),edition=r.rows.find(r=>r.relation==='editions'&&r.before_row===null);
 if(mode==='later_edit')await db.query("update catalog_work_descriptions set text=text||' Latere gecontroleerde verbetering.' where work_id=$1 and language='nl'",[description.after_row.work_id]);else await db.query('insert into synthetic_edition_dependency values($1)',[edition.after_row.id]);
 const expected=await snapshot(db);await assert.rejects(undo(db,b,r),mode==='later_edit'?/Later legitimate change/:/Later dependency/);await db.exec('rollback');assert.deepEqual(await snapshot(db),expected);
 }finally{await db.close();}}
});
test('global ISBN10 collision, changed edition corpus or changed Work-author aborts before any DML',async()=>{
 for(const mode of['isbn10','corpus','work']){const db=await fixture();try{const b=batches[0],d=approved.find(d=>b.workIds.includes(d.workId)&&!d.existingEditionId);
 if(mode==='isbn10')await db.query("insert into editions(work_id,title,language,isbn_10)values($1,'Synthetic collision','eng',$2)",[d.workId,d.isbn10Equivalent]);
 if(mode==='corpus')await db.query("update editions set publisher='Later verified publisher' where work_id=$1",[b.workIds[0]]);
 if(mode==='work')await db.query("update works set subtitle='Later legitimate subtitle' where id=$1",[b.workIds[0]]);
 const original=await snapshot(db);await assert.rejects(run(db,b),/collision|drift/i);await db.exec('rollback');assert.deepEqual(await snapshot(db),original);
 }finally{await db.close();}}
});
test('all80 actual shared selectors: exact Dutch title/ISBN/cover/summary, unchanged public scores, strict EN and language cache isolation',async()=>{
 const db=await fixture();try{for(const b of batches)await run(db,b);const editions=(await db.query('select * from editions')).rows,metadata=(await db.query('select * from catalog_edition_metadata')).rows,descriptions=(await db.query('select * from catalog_work_descriptions')).rows,rows=[];
 for(const d of approved){const oldEn=selectStrictEdition(before.editions.filter(e=>e.work_id===d.workId),'en',d.originalTitle),en=selectStrictEdition(editions.filter(e=>e.work_id===d.workId),'en',d.originalTitle),nl=selectStrictEdition(editions.filter(e=>e.work_id===d.workId),'nl',d.originalTitle);assert.equal(en?.id,oldEn?.id);assert.equal(nl?.isbn_13,d.isbn13);
 const base={workId:String(d.workId),authorId:String(d.authorId),title:d.originalTitle,lumiscore:8.25,ratingCountBand:'5–9'},books=[];
 for(const locale of['nl','en','nl']){const selected=locale==='nl'?nl:en;if(!selected){assert.equal(locale,'en');books.push(null);continue;}const book=applyStoredPresentation([withStrictEdition(base,selected,locale)],locale,descriptions,metadata)[0];assert.equal(book.lumiscore,8.25);assert.equal(book.ratingCountBand,'5–9');if(locale==='nl'){assert.equal(book.title,d.dutchTitle);assert.equal(book.isbn13,d.isbn13);assert.equal(book.storedDescription?.text,d.summary.text);assert.equal(book.coverUrls[0],d.cover.url);assert.equal(book.englishEditionFallback,false);assert.equal(book.editionFormat,d.format);}else{assert.equal(book.editionLanguage,'eng');assert.notEqual(book.storedDescription?.language,'nl');}books.push(book);}
 assert.deepEqual(books[0],books[2]);const key=storedPresentationSelection([books[0]],'nl').key;if(books[1])assert.notEqual(storedPresentationSelection([books[1]],'en').key,key);
 rows.push({workId:d.workId,isbn:d.isbn13,selectedNlEditionId:nl.id,dutchTitle:d.dutchTitle,enAvailability:Boolean(en),nlSummaryVisibleToSharedPresentation:true,coverBindingConsistent:true});
 }
 assert.equal(editions.find(e=>e.id===1013).language,null,'Existing ebook is not relabelled as print');assert.equal(editions.find(e=>e.id===1014).language,null);assert.equal(editions.find(e=>e.work_id===1410&&e.isbn_13==='9783462046601').language,'ger');
 fs.writeFileSync(new URL('local-presentation-proof.json',root),JSON.stringify({environment:'Local DB + unchanged real selector/presentation code, not hosted browser acceptance',rows,summaryLanguage:'nl',unchangedScores:true,strictNlEn:true,cacheIsolation:true,productionWrites:0,hostedTestWrites:0},null,2)+'\n');
 }finally{await db.close();}
});
test('unchanged actual SQL search finds original and Dutch titles on same Work; three16card pages are unique, stable, language-filtered before count',async()=>{
 const db=await fixture();try{for(const b of batches)await run(db,b);await db.exec(`create table catalog_work_title_aliases(work_id bigint,title text);create table catalog_selection_members(work_id bigint,selection_slug text);create table work_catalog_categories(work_id bigint,category_id text);create table catalog_categories(id text);
 create function get_work_rating_summaries(bigint[])returns table(work_id bigint,lumiscore numeric,rating_count bigint)language sql stable as $$select x,8.25::numeric,6::bigint from unnest($1)x$$;`);
 await db.exec(fs.readFileSync(new URL('../supabase/operations/catalog-integrity-release-20261031.sql',import.meta.url),'utf8'));
 const search=async q=>(await db.query("select catalog_search_selection_v2($1,'nl') data",[q])).rows[0].data.candidates,proof=[];
 for(const d of approved)for(const query of[d.originalTitle,d.dutchTitle]){const found=await search(query);assert(found.some(r=>r.workId===String(d.workId)),`${d.workId} ${query}`);const match=found.find(r=>r.workId===String(d.workId));assert.equal(match.title,d.dutchTitle);proof.push({query,workId:d.workId,title:match.title});}
 await db.query("insert into catalog_selection_members select id,'local-reviewed80' from works where id=any($1::bigint[])",[approved.map(d=>d.workId)]);
 const page=async n=>(await db.query("select catalog_browse_page_v3('nl','',array[]::text[],'local-reviewed80',array[]::text[],'highest',$1,16) data",[n])).rows[0].data;
 const seen=[];for(let n=1;n<=5;n++){const p=await page(n);assert.equal(p.total,80);assert.equal(p.workIds.length,16);seen.push(...p.workIds);assert.deepEqual(await page(n),p);}assert.equal(new Set(seen).size,80);assert.equal((await page(6)).page,5);assert.equal((await search('zzNoSuchBookSynthetic')).length,0);
 fs.writeFileSync(new URL('local-search-proof.json',root),JSON.stringify({environment:'Local PGlite actual published RPC, synthetic equal scores8.25/6ratings local only',queries:proof,fivePages:{size:16,total:80,unique:80,stableReplay:true},noSyntheticScoresOnHostedOrProduction:true,productionWrites:0,hostedTestWrites:0},null,2)+'\n');
 }finally{await db.close();}
});
test('known traps and incomplete source coverage do not silently become approvals',()=>{
 for(const id of[1016,1125,128,245,1331])assert.equal(dossiers.find(d=>d.workId===id).status,'identity_conflict');assert.equal(dossiers.find(d=>d.workId===1301).status,'insufficient_evidence_after_research');
 for(const[id,isbn]of[[1013,'9789403131252'],[1014,'9789403187716'],[1323,'9789022555026'],[1364,'9789021485850'],[1286,'9789400519381'],[249,'9789021447735']])assert.equal(approved.find(d=>d.workId===id).isbn13,isbn);
 const overrides=approved.filter(d=>d.languageDecision.startsWith('Independent'));assert.equal(overrides.length,6);assert(overrides.every(d=>d.sources.some(s=>s.role.includes('overriding'))));
 assert.equal(approved.find(d=>d.workId===1131).dutchTitle,'De Griezelbus 7');assert(dossiers.filter(d=>d.status==='insufficient_evidence_after_research').every(d=>d.sources.some(s=>s.sourceFile)&&d.nextAction));
 const p=json('progress.json');assert.equal(Object.values(p.remainingGlobalWork.classificationOverlayOnly).reduce((a,b)=>a+b,0),10223);assert.equal(p.frozen100.unvisited,0);assert.equal(p.newProposal.actuallyAddedOnTestOrProduction,0);
});
test('only actual published same-asset thumbnails accepted; rejected barcode/watermark/adaptation covers never enter imports',()=>{
 const proofs=json('cover-proof.json'),rejected=json('review-decisions.json').rejectedCovers;
 for(const d of approved){const c=proofs.find(c=>c.isbn===d.isbn13);assert(c.dimensions.width>=300&&c.dimensions.height>=300);if(d.cover.card){assert(c.card.samePublishedAssetKey);assert(c.card.approvedForCardBinding);assert.equal(c.card.status,200);assert(c.card.bytes<300000);}}
 assert.equal(proofs.filter(c=>c.card?.approvedForCardBinding).length,34);assert(!approved.some(d=>rejected[d.isbn13]));
});
