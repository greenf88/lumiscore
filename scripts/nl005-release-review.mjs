// Produce the smaller reviewed release; NEVER rewrite original execution receipts.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {renderImport,renderRollback} from './catalog-release-sql.mjs';
const dir='catalog/nl-research-005-20261101/';
const read=n=>JSON.parse(fs.readFileSync(dir+n));
const save=(n,v)=>fs.writeFileSync(dir+n,typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');
const hash=n=>createHash('sha256').update(fs.readFileSync(dir+n)).digest('hex');
const excluded=new Set([48,65]),old=read('release-candidates.json').dossiers;
const kept=old.filter(d=>!excluded.has(d.workId));
assert.equal(kept.length,48);assert.equal(kept.reduce((n,d)=>n+d.netExtraDutchWorks,0),43);
const cleanup=read('test-review-collection-cleanup-proof.json');
assert(cleanup.collectionRemoved&&cleanup.membersRemoved&&cleanup.otherPublicRecordsUnchanged&&cleanup.protectedUnchanged);
save('release-candidates-v2.json',{state:'ONLY current release candidate version. v1 remains historical, not executable approval.',dossiers:kept});
const index=read('production-import-index.json'),batches=[];
for(const b of index.batches){
 const p=read(b.prefix+'-production-plan.json'),prefix=b.prefix+'-v2';
 p.summary.batch+='-v2';
 p.actions=p.actions.filter(a=>!excluded.has(a.after.work_id));
 p.bindings=p.bindings.filter(b=>!excluded.has(b.work.id));
 const candidates=kept.filter(d=>old.slice((Number(b.prefix.slice(-2))-1)*10,Number(b.prefix.slice(-2))*10).some(x=>x.candidateId===d.candidateId));
 save(prefix+'-production-plan.json',p);save(prefix+'-production-apply.sql',renderImport(p));
 save(prefix+'-production-dry-run.sql',renderImport(p,{dryRun:true}));save(prefix+'-production-rollback.sql',renderRollback(p));
 const files=Object.fromEntries(['plan.json','apply.sql','dry-run.sql','rollback.sql'].map(s=>{const n=prefix+'-production-'+s;return[n,hash(n)];}));
 batches.push({prefix,works:candidates.length,actions:p.actions.length,newWorks:candidates.filter(d=>d.newWork).length,netNl:candidates.reduce((n,d)=>n+d.netExtraDutchWorks,0),files});
}
assert.equal(batches.reduce((n,b)=>n+b.actions,0),156);
save('production-import-index-v2.json',{state:'Current review-only version; supersedes all v1 production plans as a release choice. No approval/execution.',applicationBase:index.applicationBase,project:index.project,batches,existingWorks:38,newWorks:10,newEditions:44,netExtraDutchWorks:43,actualProductionDelta:0});
const variants=read('hosted-50-presentations.json').filter(r=>excluded.has(r.productionWorkId));
assert.equal(variants.length,2);
save('excluded-variant-proposals.json',{reason:'Exact proposed edition not selected hosted. No edition override parameter; do not alter correct existing test editions or ranking to force proof.',dossiers:old.filter(d=>excluded.has(d.workId)).map(d=>({productionWorkId:d.workId,proposedIsbn:d.edition.isbn13,hostedVariant:variants.find(v=>v.productionWorkId===d.workId),excludedActions:2,sourceVerified:true,notAnAbsenceFinding:true})),productionWrites:0});
save('hosted-release-48-presentations.json',read('hosted-50-presentations.json').filter(r=>!excluded.has(r.productionWorkId)));
const oldManifest=read('release-hashes.json');
save('release-hashes-v2.json',{state:'CURRENT REVIEW ONLY; no production approval. Supersedes v1 manifest0cb3636b... in its entirety; never combine.',applicationSha:oldManifest.applicationSha,productionBase:oldManifest.productionBase,productionProject:oldManifest.productionProject,scope:{existingWorks:38,newWorks:10,newCatalogueAuthors:6,newPrintedNlEditions:44,coverFormatBindings:48,newOriginalNlSummaries:48,actions:156,netExtraNlWorksIfApproved:43},productionFiles:Object.fromEntries(batches.flatMap(b=>Object.entries(b.files))),sourceFiles:Object.fromEntries(['release-candidates-v2.json','excluded-variant-proposals.json','production-import-index-v2.json','production-release-review-readonly.json','release-v2-global-identity-readonly.json','hosted-release-48-presentations.json','test-review-collection-cleanup-proof.json','cover-size-review-24.json','hosted-large-cover-loads.json'].map(n=>[n,hash(n)])),installation:'No new migration/DDL. Five v2 chunks only after future approval. Never execute v1, test seed, fixture or review grouping SQL on production.',recovery:'First committed receipts required. Reverse v2 chunks05 to01, full-row CAS/all incoming FKs. Original186+2 actual committed recovery retained; exact v2 subset also tested locally.',testOnlyExtraRows:'32 seeds +154 original test core +2 existing fixture bindings. Four excluded test-only catalogue rows remain deliberately untouched. Review grouping51 removed and remaining public/protected digests unchanged.'});
console.log(JSON.stringify({actions:156,net:43,manifestSha256:hash('release-hashes-v2.json'),batches:batches.map(b=>b.actions)}));
