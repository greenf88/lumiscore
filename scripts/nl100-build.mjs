// Offline completion of the frozen100; no network, DB client or hosted mutation.
import fs from'node:fs';import{createHash}from'node:crypto';import path from'node:path';import{pathToFileURL}from'node:url';
import{renderImport,renderRollback}from'./catalog-release-sql.mjs';
const root=new URL('../catalog/nl100-completion-20261031/',import.meta.url),oldRoot=new URL('../catalog/nl-followup-002-20261031/',import.meta.url);
const read=n=>JSON.parse(fs.readFileSync(new URL(n,root))),write=(n,v)=>fs.writeFileSync(new URL(n,root),typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');
const frozen=read('frozen100.json'),before=read('production-before.json'),decisions=read('review-decisions.json'),covers=read('cover-proof.json');
const detailSelections=read('detail-cover-selections.json').approved;
const originalTexts={...read('original-summaries.json'),...read('extra-original-summaries.json')};
const sourceFiles=fs.readdirSync(new URL('sources/',root)).filter(n=>n.endsWith('.json')).map(n=>({file:'sources/'+n,...read('sources/'+n)}));
const prior=JSON.parse(fs.readFileSync(new URL('next100-reviewed.json',oldRoot))).dossiers;
const checksum=v=>createHash('sha256').update(v).digest('hex');
export const isbn10=isbn=>{if(!/^978\d{10}$/.test(isbn))throw Error('ISBN conversion');const s=isbn.slice(3,12),c=(11-[...s].reduce((n,d,i)=>n+Number(d)*(10-i),0)%11)%11;return s+(c===10?'X':c);};
const isbns=read('global-isbn-readback.json'),replacement=read('additional-source-proof.json').replacementPrintGlobalIsbnPreflight;
const selections=read('draft-edition-selections.json').map(d=>({...d,format:d.format==='Hardback'?'hardcover':d.format==='Paperback'?'paperback':null}));
for(const[id,p]of Object.entries(decisions.exactRetainedSelections)){const r=frozen.rows.find(r=>r.workId===Number(id));selections.push({workId:r.workId,originalTitle:r.title,authorId:r.authorId,author:r.author,isbn:p.isbn,source:'retained_exact_OL_snapshot',sourceUrl:r.inspected.sources[0].url,sourceTitle:p.dutchTitle,format:p.format});}
if(selections.length!==80||new Set(selections.map(s=>s.workId)).size!==80)throw Error('Exact80new decisions required');
const final=[];
for(const r of frozen.rows){
 const reused=prior.find(d=>d.workId===r.workId);if(reused){final.push({...reused,status:reused.status==='approved_local_proposal'?'approved_reused_proposal':'identity_conflict',researchCompleted:true,decisionDate:'2026-10-31',reusedFrom:'../nl-followup-002-20261031/next100-reviewed.json',reusedProposalNotImportedAgain:true,noDutchEditionClaim:false,originalPriority:r.priority});continue;}
 const selected=selections.find(s=>s.workId===r.workId),localSources=sourceFiles.filter(s=>s.workId===r.workId);
 const inspected=localSources.map(s=>({url:s.url,checkedAt:s.checkedAt,sourceFile:s.file,status:s.status,sha256:s.sha256,role:s.name?.includes('search')?'Explicit title/author or ISBN discovery, not language/content evidence':'Exact bibliography and/or narrative reviewed; conflicting blocks retained but not blindly trusted'}));
 if(!selected){const held=decisions.held[r.workId];if(!held)throw Error('Unvisited dossier '+r.workId);final.push({workId:r.workId,authorId:r.authorId,author:r.author,originalTitle:r.title,status:held.status,researchCompleted:true,decisionDate:'2026-10-31',reason:held.reason,nextAction:held.next,originalPriority:r.priority,noDutchEditionClaim:false,sources:[...inspected,...(held.sources??[]).map(url=>({url,checkedAt:'2026-10-31',role:'Independently inspected corroborating identity/format evidence'})),...r.inspected.sources.filter(s=>s.url).map(s=>({url:s.url,checkedAt:s.snapshot,role:'Retained exact original-edition identity; not proof of a Dutch translation'}))],proposedActions:[],storedNewText:false});continue;}
 const exact=decisions.exactRetainedSelections[r.workId],work=before.works.find(w=>w.id===r.workId),author=before.authors.find(a=>a.id===r.authorId),originalCover=covers.find(c=>c.isbn===selected.isbn),detail=detailSelections.find(c=>c.workId===r.workId&&c.isbn===selected.isbn),cover=detail?{...originalCover,...detail,card:originalCover.card}:originalCover;
 if(work?.author_id!==author?.id||!['paperback','hardcover'].includes(selected.format)||cover?.status!==200||!cover.identity.startsWith('manual_'))throw Error('Unreviewed identity/format/cover '+r.workId);
 let title=decisions.titleOverrides[r.workId]??(selected.sourceTitle.includes(' | ')?selected.sourceTitle.split(' | ')[0]:selected.sourceTitle);
 if(exact)title=exact.dutchTitle;
 const old=before.editions.find(e=>e.work_id===r.workId&&e.isbn_13===selected.isbn);
 if(old&&old.language!==null)throw Error('Unexpected existing edition language '+r.workId);
 const exactSource=selected.source==='retained_exact_OL_snapshot'?null:sourceFiles.find(s=>s.name===selected.source);
 const content=sourceFiles.find(s=>s.file==='sources/content-review-'+r.workId+'.json');
 if(!exact&&!content?.authors)throw Error('Missing narrative/author review '+r.workId);
 const narrativeUrl=exact?.narrative??decisions.additionalNarrativeSources[r.workId]?.[0]??selected.sourceUrl;
 const references=[{url:narrativeUrl,checkedAt:'2026-10-31',role:'Reviewed content for original Dutch summary; not a copied publisher blurb'},
  {url:selected.sourceUrl,checkedAt:exactSource?.checkedAt??'2026-10-31',sha256:exactSource?.sha256,role:'Exact ISBN/title/format/publisher/cover binding; language requires exact-edition evidence'}];
 for(const url of [...(exact?[exact.corroboration,exact.formatEvidence].filter(Boolean):[]),...(decisions.independentLanguageEvidence[r.workId]??[]),...(decisions.additionalNarrativeSources[r.workId]??[])])if(!references.some(s=>s.url===url))references.push({url,checkedAt:'2026-10-31',role:decisions.independentLanguageEvidence[r.workId]?.includes(url)?'Independent explicit exact-ISBN Dutch-language/translation evidence overriding conflicting Bureau label':'Independent author, format, narrative or edition-identity corroboration'});
 const text=originalTexts[r.workId],words=text?.trim().split(/\s+/u).length;if(!text||words<50||words>90)throw Error('Missing usable original summary '+r.workId);
 const isbnEvidence=isbns.candidates.some(e=>e.isbn13===selected.isbn)||replacement.candidates.some(e=>e.isbn13===selected.isbn);if(!isbnEvidence)throw Error('Unpreflighted ISBN '+selected.isbn);
 const publisher=old?.publisher??selected.sourceFacts?.match(/ uitgever (.*?) taal /)?.[1];if(!publisher)throw Error('Missing publisher '+r.workId);
 const date=selected.sourceFacts?.match(/verschijningsdatum (\d{2})\/(\d{2})\/(\d{4})/);
 final.push({workId:r.workId,authorId:r.authorId,author:r.author,originalTitle:r.title,dutchTitle:title,isbn13:selected.isbn,isbn10Equivalent:isbn10(selected.isbn),existingEditionId:old?.id??null,language:'nld',summaryLanguage:'nl',format:selected.format,publisher,publicationDateEvidence:date?[date[3],date[2],date[1]].join('-'):null,editionDateNotWritten:true,status:'approved_local_proposal',researchCompleted:true,decisionDate:'2026-10-31',originalPriority:r.priority,identity:{existingWork:work.open_library_id,sourceAuthor:content?.authors??r.author,decision:exact?.finding??'Existing original Work/author retained; Dutch narrative, exact edition and author reviewed together. A translation is not a new Work.',note:decisions.notes[r.workId]??'No conflicting identity or format evidence found in reviewed exact-edition and content sources.'},sources:references,inspectedSourceFiles:inspected,sourceFacts:selected.sourceFacts??r.inspected.sources,languageDecision:selected.independentLanguageOverride?'Independent exact-edition publisher/author/library evidence overrides erroneous Bureau Engels value':'Explicit exact-edition Dutch metadata, not inferred from cover/title/author',cover:{isbn:selected.isbn,url:cover.url,sha256:cover.sha256,bytes:cover.bytes,dimensions:cover.dimensions,identity:cover.identity,card:cover.card?.approvedForCardBinding?cover.card:null},summary:{decision:'new_original_nl',text,wordCount:words,language:'nl',sourceUrl:narrativeUrl,sourceReviewed:true,storedOnHosted:false},netExtraNlWorksProposed:1,newWork:false,noDutchEditionClaim:false,storedNewText:false,search:'Original Work title and the Dutch selected edition title identify the same existing Work through unchanged search RPC; no new Work/title alias required.'});
}
if(final.length!==100||final.some(d=>!d.researchCompleted)||final.filter(d=>d.status==='approved_local_proposal').length!==80)throw Error('Frozen100 not completed');
for(const d of final.filter(d=>d.status==='approved_local_proposal')){
 const original=covers.find(c=>c.isbn===d.isbn13),detail=detailSelections.find(c=>c.workId===d.workId&&c.isbn===d.isbn13),chosen=detail??original;
 Object.assign(d.cover,{status:chosen.status,checkedAt:chosen.checkedAt,visualFinding:chosen.visualFinding});
 if(detail)d.cover.detailVariant={sourceUrl:detail.sourceUrl,sourceSha256:detail.sourceSha256,approvedForDetail:true,samePublishedAssetKey:true,original:detail.original};
}
write('dossiers.json',{scope:'Frozen next100; all100 individually adjudicated, not all repaired or installed',dossiers:final});
write('repair-register.jsonl',final.map(d=>JSON.stringify(d)).join('\n')+'\n');
const approved=final.filter(d=>d.status==='approved_local_proposal').sort((a,b)=>a.originalPriority-b.originalPriority||a.workId-b.workId);
const eq=approved.map(d=>({work_id:d.workId,isbn13:d.isbn13,isbn10:d.isbn10Equivalent}));
write('final-isbn-preflight.json',{project:before.project,baseline:isbns.checkedAt,replacementsCheckedAt:replacement.checkedAt,candidates:eq,matches:isbns.matches.filter(m=>eq.some(e=>e.isbn13===m.candidate_isbn)),replacementMatches:replacement.matches,foreignWorkCollisions:isbns.foreignWorkCollisions,scope:'Read-only actual production, not test fixtures. Recheck immediately before any future installation.'});
const literal=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
const index=[];
for(let offset=0;offset<approved.length;offset+=20){
 const part=approved.slice(offset,offset+20),batch='nl-followup-'+String(4+offset/20).padStart(3,'0')+'-20261031',dir='batch'+String(4+offset/20).padStart(3,'0')+'/';fs.mkdirSync(new URL(dir,root),{recursive:true});
 const plan={summary:{batch,target:'qvplwejffhjvxaypmjut',state:'review_only_not_executed',baselineAt:before.at,approvedDossiers:part.length,newWorks:0,newAuthors:0,newEditions:part.filter(d=>!d.existingEditionId).length,languageCorrections:part.filter(d=>d.existingEditionId).length,newMetadata:part.length,newNlSummaries:part.length,newEnSummaries:0,proposedExtraDutchWorks:part.length,proposedExtraDutchPrintedWorks:part.length,actualExtraDutchWorks:0,productionWrites:0,hostedTestWrites:0},bindings:[],authorCorpora:[],actions:[]};
 for(const d of part){const work=before.works.find(w=>w.id===d.workId),author=before.authors.find(a=>a.id===d.authorId),old=before.editions.find(e=>e.id===d.existingEditionId),cover=d.cover;plan.bindings.push({work,author});
  if(before.descriptions.some(s=>s.work_id===d.workId&&s.language==='nl')||before.metadata.some(s=>s.work_id===d.workId))throw Error('Unexpected existing presentation');
  const next=old?{...old,title:d.dutchTitle,language:'nld'}:{work_id:d.workId,title:d.dutchTitle,isbn_13:d.isbn13,isbn_10:d.isbn10Equivalent,language:'nld',publisher:d.publisher,open_library_edition_id:null};
  const evidence=d.sources.map(s=>({url:s.url,checkedAt:s.checkedAt,fact:s.role,...(s.sha256?{sha256:s.sha256}:{})}));
  evidence.push({url:cover.url,checkedAt:cover.checkedAt,http:cover.status,sha256:cover.sha256,bytes:cover.bytes,fact:cover.visualFinding});if(d.identity.note)evidence.push({reviewNote:d.identity.note});if(evidence.length>12)throw Error('Evidence bound');
  const common={review_status:'approved',reviewed_at:decisions.reviewedAt,review_batch:batch,evidence},editionId=old?old.id:'@edition:'+d.isbn13;
  plan.actions.push({relation:'editions',ref:'edition:'+d.isbn13,key:old?{id:old.id}:{isbn_13:d.isbn13},before:old??null,after:next});
  plan.actions.push({relation:'catalog_edition_metadata',ref:'metadata:'+d.isbn13,key:{edition_id:editionId},before:null,after:{...common,edition_id:editionId,work_id:d.workId,bound_author_id:d.authorId,bound_title:d.dutchTitle,bound_language:'nld',bound_isbn13:d.isbn13,format:d.format,cover_url:cover.url,card_cover_url:cover.card?.approvedForCardBinding?cover.card.url:null,evidence_url:d.sources.find(s=>s.url.startsWith('https://')&&s.url!==d.summary.sourceUrl)?.url??d.summary.sourceUrl}});
  plan.actions.push({relation:'catalog_work_descriptions',ref:'description:'+d.workId+':nl',key:{work_id:d.workId,language:'nl'},before:null,after:{...common,work_id:d.workId,language:'nl',bound_author_id:d.authorId,text:d.summary.text,source_type:d.summary.sourceUrl.includes('isbn.nl')||d.summary.sourceUrl.includes('bibliotheek')||d.summary.sourceUrl.includes('rozet')||d.summary.sourceUrl.includes('literatuurgeschiedenis')||d.summary.sourceUrl.includes('dbnl')?'official_catalog':'official_publisher',source_name:d.summary.sourceUrl.includes('isbn.nl')?'Bureau ISBN':d.summary.sourceUrl.includes('bibliotheek')?'Bibliotheek.nl':d.summary.sourceUrl.includes('books.google')?'Publisher-supplied Google Books':new URL(d.summary.sourceUrl).hostname,source_url:d.summary.sourceUrl,provenance:'original_source_reviewed_summary'}});
 }
 const corpus=before.editions.filter(e=>part.some(d=>d.workId===e.work_id)).sort((a,b)=>a.id-b.id),afterCorpus=corpus.map(e=>{const a=plan.actions.find(a=>a.relation==='editions'&&a.before?.id===e.id);return a?.after??e;});
 const newIsbns=part.filter(d=>!d.existingEditionId).map(d=>d.isbn13),partEq=eq.filter(e=>part.some(d=>d.workId===e.work_id));
 const preflight=`do $preflight$ declare x jsonb;a jsonb;begin
 for x in select value from jsonb_array_elements(${literal(partEq)}) loop
  if exists(select 1 from public.editions e where (regexp_replace(coalesce(e.isbn_13,''),'[-[:space:]]','','g')=x->>'isbn13' or upper(regexp_replace(coalesce(e.isbn_10,''),'[-[:space:]]','','g'))=x->>'isbn10') and not(e.work_id=(x->>'work_id')::bigint and e.isbn_13=x->>'isbn13')) then raise exception 'ISBN13/10 equivalent collision; stop for identity review';end if;
 end loop;
 select coalesce(jsonb_agg(to_jsonb(e) order by id),'[]') into a from public.editions e where work_id=any(array[${part.map(d=>d.workId)}]) ${newIsbns.length?"and not(coalesce(e.isbn_13,'')=any(array["+newIsbns.map(i=>"'"+i+"'").join(',')+"]))":''};
 if a is distinct from ${literal(corpus)} and a is distinct from ${literal(afterCorpus)} then raise exception 'Existing edition corpus drift; repeat read-only identity review';end if;
end;$preflight$;\n`;
 const wrap=s=>s.replace('create temporary table catalog_release_receipt',preflight+'create temporary table catalog_release_receipt');
 // This new packet narrows the generic renderer to its exact own actions. A
 // matching batch label alone must never authorize another record/relation.
 const receiptGuard=`do $manifest_guard$ declare reviewed jsonb:=${literal(plan.actions)};receipt jsonb;r jsonb;p jsonb;k jsonb;expected jsonb;prior jsonb;ids jsonb:='{}';kv record;i integer:=0;n integer;begin
 receipt:=nullif(current_setting('lumiscore.catalog_release_receipt',true),'')::jsonb;
 if receipt->>'project' is distinct from '${plan.summary.target}' or receipt->>'batch' is distinct from '${batch}' or jsonb_typeof(receipt->'rows') is distinct from 'array' or jsonb_array_length(receipt->'rows')<>${plan.actions.length} then raise exception 'Exact manifest receipt required';end if;
 for p in select value from jsonb_array_elements(reviewed) loop
  i:=i+1;select count(*) into n from jsonb_array_elements(receipt->'rows')x where x->>'seq'=i::text;
  if n<>1 then raise exception 'Receipt manifest sequence mismatch';end if;
  select x into r from jsonb_array_elements(receipt->'rows')x where x->>'seq'=i::text;
  if r->>'relation' is distinct from p->>'relation' then raise exception 'Receipt manifest relation mismatch';end if;
  k:=p->'key';expected:=p->'after';prior:=p->'before';
  for kv in select * from jsonb_each(expected) loop
   if jsonb_typeof(kv.value)='string' and left(kv.value#>>'{}',1)='@' then
    if not ids ? substring(kv.value#>>'{}',2) then raise exception 'Receipt manifest missing parent';end if;
    expected:=jsonb_set(expected,array[kv.key],ids->substring(kv.value#>>'{}',2));end if;
  end loop;
  for kv in select * from jsonb_each(k) loop
   if jsonb_typeof(kv.value)='string' and left(kv.value#>>'{}',1)='@' then k:=jsonb_set(k,array[kv.key],ids->substring(kv.value#>>'{}',2));end if;
  end loop;
  if prior<>'null'::jsonb then execute format('select to_jsonb(jsonb_populate_record(null::public.%I,$1))',p->>'relation') into prior using prior;end if;
  execute format('select coalesce(jsonb_object_agg(x.key,x.value),''{}''::jsonb) from jsonb_each(to_jsonb(jsonb_populate_record(null::public.%I,$1))) x where $1 ? x.key',p->>'relation') into expected using expected;
  if r->'key' is distinct from k or r->'before_row' is distinct from prior or jsonb_typeof(r->'after_row') is distinct from 'object' or not coalesce((r->'after_row')@>expected,false) then raise exception 'Receipt differs from exact reviewed manifest';end if;
  if r->'after_row' ? 'id' then
   if jsonb_typeof(r->'after_row'->'id') is distinct from 'number' then raise exception 'Receipt manifest invalid parentID';end if;
   ids:=jsonb_set(ids,array[p->>'ref'],r->'after_row'->'id');end if;
 end loop;
end;$manifest_guard$;\n`;
 const rollback=renderRollback(plan).replace('do $undo$',receiptGuard+'do $undo$');
 const files={'production-plan.json':JSON.stringify(plan,null,2)+'\n','production-import.sql':wrap(renderImport(plan)),'production-dry-run.sql':wrap(renderImport(plan,{dryRun:true})),'production-rollback.sql':rollback};
 for(const[n,s]of Object.entries(files))write(dir+n,s);const hashes=Object.fromEntries(Object.entries(files).map(([n,s])=>[n,checksum(s)]));write(dir+'import-hashes.json',hashes);index.push({directory:dir,workIds:part.map(d=>d.workId),...plan.summary,actions:plan.actions.length,hashes});
}
write('batches.json',{batchPolicy:'Four independent20Work/60action transactions; own first non-empty COMMIT receipt each. No automatic execution or continuation.',batches:index});
write('change-list.json',approved.map(d=>({workId:d.workId,authorId:d.authorId,originalTitle:d.originalTitle,oldEdition:d.existingEditionId?before.editions.find(e=>e.id===d.existingEditionId):null,newEdition:{existingId:d.existingEditionId,title:d.dutchTitle,isbn13:d.isbn13,language:'nld',format:d.format,publisher:d.publisher},cover:d.cover,summary:d.summary,exactSourceReferences:d.sources,batch:index.find(b=>b.workIds.includes(d.workId)).directory,workOrAuthorMutation:false})));
write('RESULTS.txt','VOLLEDIGE BEVROREN SELECTIE VAN100 — BESLUIT PER DOSSIER\n'+
 'Goedgekeurd betekent lokaal inhoudelijk beoordeeld voorstel, NIET op productie/test geïmporteerd.\n'+
 final.map(d=>[d.workId,d.originalTitle,d.status,d.isbn13??'geen goedgekeurd ISBN',d.format??'formaat niet goedgekeurd',d.reason??d.identity?.note??(typeof d.identity==='string'?d.identity:'Bestaand eerder goedgekeurd voorstel behouden'),d.nextAction??(d.reusedFrom?'Bestaand pakket behouden; niet dubbel importeren':'Hosted testacceptatie en gecommitteerd herstel ontbreken')].join(' | ')).join('\n')+'\n');
const oldFiles=fs.readdirSync(oldRoot,{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>pathToFileURL(path.join(e.parentPath,e.name)));
// Hash every frozen previous packet file, rather than rewriting its earlier proofs or conclusions.
write('retained-packet-hashes.json',Object.fromEntries(oldFiles.map(url=>[decodeURIComponent(url.href.slice(oldRoot.href.length)),checksum(fs.readFileSync(url))])));
const tally=Object.fromEntries([...new Set(final.map(d=>d.status))].map(s=>[s,final.filter(d=>d.status===s).length]));
write('progress.json',{baseCommit:frozen.baseCommit,historicalReference:{date:'2026-10-29',nlWorks:2649,unchanged:true},production:{readAt:before.at,nlWorks:2758,approvedSummaries:{nl:215,en:119,uniqueWorks:312},writes:0,source:'Frozen full read-only inventory plus fresh exact100Work preflight; these are not test counts'},frozen100:{selected:100,researchedWithDecision:100,unvisited:0,statuses:tally,approvedIncludingRetained:84,previouslyApproved:4,newlyApproved:80,identityConflicts:5,insufficientEvidenceAfterResearch:11,explicitlyAbsentDutchEditionsEstablished:0},newProposal:{works:80,newWorks:0,newAuthors:0,newEditions:index.reduce((n,p)=>n+p.newEditions,0),existingLanguageCorrections:index.reduce((n,p)=>n+p.languageCorrections,0),metadata:80,newNlSummaries:80,newEnSummaries:0,actions:240,proposedExtraNlPrintedWorks:80,actuallyAddedOnTestOrProduction:0},combinedWithUnchangedPreviousEight:{distinctDossiers:105,approved:88,identityConflicts:6,insufficientEvidenceAfterResearch:11,newWorks:0,newEditions:4+index.reduce((n,p)=>n+p.newEditions,0),languageCorrections:4+index.reduce((n,p)=>n+p.languageCorrections,0),metadata:88,newNlSummaries:86,retainedGoodNlSummaries:2,actions:262,proposedExtraNlPrintedWorks:88,actuallyAddedOnTestOrProduction:0},remainingGlobalWork:{inventory:10223,inventoryIsCompletedResearch:false,classificationOverlayOnly:{approved_correction_local_not_hosted:88,insufficient_evidence_further_sources_required:9782,partially_reviewed_approved_stored_content:300,approved_correction_proposed_test_not_production:16,approved_existing_NL_presentation:6,identity_conflict:31},note:'This100Work cohort is adjudicated; full10223 inventory is not. Eleven researched insufficient-evidence cases remain open to further sources, not certified absence.'},unchangedOriginalPilot100:{approved:78,blocked:22,notTheFrozenNext100:true},hosted:{writes:0,acceptance:false,committedRecovery:false,noNewConfirmation:true},pr51:'outside_scope',pr63:'unchanged11795c7b03d04ea0fd267694fe1b36c6b9bc7b0d'});
console.log(JSON.stringify({dossiers:100,tally,newApprovals:80,newEditions:index.reduce((n,p)=>n+p.newEditions,0),existingLanguageCorrections:index.reduce((n,p)=>n+p.languageCorrections,0),actions:240,oldPacketUnchanged:true}));
