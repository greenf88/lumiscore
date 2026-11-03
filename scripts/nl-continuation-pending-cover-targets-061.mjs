// Enumerate unverified fronts from exact already-investigated edition records.
// Never retry failed HTTP members, known placeholders, conflicting versions or frozen rows.
import fs from 'node:fs';import {ROOT,CACHE} from './nl-continuation-bootstrap.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),cs=fs.readFileSync(new URL('open-cases.jsonl',CACHE),'utf8').trim().split('\n').map(JSON.parse),rows=fs.readdirSync(ROOT).filter(f=>/^reviewed-\d+\.json$/.test(f)).map(f=>read(new URL(f,ROOT)));
if(['cover-large-bulk-request-017.json','cover-largezip-request-023.json'].some(n=>fs.existsSync(new URL(n,ROOT))))throw Error('This one-time selection is already frozen; use a new explicitly reviewed phase, never refresh an active manifest');
const attempts=fs.readdirSync(ROOT).filter(f=>/^cover.*readback.*\.json$/.test(f)).flatMap(f=>{const r=read(new URL(f,ROOT));return Array.isArray(r)?r:[];});
const placeholders=new Set([228,251,955]);const targets=[],skipped=[];
for(const r of rows.filter(r=>r.status==='substantive_review_complete_cover_pending')){
 const c=cs.find(c=>c.caseNumber===r.caseNumber),e=c.editionReviews.find(e=>e.editionKey==='/books/'+r.edition.sourceKey);
 if(placeholders.has(r.caseNumber)){skipped.push({caseNumber:r.caseNumber,reason:'Known placeholder or provisional cover; independently verified replacement needed'});continue;}
 const possible=e?.coverIds??[],id=possible.find(id=>{const g=Math.floor(id/1e6);return g>=5&&g<=6||g>=8&&g<=14;});
 if(!id){skipped.push({caseNumber:r.caseNumber,reason:'No available exact member in reviewed official large groups5/6 or8..14; groups3/4 lack official ol_exports provenance, groups7/15 unavailable, no repeated probing'});continue;}
 const receipt=new URL('cover-'+(id>9e6?'normal-':'')+id+'.json',ROOT);
 if(fs.existsSync(receipt)&&read(receipt).sha256){skipped.push({caseNumber:r.caseNumber,coverId:id,reason:'Successful receipt already exists; semantic review still required'});continue;}
 if(attempts.some(t=>t.coverId===id&&/failure|stop|missing_or_ambiguous/.test(t.status??''))){skipped.push({caseNumber:r.caseNumber,coverId:id,reason:'Prior source failure; no identical retry'});continue;}
 targets.push({caseNumber:r.caseNumber,candidateId:r.candidateId,editionKey:'/books/'+r.edition.sourceKey,isbn13:r.edition.isbn13,title:r.edition.title,coverId:id,notImportApproval:true});
}
const tar=targets.filter(t=>Math.floor(t.coverId/1e6)<=6),zip=targets.filter(t=>Math.floor(t.coverId/1e6)>=8);
if(tar.length>100||zip.length>40)throw Error('Split bounded cover manifests');
for(const[file,ts]of[['cover-large-bulk-request-017.json',tar],['cover-largezip-request-023.json',zip]])fs.writeFileSync(new URL(file,ROOT),JSON.stringify({purpose:'Exact pending edition fronts; bounded official bulk review, no approval',targets:ts},null,2)+'\n');
fs.writeFileSync(new URL('pending-cover-selection-061.json',ROOT),JSON.stringify({at:new Date().toISOString(),targets,skipped},null,2)+'\n');console.log({tar:tar.length,zip:zip.length,skipped:skipped.length});
