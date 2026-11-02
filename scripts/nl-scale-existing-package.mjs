// Explicitly reviewed existing-Work translations. No network or database client.
// Test mirrors and release actions are separate receipts and separate counts.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {ROOT,readJson} from './nl-scale-snapshot.mjs';
import {loadCases} from './nl-scale-case-store.mjs';
import {loadReviews} from './nl-scale-reviews.mjs';
import {renderImport,renderRollback} from './catalog-release-sql.mjs';
const dest=new URL('subbatches/002/',ROOT),{cases}=loadCases(),reviews=loadReviews();
const prod=readJson(new URL('production-preflight.json',dest)).readback;
const test=readJson(new URL('test-preflight.json',dest)).readback;
const testAuthors=readJson(new URL('test-author-preflight.json',dest)).readback;
const covers=readJson(new URL('cover-semantic-review-002.json',ROOT)).reviews;
const batch='nl-scale-20261102-002',reviewedAt='2026-11-02T16:27:00.000Z';
const selected=[
 {n:338,year:2016,yearSource:'https://www.simonandschuster.co.uk/books/It-Ends-With-Us/Colleen-Hoover/9781471156267',note:'Original publisher and exact KB original agree on2016. Existing2012 is not this novel. No merger with It Starts With Us.'},
 {n:371,note:'Exact Dutch KB ISBN identifies the complete1954 Golding novel, not film or retelling.'},
 {n:378,note:'Diary of a Wimpy Kid volume9. Exact KB original The long haul and Dutch hardcover match; no movie adaptation imported.'},
 {n:406,note:'Exact Dutch KB original The dead zone1979. Dodelijk dilemma is a translated title of this Work.'},
 {n:409,note:'Richard Bachman is Stephen King pseudonym. Exact KB original The running man1982; novel, not movie.'},
 {n:410,note:'Exact KB original Being mortal2014 and author agree. Non-fiction remains outside automatic taste-test classification.'},
 {n:414,note:'Exact KB original El túnel1948 and Ernesto Sábato identity agree; translator is not a new primary author.'},
 {n:416,year:1991,note:'KB original Mördare utan ansikte Stockholm Ordfront1991; current1993 is an edition year, not first original publication.'},
 {n:419,year:2014,yearSource:'https://profilebooks.com/work/the-obstacle-is-the-way/',note:'Original publisher lists first ebook1May2014 and paperback2015. Proposed NL2018 edition is not the2024 expanded anniversary edition.'},
 {n:436,note:'Complete Different seasons collection of four novellas. Keep collection Work; do not count its constituent stories as newly added Works.'},
 {n:439,note:'Exact Dutch original novel Tirza2006. Anniversary publisher synopsis supports content but does not replace proposed2009ISBN/cover.'},
 {n:440,note:'Exact KB original The outsider2018 and Stephen King agree; not Albert Camus L’Étranger.'},
 {n:444,year:2003,yearSource:'https://www.jamespatterson.com/titles/james-patterson/the-big-bad-wolf/9780316743846/',note:'Original author/publisher and KB original agree on2003, not current2001. Full Alex Cross novel, not another book called Wolf.'}
];
function writePlan(name,plan){
 const files={[name+'-plan.json']:JSON.stringify(plan,null,2)+'\n',[name+'-import.sql']:renderImport(plan,{canary:name!=='production'}),[name+'-dry-run.sql']:renderImport(plan,{dryRun:true,canary:name!=='production'}),[name+'-rollback.sql']:renderRollback(plan)};
 for(const [n,b]of Object.entries(files))fs.writeFileSync(new URL(n,dest),b);
 fs.writeFileSync(new URL(name+'-hashes.json',dest),JSON.stringify(Object.fromEntries(Object.entries(files).map(([n,b])=>[n,createHash('sha256').update(b).digest('hex')])),null,2)+'\n');
 console.log(JSON.stringify({name,...plan.summary}));
}
const dossiers=selected.map(s=>{
 const c=cases.find(c=>c.caseNumber===s.n),r=reviews.get(c.candidateId),cover=covers.find(x=>x.candidateId===c.candidateId&&x.status==='front_title_author_consistent_with_bound_source');
 const e=c.editionReviews.find(e=>e.editionKey===cover?.editionKey),w=prod.works.find(w=>w.id===c.workId);
 if(!w||!r?.text||!e?.languageConfirmed||!e.authorConfirmed||!e.titleConfirmed||!e.kbRecords.length||e.isbn13.length!==1||!cover||e.problems.length||!['hardcover','paperback','mass market paperback'].includes(e.format.toLowerCase()))throw Error('Incomplete reviewed translation '+s.n);
 if(prod.editions.some(x=>x.isbn_13===e.isbn13[0]||x.open_library_edition_id===e.editionKey.split('/').at(-1))||prod.descriptions.some(x=>x.work_id===w.id&&x.language==='nl')||prod.editions.some(x=>x.work_id===w.id&&['nl','dut','nld'].includes(x.language)))throw Error('Existing NL identity/presentation requires revised plan');
 const sources=[...new Set([...(r.additionalSources??[]),...(s.yearSource?[s.yearSource]:[]),...c.contentSources.filter(x=>x.text).map(x=>x.sourceUrl),...e.kbRecords.map(x=>x.uri.replace('http://','https://'))])];
 return {candidateId:c.candidateId,caseNumber:s.n,status:'approved_edition_addition',importApproved:true,stream:'B_add_translation',reviewedAt,reason:s.note,productionWorkId:w.id,work:{sourceWorkId:w.open_library_id,originalTitle:w.title,originalYear:s.year??w.first_publish_year,primaryAuthor:prod.authors.find(a=>a.id===w.author_id)},edition:{key:e.editionKey,title:e.title,isbn13:e.isbn13[0],language:'dut',format:e.format.toLowerCase().includes('paperback')?'paperback':'hardcover',sourceFormat:e.format,publisher:e.publisher.join(' / '),coverId:cover.coverId},summary:{text:r.text,language:'nl',reference:r.reference,sourceUrl:sources[0],sources},evidence:{editionReferences:e.kbRecords.map(k=>k.uri),coverReference:'cover-semantic-review-002.json',coverSha256:cover.sha256,coverDimensions:cover.dimensions,coverBytes:cover.bytes,sourceBindingSha256:r.sourceEvidence.bindingSha256,sourceWorkSha256:c.contentSources.map(x=>x.sourceSha256)},remaining:['bounded test import/readback/replay/committed recovery','hosted exact presentation and search acceptance'],testApplied:false,hostedAccepted:false,releaseOffered:false};
});
const finalFile=new URL('final-research-decisions.json',ROOT),final=readJson(finalFile);
for(const d of dossiers){const old=final.decisions.find(x=>x.candidateId===d.candidateId);if(old&&JSON.stringify(old)!==JSON.stringify(d))throw Error('Explicit final-decision amendment required');if(!old)final.decisions.push(d);}
fs.writeFileSync(finalFile,JSON.stringify(final,null,2)+'\n');
fs.writeFileSync(new URL('reviewed-dossiers.json',dest),JSON.stringify({reviewedAt,dossiers},null,2)+'\n');
// Mirror current identities in the test schema, without claiming these as new production Works.
if(test.works.length||test.editions.length)throw Error('Existing test identity requires reuse');
const fixtureActions=[],authorRefs=new Map();let ai=0;
for(const d of dossiers){const a=d.work.primaryAuthor;if(authorRefs.has(a.id))continue;const present=testAuthors.authors.find(x=>x.open_library_id===a.open_library_id);if(present){authorRefs.set(a.id,present.id);continue;}const ref='fa'+(++ai);fixtureActions.push({ref,relation:'authors',key:{open_library_id:a.open_library_id},before:null,after:{id:987301000+ai,name:a.name,open_library_id:a.open_library_id}});authorRefs.set(a.id,'@'+ref);}
for(const [i,d]of dossiers.entries()){
 const w=prod.works.find(w=>w.id===d.productionWorkId),ref='fw'+(i+1),id=987101001+i;
 fixtureActions.push({ref,relation:'works',key:{native_identity_key:'nlscale:fixture002:'+w.id},before:null,after:{id,title:w.title,author_id:authorRefs.get(w.author_id),first_publish_year:w.first_publish_year,open_library_id:w.open_library_id,cover_id:w.cover_id,source_type:w.source_type,work_type:w.work_type,native_identity_key:'nlscale:fixture002:'+w.id}});
 const editions=prod.editions.filter(e=>e.work_id===w.id);if(editions.length!==1)throw Error('Review all legacy editions before mirroring');
 const e=editions[0];fixtureActions.push({ref:'fe'+(i+1),relation:'editions',key:{open_library_edition_id:e.open_library_edition_id},before:null,after:{id:987201001+i,work_id:'@'+ref,open_library_edition_id:e.open_library_edition_id,isbn_13:e.isbn_13,isbn_10:e.isbn_10,language:e.language,publisher:e.publisher,title:e.title,publish_date:null,cover_id:null}});
}
writePlan('test-fixture',{summary:{batch:batch+'-fixture',target:'hlvujbrmfdlrfxdjwsmb',scope:'OWNED TEST MIRRORS ONLY; not production additions',actions:fixtureActions.length,newWorks:13,newAuthors:ai,newDutchEditions:0,netDutchAvailability:0},bindings:testAuthors.author_corpora.map(w=>({work:w,author:testAuthors.authors.find(a=>a.id===w.author_id)})),authorCorpora:testAuthors.authors.map(a=>({author_id:a.id,rows:testAuthors.author_corpora.filter(w=>w.author_id===a.id)})),actions:fixtureActions});
function presentationPlan(env,base){
 const actions=[],bindings=[];
 for(const [i,d]of dossiers.entries()){
  const w=env==='production'?prod.works.find(w=>w.id===d.productionWorkId):base.works.find(w=>w.open_library_id===d.work.sourceWorkId);
  const author=(env==='production'?prod.authors:base.authors).find(a=>a.id===w?.author_id);if(!w||!author)throw Error('Exact full test fixture readback required');bindings.push({work:w,author});
  if(w.first_publish_year!==d.work.originalYear)actions.push({ref:'y'+(i+1),relation:'works',key:{id:w.id},before:w,after:{...w,first_publish_year:d.work.originalYear}});
  const ref='e'+(i+1),a=w.author_id,edition={work_id:w.id,open_library_edition_id:d.edition.key.split('/').at(-1),isbn_13:d.edition.isbn13,isbn_10:null,language:'dut',publisher:d.edition.publisher,title:d.edition.title};if(env==='test')Object.assign(edition,{id:987201014+i,publish_date:null,cover_id:d.edition.coverId});
  actions.push({ref,relation:'editions',key:{open_library_edition_id:edition.open_library_edition_id},before:null,after:edition});
  const evidence=[{type:'reviewed_identity_and_bibliography',sources:d.evidence.editionReferences,checked_at:reviewedAt,reference:d.candidateId,note:d.reason},{type:'original_substantive_source_review',sources:d.summary.sources,review:d.summary.reference},{type:'cover_front_review',cover_id:d.edition.coverId,sha256:d.evidence.coverSha256,reference:d.evidence.coverReference,limitation:'Front title/author and bound exact source edition; no visible barcode assertion.'}];
  actions.push({ref:'d'+(i+1),relation:'catalog_work_descriptions',key:{work_id:w.id,language:'nl'},before:null,after:{work_id:w.id,language:'nl',bound_author_id:a,text:d.summary.text,source_type:'official_catalog',source_name:'Gecontroleerde boek- en catalogusbronnen',source_url:d.summary.sourceUrl,evidence,provenance:'original_source_reviewed_summary',review_status:'approved',reviewed_at:reviewedAt,review_batch:batch}});
  actions.push({ref:'m'+(i+1),relation:'catalog_edition_metadata',key:{edition_id:'@'+ref},before:null,after:{edition_id:'@'+ref,work_id:w.id,bound_author_id:a,bound_title:d.edition.title,bound_language:'dut',bound_isbn13:d.edition.isbn13,format:d.edition.format,cover_url:`https://covers.openlibrary.org/b/id/${d.edition.coverId}-L.jpg?default=false`,card_cover_url:`https://covers.openlibrary.org/b/id/${d.edition.coverId}-M.jpg?default=false`,evidence_url:d.evidence.editionReferences[0].replace('http://','https://'),evidence,review_status:'approved',reviewed_at:reviewedAt,review_batch:batch}});
 }
 return {summary:{batch,target:env==='production'?'qvplwejffhjvxaypmjut':'hlvujbrmfdlrfxdjwsmb',scope:env==='production'?'REVIEW PROPOSAL ONLY':'Existing-Work test mirrors; fixture has separate receipt',newWorks:0,newDutchEditions:13,newDutchSummaries:13,newCoverBindings:13,correctedOriginalYears:4,netDutchAvailability:13,actions:actions.length},bindings,authorCorpora:[],actions};
}
writePlan('production',presentationPlan('production',prod));
const testFull=new URL('test-fixture-full-readback.json',dest);if(fs.existsSync(testFull))writePlan('test',presentationPlan('test',readJson(testFull).readback));
