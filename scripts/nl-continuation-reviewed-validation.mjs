// Validate durable research, not a production approval or hosted acceptance substitute.
import fs from 'node:fs';import {ROOT,CACHE,PRIOR,hash} from './nl-continuation-bootstrap.mjs';
const read=u=>JSON.parse(fs.readFileSync(u));
const cases=fs.readFileSync(new URL('open-cases.jsonl',CACHE),'utf8').trim().split('\n').map(JSON.parse);
const rows=fs.readdirSync(ROOT).filter(f=>/^reviewed-\d+\.json$/.test(f)).map(f=>read(new URL(f,ROOT)));
const parked=read(new URL('catalog/nl-scale-20261102/release/production-plan.json',PRIOR));
if(hash(fs.readFileSync(new URL('catalog/nl-scale-20261102/release/production-plan.json',PRIOR)))!=='5fb007804c7784569fb1dfe8a5bbee3df15be580668c927c819bf53474e7edf5')throw Error('Parked PR71 plan drift');
const norm=s=>String(s??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const isbnOk=s=>/^\d{13}$/.test(s)&&[...s].reduce((n,c,i)=>n+Number(c)*(i%2?3:1),0)%10===0;
const result=[];
for(const r of rows){
 const c=cases.find(c=>c.caseNumber===r.caseNumber);if(!c||c.candidateId!==r.candidateId)throw Error('Source identity missing');
 if(r.proposedWork?.type&&!['novel','novella','short_story','collection','audiobook_original'].includes(r.proposedWork.type))throw Error('Proposed database Work type not supported by current CHECK '+r.caseNumber);
 if(r.summary?.text){const n=r.summary.text.trim().split(/\s+/).length;if(n<50||n>105||r.summary.language!=='nl')throw Error('Summary bounds/language '+r.caseNumber);}
 if(r.status.startsWith('approved_')){
  // Legacy/source-reviewed dossiers deliberately retain importApproved:false until
  // a separate executable manifest is approved. That is not missing source proof.
  if(!r.cover?.sha256||!r.summary?.text||!r.presentationSource||!r.sources?.length||!isbnOk(r.edition?.isbn13))throw Error('Source-approved proposal missing evidence '+r.caseNumber);
  const cover=read(new URL(r.cover.receipt,ROOT));if(cover.sha256!==r.cover.sha256||cover.bytes!==r.cover.bytes)throw Error('Cover evidence drift');
 }
 const keys=new Set(c.identityChecks.map(x=>x.sourceWorkKey.replace('/works/','')));if(r.proposedWork?.sourceWorkKey)keys.add(r.proposedWork.sourceWorkKey.replace('/works/',''));
 // Existing bindings are context, not necessarily actions. Match actual parked actions only.
 const exact=parked.actions.filter(a=>(a.relation==='works'&&((Number.isSafeInteger(r.workId)&&a.key.id===r.workId)||keys.has(a.after?.open_library_id)))||(a.relation==='editions'&&((r.edition?.sourceKey&&a.key.open_library_edition_id===r.edition.sourceKey)||(r.edition?.isbn13&&a.after?.isbn_13===r.edition.isbn13)))||(a.relation==='catalog_work_descriptions'&&Number.isSafeInteger(r.workId)&&a.key.work_id===r.workId&&a.key.language==='nl'));
 const titleOnly=parked.actions.filter(a=>a.relation==='works'&&[c.title,r.edition?.title,r.proposedWork?.originalTitle].some(t=>norm(t)&&norm(a.after?.title)===norm(t))).map(a=>({ref:a.ref,title:a.after.title,meaning:'Name-only signal; not proof of identical Work'}));
 result.push({caseNumber:r.caseNumber,candidateId:r.candidateId,workId:r.workId,status:r.status,exactParkedActionMatches:exact.map(a=>({ref:a.ref,relation:a.relation,key:a.key})),titleOnlySignals:titleOnly});
}
const output={at:new Date().toISOString(),parkedHead:'c7f6e10dc11aab87a9d0f9cbb9545a73342bf1f6',reviewedSourceRows:rows.length,meaning:'Research dossier validation and collision screening; no new SQL generation or writes; name signals require manual decision',rows:result};
fs.writeFileSync(new URL('reviewed-validation.json',ROOT),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({checked:rows.length,exactMatches:result.filter(r=>r.exactParkedActionMatches.length),titleSignals:result.filter(r=>r.titleOnlySignals.length).map(r=>({caseNumber:r.caseNumber,signals:r.titleOnlySignals}))},null,2));
