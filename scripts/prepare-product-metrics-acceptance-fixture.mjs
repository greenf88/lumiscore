// Test-only preparation; no network, credentials or application import.
// Reuse the existing taste policy from its separate worktree without copying it
// into PR51. Supply --policy-root explicitly; never change that other worktree.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=process.argv[process.argv.indexOf('--policy-root')+1];
assert.ok(process.argv.includes('--policy-root')&&root,'Explicit existing policy root required');
const fixture=JSON.parse(await readFile(new URL('../test-support/product-metrics/acceptance-fixture-v1.json',import.meta.url),'utf8'));
const policyFile=path.join(root,'lib/taste-test/eligibility.ts');
const {tasteEligibility}=await import(pathToFileURL(policyFile));
const {buildEffectiveWorkTraitVector,evidenceRowsForTraits}=await import(pathToFileURL(path.join(root,'lib/recommendations/work-trait-evidence.ts')));
const results=fixture.books.map(b=>{
 const identity={workId:String(b.workId),title:b.title,author:fixture.author.name,
  identityKey:`${fixture.fixtureId}:${b.workId}`,workType:fixture.workType,labels:[],memberships:[],
  standaloneEvidence:fixture.standaloneEvidence,
  editions:[{id:b.editionId,work_id:b.workId,title:b.title,language:fixture.language,isbn_13:null,open_library_edition_id:null}]};
 const evidence=evidenceRowsForTraits({workId:String(b.workId),traits:{[b.trait]:1},confidence:1,
  source:'manual',sourceKey:`${fixture.fixtureId}:${b.workId}`,rawLabels:['SYNTHETIC_FIXTURE',b.definition],verifiedAt:fixture.checkedAt});
 const effective=buildEffectiveWorkTraitVector(evidence);
 const nl=tasteEligibility(identity,effective,'nl'),en=tasteEligibility(identity,effective,'en');
 assert.equal(nl.eligible,true,JSON.stringify(nl));assert.equal(String(nl.edition.id),String(b.editionId));
 assert.equal(en.eligible,false);assert.ok(en.reasons.includes('edition-language-missing'));
 assert.equal(tasteEligibility({...identity,standaloneEvidence:undefined},effective,'nl').eligible,false);
 assert.equal(tasteEligibility(identity,buildEffectiveWorkTraitVector([]),'nl').eligible,false);
 assert.equal(tasteEligibility({...identity,workType:'omnibus'},effective,'nl').eligible,false);
 return {workId:b.workId,editionId:b.editionId,nl:nl.eligible,en:en.eligible};
});
assert.equal(results.length,9);assert.equal(new Set(results.map(x=>x.workId)).size,9);
console.log(JSON.stringify({fixtureId:fixture.fixtureId,policySha256:createHash('sha256').update(await readFile(policyFile)).digest('hex'),results,checks:'9 NL pass, EN excluded; missing standalone/evidence and omnibus remain excluded. No policy/account exceptions.'},null,2));
