// Read-only reviewer workboard; no automatic approvals or source-body export.
import fs from 'node:fs';
import {loadCases} from './nl-scale-case-store.mjs';
import {loadReviews} from './nl-scale-reviews.mjs';
import {ROOT,readJson} from './nl-scale-snapshot.mjs';
const reviews=loadReviews(),done=new Set(readJson(new URL('final-research-decisions.json',ROOT)).decisions.map(x=>x.candidateId));
const covers=fs.readdirSync(ROOT).filter(f=>/^cover-semantic-review-/.test(f)).flatMap(f=>readJson(new URL(f,ROOT)).reviews);
const mode=process.argv[2]??'covered',start=Number(process.argv[3]??0),limit=Number(process.argv[4]??12);
const todo=loadCases().cases.filter(c=>!done.has(c.candidateId)&&(mode!=='covered'||(reviews.get(c.candidateId)?.text&&covers.some(k=>k.candidateId===c.candidateId&&k.status==='front_title_author_consistent_with_bound_source'))));
console.log(JSON.stringify({mode,total:todo.length,start,limit}));
for(const c of todo.slice(start,start+limit)){
 const r=reviews.get(c.candidateId);
 console.log(JSON.stringify({n:c.caseNumber,id:c.candidateId,title:c.title,authors:c.sourceAuthors.map(a=>({key:a.key,name:a.name})),content:{facts:r.facts,note:r.note,text:r.text,reference:r.reference,additionalSources:r.additionalSources},editions:c.editionReviews.map(e=>({key:e.editionKey,title:e.title,isbn:e.isbn13,format:e.format,publisher:e.publisher,languageConfirmed:e.languageConfirmed,titleConfirmed:e.titleConfirmed,authorConfirmed:e.authorConfirmed,problems:e.problems,kb:e.kbRecords.map(k=>({uri:k.uri,title:k.titles,authors:k.authors,original:k.originals.map(o=>o.properties['http://www.w3.org/2000/01/rdf-schema#label']?.map(v=>v.value)),notes:k.descriptionCandidates?.map(d=>d.text)})),covered:covers.find(k=>k.candidateId===c.candidateId&&k.editionKey===e.editionKey)?.status}))}));
}
