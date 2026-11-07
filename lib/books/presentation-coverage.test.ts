import assert from 'node:assert/strict';import test from 'node:test';
import {PresentationCoverage} from './presentation-coverage.ts';
test('source coverage compares the same selection and locale only, without reverting valid withdrawals or leaking keys',()=>{
 let now=0;const logs:Record<string,unknown>[]=[];const monitor=new PresentationCoverage(()=>now,r=>logs.push(r));
 const initial={books:16,summaries:12,covers:10};monitor.observe('private-selection-nl','nl',initial);
 monitor.observe('another-selection','nl',{books:16,summaries:0,covers:0});assert.equal(logs.length,0);
 now=100;monitor.observe('private-selection-nl','nl',{books:16,summaries:9,covers:10});assert.equal(logs.length,1);
 assert.deepEqual(logs[0].fields,['summaries']);assert.doesNotMatch(JSON.stringify(logs),/private-selection|workId|userId|query/);
 monitor.observe('private-selection-nl','nl',{books:16,summaries:9,covers:10});assert.equal(logs.length,1);
 now=6*60000;monitor.observe('private-selection-nl','nl',{books:16,summaries:0,covers:0});assert.equal(logs.length,1);
});
