import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {ROOT,readJson,loadSnapshot,priorRegister} from './nl-scale-snapshot.mjs';
import {norm} from './nl-scale-identity.mjs';
const cache=new URL('../.research-cache/nl-scale-20261102/',import.meta.url);
const snap=loadSnapshot(),prior=priorRegister();
const editions=readJson(new URL('editions-extract.json',cache));
const ws=readJson(new URL('works-extract.json',cache)).records;
const authorSource=readJson(new URL('authors-extract.json',cache)).records;
const key=s=>String(s??'').replace(/^\/(?:authors|works)\//,'');
const index=(rows,f)=>{const m=new Map();for(const r of rows){const k=f(r);if(!k)continue;const a=m.get(k)??[];a.push(r);m.set(k,a);}return m};
const groups=index(editions.entries,x=>x.workKey),worksByKey=new Map(snap.works.filter(w=>w.open_library_id).map(w=>['/works/'+key(w.open_library_id),w]));
const authors=new Map(authorSource.map(x=>[x.record.key,x.record]));
const authorsByKey=index(snap.authors,a=>key(a.open_library_id));
const worksById=new Map(snap.works.map(w=>[w.id,w]));
const productionIsbns=index(snap.editions,e=>(e.isbn_13||e.isbn_10)?.replace(/[-\s]/g,''));
const titleIndex=new Map();
function addTitle(workId,title){
 const work=worksById.get(workId);if(!work)return;
 const k=norm(title);if(!k)return;
 const rows=titleIndex.get(k)??[];if(!rows.some(r=>r.id===workId))rows.push(work);titleIndex.set(k,rows);
}
for(const w of snap.works)addTitle(w.id,w.title);
for(const e of snap.editions)addTitle(e.work_id,e.title);
for(const a of snap.aliases)addTitle(a.work_id,a.title);
const reviewed=new Set(prior.rows.filter(x=>x.closedInBoundedSourceReview||x.substantiveDecisionByCurrentCohort||x.substantiveDecisionByResearch004||x.research007?.completed).map(x=>x.workId));
const r007=readJson(new URL('../nl-research-007-20261101/release-candidates.json',ROOT)).dossiers;
const publishedNew=[];
for(const d of r007.filter(x=>x.newWork)){
 const exact=snap.editions.filter(e=>e.isbn_13===d.edition.isbn13);
 if(exact.length!==1)throw Error('Published PR68 ISBN absent/duplicated '+d.candidateId);
 const w=worksById.get(exact[0].work_id);
 if(norm(w.author)!==norm(d.author))throw Error('Published PR68 author drift');
 reviewed.add(w.id);publishedNew.push({candidateId:d.candidateId,workId:w.id,isbn13:d.edition.isbn13,publishedIn:'PR68',productionProof:'historical release 13f3a9a3ee7d9610f7f260019476846c997bf8c5 plus current exact ISBN/author read-only snapshot'});
}
const nl=new Set(snap.editions.filter(e=>['nl','nld','dut'].includes(e.language?.toLowerCase())).map(e=>e.work_id));
const desc=new Set(snap.descriptions.filter(d=>d.language==='nl'&&d.review_status==='approved').map(d=>d.work_id));
const pool=new Map(),sourceToId=new Map();
const sourceWorkByKey=new Map(ws.map(x=>[x.record.key,x]));
for(const [workKey,es] of groups){
 const source=sourceWorkByKey.get(workKey);
 if(!source)throw Error('Missing source Work '+workKey);
 const authorKeys=(source.record.authors??[]).map(a=>a.author?.key).filter(Boolean);
 const sourceAuthors=authorKeys.map(k=>({key:k,name:authors.get(k)?.name??null,aliases:authors.get(k)?.alternate_names??[]}));
 const exactOL=worksByKey.get(workKey);
 const isbnMatches=[...new Set(es.flatMap(e=>[...e.record.isbn_13,...e.record.isbn_10].flatMap(i=>(productionIsbns.get(i)??[]).map(x=>x.work_id))))];
 const authorIds=new Set(authorKeys.flatMap(k=>(authorsByKey.get(key(k))??[]).map(a=>a.id)));
 const names=new Set(sourceAuthors.flatMap(a=>[a.name,...a.aliases]).map(norm));
 const titles=[source.record.title,...es.map(e=>e.record.title)];
 const exactTitleAuthor=[...new Set(titles.flatMap(t=>(titleIndex.get(norm(t))??[]).filter(w=>authorIds.has(w.author_id)||names.has(norm(w.author))).map(w=>w.id)))];
 const possibleIds=[...new Set([...(exactOL?[exactOL.id]:[]),...isbnMatches,...exactTitleAuthor])];
 const current=exactOL??(possibleIds.length===1?worksById.get(possibleIds[0]):null);
 const conflict=possibleIds.length>1;
 const id=current?'work:'+current.id:'ol:'+key(workKey);
 sourceToId.set(workKey,id);
 const row=pool.get(id)??{candidateId:id,workId:current?.id??null,title:current?.title??source.record.title,author:current?.author??sourceAuthors.map(x=>x.name).join(' / '),sourceWorkKeys:[],sourceAuthorFacts:[],editionCandidates:[],popularitySignals:[],priorResearched:current?reviewed.has(current.id):false,currentNlAvailable:current?nl.has(current.id):false,currentApprovedNlSummary:current?desc.has(current.id):false,researchStatus:'not_yet_researched',publicationStatus:'proposal_only',sources:[],identityChecks:[]};
 row.sourceWorkKeys.push(workKey);row.sourceAuthorFacts.push(...sourceAuthors);row.editionCandidates.push(...es);
 row.popularitySignals.push(...es[0].popularitySignals);
 row.identityChecks.push({sourceWorkKey:workKey,exactOLWorkId:exactOL?.id??null,exactIsbnWorkIds:isbnMatches,exactTitleAuthorWorkIds:exactTitleAuthor,conflict,sourceRecordSha256:source.recordSha256});
 row.sources.push({kind:'official monthly bibliographic dump',url:'https://openlibrary.org'+workKey,checkedAt:editions.checkedAt,recordSha256:source.recordSha256});
 row.stream=current?(nl.has(current.id)?'A_review_existing_presentation':'B_add_dutch_edition'):'C_possible_new_work';
 pool.set(id,row);
}
const cpnb=readJson(new URL('sources/cpnb-ranking-facts.json',ROOT)).facts;
for(const f of cpnb){
 if(!f.title||!f.author||f.parseStatus!=='extracted_fact')continue;
 const exact=(titleIndex.get(norm(f.title))??[]).filter(w=>norm(w.author)===norm(f.author));
 const sourceExact=[...pool.values()].filter(x=>[x.title,...x.editionCandidates.map(e=>e.title)].some(t=>norm(t)===norm(f.title))&&(norm(x.author)===norm(f.author)||x.sourceAuthorFacts.some(a=>[a.name,...a.aliases].some(n=>norm(n)===norm(f.author)))));
 const matches=[...new Set([...exact.map(w=>'work:'+w.id),...sourceExact.map(x=>x.candidateId)])];
 const id=matches.length===1?matches[0]:'title:'+createHash('sha256').update(norm(f.title)+'|'+norm(f.author)).digest('hex').slice(0,20);
 const w=exact.length===1?exact[0]:null;
 const row=pool.get(id)??{candidateId:id,workId:w?.id??null,title:f.title,author:f.author,sourceWorkKeys:[],sourceAuthorFacts:[],editionCandidates:[],popularitySignals:[],priorResearched:w?reviewed.has(w.id):false,currentNlAvailable:w?nl.has(w.id):false,currentApprovedNlSummary:w?desc.has(w.id):false,researchStatus:'not_yet_researched',publicationStatus:'proposal_only',sources:[],identityChecks:[],stream:w?'A_review_existing_presentation':'C_possible_new_work',possibleExistingWorkIds:matches};
 row.popularitySignals.push({kind:f.signal,year:f.year,position:f.position,country:f.country,source:f.sourceUrl,sourceSha256:f.sourceSha256,checkedAt:f.checkedAt,notUniqueReaders:true,notEditionProof:true});pool.set(id,row);
}
// Existing unique Work IDs fill a broad reserve; they are not marked researched.
const ratings=readJson(new URL('rating-signals.json',cache));
for(const w of [...snap.works].sort((a,b)=>(ratings.works['/works/'+key(b.open_library_id)]?.count??0)-(ratings.works['/works/'+key(a.open_library_id)]?.count??0)||a.id-b.id)){
 if(pool.size>=2300)break;
 if(reviewed.has(w.id)||pool.has('work:'+w.id))continue;
 const keyOL='/works/'+key(w.open_library_id),s=ratings.works[keyOL];
 pool.set('work:'+w.id,{candidateId:'work:'+w.id,workId:w.id,title:w.title,author:w.author,sourceWorkKeys:w.open_library_id?[keyOL]:[],sourceAuthorFacts:[],editionCandidates:[],popularitySignals:s?[{kind:'public_rating_rows',count:s.count,region:'global; not Dutch-specific',source:ratings.source,period:'monthly snapshot 2026-09-30'}]:[],priorResearched:false,currentNlAvailable:nl.has(w.id),currentApprovedNlSummary:desc.has(w.id),researchStatus:'not_yet_researched',publicationStatus:'proposal_only',sources:[],identityChecks:[],stream:nl.has(w.id)?'A_review_existing_presentation':'B_find_dutch_translation'});
}
const seoPath='C:/Users/rickg/.codex/.chatgpt-projects/g-p-6a88a9eeda5c819181702eb71c430b4d/social-media/seo-content/20261030/content-package.json';
const seoRaw=fs.readFileSync(seoPath,'utf8'),seo=JSON.parse(seoRaw);
const seoIds=new Set([...seoRaw.matchAll(/(?:\/book\/|workId["\s:]+)(\d+)/g)].map(m=>Number(m[1])));
const seoReferences=[...seoIds].map(id=>({workId:id,work:worksById.get(id)??null,nlAvailable:nl.has(id),approvedNlSummary:desc.has(id),candidateId:pool.has('work:'+id)?'work:'+id:null}));
for(const row of pool.values()){
 row.popularitySignals=[...new Map(row.popularitySignals.map(s=>[JSON.stringify(s),s])).values()];
 row.priority={seoContent:seoIds.has(row.workId),dutchSalesOrLoans:row.popularitySignals.some(s=>['retail_sales_rank','library_loan_events'].includes(s.kind)),globalRatingRows:row.popularitySignals.find(s=>s.kind==='public_rating_rows')?.count??0};
 row.missingEvidence=['substantive identity review','exact edition review','content-source review','cover identity and decode','test import and committed recovery','hosted acceptance'];
}
const rows=[...pool.values()].sort((a,b)=>Number(b.priority.seoContent)-Number(a.priority.seoContent)||Number(b.priority.dutchSalesOrLoans)-Number(a.priority.dutchSalesOrLoans)||Number(!b.currentNlAvailable)-Number(!a.currentNlAvailable)||b.priority.globalRatingRows-a.priority.globalRatingRows||a.candidateId.localeCompare(b.candidateId));
if(rows.length<2000)throw Error('Candidate pool below requested 2000');
fs.writeFileSync(new URL('candidate-pool.jsonl',ROOT),rows.map(x=>JSON.stringify(x)).join('\n')+'\n');
fs.writeFileSync(new URL('prior-publication-reconciliation.json',ROOT),JSON.stringify({priorExistingIdentities:prior.rows.length,priorResearched:686,publishedNew,nowResearchedCurrentWorkIds:[...reviewed].sort((a,b)=>a-b),noTechnicalInventoryCountedAsResearch:true},null,2)+'\n');
fs.writeFileSync(new URL('seo-content-dependencies.json',ROOT),JSON.stringify({source:seoPath,sourceSha256:createHash('sha256').update(seoRaw).digest('hex'),usedForPriorityOnly:true,publicationsUnchanged:true,sourceReferences:seo.sources,works:seoReferences},null,2)+'\n');
fs.writeFileSync(new URL('candidate-pool-stats.json',ROOT),JSON.stringify({candidates:rows.length,existing:new Set(rows.filter(r=>r.workId).map(r=>r.workId)).size,possibleNew:rows.filter(r=>!r.workId).length,possibleNewWithPrintedSource:rows.filter(r=>!r.workId&&r.editionCandidates.length).length,priorResearchedReused:rows.filter(r=>r.priorResearched).length,unresearchedSourceCandidates:rows.filter(r=>!r.priorResearched&&r.editionCandidates.length).length,cpnbFacts:cpnb.length,cpnbFactsPendingGlyphOrWrapReview:cpnb.filter(r=>r.parseStatus!=='extracted_fact').length,identityConflicts:rows.filter(r=>r.identityChecks.some(c=>c.conflict)).length,sourceAuthorities:authors.size},null,2)+'\n');
console.log(fs.readFileSync(new URL('candidate-pool-stats.json',ROOT),'utf8'));
