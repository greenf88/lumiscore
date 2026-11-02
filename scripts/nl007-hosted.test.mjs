import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
const root=new URL('../catalog/nl-research-007-20261101/',import.meta.url);
const read=n=>JSON.parse(fs.readFileSync(new URL(n,root),'utf8'));
const scoped=['works','authors','editions','metadata','descriptions','reserved','protected'];

test('hosted COMMIT recovery matches the actual preflight and preserves private baseline',()=>{
 const before=read('test-before-hosted.json'),undone=read('hosted/after-committed-recovery.json');
 for(const k of scoped)assert.deepEqual(undone[k],before[k],k);
 const final=read('hosted/final-after-negative-guards.json');assert.deepEqual(final.protected,before.protected);
 assert.equal(final.works.length,87);assert.equal(final.metadata.length,87);assert.equal(final.descriptions.length,87);
 for(let n=1;n<=9;n++)assert.equal(read('hosted/batch-'+String(n).padStart(2,'0')+'-test-replay-receipt.json').rows.length,0);
});

test('hosted revised source batch undoes only its40 rows and is restored exactly',()=>{
 const before=read('hosted/source-v2-installed.json'),undo=read('hosted/source-v2-after-committed-recovery.json'),receipt=read('hosted/batch-08-test-v2-first-receipt.json'),final=read('hosted/final-after-negative-guards.json');
 assert.equal(receipt.rows.length,40);assert.equal(read('hosted/batch-08-test-v2-replay-receipt.json').rows.length,0);
 for(const[k,relation,pk]of[['works','works','id'],['editions','editions','id'],['metadata','catalog_edition_metadata','edition_id'],['descriptions','catalog_work_descriptions','work_id']]){
  const ids=new Set(receipt.rows.filter(r=>r.relation===relation).map(r=>r.key[pk]));
  assert.deepEqual(undo[k],before[k].filter(r=>!ids.has(r[pk])));assert.deepEqual(final[k],before[k]);
 }
 const source=final.descriptions.find(r=>r.work_id===978100110);assert.equal(source.source_type,'official_catalog');assert.equal(source.source_url,'https://www.flandersliterature.be/books-and-authors/book/the-animals-within');
});

test('hosted refusal leaves later changes and dependencies intact; targeted cleanup restores all scoped rows',()=>{
 const baseline=read('hosted/final-after-cleanup.json'),dep=read('hosted/negative-dependency-after-refusal.json'),change=read('hosted/negative-later-change-after-refusal.json'),final=read('hosted/final-after-negative-guards.json'),manifest=read('hosted/negative-guard-manifest.json');
 assert.match(read('hosted/hosted-dependency-refusal.json').message,/Later dependency in public.editions/);
 assert.match(read('hosted/hosted-later-change-refusal.json').message,/Later legitimate change/);
 for(const k of ['works','authors','metadata','descriptions','protected']){assert.deepEqual(dep[k],baseline[k]);assert.deepEqual(change[k],baseline[k]);}
 assert.deepEqual(dep.editions.filter(e=>e.id!==manifest.temporaryEdition.id),baseline.editions);
 assert.deepEqual(change.editions.map(e=>e.id===manifest.ownPublisherChange.after.id?manifest.ownPublisherChange.before:e),baseline.editions);
 for(const k of scoped)assert.deepEqual(final[k],baseline[k]);
 const cleaned=read('hosted/cleanup-result.json');for(const k of['ownAccountRemaining','ownRatingsRemaining','ownStatusesRemaining','ownRoundRemaining','ownOffersRemaining'])assert.equal(cleaned[k],0);
});

test('all87 exact hosted presentations correspond to the current proposals and tested application',()=>{
 const ds=read('release-candidates.json').dossiers,proof=read('hosted/presentation-acceptance-v2.json');
 assert.equal(proof.applicationSha,'5c2e4ced63c53badbf3cc3634b941b357e280663');assert.equal(proof.results.length,87);assert.equal(new Set(proof.results.map(r=>r.candidateId)).size,87);
 for(const d of ds){const r=proof.results.find(r=>r.candidateId===d.candidateId);assert.equal(r.isbn,d.edition.isbn13);assert.deepEqual(r.issues,[]);assert(Object.values(r.checks).every(Boolean));assert(r.detail.info.includes(d.edition.isbn13));assert(r.detail.about.includes('Bron:'));}
 const mobile=read('hosted/mobile-overflow-regression.json');for(const r of mobile.after){assert(r.documentWidth<=r.viewport);assert.equal(r.cards.length,16);}
});
