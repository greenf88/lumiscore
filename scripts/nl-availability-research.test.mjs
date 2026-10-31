import test from 'node:test';import assert from 'node:assert/strict';
import {inheritWorkResearch,substantiveAssessment} from './nl-availability-research.mjs';
test('regeneration keeps prior source attempts/status/decisions; stale identity does not inherit',()=>{
 const w={title:'Same book',author_id:1,open_library_id:'OL1W'},old={key:'work:1',title:w.title,authorId:1,openLibraryWorkId:'OL1W',sourceAttempts:[{url:'https://example.org/edition',state:'insufficient_content'}],sourcePoorResearch:{researchStatus:'insufficient_evidence'},authorAuthorityDecision:'not_a_merge'};
 const first=inheritWorkResearch(old,w),rerun=inheritWorkResearch({...old,sourceAttempts:undefined,sourcePoorResearch:undefined,authorAuthorityDecision:undefined,research:first},w);
 assert.deepEqual(rerun,first);assert.equal(inheritWorkResearch(old,{...w,author_id:2}).previousSourceAttempts.length,0);
});
test('technical Dutch eligibility alone never implies complete substantive review; proposal/test is not production',()=>{
 const row={status:'insufficient_substantive_research',presentations:{nl:{eligible:true,summary:{state:'no_approved_stored_summary'},cover:{state:'no_stored_approved_binding_remote_evidence_unknown'}},en:{eligible:false}}};
 assert.equal(substantiveAssessment(row).outcome,'insufficient_evidence_further_sources_required');
 const approved={...row,status:'verified_external_NL_missing_or_incomplete',proposal:{batch:'Hebban12'}};
 assert.equal(substantiveAssessment(approved).outcome,'approved_correction_proposed_test_not_production');
 assert.equal(substantiveAssessment(row,{status:'identity_review_required',remaining:['author binding']}).outcome,'identity_conflict');
 assert.equal(substantiveAssessment(row).finalUnresolvableException,false);
});
