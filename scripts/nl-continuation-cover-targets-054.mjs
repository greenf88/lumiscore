import fs from 'node:fs';
import {ROOT} from './nl-continuation-bootstrap.mjs';
const pairs=[[309,6451416],[310,6451421],[311,6451517],[312,6451543],[313,6451419],[330,6759413],[332,6391750],[334,6391743],[336,6717080],[319,13263465],[333,12346546]];
const targets=pairs.map(([n,coverId])=>{const r=JSON.parse(fs.readFileSync(new URL('reviewed-'+n+'.json',ROOT),'utf8'));return {caseNumber:n,candidateId:r.candidateId,editionKey:'/books/'+r.edition.sourceKey,isbn13:r.edition.isbn13,title:r.edition.title,coverId,notImportApproval:true};});
for(const [file,ts] of [['cover-large-bulk-request-016.json',targets.filter(t=>Math.floor(t.coverId/1e6)===6)],['cover-largezip-request-022.json',targets.filter(t=>Math.floor(t.coverId/1e6)!==6)]])fs.writeFileSync(new URL(file,ROOT),JSON.stringify({purpose:'Exact bounded public bulk cover review; no import approval',targets:ts},null,2)+'\n');
