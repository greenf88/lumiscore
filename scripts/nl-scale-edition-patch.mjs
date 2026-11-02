// Only reviewed missing ISBNs and already-supported language corrections.
export function fillVerifiedMissingIsbn(row,{isbn13,editionKey,workId,editionRows}){
 if(!/^\d{13}$/.test(isbn13)||[...isbn13].reduce((s,c,i)=>s+Number(c)*(i%2?3:1),0)%10!==0)throw Error('Invalid verified ISBN13');
 if(row.work_id!==workId||row.open_library_edition_id!==editionKey.split('/').at(-1)||row.isbn_13!==null)throw Error('Exact missing-ISBN identity required');
 if(editionRows.some(e=>e.id!==row.id&&e.isbn_13===isbn13))throw Error('Existing ISBN belongs to another edition');
 return{...row,isbn_13:isbn13};
}
export function mirrorReviewedEditionPatch(target,before,after){
 const changed=Object.keys(after).filter(k=>JSON.stringify(before[k])!==JSON.stringify(after[k]));
 if(!changed.length||changed.some(k=>!['language','isbn_13'].includes(k)))throw Error('Unreviewed edition mutation');
 const result={...target};for(const k of changed){if(target[k]!==before[k])throw Error('Mirror baseline differs');result[k]=after[k];}return result;
}
