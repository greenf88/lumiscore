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
  if(!row||row.status!==a.status||!/(?:unavailable|failed|not_published|missing)/.test(row.status))throw Error('Missing-cover attempt not independently recorded');
  return{receipt:a.receipt,coverId:a.coverId,status:a.status,receiptSha256:createHash('sha256').update(JSON.stringify(file)).digest('hex')};
 });
 return{type:'no_verified_cover_asset_retained',status:review.status,editionKey:edition.editionKey,isbn13:review.isbn13,checkedAt:review.checkedAt,note:review.note,attempts,limitation:'No verified image is imported. Existing neutral placeholder; not proof that no cover exists at the provider or elsewhere.'};
}
