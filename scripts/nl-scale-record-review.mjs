// Materialise individually supplied reading decisions, never infer an approval.
// Input is a locally reviewed {entries:[{caseNumber,contentStatus,facts,note,text}]}.
// Copyrighted source bodies remain in ignored cache; only hashes/URLs are stored.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {ROOT,readJson} from './nl-scale-snapshot.mjs';
import {loadCases} from './nl-scale-case-store.mjs';
export function bindReviews(input,cases) {
 if(!Array.isArray(input.entries)||!input.entries.length)throw Error('Explicit review entries required');
 const used=new Set();
 return input.entries.map(r=>{
  if(!Number.isInteger(r.caseNumber)||used.has(r.caseNumber))throw Error('Duplicate/invalid case');
  used.add(r.caseNumber);
  const c=cases.find(c=>c.caseNumber===r.caseNumber);if(!c)throw Error('Unknown selected case');
  if(!r.contentStatus||!Array.isArray(r.facts)||!r.facts.length||r.facts.some(f=>typeof f!=='string'||!f.trim()))throw Error('Explicit substantive review required');
  if(r.text!=null){
   if(typeof r.text!=='string'||/[<>]/.test(r.text))throw Error('Invalid text');
   const count=r.text.trim().split(/\s+/).length;
   if(count<50||count>105)throw Error('Original draft length outside review bounds '+r.caseNumber);
  } else if(!r.note?.trim())throw Error('Unresolved review requires exact next evidence');
  if(/^(approved|complete|published|installed)$/.test(r.contentStatus))throw Error('Content review cannot grant import/release status');
  const {caseNumber,...review}=r;
  return {candidateId:c.candidateId,caseNumber,...review,
   sourceEvidence:{
    content:c.contentSources.map(s=>({url:s.sourceUrl,recordSha256:s.sourceSha256})),
    editions:c.editionReviews.map(e=>({key:e.editionKey,isbns:e.isbn13,kb:e.kbRecords.map(b=>({uri:b.uri,cacheReferences:b.sources}))})),
    bindingSha256:createHash('sha256').update(JSON.stringify({candidateId:c.candidateId,sourceAuthors:c.sourceAuthors,editionReviews:c.editionReviews,contentSources:c.contentSources})).digest('hex')
   }};
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 const [source,target]=process.argv.slice(2);if(!source||!/^content-review-\d{3}\.json$/.test(target??''))throw Error('Usage: node script input.json content-review-NNN.json');
 const input=readJson(pathToFileURL(source)),selection=readJson(new URL('research-selection.json',ROOT));
 const {cases,manifests}=loadCases(),entries=bindReviews(input,cases);
 const existing=fs.readdirSync(ROOT).filter(f=>/^content-review-\d+\.json$/.test(f));
 const seen=new Set(existing.flatMap(f=>readJson(new URL(f,ROOT)).entries.map(e=>e.candidateId)));
 if(entries.some(e=>seen.has(e.candidateId)))throw Error('Review already recorded; use an explicit amendment');
 const destination=new URL(target,ROOT);if(fs.existsSync(destination))throw Error('Refusing existing review overwrite');
 fs.writeFileSync(destination,JSON.stringify({reviewedOn:input.reviewedOn,scope:input.scope,sourceSelectionSha256:selection.selectionSha256,sourceSelectionManifests:manifests,entries},null,2)+'\n');
 console.log(JSON.stringify({file:target,individualReviews:entries.length,drafts:entries.filter(e=>e.text).length,importApproved:0}));
}
