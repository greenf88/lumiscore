import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProposals} from './operations/pilot-proposals.mjs';
const source={workId:1,sourceUrl:'https://openlibrary.org/works/OL1W.json',sourceHash:'abc',description:'A nonfiction guide to home care.'};
const proposal=()=>({workId:1,sourceUrl:source.sourceUrl,sourceHash:'abc',humanReview:'pending',productionApplied:false,
  decision:'propose',reason:'Description identifies a guide.',traits:[{trait:'nonfiction',excerpt:'nonfiction guide'}]});
test('proposals require exact source identity, pending review and real bounded excerpts',()=>{
  assert.equal(validateProposals([proposal()],[source]).length,1);
  for(const patch of [{sourceHash:'other'},{humanReview:'approved'},{productionApplied:true},{sourceUrl:'https://other.test'}])
    assert.throws(()=>validateProposals([{...proposal(),...patch}],[source]));
  assert.throws(()=>validateProposals([{...proposal(),traits:[{trait:'nonfiction',excerpt:'not in the source'}]}],[source]));
});
test('abstention and allowlisted labels prevent silent activation and invented taxonomy',()=>{
  assert.throws(()=>validateProposals([{...proposal(),decision:'abstain'}],[source]));
  assert.throws(()=>validateProposals([{...proposal(),traits:[{trait:'new_genre',excerpt:'nonfiction guide'}]}],[source]));
  assert.throws(()=>validateProposals([proposal(),proposal()],[source]));
  assert.equal(validateProposals([{...proposal(),decision:'abstain',traits:[]}],[source]).length,1);
});
