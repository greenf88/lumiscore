import test from 'node:test';import assert from 'node:assert/strict';
import {parseBufferedDecisions,readBufferedDraft,DRAFT_TTL,draftKey} from './buffered-round.ts';
test('draft validates real ratings, skips, uniqueness and bounded storage expiry',()=>{
 const decisions=[{workId:'1',score:9},{workId:'2',score:null}];assert.deepEqual(parseBufferedDecisions(decisions),decisions);
 for(const invalid of [[...decisions,decisions[0]],[{workId:'1',score:0}],[{workId:'1',score:1.5}],[{workId:'1',score:'9'}],[{workId:'1',score:8,user:'other'}],Array(121).fill(decisions[0])])assert.equal(parseBufferedDecisions(invalid),null);
 const now=1000;assert.deepEqual(readBufferedDraft(JSON.stringify({decisions,expires:now+DRAFT_TTL}),now)?.decisions,decisions);
 assert.equal(readBufferedDraft(JSON.stringify({decisions,expires:now-1}),now),null);
 assert.notEqual(draftKey('reader-a','round'),draftKey('reader-b','round'));
});
