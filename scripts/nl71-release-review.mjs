// Local evidence assembly only. Never connects to, or mutates, a database.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root='catalog/nl-scale-20261102/release/',dir=root+'final-decision/';
const read=p=>JSON.parse(fs.readFileSync(p));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const old=read(root+'production-plan.json'),current=read(root+'after-pr72/production-plan.json');
assert.deepEqual(current.actions,old.actions);assert.deepEqual(current.bindings,old.bindings);
const originalManifest=read(root+'release-hashes.json');
for(const [p,h] of Object.entries(originalManifest.files))assert.equal(hash(root+p),h,p);
for(const [p,h] of Object.entries(read(root+'after-pr72/hashes.json').hashes))assert.equal(hash(root+'after-pr72/'+p),h,p);
const continuation='catalog/nl-continuation-20261103/',selected=new Set(read(continuation+'batch-001/selection.json').cases);
const approved=fs.readFileSync(continuation+'research-register.jsonl','utf8').trim().split('\n').map(JSON.parse).filter(r=>r.status.startsWith('approved')&&!selected.has(r.caseNumber));
assert.equal(approved.length,171);
const candidateIds=new Set(read(root+'dossiers.json').decisions.map(r=>r.candidateId));
assert.equal(approved.filter(r=>candidateIds.has(r.candidateId)).length,0);
const other=read(continuation+'batch-001/production-plan.json');
const key=a=>a.relation+':'+JSON.stringify(a.key,Object.keys(a.key).sort());
const keys=new Set(current.actions.map(key));assert.equal(other.actions.filter(a=>keys.has(key(a))).length,0);
const actionCounts={};for(const a of current.actions)actionCounts[a.relation]=(actionCounts[a.relation]??0)+1;
const net=read(dir+'net-current.json');const result=net[0]?.result??net.result??net;
assert.equal(result.currentDutch,3108);assert.equal(result.rows.length,498);
assert.equal(result.rows.filter(r=>!r.currentDutch).length,235);
const protectedNow=read(dir+'test-protected-current.json')[0].protected;
const baseline=read(continuation+'batch-001/synthetic-profile-cleanup-proof.json').after;
assert.deepEqual(protectedNow.ratings,baseline.ratings);assert.deepEqual(protectedNow.statuses,baseline.status);
assert.equal(protectedNow.accounts.count,baseline.accounts.count);
const cover=read(dir+'cover-case-decisions.json');
cover.rows.find(r=>r.candidateId==='ol:OL21254611W').freshObservation={
  at:'2026-11-03T22:01:31.082Z',state:'same_bound_resolver_cover_now_decoded_and_visually_reviewed',
  coverId:14860444,cardAndDetail:true,reload:true,width:320,
  identity:'Visible title Het tijdperk van de huid, author Dubravka Ugresic, publisher Nijgh & Van Ditmar; bound exact edition OL42341561M/ISBN9789038807416.',
  importChange:false,proof:'preview-targeted-browser.json',
  limitation:'No new stored cover binding. No provider-wide availability claim. Other83 historical placeholder cases not freshly browser-tested.'
};
fs.writeFileSync(dir+'cover-case-decisions.json',JSON.stringify(cover,null,2)+'\n');
fs.writeFileSync(dir+'action-disposition.json',JSON.stringify({
  currentProduction:'1bd42f0bb96699eeef33ebe6b409e36ed6dad061',pr72:'merged_and_deployed; prerequisite already satisfied',
  actionsKept:1492,actionsMadeRedundantByPr72:0,actionContentsChanged:0,
  authorCorpusGuardUpdated:{authorId:670,addedExactlyPr72Works:[10290,10291],isImportAction:false},
  excludedHistoricalActions:read(root+'exclusions.json').excludedActions,
  newActionsFrom171Followups:0,followupCandidatesChecked:171,followupCandidateOverlap:0,pr72ActionOverlap:0,
  actionCounts,operationalDefinition:'Distinct Work IDs with an edition.language in nl/nld/dut, same historical series; not a new semantic approval of the entire catalogue. Proposed dossier editions separately reviewed as printed Dutch editions.',
  currentDutch:3108,alreadyDutchAmong498:263,proposedNewDutch:235,projectedDutch:3343,
  publishedAgainstHistorical2649:459,projectedAgainstHistorical2649:694,
  remainingToPlus5000IfReleased:4306,
  testProtectedDataMatchesLatestCleanup:{ratings:true,statuses:true,oldAccountCount:true,baseline:continuation+'batch-001/synthetic-profile-cleanup-proof.json',differentOldDigestAlgorithmsNotInterchangeable:true},
  runtime:'No app/lib/components/public/package/build/middleware changes against current main; preserve metadata, Paper, edition selection, shared score source, PR51 and consent.',
},null,2)+'\n');
console.log(JSON.stringify({actionCounts,net:235,projected:3343,originalHashesVerified:Object.keys(originalManifest.files).length,followupOverlap:0,protectedDataUnchanged:true}));
