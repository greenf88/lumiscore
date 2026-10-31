import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {selectStrictEdition,withStrictEdition} from '../lib/books/strict-edition.ts';
import {normalizeEditionLanguage,getSuspiciousEditionReasons} from '../lib/books/edition-ranking.ts';
import {applyStoredPresentation} from '../lib/books/stored-presentation.ts';
import {normalizeBookDescription} from '../lib/books/description-text.ts';
import {inheritWorkResearch,substantiveAssessment} from './nl-availability-research.mjs';
const root=new URL('../catalog/nl-availability-20261031/',import.meta.url);
const read=n=>JSON.parse(fs.readFileSync(new URL(n,root),'utf8'));
const write=(n,v)=>fs.writeFileSync(new URL(n,root),typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');
const current=read('production-public-snapshot.json');
const historicalRoot=new URL('../../lumiscore-catalog-integrity-20261030/catalog/integrity-repair-20261030/',import.meta.url);
const historicalRegister=new URL('repair-register.jsonl',historicalRoot),savedRegister=new URL('repair-register.jsonl',root);
const previousRows=fs.readFileSync(fs.existsSync(historicalRegister)?historicalRegister:savedRegister,'utf8').trim().split('\n').map(s=>JSON.parse(s));
const previous=new Map(previousRows.map(r=>[r.key,r]));
for(const row of previousRows)for(const e of row.editions??[])previous.set('edition:'+e.id,{...e,title:e.title,isbn13:e.isbn_13,sourceAttempts:e.identityResearch?.sourceAttempts,identity:e.identityResearch?.sourceIdentity,format:e.identityResearch?.format});
const byWork=new Map(),authors=new Map(current.authors.map(a=>[a.id,a]));
for(const e of current.editions){const rows=byWork.get(e.work_id)??[];rows.push(e);byWork.set(e.work_id,rows);}
const hebban=JSON.parse(fs.readFileSync(new URL('../catalog/hebban-priority-20261031/reviewed-changes.json',import.meta.url),'utf8'));
const pr62=read('pr62-plan-reference.json');
const followup=read('research-batch-002.json');
const plannedNL=new Map();
const verifiedLive=new Map(JSON.parse(fs.readFileSync(new URL('../catalog/hebban-priority-20261031/live-readonly-proof.json',import.meta.url),'utf8')).observations.map(r=>[r.workId,r]));
for(const a of pr62.actions.filter(a=>a.relation==='editions'&&normalizeEditionLanguage(a.after.language??'')==='nld'))plannedNL.set(a.after.work_id,{batch:'PR62',isbn:a.after.isbn_13,source:a.origin});
for(const e of hebban.editions)plannedNL.set(e.workId,{batch:'Hebban12',isbn:e.isbn,source:e.source});
const sql=Object.fromEntries(['nl','en'].map(l=>[l,new Map(read('sql-choices-'+l+'.json').choices)]));
const rows=[],mismatches=[],collections=[],totals={works:current.works.length,editions:current.editions.length,authors:current.authors.length,locales:{},statuses:{},editionLanguages:{},rejectedNL:{},storedDutchWorkIds:[],isbnMissing:0,isbn13Invalid:0,titleMissing:0,languageMissing:0,unknownOrUnreviewedFormat:0,orphanEditions:0};
const bump=(o,k)=>o[k]=(o[k]??0)+1;
const validISBN=v=>{const s=String(v??'').replace(/[\s-]/g,'');return /^\d{13}$/.test(s)&&[...s].reduce((n,c,i)=>n+Number(c)*(i%2?3:1),0)%10===0;};
for(const e of current.editions){const l=normalizeEditionLanguage(e.language??'')||'unknown';bump(totals.editionLanguages,l);if(!e.language?.trim())totals.languageMissing++;if(!e.title?.trim())totals.titleMissing++;if(!e.isbn_13&&!e.isbn_10)totals.isbnMissing++;if(e.isbn_13&&!validISBN(e.isbn_13))totals.isbn13Invalid++;if(!current.metadata.some(m=>m.edition_id===e.id&&m.review_status==='approved'&&m.format!=='unknown'))totals.unknownOrUnreviewedFormat++;if(!current.works.some(w=>w.id===e.work_id))totals.orphanEditions++;if(l==='nld'){const reasons=getSuspiciousEditionReasons(e);if(!e.title?.trim())bump(totals.rejectedNL,'missing_title');else for(const r of reasons)bump(totals.rejectedNL,r);}}
for(const w of current.works){
 const eds=byWork.get(w.id)??[],old=previous.get('work:'+w.id),presentations={};
 const compatibleResearch=old&&old.title===w.title&&old.authorId===w.author_id&&old.openLibraryWorkId===w.open_library_id;
 for(const locale of ['nl','en']){
  const edition=selectStrictEdition(eds,locale,w.title),s=totals.locales[locale]??={eligibleWorks:0,selectedEditions:0,approvedSummaries:0,missingReviewedSummary:0,approvedExactCoverBindings:0,runtimeVerifiedLegacyCovers:0,actualLoadedNewProof:0,unknownSelectedFormat:0};
  if(String(edition?.id??'')!==String(sql[locale].get(w.id)??''))mismatches.push({workId:w.id,locale,js:edition?.id??null,sql:sql[locale].get(w.id)??null});
  if(!edition){presentations[locale]={eligible:false,reason:'no_suitable_confirmed_edition',summary:'not_applicable',actualBrowser:'not_checked_currently'};continue;}
  s.eligibleWorks++;s.selectedEditions++;
  const book=withStrictEdition({id:String(w.id),workId:String(w.id),authorId:String(w.author_id),title:w.title,author:authors.get(w.author_id)?.name??'',openLibraryWorkId:w.open_library_id,cover:'orbit',score:null,ratingsCount:null,match:null},edition,locale);
  const applied=applyStoredPresentation([book],locale,current.descriptions,current.metadata)[0];
  const text=applied.storedDescription&&normalizeBookDescription(applied.storedDescription.text);
  if(text)s.approvedSummaries++;else s.missingReviewedSummary++;
  const storedCover=!!applied.coverUrls?.length&&!!current.metadata.find(m=>m.edition_id===edition.id&&m.cover_url===applied.coverUrls[0]);
  if(storedCover)s.approvedExactCoverBindings++;else if(applied.coverUrls?.length)s.runtimeVerifiedLegacyCovers++;
  if(!applied.editionFormat||applied.editionFormat==='unknown')s.unknownSelectedFormat++;
  presentations[locale]={eligible:true,editionId:edition.id,title:edition.title,language:normalizeEditionLanguage(edition.language),isbn13:edition.isbn_13,format:applied.editionFormat??'unknown',summary:text?{state:'approved_stored_source_bound',source:applied.storedDescription.sourceUrl,hash:createHash('sha256').update(text).digest('hex')}: {state:'no_approved_stored_summary',remoteContent:'unknown_not_equated_to_missing'},cover:{state:storedCover?'approved_stored_exact_edition_binding':applied.coverUrls?.length?'legacy_reviewed_binding':'no_stored_approved_binding_remote_evidence_unknown',urls:applied.coverUrls??[],actualBrowser:'not_inferred_from_database'}};
 }
 const storedNL=eds.some(e=>normalizeEditionLanguage(e.language??'')==='nld');if(storedNL)totals.storedDutchWorkIds.push(w.id);
 // Eligibility is technical, never promoted to visually/substantively proven.
 const live=verifiedLive.get(w.id),visibleVerified=presentations.nl.eligible&&live?.descriptionStatus==='visible-sourced'&&live.images?.some(i=>i.complete&&i.width>0)&&live.metadata?.includes(presentations.nl.isbn13);
 const status=visibleVerified?'suitable_NL_present_correctly_visible':plannedNL.has(w.id)&&!presentations.nl.eligible?'verified_external_NL_missing_or_incomplete':w.id===93?'NL_present_presentation_incomplete':!presentations.nl.eligible&&compatibleResearch&&old.sourcePoorResearch?.researchStatus==='identity_conflict'?'identity_or_source_conflict':'insufficient_substantive_research';
 if(visibleVerified){presentations.nl.cover.actualBrowser={file:'../hebban-priority-20261031/live-readonly-proof.json',url:live.url,checkedAt:'2026-10-31',environment:'production'};totals.locales.nl.actualLoadedNewProof++;}
 bump(totals.statuses,status);
 rows.push({key:'work:'+w.id,workId:w.id,title:w.title,authorId:w.author_id,author:authors.get(w.author_id)?.name??null,openLibraryWorkId:w.open_library_id,editionIds:eds.map(e=>e.id),storedDutchEdition:storedNL,presentations,status,technicalSelection:presentations.nl.eligible?'NL_eligible_visibility_not_globally_verified':presentations.en.eligible?'EN_only':'neither_NL_nor_EN',research:{inheritedIdentityMatches:!!compatibleResearch,previousKey:old?.key??null,previousSourceAttempts:compatibleResearch?old.sourceAttempts:[],previousSourcePoorStatus:compatibleResearch?old.sourcePoorResearch?.researchStatus??null:null,previousConflictDecision:compatibleResearch?old.additionalSourceAdjudication??old.authorAuthorityDecision??null:null},proposal:plannedNL.get(w.id)??null,editions:eds.map(e=>{const prior=previous.get('edition:'+e.id);return {...e,normalizedLanguage:normalizeEditionLanguage(e.language??'')||'unknown',identityResearch:prior?.title===e.title&&prior?.isbn13===e.isbn_13?{previousKey:prior.key,sourceAttempts:prior.sourceAttempts,sourceIdentity:prior.identity,format:prior.format,sourceDecision:prior.sourceDecision??null}:null};}),nextAction:presentations.nl.eligible?'Validate substantive edition/cover identity and actual presentation; complete stored Dutch text where evidence permits':plannedNL.has(w.id)?'Execute separately reviewed test batch; production remains unchanged':'Research exact Dutch edition independently; do not infer from title/author or description'});
}
for(const row of rows){
 row.research=inheritWorkResearch(previous.get(row.key),current.works.find(w=>w.id===row.workId));
 row.research.assessment=substantiveAssessment(row,followup.candidates.find(c=>c.workId===row.workId));
 const reconciled=followup.priorProposalReconciliation.find(p=>p.workId===row.workId);
 if(reconciled)row.research.reconciledPriorProposal={...reconciled,checkedAt:followup.checkedAt,file:'research-batch-002.json',newExpansion:0};
}
for(const c of current.collections){const ids=current.collectionLinks.filter(x=>x.collection_id===c.id).map(x=>x.work_id);collections.push({id:c.id,slug:c.slug,total:ids.length,locales:Object.fromEntries(['nl','en'].map(l=>[l,{visible:ids.filter(id=>rows.find(r=>r.workId===id)?.presentations[l].eligible).length,missing:ids.filter(id=>!rows.find(r=>r.workId===id)?.presentations[l].eligible)}]))});}
totals.storedDutchWorks=totals.storedDutchWorkIds.length;delete totals.storedDutchWorkIds;
totals.ENOnly=rows.filter(r=>r.technicalSelection==='EN_only').length;totals.neither=rows.filter(r=>r.technicalSelection==='neither_NL_nor_EN').length;
totals.duplicateIsbn13=[...Map.groupBy(current.editions.filter(e=>e.isbn_13),e=>e.isbn_13).entries()].filter(([,e])=>e.length>1).map(([isbn,editions])=>({isbn,editionIds:editions.map(e=>e.id),workIds:[...new Set(editions.map(e=>e.work_id))]}));
const lists=['top-lists.json','editorial-campaigns-20261028.json'].flatMap(file=>JSON.parse(fs.readFileSync(new URL('../lib/catalog/'+file,import.meta.url),'utf8')).lists).map(l=>({slug:l.slug,total:l.workIds.length,locales:Object.fromEntries(['nl','en'].map(locale=>[locale,{visible:l.workIds.filter(id=>rows.find(r=>String(r.workId)===id)?.presentations[locale].eligible).length,missing:l.workIds.filter(id=>!rows.find(r=>String(r.workId)===id)?.presentations[locale].eligible)}]))}));
const summary={at:current.at,application:current.main,inventoryCoverage:{checked:rows.length,total:current.works.length,percent:100,scope:'complete public database inventory and current JS/SQL eligibility, NOT full substantive or visual review'},researchCoverage:{concludedCurrentNLPresentationCases:rows.filter(r=>r.status==='suitable_NL_present_correctly_visible').length,note:'Only known complete substantive/visible proof counted; other prior research retained per identity, not silently discarded or promoted to complete'},userCoverage:{selectorEligibleNL:totals.locales.nl.eligibleWorks,actualCurrentVisualProof:'only separately recorded browser cases'},historicalReference:{date:'2026-10-29',works:10210,eligibleNL:2649,currentEligibleDelta:totals.locales.nl.eligibleWorks-2649,expansionTarget:5000},totals,mismatches,collections,editorialLists:lists,proposalOverlap:{pr62WorkIds:[...new Set(pr62.actions.map(a=>a.after.work_id).filter(Number.isInteger))],hebbanWorkIds:hebban.priorities.map(p=>p.workId),sharedWorkIds:[...plannedNL].filter(([id,v])=>v.batch==='Hebban12'&&pr62.actions.some(a=>a.after.work_id===id)).map(([id])=>id)}};
summary.researchCoverage.assessments=rows.reduce((o,r)=>(bump(o,r.research.assessment.outcome),o),{});
summary.researchCoverage.worksWithRetainedSourceAttempts=rows.filter(r=>r.research.previousSourceAttempts.length).length;
summary.researchCoverage.note='Every Work has an explicit per-aspect research state. Insufficient evidence means research remains, NOT proof of no Dutch edition or a finished exception. Technical eligibility, approved text, cover identity and actual browser evidence remain separate.';
summary.researchCoverage.followupBatch=followup.counting;
write('repair-register.jsonl',rows.map(r=>JSON.stringify(r)).join('\n')+'\n');write('inventory-summary.json',summary);console.log(JSON.stringify({counts:summary.totals.locales,research:summary.researchCoverage},null,2));
