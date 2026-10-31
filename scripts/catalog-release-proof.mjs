// Offline evidence/hash validation. No network, credentials or database writes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {renderImport,renderRollback} from './catalog-release-sql.mjs';
const root=new URL('../',import.meta.url),dir=new URL('catalog/release-20261031/',root);
const read=n=>JSON.parse(fs.readFileSync(new URL(n,dir),'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const plan=read('release-plan.json');
assert.equal(plan.actions.length,686);
assert.equal(plan.summary.texts.nl,215);assert.equal(plan.summary.texts.en,119);
assert.equal(plan.summary.texts.uniqueWorks,312);assert.equal(plan.summary.nlAvailability.net,109);
for(const [name,expected] of Object.entries({'production-import.sql':renderImport(plan),'production-dry-run.sql':renderImport(plan,{dryRun:true}),'production-rollback.sql':renderRollback(plan)})){
 const actual=fs.readFileSync(new URL(name,dir));assert.equal(actual.toString('utf8'),expected,name+' differs from reviewed renderer');
 assert.equal(hash(actual),read('import-hashes.json')[name]);
}
const files=read('artifact-hashes.json').map(x=>x.file);
const hashes=files.map(file=>({file,sha256:hash(fs.readFileSync(new URL(file,root)))}));
if(process.argv.includes('--write-hashes'))fs.writeFileSync(new URL('artifact-hashes.json',dir),JSON.stringify(hashes,null,2)+'\n');
else for(const item of read('artifact-hashes.json'))assert.equal(item.sha256,hashes.find(x=>x.file===item.file).sha256,'Stale hash '+item.file);
if(process.argv.includes('--git'))for(const item of hashes){
 const committed=execFileSync('git',['show','HEAD:'+item.file],{cwd:root,encoding:'buffer',maxBuffer:4*1024*1024});
 assert.equal(hash(committed),item.sha256,'Git blob differs '+item.file);
}
const lineage=read('summary-lineage-and-code-proof.json');
assert.equal(lineage.releaseRecords,334);assert.equal(lineage.releaseUniqueWorks,312);assert(lineage.canonicalRuntimeBlobsEqual);
const browser=read('hosted-validation-summary.json');assert.equal(browser.pagination.length,6);
assert(browser.pagination.every(p=>p.uniqueCards===16&&p.allHaveConfirmedLocale));
const recovery=read('recovery-committed-20261031.json');
assert.equal(recovery.project,'hlvujbrmfdlrfxdjwsmb');assert.equal(recovery.productionWrites,0);
assert.equal(recovery.committedUndoProved,true);assert(Object.values(recovery.checks).every(v=>v===true));
assert.equal(recovery.before.work.id,959100031);assert.equal(recovery.before.edition.id,959200031);
assert.equal(recovery.after.work,null);assert.equal(recovery.after.edition,null);
assert.equal(recovery.after.counts.works,recovery.before.counts.works-1);
assert.equal(recovery.after.counts.editions,recovery.before.counts.editions-1);
assert.equal(recovery.before.preservedTables.length,16);assert.equal(recovery.before.sequences.length,4);
assert.deepEqual(recovery.before.preservedTables,recovery.after.preservedTables);
assert.deepEqual(recovery.before.sequences,recovery.after.sequences);
assert(recovery.after.dependencies.every(d=>d.count===0));
for(const [name,sha] of Object.entries(recovery.artifacts))assert.equal(hash(fs.readFileSync(new URL(name,dir))),sha);
for(const [name,sha] of Object.entries(read('recovery-committed-hashes.json')))assert.equal(hash(fs.readFileSync(new URL(name,dir))),sha,'Recovery proof hash '+name);
const authFile=new URL('authenticated-validation-summary.json',dir);
const auth=fs.existsSync(authFile)?JSON.parse(fs.readFileSync(authFile,'utf8')):null;
console.log(JSON.stringify({actions:686,texts:334,works:312,netNlWorks:109,hashedFiles:hashes.length,gitVerified:process.argv.includes('--git'),hostedPublicChecks:browser.checks,authenticatedBrowserProved:Boolean(auth?.themeLocaleDeviceCases===8&&auth?.verifiedLocaleSelections===40)}));
