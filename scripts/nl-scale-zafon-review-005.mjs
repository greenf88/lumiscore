// Materialise one exact paperback reading; never modifies the immutable case archive.
import fs from 'node:fs';
import {ROOT,readJson} from './nl-scale-snapshot.mjs';
const row=readJson(new URL('cover-decode-results-v5.json',ROOT)).find(x=>x.coverId===13126795&&x.editionKey==='/books/OL45307798M');
if(!row?.decoded||!row.sha256||row.isbn13.join()!=='9789056726126')throw Error('Exact cover bytes missing');
const review={candidateId:'work:1585',editionKey:row.editionKey,coverId:row.coverId,sha256:row.sha256,dimensions:row.dimensions,bytes:row.bytes,status:'front_title_author_consistent_with_bound_source',note:'Visually inspected covers-v5/sheet-011.jpg. White front Carlos Ruiz Zafón, Het labyrint der geesten, boy on windowsill. Exact existing OL paperback singleISBN9789056726126, not the related hardcover5815. No visible barcode claim.'};
fs.writeFileSync(new URL('cover-semantic-review-005.json',ROOT),JSON.stringify({reviewedOn:'2026-11-02',source:'cover-decode-results-v5.json',visuallyInspectedSheet:'outputs/nl-scale-20261102/covers-v5/sheet-011.jpg',notImportApproval:true,reviews:[review]},null,2)+'\n');
console.log(JSON.stringify({coverId:row.coverId,bytes:row.bytes,dimensions:row.dimensions,sha256:row.sha256}));
