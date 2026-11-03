// Explicitly reviewed absence of an accepted asset is not absence of the book.
// This records the neutral placeholder path already supported by the application.
import {createHash} from 'node:crypto';
export function reviewedMissingCover(edition,review,{readReceipt,hasVerifiedCover=false}={}){
 if(!review)return null;
 if(hasVerifiedCover||review.status!=='no_verified_asset_retained'||review.editionKey!==edition.editionKey||edition.isbn13?.length!==1||review.isbn13!==edition.isbn13[0]||review.editionSha256!==createHash('sha256').update(JSON.stringify(edition)).digest('hex')||!review.note||!review.checkedAt||!Array.isArray(review.attempts)||!review.attempts.length)throw Error('Explicit exact-edition missing-cover review required');
 const attempts=review.attempts.map(a=>{
  if(!/^cover-(?:archive(?:-v2)?|tar|large-zip)-readback\.json$/.test(a.receipt??'')||!Number.isInteger(a.coverId)||!edition.coverIds.includes(a.coverId))throw Error('Unbound cover attempt');
  const file=readReceipt(a.receipt),rows=Array.isArray(file)?file:file.results??file.readback??file.receipts;
  if(!Array.isArray(rows))throw Error('Unknown receipt structure');
  const row=rows.find(r=>r.candidateId===review.candidateId&&r.editionKey===edition.editionKey&&r.coverId===a.coverId);
  if(!row||row.status!==a.status)throw Error('Missing-cover attempt not independently recorded');
  let historicalFailure=null;
  if(row.status==='prior_source_failure_no_new_request'){
   if(!/^cover-archive(?:-v2)?-readback\.json$/.test(row.sourceFailureReference??''))throw Error('Unbound historical cover failure');
   const oldFile=readReceipt(row.sourceFailureReference),oldRows=Array.isArray(oldFile)?oldFile:oldFile.results??oldFile.readback??oldFile.receipts;
   const item='covers_'+String(Math.floor(a.coverId/1000000)).padStart(4,'0'),part=String(Math.floor(a.coverId/10000)%100).padStart(2,'0');
   const url='https://archive.org/download/'+item+'/'+item+'_'+part+'.zip';
   const old=oldRows?.find(r=>r.status==='bulk_source_failure_no_retry'&&r.url===url&&r.error===row.error);
   if(!old||!old.error||/ACCESS_STOP|(?:HTTP\s*)?(?:401|403|429)\b/.test(old.error))throw Error('Historical failure is missing, unrelated or access-restricted');
   historicalFailure={reference:row.sourceFailureReference,receiptSha256:createHash('sha256').update(JSON.stringify(oldFile)).digest('hex'),archiveUrl:url,sourceError:old.error,noNewRequest:true};
  }else if(!/(?:unavailable|failed|source_failure_no_retry|not_published|missing)/.test(row.status))throw Error('Missing-cover attempt not independently recorded');
  return{receipt:a.receipt,coverId:a.coverId,status:a.status,receiptSha256:createHash('sha256').update(JSON.stringify(file)).digest('hex'),...(historicalFailure?{historicalFailure}:{})};
 });
 return{type:'no_verified_cover_asset_retained',status:review.status,editionKey:edition.editionKey,isbn13:review.isbn13,checkedAt:review.checkedAt,note:review.note,attempts,limitation:'No verified image is imported. Existing neutral placeholder; not proof that no cover exists at the provider or elsewhere.'};
}
