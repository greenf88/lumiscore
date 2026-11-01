import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const root=new URL('../catalog/nl-availability-20261031/',import.meta.url);
test('entire current public inventory has one traceable Work status; production, proposals and fixtures stay separate',()=>{
 const current=JSON.parse(fs.readFileSync(new URL('production-public-snapshot.json',root))),summary=JSON.parse(fs.readFileSync(new URL('inventory-summary.json',root))),rows=fs.readFileSync(new URL('repair-register.jsonl',root),'utf8').trim().split('\n').map(r=>JSON.parse(r));
 assert.equal(rows.length,current.works.length);assert.equal(new Set(rows.map(r=>r.key)).size,rows.length);assert.equal(rows.flatMap(r=>r.editionIds).length,current.editions.length);
 assert.equal(summary.historicalReference.eligibleNL,2649);assert.equal(summary.totals.locales.nl.eligibleWorks,2758);assert.equal(summary.historicalReference.currentEligibleDelta,109);
 assert.equal(summary.editorialLists.length,12);assert.equal(summary.editorialLists.find(l=>l.slug==='dystopie-vanaf-1990').locales.nl.visible,3);
 assert.equal(summary.mismatches.length,0);assert(rows.every(r=>r.status&&r.nextAction&&r.presentations.nl&&r.presentations.en));
 assert.equal(rows.find(r=>r.workId===1936).presentations.nl.eligible,false,'test correction is not production availability');assert.equal(rows.find(r=>r.workId===1936).proposal.batch,'Hebban12');
 assert.equal(rows.find(r=>r.workId===93).status,'NL_present_presentation_incomplete','stored edition is not proof of a working summary');
 assert.equal(summary.proposalOverlap.sharedWorkIds.length,0);assert.equal(summary.totals.orphanEditions,0);
 assert(rows.every(r=>r.research.assessment?.outcome&&r.research.assessment.finalUnresolvableException===false));
 assert.equal(Object.values(summary.researchCoverage.assessments).reduce((a,b)=>a+b,0),10223);
 assert.equal(rows.find(r=>r.workId===1993).research.assessment.outcome,'identity_conflict');
 assert.equal(rows.find(r=>r.workId===125).research.reconciledPriorProposal.newExpansion,0);
 assert(rows.find(r=>r.workId===1).research.previousSourceAttempts.length>0);
});
