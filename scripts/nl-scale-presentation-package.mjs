// Existing-edition presentation proposals. Explicit reviewed input, full-row CAS.
// No network, test installation or production execution performed by this file.
import fs from 'node:fs';
import{createHash}from'node:crypto';
import{ROOT,readJson}from'./nl-scale-snapshot.mjs';
import{loadCases}from'./nl-scale-case-store.mjs';
import{loadReviews}from'./nl-scale-reviews.mjs';
import{renderImport,renderRollback}from'./nl-scale-release-sql.mjs';
import{reviewedPrintFormat}from'./nl-scale-print-format.mjs';
import{fillVerifiedMissingIsbn}from'./nl-scale-edition-patch.mjs';
const number=process.argv[2];if(!/^\d{3}$/.test(number??''))throw Error('Reviewed subbatch number required');
const dir=new URL('subbatches/'+number+'/',ROOT),input=readJson(new URL('reviewed-input.json',dir)),base=readJson(new URL('production-preflight.json',dir)).readback;
const cases=loadCases().cases,reviews=loadReviews(),covers=fs.readdirSync(ROOT).filter(n=>/^cover-semantic-review-\d+\.json$/.test(n)).flatMap(file=>readJson(new URL(file,ROOT)).reviews.map(r=>({...r,reference:file})));
const batch='nl-scale-20261102-'+number,actions=[],bindings=[],decisions=[];
let restoredExclusions=0,yearCorrections=0,filledMissingIsbns=0;
for(const [i,item]of input.entries.entries()){
 const c=cases.find(c=>c.caseNumber===item.caseNumber&&c.workId===item.workId),w=base.works.find(w=>w.id===item.workId),a=base.authors.find(a=>a.id===w?.author_id),r=reviews.get(c?.candidateId);
 if(!c||!w||!a||!r?.text||!item.reason)throw Error('Incomplete explicit dossier');
 const candidateCovers=covers.filter(x=>x.candidateId===c.candidateId&&x.status==='front_title_author_consistent_with_bound_source');
 const cover=candidateCovers.find(x=>(!item.editionKey||x.editionKey===item.editionKey)&&(!item.coverId||x.coverId===item.coverId));
 const supplement=item.supplementalEdition;
 if(supplement&&(!item.bibliographyOverride||supplement.editionKey!==item.editionKey||!supplement.sourceEvidence?.kbResponseSha256||!supplement.sourceEvidence?.review))throw Error('Supplemental exact-source reading needs bound independent evidence');
 const e=supplement??c.editionReviews.find(e=>e.editionKey===cover?.editionKey),isbns=e?.isbn13??[];
 const printFormat=reviewedPrintFormat(e?.format);
 if(!cover||isbns.length!==1||!printFormat)throw Error('Ambiguous print or cover '+item.workId);
 const exception=item.bibliographyOverride;
 if(exception){if(exception.isbn13!==isbns[0]||exception.language!=='nl'||exception.format!=='paperback'||!exception.source||!exception.secondSource)throw Error('Unbound exact-source exception');}
 else if(!e.languageConfirmed||!e.titleConfirmed||!e.kbRecords.length||(!e.authorConfirmed&&!item.canonicalFullNameResolution)||e.problems.some(p=>p!=='KB_author_differs_or_alias_requires_review'))throw Error('Unresolved bibliographic conflict '+item.workId);
 const matches=base.editions.filter(x=>item.fillMissingIsbn13?x.open_library_edition_id===e.editionKey.split('/').at(-1):x.isbn_13===isbns[0]);if(matches.length!==1||matches[0].work_id!==w.id||matches[0].open_library_edition_id!==e.editionKey.split('/').at(-1))throw Error('Existing exact-edition binding drift '+w.id);
 const beforeStored=matches[0];let stored=beforeStored;
 if(item.fillMissingIsbn13){if(item.fillMissingIsbn13!==isbns[0])throw Error('Explicit reviewed ISBN differs');stored=fillVerifiedMissingIsbn(stored,{isbn13:isbns[0],editionKey:e.editionKey,workId:w.id,editionRows:base.editions});filledMissingIsbns++;}
 if(base.metadata.some(x=>x.edition_id===stored.id)||base.descriptions.some(x=>x.work_id===w.id&&x.language==='nl'))throw Error('Never overwrite an existing approved/pending presentation blindly');
 bindings.push({work:w,author:a});
 if(item.year!=null&&w.first_publish_year!==item.year){if(!item.extraSources?.length)throw Error('Exact year correction needs reviewed independent source');actions.push({ref:'y'+i,relation:'works',key:{id:w.id},before:w,after:{...w,first_publish_year:item.year}});yearCorrections++;}
 if(!['nl','dut','nld'].includes(stored.language)){if(stored.language!==null)throw Error('Explicit non-null language conflict requires separate manifest');stored={...stored,language:'dut'};restoredExclusions++;}
 if(stored!==beforeStored)actions.push({ref:'e'+i,relation:'editions',key:{id:stored.id},before:beforeStored,after:stored});
 const sources=[...new Set([...(exception?[exception.source,exception.secondSource]:[]),...(item.extraSources??[]),...(r.additionalSources??[]),...c.contentSources.filter(x=>x.text).map(x=>x.sourceUrl),...e.kbRecords.map(k=>k.uri.replace('http://','https://'))])];
 const evidence=[{type:'reviewed_identity_and_bibliography',sources:exception?[exception.source,exception.secondSource]:e.kbRecords.map(k=>k.uri),checked_at:input.reviewedAt,reference:c.candidateId,note:item.reason,canonical_name_resolution:item.canonicalFullNameResolution??null},{type:'original_substantive_source_review',review:r.reference,sources},{type:'cover_front_review',cover_id:cover.coverId,sha256:cover.sha256,reference:cover.reference,limitation:cover.note??'Front and source-edition binding; no barcode or exact-printing-year assertion.'}];
 actions.push({ref:'d'+i,relation:'catalog_work_descriptions',key:{work_id:w.id,language:'nl'},before:null,after:{work_id:w.id,language:'nl',bound_author_id:a.id,text:r.text,source_type:'official_catalog',source_name:'Gecontroleerde boek- en catalogusbronnen',source_url:sources[0],evidence,provenance:'original_source_reviewed_summary',review_status:'approved',reviewed_at:input.reviewedAt,review_batch:batch}});
 actions.push({ref:'m'+i,relation:'catalog_edition_metadata',key:{edition_id:stored.id},before:null,after:{edition_id:stored.id,work_id:w.id,bound_author_id:a.id,bound_title:stored.title,bound_language:stored.language??'dut',bound_isbn13:stored.isbn_13,format:exception?.format??(e.format.toLowerCase().includes('paperback')?'paperback':'hardcover'),cover_url:`https://covers.openlibrary.org/b/id/${cover.coverId}-L.jpg?default=false`,card_cover_url:`https://covers.openlibrary.org/b/id/${cover.coverId}-M.jpg?default=false`,evidence_url:exception?.source??e.kbRecords[0].uri.replace('http://','https://'),evidence,review_status:'approved',reviewed_at:input.reviewedAt,review_batch:batch}});
 decisions.push({candidateId:c.candidateId,caseNumber:c.caseNumber,status:'approved_existing_presentation_repair',importApproved:true,stream:beforeStored.language===null?'A_repair_exclusion':'A_repair_existing_presentation',reviewedAt:input.reviewedAt,reason:item.reason,productionWorkId:w.id,edition:{key:e.editionKey,id:stored.id,title:stored.title,isbn13:stored.isbn_13,language:'dut',format:exception?.format??e.format,coverId:cover.coverId},summary:{text:r.text,language:'nl',reference:r.reference,sourceUrl:sources[0],sources},evidence:{coverReference:cover.reference,coverSha256:cover.sha256,editionReferences:e.kbRecords.map(k=>k.uri),additionalBibliography:exception??null},remaining:['exact test import/readback/replay/committed recovery','hosted exact presentation and search acceptance'],testApplied:false,hostedAccepted:false,releaseOffered:false});
}
const plan={summary:{batch,target:'qvplwejffhjvxaypmjut',scope:'REVIEW PROPOSAL ONLY; no production execution authorised',actions:actions.length,newWorks:0,newDutchEditions:0,existingEditionsReused:input.entries.length,restoredExclusions,...(filledMissingIsbns?{filledMissingIsbns}:{}),newDutchSummaries:input.entries.length,newCoverBindings:input.entries.length,correctedOriginalYears:yearCorrections,netDutchAvailability:restoredExclusions},bindings,authorCorpora:[],actions};
const files={'production-plan.json':JSON.stringify(plan,null,2)+'\n','production-import.sql':renderImport(plan),'production-dry-run.sql':renderImport(plan,{dryRun:true}),'production-rollback.sql':renderRollback(plan)};
for(const[n,b]of Object.entries(files))fs.writeFileSync(new URL(n,dir),b);
fs.writeFileSync(new URL('production-hashes.json',dir),JSON.stringify(Object.fromEntries(Object.entries(files).map(([n,b])=>[n,createHash('sha256').update(b).digest('hex')])),null,2)+'\n');
const finalFile=new URL('final-research-decisions.json',ROOT),final=readJson(finalFile);for(const d of decisions){const old=final.decisions.find(x=>x.candidateId===d.candidateId);if(old&&JSON.stringify(old)!==JSON.stringify(d))throw Error('Explicit amendment required');if(!old)final.decisions.push(d);}fs.writeFileSync(finalFile,JSON.stringify(final,null,2)+'\n');
console.log(JSON.stringify(plan.summary));
