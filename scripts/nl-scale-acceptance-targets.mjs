// Expectations derived from exact committed rows, not alternate edition fixtures.
import fs from 'node:fs';
import{ROOT,readJson}from'./nl-scale-snapshot.mjs';
import{loadCases}from'./nl-scale-case-store.mjs';
const sourceCases=loadCases().cases;
const renderedCoverReviews=fs.readdirSync(ROOT).filter(f=>/^hosted-cover-state-reviews-\d{3}\.json$/.test(f)).flatMap(f=>readJson(new URL(f,ROOT)).reviews.map(r=>({...r,reference:f})));
const targets=[];
for(const batch of fs.readdirSync(new URL('subbatches/',ROOT)).filter(n=>/^\d{3}$/.test(n)&&fs.existsSync(new URL('subbatches/'+n+'/test-first-committed-receipt.json',ROOT))).sort()){
 const raw=readJson(new URL('subbatches/'+batch+'/test-first-committed-receipt.json',ROOT)),r=raw.receipt??raw,plan=readJson(new URL('subbatches/'+batch+'/test-plan.json',ROOT));
 const fixturePath=new URL('subbatches/'+batch+'/test-fixture-first-committed-receipt.json',ROOT),fixture=fs.existsSync(fixturePath)?readJson(fixturePath):null,rows=[...(fixture?.receipt?.rows??fixture?.rows??[]),...r.rows];
 for(const m of r.rows.filter(x=>x.relation==='catalog_edition_metadata')){
  const e=rows.findLast(x=>x.relation==='editions'&&x.after_row.id===m.after_row.edition_id)?.after_row,d=r.rows.find(x=>x.relation==='catalog_work_descriptions'&&x.after_row.work_id===e?.work_id)?.after_row;
  const w=rows.findLast(x=>x.relation==='works'&&x.after_row.id===e?.work_id)?.after_row??plan.bindings.find(x=>x.work.id===e?.work_id)?.work;
  if(!e||!d)throw Error('Missing exact edition/summary receipt binding');
  if(!w)throw Error('Missing exact committed Work binding');
  let coverUrl=m.after_row.cover_url,coverAcceptance='imported_verified_cover',coverReview=null;
  if(!coverUrl){
   coverReview=renderedCoverReviews.find(r=>r.testWorkId===e.work_id&&r.testEditionId===e.id&&r.isbn===e.isbn_13);
   const source=sourceCases.find(c=>c.candidateId===coverReview?.candidateId)?.editionReviews.find(x=>x.editionKey===coverReview?.sourceEditionKey&&x.isbn13.includes(e.isbn_13));
   if(!source||!coverReview.reason||!coverReview.observation.selectedIsbnVisible)throw Error('Missing exact rendered cover/placeholder review');
   if(coverReview.mode==='visually_reviewed_existing_resolver_asset'){
    const image=coverReview.observation.images.find(i=>i.url===coverReview.imageUrl&&i.complete&&i.width>0&&i.height>0),id=coverReview.imageUrl?.match(/^https:\/\/covers\.openlibrary\.org\/b\/id\/(\d+)-L\.jpg\?default=false$/)?.[1];
    if(!image||!source.coverIds.includes(Number(id)))throw Error('Rendered cover is not bound to the proposed exact source edition');
    coverUrl=coverReview.imageUrl;coverAcceptance='visually_reviewed_existing_resolver_asset';
   }else if(coverReview.mode==='documented_neutral_placeholder'&&coverReview.observation.images.length===0&&coverReview.observation.placeholder.some(p=>p.title===e.title&&p.className.includes('book-cover')))coverAcceptance='documented_neutral_placeholder';
   else throw Error('Unproven missing-cover state');
  }
  targets.push({batch,testWorkId:e.work_id,expectedEditionId:e.id,isbn:e.isbn_13,title:e.title,originalTitle:w.title,authorId:d.bound_author_id,summary:d.text,sourceUrl:d.source_url,coverUrl,...(!m.after_row.cover_url?{importedCoverUrl:null,coverAcceptance,coverReviewReference:coverReview.reference}:{}),publicRatingExpected:'Own new/mirror test Works have no ratings; empty-score parity only, not proof of populated production scores.'});
 }
}
const body={deployment:'dpl_9ruvyD65bjhJtzNvP4UuWbrxyXvg',host:'https://lumiscore-9ue18tr1w-rgkgroeneveld-9102.vercel.app',testedCommit:'96c3efc5ebea86e286c72786db87aecc9138f5f3',applicationBase:'9c74ecaa48f7a35830f713eed3528d46ba0466ad',targets};
fs.writeFileSync(new URL('hosted-acceptance-targets.json',ROOT),JSON.stringify(body,null,2)+'\n');console.log({exactTargets:targets.length});
