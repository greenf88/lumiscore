// Versioned draft packet; never an execution authorisation.
import fs from'node:fs';import{createHash}from'node:crypto';import{fileURLToPath}from'node:url';import{execFileSync}from'node:child_process';import{ROOT,readJson}from'./nl-scale-snapshot.mjs';
const plan=readJson(new URL('combined-draft/production-plan.json',ROOT));
const names=['combined-draft/production-plan.json','combined-draft/production-import.sql','combined-draft/production-dry-run.sql','combined-draft/production-rollback.sql','search-normalization/install.sql','search-normalization/rollback.sql','hosted-acceptance-matrix.json','hosted-own-profile-cleanup-proof.json','production-projection-readback.json'];
const files=Object.fromEntries(names.map(n=>[n,createHash('sha256').update(fs.readFileSync(new URL(n,ROOT))).digest('hex')]));
const body={status:'DRAFT_REVIEW_ONLY_NOT_RELEASE_OFFER',applicationBase:'9c74ecaa48f7a35830f713eed3528d46ba0466ad',files,proposedActions:plan.summary.actions,newWorks:plan.summary.newWorks,newDutchEditions:plan.summary.newDutchEditions,newDutchSummaries:plan.summary.newDutchSummaries,newCoverBindings:plan.summary.newCoverBindings,netDutchAvailability:plan.summary.netDutchAvailability,productionWrites:0};
fs.writeFileSync(new URL('review-hashes-draft.json',ROOT),JSON.stringify(body,null,2)+'\n');console.log({files:names.length,actions:body.proposedActions,net:body.netDutchAvailability});
if(process.argv.includes('--index')){
 const cwd=fileURLToPath(new URL('../../',ROOT)),safe='safe.directory='+cwd.replaceAll('\\','/').replace(/\/$/,'');
 for(const[n,expected]of Object.entries(files)){const bytes=execFileSync('git',['-c',safe,'show',':catalog/nl-scale-20261102/'+n],{cwd,maxBuffer:8*1024*1024});if(createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('Index differs from reviewed bytes '+n);}
 console.log({gitIndexHashesMatch:names.length});
}
