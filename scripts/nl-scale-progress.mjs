// One current register. Inventory, source triage, content, import and release are distinct.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {ROOT,readJson,loadSnapshot,priorRegister} from './nl-scale-snapshot.mjs';
import {loadReviews} from './nl-scale-reviews.mjs';
import {loadCases} from './nl-scale-case-store.mjs';
const snap=loadSnapshot(),prior=priorRegister();
const pool=fs.readFileSync(new URL('candidate-pool.jsonl',ROOT),'utf8').trim().split('\n').map(JSON.parse);
const {cases}=loadCases();
const reviews=loadReviews();
const identityRouting=readJson(new URL('identity-reviewed-decisions.json',ROOT)).decisions;
const identityById=new Map(identityRouting.map(d=>[d.candidateId,d]));
const executionRoot=new URL('subbatches/',ROOT);
const executions=fs.existsSync(executionRoot)?fs.readdirSync(executionRoot).flatMap(n=>{
 const f=new URL(n+'/execution-status.json',executionRoot);return fs.existsSync(f)?[readJson(f)]:[];
}):[];
const executedIds=new Set(executions.flatMap(e=>e.candidateIds));
const hostedIds=new Set(executions.flatMap(e=>e.hostedAcceptedCandidateIds));
const executionById=new Map(executions.flatMap(e=>e.candidateIds.map(id=>[id,e])));
const bookDecisionsPath=new URL('final-research-decisions.json',ROOT);
const decisions=fs.existsSync(bookDecisionsPath)?readJson(bookDecisionsPath).decisions:[];
const decisionById=new Map(decisions.map(d=>[d.candidateId,d]));
const phaseCases=new Map(cases.map(d=>[d.candidateId,d]));
const publication=readJson(new URL('prior-publication-reconciliation.json',ROOT));
const historical=new Map(prior.rows.map(r=>[r.workId,r]));
const nowReviewed=new Set(publication.nowResearchedCurrentWorkIds);
const poolByWork=new Map(pool.filter(r=>r.workId).map(r=>[r.workId,r]));
const sumRefs=new Map();for(const d of snap.descriptions.filter(d=>d.language==='nl'&&d.review_status==='approved'))sumRefs.set(d.work_id,{reviewBatch:d.review_batch,reviewedAt:d.reviewed_at,sourceUrl:d.source_url});
function state(c){
 const d=phaseCases.get(c.candidateId),r=reviews.get(c.candidateId),final=decisionById.get(c.candidateId);
 return {
  candidateId:c.candidateId,workId:c.workId??null,resolvedExistingWorkId:identityById.get(c.candidateId)?.resolvedWorkId??c.workId??null,title:c.title,author:c.author,stream:c.stream,
  priority:c.priority,popularitySignals:c.popularitySignals,
  currentProduction:{nlLanguageEligible:c.currentNlAvailable,approvedNlSummary:c.currentApprovedNlSummary},
  priorResearchReused:c.priorResearched,
  research:{phaseSelected:Boolean(d),bibliographicSourceTriage:Boolean(d),contentReviewed:Boolean(r),contentReviewReference:r?.reference??null,contentStatus:r?.contentStatus??'not_yet_researched',decision:final?.status??(r?'research_in_progress':c.priorResearched?'historical_research_reference_retained':'not_yet_researched'),completed:Boolean(final)||(!d&&c.priorResearched),decisionReference:final?'final-research-decisions.json#'+c.candidateId:null},
  proposedSummary:r?.text?{status:'original_content_draft_not_installed',language:'nl',words:r.text.trim().split(/\s+/).length,reference:r.reference}:null,
  editionCandidateReferences:c.editionCandidates.map(e=>({editionKey:e.record.key,isbn13:e.record.isbn_13,isbn10:e.record.isbn_10,sourceRecordSha256:e.source.recordSha256})),
  sourceReferences:c.sources,remaining:final?.remaining??c.missingEvidence,
  execution:{scope:'current_research_phase_only',testApplied:executedIds.has(c.candidateId),testBatch:executionById.get(c.candidateId)?.batch??null,committedRecoveryProven:executionById.get(c.candidateId)?.committedRecovery??false,hostedAccepted:hostedIds.has(c.candidateId),testedApplicationSha:executionById.get(c.candidateId)?.testedApplicationSha??null,releaseOffered:false,published:false}
 };
}
const rows=snap.works.map(w=>{
 const c=poolByWork.get(w.id);if(c)return state(c);
 const old=historical.get(w.id),p=publication.publishedNew.find(x=>x.workId===w.id);
 return {candidateId:'work:'+w.id,workId:w.id,title:w.title,author:w.author,currentProduction:{nlLanguageEligible:snap.editions.some(e=>e.work_id===w.id&&['nl','nld','dut'].includes(e.language)),approvedNlSummary:sumRefs.has(w.id)},priorResearchReused:nowReviewed.has(w.id),research:{phaseSelected:false,contentReviewed:false,decision:nowReviewed.has(w.id)?'historical_research_reference_retained':'not_yet_researched',completed:nowReviewed.has(w.id),reference:p?'prior-publication-reconciliation.json#'+p.candidateId:old?.latestReference??old?.researchReference??null},execution:{changedByCurrentPhase:false,publishedByCurrentPhase:false}};
});
rows.push(...pool.filter(c=>!c.workId).map(state));
if(new Set(rows.map(r=>r.candidateId)).size!==rows.length||new Set(rows.filter(r=>r.workId).map(r=>r.workId)).size!==snap.works.length)throw Error('Cumulative identity duplicate');
const text=rows.map(r=>JSON.stringify(r)).join('\n')+'\n';fs.writeFileSync(new URL('research-register.jsonl',ROOT),text);
const drafts=[...reviews.values()].filter(r=>r.text);
const retained=[...reviews.values()].filter(r=>r.contentStatus==='existing_approved_text_retained');
const duplicateSourceReviews=[...reviews.values()].filter(r=>r.contentStatus==='duplicate_source_candidate_reuse');
for(const r of drafts){
 const count=r.text.trim().split(/\s+/).length;
 if(count<50||count>105||/[<>]/.test(r.text)||!cases.some(c=>c.candidateId===r.candidateId))throw Error('Invalid original draft '+r.candidateId);
}
const stats={at:new Date().toISOString(),productionBaseline:snap.baseline,productionWritesByPhase:0,
 historicalReference:{nlBaseline:snap.baseline.historicalNlBaseline,nlCurrentOperational:snap.baseline.nlAvailableWorks,publishedNetChange:snap.baseline.publishedNetGrowth,remainingToNet5000:snap.baseline.remainingToPlus5000,storedApprovedDutchPrintWorks:new Set(snap.metadata.filter(m=>m.review_status==='approved'&&['paperback','hardcover'].includes(m.format)&&snap.editions.some(e=>e.id===m.edition_id&&['nl','nld','dut'].includes(e.language))).map(m=>m.work_id)).size,legacyFormatsNotAutomaticallyCertified:true},
 broadPool:{candidates:pool.length,possibleNewIdentities:pool.filter(c=>!c.workId).length,notVerifiedAbsent:true},
 currentPhase:{selected:cases.length,possibleNewCandidatesSelected:cases.filter(c=>!c.workId).length,bibliographicTriage:cases.length,individualContentReviews:reviews.size,originalDutchDrafts:drafts.length,uniqueDraftCandidateIds:new Set(drafts.map(r=>r.candidateId)).size,retainedApprovedTextReviews:retained.length,duplicateSourceReviewsRequiringConsolidation:duplicateSourceReviews.length,currentSourceOrIdentityHolds:reviews.size-drafts.length-retained.length-duplicateSourceReviews.length,finalResearchDecisions:decisions.length,fullyApprovedImports:decisions.filter(d=>d.importApproved).length,testApplied:executedIds.size,hostedAccepted:hostedIds.size,committedRecoveryProvenCandidates:executions.filter(e=>e.committedRecovery).reduce((n,e)=>n+e.candidateIds.length,0),releaseOffered:0,published:0},
 cumulative:{actualCurrentWorks:snap.works.length,earlierCurrentWorkIdentitiesResearched:nowReviewed.size,phaseFinalResearchDecisions:decisions.length,technicalInventoryIsNotFinishedResearch:true},
 registerSha256:createHash('sha256').update(text).digest('hex')};
fs.writeFileSync(new URL('progress-current.json',ROOT),JSON.stringify(stats,null,2)+'\n');
console.log(JSON.stringify({...stats,productionBaseline:{works:snap.baseline.works,editions:snap.baseline.editions}},null,2));
