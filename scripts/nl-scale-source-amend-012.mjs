// Explicit evidence-bound single-field amendment; not a URL-validation relaxation.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {ROOT,readJson} from './nl-scale-snapshot.mjs';
import {renderImport,renderRollback} from './nl-scale-release-sql.mjs';
const before='https://www.dbnl.org/tekst/anbe001lexi01_01/lvlw00134.php?q=gemoderniseerd';
const after='https://www.dbnl.org/tekst/anbe001lexi01_01/lvlw00134.php';
const dir=new URL('subbatches/012/',ROOT),archive=new URL('superseded-source-url-v1/',dir);
fs.mkdirSync(archive,{recursive:true});
for(const name of fs.readdirSync(dir))if(fs.statSync(new URL(name,dir)).isFile()&&!fs.existsSync(new URL(name,archive)))fs.copyFileSync(new URL(name,dir),new URL(name,archive));
for(const env of ['production','test']){
 const plan=readJson(new URL(env+'-plan.json',archive));
 const row=plan.actions.find(a=>a.relation==='catalog_work_descriptions'&&[1193,987111006].includes(a.after.work_id));
 if(row.after.source_url!==before)throw Error('Unexpected immutable source preimage');
 row.after.source_url=after;
 const bodies={[env+'-plan.json']:JSON.stringify(plan,null,2)+'\n',[env+'-import.sql']:renderImport(plan,{canary:env==='test'}),[env+'-dry-run.sql']:renderImport(plan,{dryRun:true,canary:env==='test'}),[env+'-rollback.sql']:renderRollback(plan)};
 for(const[n,b]of Object.entries(bodies))fs.writeFileSync(new URL(n,dir),b);
 fs.writeFileSync(new URL(env+'-hashes.json',dir),JSON.stringify(Object.fromEntries(Object.entries(bodies).map(([n,b])=>[n,createHash('sha256').update(b).digest('hex')])),null,2)+'\n');
}
const finalFile=new URL('final-research-decisions.json',ROOT),final=readJson(finalFile),decision=final.decisions.find(d=>d.candidateId==='work:1193');
if(![before,after].includes(decision.summary.sourceUrl))throw Error('Unexpected final decision source');
decision.summary.sourceUrl=after;fs.writeFileSync(finalFile,JSON.stringify(final,null,2)+'\n');
fs.writeFileSync(new URL('source-url-amendment.json',dir),JSON.stringify({reviewedAt:new Date().toISOString(),candidateId:'work:1193',before,after,changedFieldOnly:'catalog_work_descriptions.source_url',reason:'The same independently read DBNL article is available without its optional highlight query. Existing application rejects arbitrary source queries. Do not weaken source validation.',sourceChecked:'2026-11-02',archive:'superseded-source-url-v1/',productionWrites:0},null,2)+'\n');
console.log({plannedFieldChanged:'source_url',productionWrites:0});
