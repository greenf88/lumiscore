import test from'node:test';import assert from'node:assert/strict';import{reviewedExistingCase}from'./nl-scale-reviewed-routing.mjs';
test('reviewed alternate source routes only to exact existing Work/person, never a duplicate or unreviewed suspected match',()=>{
 const c={caseNumber:1,candidateId:'ol:OL10W',workId:null,sourceAuthors:[{key:'/authors/OL20A'}]},item={caseNumber:1,workId:3,existingIdentityResolution:'identity-reviewed-decisions.json#ol:OL10W'},r={candidateId:c.candidateId,status:'use_existing_work_identity',resolvedWorkId:3,currentSourceWorkId:'OL30W',reason:'Same original independently verified',evidence:['https://example.invalid/library']},w={id:3,open_library_id:'OL30W'},a={open_library_id:'OL20A'};
 assert.equal(reviewedExistingCase([c],item,[r],w,a),c);
 for(const wrong of [{...r,status:'suspected_existing_identity_pending_primary_confirmation'},{...r,resolvedWorkId:4},{...r,currentSourceWorkId:'OL31W'}])assert.throws(()=>reviewedExistingCase([c],item,[wrong],w,a));
 assert.throws(()=>reviewedExistingCase([c],item,[r],w,{open_library_id:'OL21A'}));
 assert.throws(()=>reviewedExistingCase([{...c,workId:4}],item,[r],w,a));
});
