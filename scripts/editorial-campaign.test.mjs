import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const dir=new URL('../catalog/editorial-parity-20261021/',import.meta.url);
const json=n=>JSON.parse(readFileSync(new URL(n,dir)));
test('24 audited languages are separated from minimal complete-cover campaign proposal',()=>{
 const all=json('campaign-source-recheck.json'),minimal=json('campaign-production-recommended.json');
 assert.equal(all.changes.length,24);assert.ok(all.changes.every(c=>c.currentValue===null&&c.proposedValue==='eng'&&c.sourceLanguageVerified));
 assert.deepEqual(minimal.languageCorrections.map(c=>c.workId),[179,199]);
 assert.deepEqual(minimal.editionAdditions.map(e=>[e.workId,e.isbn13]),[[2600,'9780385721677'],[100,'9780385732550']]);
 const sql=readFileSync(new URL('campaign-production-recommended-dry-run.sql',dir),'utf8');
 assert.ok(sql.trim().includes('rollback;'));assert.ok(!/delete from|alter table|public\.(ratings|user_|taste_test)/i.test(sql));
 for(const id of [14,22])assert.ok(!minimal.languageCorrections.some(c=>c.workId===id));
});
test('real campaign test apply is bounded and idempotent without touching existing bibliography',()=>{
 const r=json('campaign-test-receipt.json');assert.equal(r.application.target,'hlvujbrmfdlrfxdjwsmb');
 assert.deepEqual(r.application.counts,{work_created:11,author_created:8,edition_created:13,language_null_to_eng:3});
 assert.equal(r.application.existing_catalogue_unchanged,true);assert.equal(r.idempotence.counts,null);
 assert.equal(r.productionWrites,false);assert.equal(r.userDataWrites,false);
 const giver=json('giver-test-receipt.json');assert.equal(giver.receipt.inserted.length,1);assert.equal(giver.receipt.inserted[0].work_id,921100100);assert.equal(giver.receipt.inserted[0].isbn_13,'9780385732550');
});
