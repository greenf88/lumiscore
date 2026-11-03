import fs from'node:fs';
import{ROOT,CACHE}from'./nl-continuation-bootstrap.mjs';
const rows=fs.readFileSync(new URL('open-cases.jsonl',CACHE),'utf8').trim().split('\n').map(JSON.parse);
const args=process.argv.slice(2),numbers=args.filter(a=>/^\d+$/.test(a)).map(Number);
const selected=numbers.length?rows.filter(r=>numbers.includes(r.caseNumber)):JSON.parse(fs.readFileSync(new URL('queue.json',ROOT),'utf8')).cases.slice(0,20).map(r=>rows.find(c=>c.caseNumber===r.case));
for(const c of selected){
 const p=c.priorContentReview;
 console.log(JSON.stringify({case:c.caseNumber,id:c.candidateId,title:c.title,author:c.author,current:c.currentWork,currentNl:c.currentNlAvailable,authors:c.sourceAuthors.map(a=>({...a,alternateNames:a.alternateNames.slice(0,3)})),identity:c.identityChecks,editions:c.editionReviews.map(e=>({...e,kbRecordCount:e.kbRecords.length,kbRecords:e.kbRecords.slice(0,2).map(k=>({uri:k.uri,titles:k.titles,language:k.languages,format:k.formats,authors:k.authors,aliases:k.authorAliases.slice(0,3),original:k.originals.flatMap(o=>o.properties['http://www.w3.org/2000/01/rdf-schema#label']??[]).map(x=>x.value)}))})),content:c.contentSources.map(s=>({source:s.sourceUrl,text:s.text})),prior:p?{status:p.contentStatus,facts:p.facts,note:p.note,text:p.text,sources:p.additionalSources,reference:p.reference}:null,retained:c.existingNlSummaries},null,2));
}
