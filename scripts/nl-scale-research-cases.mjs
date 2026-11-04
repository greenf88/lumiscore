import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {ROOT,OUTPUT,readJson,loadSnapshot} from './nl-scale-snapshot.mjs';
import {norm} from './nl-scale-identity.mjs';
const snap=loadSnapshot(),cache=new URL('../.research-cache/nl-scale-20261102/',import.meta.url);
const pool=fs.readFileSync(new URL('candidate-pool.jsonl',ROOT),'utf8').trim().split('\n').map(JSON.parse);
const available=pool.filter(x=>!x.priorResearched&&x.editionCandidates.length);
const newly=available.filter(x=>!x.workId),existing=available.filter(x=>x.workId);
const baseSelected=[...newly,...existing.slice(0,1000-newly.length)];
const supplement=process.argv.includes('--supplement');
const selected=supplement?available.filter(x=>!baseSelected.some(b=>b.candidateId===x.candidateId)).slice(0,1):baseSelected;
if(!supplement&&(selected.length!==1000||newly.length<300))throw Error('Research phase must include 1000 dossiers / 300 possible new Works');
if(supplement&&selected.length!==1)throw Error('One unique replacement source dossier required');
const sources=new Map(readJson(new URL('works-extract.json',cache)).records.map(x=>[x.record.key,x]));
const kb=readJson(new URL('sources/kb-normalized-facts.json',ROOT)).books;
const kbByIsbn=new Map();for(const b of kb)for(const isbn of b.isbns??[b.isbn]){const r=kbByIsbn.get(isbn)??[];r.push(b);kbByIsbn.set(isbn,r);}
const authorSource=new Map(readJson(new URL('authors-extract.json',cache)).records.map(x=>[x.record.key,x]));
const rawAuthors=new Map(snap.authors.map(x=>[x.id,x]));
const isbn13=value=>{const x=String(value).replace(/[-\s]/g,'');if(x.length===13)return x;const p='978'+x.slice(0,9);return p+((10-[...p].reduce((n,c,i)=>n+Number(c)*(i%2?3:1),0)%10)%10)};
const cases=[];
for(let i=0;i<selected.length;i++){
 const row=selected[i],work=snap.works.find(w=>w.id===row.workId),currentAuthor=rawAuthors.get(work?.author_id);
 const sourceFacts=row.sourceWorkKeys.map(k=>sources.get(k)).filter(Boolean);
 const allAuthors=[...new Set(sourceFacts.flatMap(s=>(s.record.authors??[]).map(x=>x.author?.key)))].filter(Boolean).map(k=>authorSource.get(k)).filter(Boolean).map(x=>({key:x.record.key,name:x.record.name,alternateNames:x.record.alternate_names??[],sourceSha256:x.recordSha256,sourceUrl:'https://openlibrary.org'+x.record.key}));
 const names=allAuthors.flatMap(a=>[a.name,...a.alternateNames]).filter(Boolean);
 const authorBound=!work||allAuthors.some(a=>currentAuthor?.open_library_id?.replace('/authors/','')===a.key.replace('/authors/','')||[a.name,...a.alternateNames].some(n=>norm(n)===norm(work.author)));
 const editionReviews=row.editionCandidates.map(e=>{
  const isbns=[...new Set([...e.record.isbn_13,...e.record.isbn_10].map(isbn13))];
  const bs=[...new Map([...isbns,...e.record.isbn_10].flatMap(i=>kbByIsbn.get(i)??[]).map(b=>[b.uri,b])).values()];
  const titleBase=x=>norm(String(x??'').split(/\s+:\s+/)[0]);
  const titleConfirmed=Boolean(e.title)&&bs.some(b=>b.titles.some(t=>titleBase(t)===titleBase(e.title)));
  const languageConfirmed=bs.some(b=>b.languages.length===1&&b.languages[0]==='nl');
  const kbAuthors=bs.flatMap(b=>b.authors.flatMap(a=>[...a.names,...a.alternateNames]));
  const authorConfirmed=kbAuthors.some(a=>names.some(n=>norm(n)===norm(a)));
  const current=snap.editions.filter(c=>e.record.isbn_13.includes(c.isbn_13)||e.record.isbn_10.includes(c.isbn_10)||c.open_library_edition_id?.replace('/books/','')===e.record.key.replace('/books/',''));
  const problems=[];
  if(!e.title?.trim())problems.push('source_edition_title_missing');
  if(isbns.length!==1)problems.push('multiple_distinct_ISBNs_require_exact_edition_review');
  if(!authorBound)problems.push('current_author_binding_conflict');
  if(row.identityChecks.some(c=>c.conflict))problems.push('multiple_current_work_identity_matches');
  if(current.some(c=>c.work_id!==row.workId))problems.push('edition_already_bound_to_another_current_work');
  if(bs.length&&!titleConfirmed)problems.push('KB_title_differs_from_source_edition');
  if(bs.length&&!languageConfirmed)problems.push('KB_language_not_independently_confirmed_as_nl');
  if(bs.length&&kbAuthors.length&&!authorConfirmed)problems.push('KB_author_differs_or_alias_requires_review');
  if(!e.record.publishers.length)problems.push('publisher_missing');
  if(/\b(?:omnibus|trilogie|verzamelde|collected|complete|abridged|verkort|bewerking|bundel)\b/i.test([e.title,e.record.edition_name,sourceFacts[0]?.record.title].join(' ')))problems.push('bundle_or_adaptation_requires_review');
  return {editionKey:e.record.key,title:e.title,isbn13:isbns,language:e.record.languages.map(x=>x.key),format:e.record.physical_format,publisher:e.record.publishers,date:e.record.publish_date,byStatement:e.record.by_statement,coverIds:e.record.covers,currentMatches:current.map(c=>({id:c.id,workId:c.work_id,language:c.language,title:c.title})),kbRecords:bs.map(b=>({uri:b.uri,titles:b.titles,languages:b.languages,formats:b.formats,authors:b.authors.map(a=>a.names).flat(),authorAliases:b.authors.map(a=>a.alternateNames).flat(),originals:b.originals,descriptionCandidates:b.descriptionCandidates,sources:b.sources})),titleConfirmed,languageConfirmed,authorConfirmed,problems,reviewStatus:'awaiting_substantive_review'};
 });
 const retained=snap.descriptions.filter(d=>d.work_id===row.workId&&d.language==='nl'&&d.review_status==='approved');
 const texts=sourceFacts.map(s=>({workKey:s.record.key,title:s.record.title,text:typeof s.record.description==='string'?s.record.description:s.record.description?.value??null,sourceUrl:'https://openlibrary.org'+s.record.key,sourceSha256:s.recordSha256,subjects:s.record.subjects??[]}));
 const dossier={caseNumber:(supplement?1000:0)+i+1,candidateId:row.candidateId,workId:row.workId,stream:row.stream,title:row.title,author:row.author,currentWork:work??null,currentNlAvailable:row.currentNlAvailable,authorBound,sourceAuthors:allAuthors,identityChecks:row.identityChecks,editionReviews,existingNlSummaries:retained.map(d=>({text:d.text,sourceUrl:d.source_url,reviewedAt:d.reviewed_at,reviewBatch:d.review_batch})),contentSources:texts,popularitySignals:row.popularitySignals,review:{status:'not_yet_researched',notAutomaticallyApproved:true},testStatus:'not_installed',hostedAcceptance:'not_proven'};
 cases.push(dossier);
}
const raw=cases.map(x=>JSON.stringify(x)).join('\n')+'\n';
const cacheName=supplement?'research-supplement-001.jsonl':'research-cases.jsonl';
const selectionName=supplement?'research-selection-supplement-001.json':'research-selection.json';
if(supplement&&fs.existsSync(new URL(cacheName,cache)))throw Error('Supplement already recorded; preserve original selection and replacement');
fs.writeFileSync(new URL(cacheName,cache),raw);
fs.writeFileSync(new URL(selectionName,ROOT),JSON.stringify({cases:cases.length,possibleNew:selected.filter(x=>!x.workId).length,existing:selected.filter(x=>x.workId).length,selectionSha256:createHash('sha256').update(raw).digest('hex'),sourceCandidateIds:selected.map(x=>x.candidateId),policy:supplement?'One replacement for independently confirmed duplicate source identity; original1000 source selection remains immutable.':'Unresearched exact printed-source dossiers. All337possible-new cases included. Existing dossiers ordered by separate Dutch list/SEO signal then global rating rows. Automated triage is not a substantive decision.'},null,2)+'\n');
fs.mkdirSync(new URL('review-packets/',OUTPUT),{recursive:true});
for(let start=0;start<cases.length;start+=20){
 const packet=cases.slice(start,start+20).map(d=>({
  case:d.caseNumber,id:d.candidateId,workId:d.workId,original:d.title,author:d.author,currentNl:d.currentNlAvailable,retainedSummary:d.existingNlSummaries.length,authorBound:d.authorBound,
  authors:d.sourceAuthors.map(a=>a.name),identity:d.identityChecks,
  editions:d.editionReviews.map(e=>({key:e.editionKey,title:e.title,isbn:e.isbn13,format:e.format,publisher:e.publisher,by:e.byStatement,kb:e.kbRecords.map(b=>({uri:b.uri,titles:b.titles,authors:b.authors,language:b.languages,original:b.originals})),problems:e.problems,cover:e.coverIds})),
  content:d.contentSources.map(c=>({title:c.title,text:c.text,source:c.sourceUrl,subjects:c.subjects.slice(0,12)}))
 }));
 fs.writeFileSync(new URL('review-packets/'+(supplement?'supplement-':'')+String(start+1).padStart(4,'0')+'.json',OUTPUT),JSON.stringify(packet,null,2)+'\n');
 const compact=cases.slice(start,start+20).map(d=>({
  case:d.caseNumber,id:d.candidateId,title:d.title,author:d.author,currentNl:d.currentNlAvailable,retainedSummary:d.existingNlSummaries.length,
  authorBound:d.authorBound,sourceAuthors:d.sourceAuthors.map(a=>a.name),
  editions:d.editionReviews.map(e=>({key:e.editionKey,title:e.title,isbn:e.isbn13,format:e.format,publisher:e.publisher,kb:e.kbRecords.map(b=>({uri:b.uri,titles:b.titles,authors:b.authors,aliases:b.authorAliases,original:b.originals.flatMap(o=>o.properties['http://www.w3.org/2000/01/rdf-schema#label']??[]).map(x=>x.value)})),problems:e.problems})),
  content:d.contentSources.map(c=>({title:c.title,text:c.text,source:c.sourceUrl}))
 }));
 fs.writeFileSync(new URL('review-packets/'+(supplement?'supplement-':'')+String(start+1).padStart(4,'0')+'.compact.json',OUTPUT),JSON.stringify(compact)+'\n');
}
console.log(JSON.stringify({cases:cases.length,new:newly.length,currentNl:cases.filter(c=>c.currentNlAvailable).length,withRetainedSummary:cases.filter(c=>c.existingNlSummaries.length).length,withText:cases.filter(c=>c.contentSources.some(s=>s.text?.length>=150)).length,noProblemIndependentEdition:cases.filter(c=>c.editionReviews.some(e=>!e.problems.length&&e.titleConfirmed&&e.languageConfirmed&&e.authorConfirmed)).length,identityFlags:cases.filter(c=>c.editionReviews.some(e=>e.problems.length)).length}));
