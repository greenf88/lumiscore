// Local materialisation of five source-reviewed, observed Work-year corrections.
// No network/database client; these are already-counted dossiers, not new books.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {ROOT,readJson} from './nl-scale-snapshot.mjs';
import {loadCases} from './nl-scale-case-store.mjs';
import {renderImport,renderRollback} from './nl-scale-release-sql.mjs';
const dir=new URL('subbatches/051/',ROOT),input=readJson(new URL('reviewed-year-corrections.json',dir));
const cases=loadCases().cases;
if(input.rows.length!==5||new Set(input.rows.map(r=>r.workId)).size!==5)throw Error('Exact five reviewed Works required');
const production=readJson(new URL('production-preflight.json',dir)).readback;
for(const environment of ['production','test']){
 const pre=readJson(new URL(environment+'-preflight.json',dir)).readback,bindings=[],actions=[];
 for(const [i,r]of input.rows.entries()){
  const c=cases.find(c=>c.candidateId===r.candidateId&&c.workId===r.workId);
  const original=production.works.find(w=>w.id===r.workId);
  const w=pre.works.find(w=>w.id===(environment==='test'?r.testWorkId:r.workId));
  const a=pre.authors.find(a=>a.id===w?.author_id),pa=production.authors.find(a=>a.id===original?.author_id);
  if(!c||!original||!w||!a||!pa||!r.reason||!Number.isInteger(r.to)||r.to<1400||r.to>2026||r.to===r.from||w.first_publish_year!==r.from)throw Error('Unbound or changed reviewed Work/year');
  if(w.open_library_id!==original.open_library_id||w.title!==original.title||a.open_library_id!==pa.open_library_id)throw Error('Test/production Work or author identity differs');
  const expected=c.editionReviews.flatMap(e=>e.kbRecords.map(k=>({source:k.uri.replace('http:','https:'),originalReferences:k.originals})));
  if(JSON.stringify(expected)!==JSON.stringify(r.bibliographicEvidence))throw Error('Independent original bibliography changed');
  const labels=expected.flatMap(k=>k.originalReferences.flatMap(o=>(o.properties['http://www.w3.org/2000/01/rdf-schema#label']??[]).map(v=>v.value)));
  if(!labels.some(s=>new RegExp('(?:^|[^0-9])'+r.to+'(?:[^0-9]|$)').test(s)))throw Error('Reviewed year absent from exact original bibliography');
  bindings.push({work:w,author:a});
  actions.push({ref:'year'+i,relation:'works',key:{id:w.id},before:w,after:{...w,first_publish_year:r.to}});
 }
 const plan={summary:{batch:'nl-scale-20261102-051',target:environment==='test'?'hlvujbrmfdlrfxdjwsmb':'qvplwejffhjvxaypmjut',scope:'Five explicit original-publication-year corrections only; not a new research or availability count',actions:5,newWorks:0,newDutchEditions:0,newDutchSummaries:0,newCoverBindings:0,missingVerifiedCovers:0,correctedOriginalYears:5,netDutchAvailability:0},bindings,authorCorpora:[],actions};
 const files={[environment+'-plan.json']:JSON.stringify(plan,null,2)+'\n',[environment+'-import.sql']:renderImport(plan,{canary:environment==='test'}),[environment+'-dry-run.sql']:renderImport(plan,{dryRun:true,canary:environment==='test'}),[environment+'-rollback.sql']:renderRollback(plan)};
 for(const[n,body]of Object.entries(files))fs.writeFileSync(new URL(n,dir),body);
 fs.writeFileSync(new URL(environment+'-hashes.json',dir),JSON.stringify(Object.fromEntries(Object.entries(files).map(([n,body])=>[n,createHash('sha256').update(body).digest('hex')])),null,2)+'\n');
 console.log({environment,actions:actions.length,newWorks:0,netDutchAvailability:0});
}
