import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const dir=new URL('../catalog/editorial-parity-20261021/',import.meta.url);
const plan=JSON.parse(readFileSync(new URL('fantasy-test-plan.json',dir)));
const receipt=JSON.parse(readFileSync(new URL('fantasy-test-receipt.json',dir)));
const sql=readFileSync(new URL('fantasy-test-dry-run.sql',dir),'utf8');
test('Exactly20 fantasy identities, no audio/bilingual or other editorial additions',()=>{
 assert.equal(plan.target,'hlvujbrmfdlrfxdjwsmb');assert.equal(plan.plan.length,20);
 assert.deepEqual(plan.plan.map(p=>p.productionWorkId),[6,17,18,19,21,23,24,25,26,27,30,32,117,140,146,171,185,218,288,304]);
 assert.equal(new Set(plan.plan.map(p=>p.testWorkId)).size,20);assert.equal(new Set(plan.plan.map(p=>p.isbn13)).size,20);
 assert.ok(sql.trim().endsWith('rollback;'));assert.ok(!/public\.(ratings|user_|taste_test)|delete from|alter table/i.test(sql));
});
test('Actual persisted readback and zero-write second dry-run',()=>{
 assert.equal(receipt.application.existing_catalogue_unchanged,true);
 assert.deepEqual(receipt.application.counts,{work_created:20,author_created:16,edition_created:20,language_null_to_eng:20});
 assert.equal(receipt.readback.length,20);assert.equal(receipt.idempotence.counts,null);
 assert.equal(receipt.idempotence.existing_catalogue_unchanged,true);
 for(const p of plan.plan){const row=receipt.readback.find(r=>r.id===p.testWorkId);assert.ok(row);assert.equal(row.language,'eng');assert.equal(row.edition_id,p.testEditionId);assert.equal(row.isbn_13,p.isbn13);assert.equal(row.edition_title,p.editionTitle);assert.equal(row.open_library_edition_id,p.editionOlid);assert.equal(row.open_library_id,p.olid);}
});
