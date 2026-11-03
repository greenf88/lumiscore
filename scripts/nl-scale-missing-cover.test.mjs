import test from'node:test';import assert from'node:assert/strict';import{createHash}from'node:crypto';import{reviewedMissingCover}from'./nl-scale-missing-cover.mjs';
const e={editionKey:'/books/OL123M',isbn13:['9789025912673'],coverIds:[15138593]};
const receipt=[{candidateId:'ol:OL123W',editionKey:e.editionKey,coverId:15138593,status:'bulk_archive_unavailable'}];
const review={candidateId:'ol:OL123W',status:'no_verified_asset_retained',editionKey:e.editionKey,isbn13:e.isbn13[0],editionSha256:createHash('sha256').update(JSON.stringify(e)).digest('hex'),checkedAt:'2026-11-02T23:00:00Z',note:'Known archive delivery failed; do not invent a cover URL.',attempts:[{receipt:'cover-archive-readback.json',coverId:15138593,status:'bulk_archive_unavailable'}]};
test('placeholder proposal binds exact edition and actual failed source receipt',()=>{const r=reviewedMissingCover(e,review,{readReceipt:()=>receipt});assert.equal(r.status,'no_verified_asset_retained');assert.equal(r.attempts.length,1);assert(r.limitation.includes('not proof'));assert.equal(reviewedMissingCover(e,null),null);});
test('missing cover cannot discard a verified cover, invent a failure or target a different edition',()=>{for(const [ed,r,options]of[[e,review,{hasVerifiedCover:true}],[{...e,isbn13:['9789025915117']},review,{}],[e,{...review,attempts:[{...review.attempts[0],status:'http_image_ok'}]},{}],[e,{...review,editionKey:'/books/OL999M'},{}]])assert.throws(()=>reviewedMissingCover(ed,r,{readReceipt:()=>receipt,...options}));});

test('documented unpublished archive is accepted only with its independently matched failure receipt',()=>{const state='new_large_zip_source_failure_no_retry',rr={...review,attempts:[{receipt:'cover-large-zip-readback.json',coverId:15138593,status:state}]};assert.equal(reviewedMissingCover(e,rr,{readReceipt:()=>[{...receipt[0],status:state}]}).attempts[0].status,state);assert.throws(()=>reviewedMissingCover(e,rr,{readReceipt:()=>[{...receipt[0],status:'large_zip_bytes_verified_decode_and_identity_pending'}]}));});

test('a cached archive failure needs the original same-archive receipt; it proves no image absence',()=>{
 const error='Range refused/different: HTTP 500, Content-Range null; no full-download fallback';
 const prior={...receipt[0],status:'prior_source_failure_no_new_request',sourceFailureReference:'cover-archive-readback.json',error};
 const original={status:'bulk_source_failure_no_retry',url:'https://archive.org/download/covers_0015/covers_0015_13.zip',error};
 const rr={...review,attempts:[{receipt:'cover-archive-v2-readback.json',coverId:15138593,status:prior.status}]};
 const check=old=>reviewedMissingCover(e,rr,{readReceipt:name=>name==='cover-archive-v2-readback.json'?[prior]:old});
 const result=check([original]);assert.equal(result.attempts[0].historicalFailure.noNewRequest,true);assert(result.limitation.includes('not proof'));
 assert.throws(()=>check([]));assert.throws(()=>check([{...original,url:original.url.replace('_13.zip','_14.zip')} ]));
 assert.throws(()=>check([{...original,error:'ACCESS_STOP 403 archive.org'}]));
});
