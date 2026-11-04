// Explicit reviewer decisions for exact stored editions; no network or database client.
import {createHash} from 'node:crypto';
import {reviewedPrintFormat} from './nl-scale-print-format.mjs';
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function bound(edition,review){
 if(!review?.reason||review.editionKey!==edition.editionKey||edition.isbn13.length!==1||review.isbn13!==edition.isbn13[0]||review.originalEditionSha256!==digest(edition)||review.sources?.length<2||review.sources.some(s=>!s.startsWith('https://')))throw Error('Exact edition and two reviewed sources required');
}
export function reviewedEditionFormat(edition,review){
 if(!review)return reviewedPrintFormat(edition.format);
 bound(edition,review);
 const format=reviewedPrintFormat(review.format);
 if(!format||!['paperback','hardcover'].includes(review.format))throw Error('Explicit supported print binding required');
 return format;
}
export function reviewedStoredEditionFields(stored,edition,review){
 if(!review)return stored;
 bound(edition,review);
 if(stored.open_library_edition_id!==edition.editionKey.split('/').at(-1)||stored.isbn_13!==review.isbn13||JSON.stringify(review.expectedFields)!==JSON.stringify(Object.fromEntries(Object.keys(review.after??{}).map(k=>[k,stored[k]]))))throw Error('Stored edition field baseline changed');
 const fields=Object.keys(review.after??{});
 if(!fields.length||fields.some(k=>!['title','publisher'].includes(k)||typeof review.after[k]!=='string'||!review.after[k].trim()||review.after[k].length>600))throw Error('Only explicitly reviewed title/publisher corrections allowed');
 return {...stored,...review.after};
}
