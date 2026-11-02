// Materialise an explicitly reviewed subbatch. No network or database execution.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {ROOT,readJson} from './nl-scale-snapshot.mjs';
import {renderImport,renderRollback} from './catalog-release-sql.mjs';
import {loadReviews} from './nl-scale-reviews.mjs';
import {loadCases} from './nl-scale-case-store.mjs';
const {cases}=loadCases();
const reviews=[...loadReviews().values()];
const covers=readJson(new URL('cover-semantic-review-001.json',ROOT)).reviews;
const decoded=readJson(new URL('cover-decode-results.json',ROOT));
const neighbours=readJson(new URL('identity-neighbours.json',ROOT)).cases;
const reviewedAt='2026-11-02T15:25:00.000Z',batch='nl-scale-20261102-001';
// Each row was individually compared with complete captured author corpora,
// original-title KB statements, exact-ISBN Dutch editions, source text and cover.
const selected=[
 {n:1,year:2021,type:'novel',original:'Truth or Dare',reason:'Different from Arlidge current Eeny Meeny/Iene miene mutte. Exact KB original Truth or dare; Helen Grace volume10.'},
 {n:3,year:1997,type:null,reason:'No current author/alias, ISBN, source Work or title match. KB original The four agreements; publisher confirms Don Miguel Ruiz, NL hardcover and exact ISBN. NTA inverted alias resolves Miguel Ángel Ruiz.'},
 {n:6,year:1979,type:null,reason:'Different from current I Am a Strange Loop(2007). Exact KB original Gödel, Escher, Bach(1979), same established author.'},
 {n:13,year:1973,type:'novel',title:'Momo en de tijdspaarders',original:'Momo',reason:'Different from current Neverending Story and Jim Button. KB original Momo(1973), author authority and full Dutch title match front. Same ISBN spans printings; no specific cover printing-year asserted.'},
 {n:18,year:2016,type:'novel',reason:'Magnus Chase volume2, distinct from current volume1 Sword of Summer and volume3 Ship of the Dead, other Riordan novels and companion guides. Exact KB original/series and front confirm volume2.'},
 {n:20,year:2020,type:'novel',reason:'Distinct from current Gold Coast,2312,Blue Mars. Exact KB/publisher original and new institution premise. Primary author Kim Stanley Robinson; source Simon Saito not imported as coauthor.'},
 {n:23,year:1985,type:'novel',reason:'Earth Children volume3, distinct from current1,4,5,6 and candidate volume2. KB original/series and front confirm3. Jean M.Auel and J.M.Auel are one writer.'},
 {n:24,year:1982,type:'novel',reason:'Earth Children volume2, distinct from current1,4,5,6 and candidate3. KB original and Dutch edition title identify same full novel.'},
 {n:26,year:2017,type:null,reason:'No current author/alias, source Work, ISBN or title match. Exact KB original identifies Reni Eddo-Lodge; Ana Camallonga is not primary original author.'},
 {n:30,year:1985,type:'novel',reason:'No current source Work, ISBN, author alias or title match for Eon. KB Gregory Dale Bear resolves Greg Bear; exact original Eon1985.'},
 {n:34,year:2000,type:'novel',reason:'Jack Reacher volume4 The Visitor, also Running Blind, distinct from all captured Lee Child books and Dutch edition titles. Exact KB original, front and two murdered soldiers premise agree.'},
 {n:44,year:2018,type:null,reason:'Distinct from current Operation Mincemeat and Agent Zigzag. Exact publisher/KB ISBN and Gordievsky premise; Ben Macintyre is primary author, not Efrén del Valle.'},
 {n:45,year:2020,type:'novel',reason:'No current author alias, Work/title/ISBN match. Original publisher confirms July2020, correcting KB original-year2002 error. Dutch publisher confirms exact NL paperback ISBN; out-of-print status does not invalidate published edition.'}
];
const finalFile=new URL('final-research-decisions.json',ROOT);
const old=fs.existsSync(finalFile)?readJson(finalFile):{reviewedOn:'2026-11-02',scope:'Substantive research decisions, distinct from test/hosted/release approval',decisions:[]};
const dossiers=selected.map(s=>{
 const c=cases.find(c=>c.caseNumber===s.n),r=reviews.find(r=>r.candidateId===c.candidateId),e=c.editionReviews[0];
 const cover=covers.find(x=>x.candidateId===c.candidateId&&x.decision==='identity_consistent');
 const image=decoded.find(x=>x.coverId===cover?.coverId&&x.decoded);
 if(!r?.text||!e.languageConfirmed||!e.kbRecords.length||e.isbn13.length!==1||!['paperback','hardcover'].includes(e.format.toLowerCase())||!cover||!image)throw Error('Unreviewed required field '+s.n);
 if(c.identityChecks.some(i=>i.conflict||i.exactOLWorkId||i.exactIsbnWorkIds.length||i.exactTitleAuthorWorkIds.length))throw Error('Identity collision '+s.n);
 const source=c.sourceAuthors[0];
 const edition={key:e.editionKey,title:s.title??e.title,isbn13:e.isbn13[0],language:'dut',format:e.format.toLowerCase(),publisher:e.publisher.join(' / '),coverId:cover.coverId};
 const sources=[...new Set([...(r.additionalSources??[]),...c.contentSources.filter(x=>x.text).map(x=>x.sourceUrl),...e.kbRecords.map(x=>x.uri.replace('http://','https://'))])];
 if(s.n===45)sources.push('https://www.sourcebooks.com/9781728206141-boyfriend-material-tp.html','https://www.zomerenkeuning.nl/boek/boyfriend-material-paperback/');
 if(s.n===13)sources.push('https://www.bibliotheek.nl/catalogus/titel.439415993.html/momo-en-de-tijdspaarders/');
 return {candidateId:c.candidateId,caseNumber:s.n,status:'approved_new_work',importApproved:true,reviewedAt,stream:'C_new_work',reason:s.reason,work:{sourceWorkId:c.candidateId.slice(3),originalTitle:s.original??c.title,originalYear:s.year,workType:s.type,primaryAuthor:{name:r.author??source.name,sourceAuthorId:source.key.split('/').at(-1)}},edition,summary:{text:r.text,language:'nl',reference:r.reference,sourceUrl:sources[0],sources},evidence:{sourceRecords:c.identityChecks.map(x=>x.sourceRecordSha256),editionReferences:e.kbRecords.map(x=>x.uri),authorCorpusReference:'identity-neighbours.json#'+c.candidateId,authorCorpusSha256:createHash('sha256').update(JSON.stringify(neighbours.find(x=>x.candidateId===c.candidateId))).digest('hex'),coverReference:'cover-semantic-review-001.json',coverSha256:image.sha256,coverDimensions:image.dimensions},remaining:['exact test import/readback/replay/committed recovery','hosted exact presentation and search acceptance'],testApplied:false,hostedAccepted:false,releaseOffered:false};
});
for(const d of dossiers){const i=old.decisions.findIndex(x=>x.candidateId===d.candidateId);if(i>=0&&JSON.stringify(old.decisions[i])!==JSON.stringify(d))throw Error('Explicit amendment required');if(i<0)old.decisions.push(d);}
fs.writeFileSync(finalFile,JSON.stringify(old,null,2)+'\n');
const dest=new URL('subbatches/001/',ROOT);fs.mkdirSync(dest,{recursive:true});
for(const env of ['test','production']){
 const baseline=readJson(new URL(env+'-initial15-identity-preflight.json',ROOT)).readback;
 if(baseline.isbn_matches.length||baseline.source_work_matches.length)throw Error('Existing exact identity requires reviewed reuse');
 const actions=[],bindings=baseline.author_corpora.map(w=>({work:w,author:baseline.authors.find(a=>a.id===w.author_id)}));
 const authorCorpora=baseline.authors.map(a=>({author_id:a.id,rows:baseline.author_corpora.filter(w=>w.author_id===a.id)}));
 const refs=new Map();let authorIndex=0;
 for(const d of dossiers){const a=d.work.primaryAuthor,oldAuthor=baseline.authors.find(x=>x.open_library_id===a.sourceAuthorId);if(oldAuthor){refs.set(a.sourceAuthorId,oldAuthor.id);continue;}if(refs.has(a.sourceAuthorId))continue;
  const ref='a'+(++authorIndex),after={open_library_id:a.sourceAuthorId,name:a.name};if(env==='test')after.id=987300000+authorIndex;
  actions.push({ref,relation:'authors',key:{open_library_id:a.sourceAuthorId},before:null,after});refs.set(a.sourceAuthorId,'@'+ref);
 }
 for(const [i,d] of dossiers.entries()){
  const wref='w'+(i+1),eref='e'+(i+1),a=refs.get(d.work.primaryAuthor.sourceAuthorId),native='nlscale:20261102:'+d.candidateId;
  const after={title:d.work.originalTitle,author_id:a,first_publish_year:d.work.originalYear,open_library_id:d.work.sourceWorkId,cover_id:d.edition.coverId,source_type:'open_library',work_type:d.work.workType,native_identity_key:native};if(env==='test')after.id=987100001+i;
  actions.push({ref:wref,relation:'works',key:{native_identity_key:native},before:null,after});
  const edition={work_id:'@'+wref,open_library_edition_id:d.edition.key.split('/').at(-1),isbn_13:d.edition.isbn13,isbn_10:null,language:'dut',publisher:d.edition.publisher,title:d.edition.title};if(env==='test')Object.assign(edition,{id:987200001+i,publish_date:null,cover_id:d.edition.coverId});
  actions.push({ref:eref,relation:'editions',key:{open_library_edition_id:edition.open_library_edition_id},before:null,after:edition});
  const evidence=[{type:'reviewed_identity_and_bibliography',sources:d.editionReferences??d.evidence.editionReferences,checked_at:reviewedAt,reference:d.candidateId},{type:'original_substantive_source_review',sources:d.summary.sources,review:d.summary.reference},{type:'cover_front_review',cover_id:d.edition.coverId,sha256:d.evidence.coverSha256,reference:d.evidence.coverReference,limitation:'Front title/author and exact source-edition mapping; no visible barcode claim.'}];
  actions.push({ref:'d'+(i+1),relation:'catalog_work_descriptions',key:{work_id:'@'+wref,language:'nl'},before:null,after:{work_id:'@'+wref,language:'nl',bound_author_id:a,text:d.summary.text,source_type:'official_catalog',source_name:'Gecontroleerde boek- en catalogusbronnen',source_url:d.summary.sourceUrl,evidence,provenance:'original_source_reviewed_summary',review_status:'approved',reviewed_at:reviewedAt,review_batch:batch}});
  actions.push({ref:'m'+(i+1),relation:'catalog_edition_metadata',key:{edition_id:'@'+eref},before:null,after:{edition_id:'@'+eref,work_id:'@'+wref,bound_author_id:a,bound_title:d.edition.title,bound_language:'dut',bound_isbn13:d.edition.isbn13,format:d.edition.format,cover_url:`https://covers.openlibrary.org/b/id/${d.edition.coverId}-L.jpg?default=false`,card_cover_url:`https://covers.openlibrary.org/b/id/${d.edition.coverId}-M.jpg?default=false`,evidence_url:d.summary.sources.find(u=>u.includes('data.bibliotheken.nl'))??d.summary.sourceUrl,evidence,review_status:'approved',reviewed_at:reviewedAt,review_batch:batch}});
 }
 const plan={summary:{batch,target:env==='test'?'hlvujbrmfdlrfxdjwsmb':'qvplwejffhjvxaypmjut',scope:env==='test'?'Bounded owned test fixtures only':'REVIEW PROPOSAL ONLY; production execution not authorised',newWorks:dossiers.length,newDutchEditions:dossiers.length,newDutchSummaries:dossiers.length,newCoverBindings:dossiers.length,newAuthors:authorIndex,netDutchAvailability:dossiers.length,actions:actions.length},bindings,authorCorpora,actions};
 const files={[env+'-plan.json']:JSON.stringify(plan,null,2)+'\n',[env+'-import.sql']:renderImport(plan,{canary:env==='test'}),[env+'-dry-run.sql']:renderImport(plan,{dryRun:true,canary:env==='test'}),[env+'-rollback.sql']:renderRollback(plan)};
 for(const [name,body]of Object.entries(files))fs.writeFileSync(new URL(name,dest),body);
 fs.writeFileSync(new URL(env+'-hashes.json',dest),JSON.stringify(Object.fromEntries(Object.entries(files).map(([n,b])=>[n,createHash('sha256').update(b).digest('hex')])),null,2)+'\n');
 console.log(JSON.stringify(plan.summary));
}
