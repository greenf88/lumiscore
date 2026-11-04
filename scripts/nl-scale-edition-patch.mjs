// Only reviewed missing ISBNs and already-supported language corrections.
export function fillVerifiedMissingIsbn(row,{isbn13,editionKey,workId,editionRows}){
 if(!/^\d{13}$/.test(isbn13)||[...isbn13].reduce((s,c,i)=>s+Number(c)*(i%2?3:1),0)%10!==0)throw Error('Invalid verified ISBN13');
 if(row.work_id!==workId||row.open_library_edition_id!==editionKey.split('/').at(-1)||row.isbn_13!==null)throw Error('Exact missing-ISBN identity required');
 if(editionRows.some(e=>e.id!==row.id&&e.isbn_13===isbn13))throw Error('Existing ISBN belongs to another edition');
 return{...row,isbn_13:isbn13};
}
export function mirrorReviewedEditionPatch(target,before,after,reviewedEditionFieldKeys=[]){
 if(reviewedEditionFieldKeys.some(k=>!['title','publisher'].includes(k)))throw Error('Unreviewed field allowance');
 const changed=Object.keys(after).filter(k=>JSON.stringify(before[k])!==JSON.stringify(after[k]));
 if(!changed.length||changed.some(k=>!['language','isbn_13',...reviewedEditionFieldKeys].includes(k)))throw Error('Unreviewed edition mutation');
 const result={...target};for(const k of changed){if(target[k]!==before[k])throw Error('Mirror baseline differs');result[k]=after[k];}return result;
}
export function verifyAdditionalPrintedAlternative(existingDutch,review){
 const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
 if(!review?.reason||review.sources?.length<2||!existingDutch.length||review.expectedEditions?.length!==existingDutch.length)throw Error('Explicit existing-Dutch alternative review required');
 for(const row of existingDutch){const before=review.expectedEditions.find(x=>x.id===row.id);if(JSON.stringify(canonical(row))!==JSON.stringify(canonical(before)))throw Error('Existing Dutch alternative changed; review again');}
 return true; // No deletion, reparenting or additional availability credit.
}
