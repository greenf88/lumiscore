import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('catalogue proposal is exact, nonautomatic, guarded and excludes audio/multilingual editions',()=>{
 const plan=JSON.parse(read('catalog/editorial-parity-20261021/correction-proposal.json'));
 assert.equal(plan.status,'PROPOSAL_ONLY_NOT_APPLIED');assert.equal(plan.languageCorrections.length,24);
 assert.equal(new Set(plan.languageCorrections.map(e=>e.editionId)).size,24);
 for(const correction of plan.languageCorrections){assert.equal(correction.oldLanguage,null);assert.equal(correction.newLanguage,'eng');assert.match(correction.source,/openlibrary.org\/books\/OL\d+M/);}
 assert.ok(plan.unresolved.some(row=>row.workId===14));assert.ok(plan.unresolved.some(row=>row.workId===22));
 const sql=read('catalog/editorial-parity-20261021/proposed-dry-run.sql');
 assert.match(sql,/Edition preimage mismatch/);assert.match(sql,/e.language is null returning/);assert.match(sql,/where not exists/);assert.match(sql,/\nrollback;/);
 assert.doesNotMatch(sql,/\b(?:update|delete from) public\.(?:works|ratings|user_book_status|collection_books)\b/i);
 assert.doesNotMatch(read('package.json'),/prepare-editorial|proposed-dry-run/);
});
test('Oryx proposal reuses the existing Work, with exact source-backed English identity',()=>{
 const plan=JSON.parse(read('catalog/editorial-parity-20261021/correction-proposal.json'));
 assert.deepEqual(plan.editionAdditions.map(e=>[e.workId,e.isbn13,e.openLibraryEditionId,e.language]),[[2600,'9780385721677','OL39470791M','eng']]);
 assert.equal(plan.editionAdditions[0].publicationDate,'2004-03-30');
 assert.match(plan.additionalReview.find(e=>e.workId===100).reason,/NOT approved/);
 const sql=read('catalog/editorial-parity-20261021/proposed-dry-run.sql');
 assert.doesNotMatch(sql,/insert into public\.works/i);assert.match(sql,/Oryx edition collision/);
});
