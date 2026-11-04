import test from 'node:test';
import assert from 'node:assert/strict';
import {bindReviews} from './nl-scale-record-review.mjs';
const cases=[{caseNumber:1,candidateId:'work:10',sourceAuthors:[{name:'Test author'}],editionReviews:[{editionKey:'/books/OL1M',isbn13:['9789025327422'],kbRecords:[{uri:'https://example.test/bibliography/1',sources:['kb-test.json']}]}],contentSources:[{sourceUrl:'https://example.test/work/1',sourceSha256:'f'.repeat(64)}]}];
const hold={caseNumber:1,contentStatus:'substantive_source_required',facts:['Bibliographic record exists'],note:'Narrative not available; publisher account needed',text:null};
test('an explicit hold stays unresolved and binds exact sources without raw text',()=>{
 const [r]=bindReviews({entries:[hold]},cases);
 assert.equal(r.candidateId,'work:10');
 assert.equal(r.text,null);
 assert.equal(r.importApproved,undefined);
 assert.equal(r.sourceEvidence.content[0].recordSha256,'f'.repeat(64));
 assert.equal(r.sourceEvidence.editions[0].isbns[0],'9789025327422');
 assert.match(r.sourceEvidence.bindingSha256,/^[a-f0-9]{64}$/);
 assert.equal(JSON.stringify(r).includes('sourceAuthors'),false);
});
test('missing facts, unresolved reason, duplicate or unknown cases are refused',()=>{
 for(const entries of [[{...hold,facts:[]}],[{...hold,note:''}],[hold,hold],[{...hold,caseNumber:2}]]){
  assert.throws(()=>bindReviews({entries},cases));
 }
});
test('content reading cannot imply import, install, release or publication approval',()=>{
 for(const contentStatus of ['approved','complete','published','installed'])assert.throws(()=>bindReviews({entries:[{...hold,contentStatus}]},cases));
});
test('short, oversized and markup drafts cannot be installed as a content review',()=>{
 for(const text of ['too short',Array(106).fill('word').join(' '),Array(60).fill('<script>').join(' ')])assert.throws(()=>bindReviews({entries:[{...hold,text}]},cases));
});
test('source change changes the binding even when wording is retained',()=>{
 const a=bindReviews({entries:[hold]},cases)[0];
 const changed=structuredClone(cases);changed[0].editionReviews[0].isbn13=['9789044635867'];
 assert.notEqual(a.sourceEvidence.bindingSha256,bindReviews({entries:[hold]},changed)[0].sourceEvidence.bindingSha256);
});
