import fs from 'node:fs';
import {readKB} from './nl-scale-kb.mjs';
import {ROOT,readJson} from './nl-scale-snapshot.mjs';
const e=readJson(new URL('../.research-cache/nl-scale-20261102/editions-extract.json',import.meta.url));
const values=[...new Set(e.entries.flatMap(x=>x.record.isbn_10))].sort(),queries=[];
for(let start=0;start<values.length;start+=40){
 const vs=values.slice(start,start+40);
 const query='PREFIX schema: <http://schema.org/>\nSELECT ?isbn ?book ?p ?value WHERE { GRAPH <http://data.bibliotheken.nl/nbt> { VALUES ?isbn { '+vs.map(JSON.stringify).join(' ')+' } ?book schema:isbn ?isbn ; ?p ?value } } LIMIT 9000';
 const r=await readKB(query,{label:'exact NL candidate ISBN10 legacy corroboration '+start+'..'+(start+vs.length-1)});
 if(r.data.results.bindings.length>=9000)throw Error('Truncated; split query');
 queries.push({isbns:vs,responseSha256:r.sha256,rows:r.data.results.bindings.length,checkedAt:r.checkedAt});
 console.log(JSON.stringify({done:start+vs.length,total:values.length,rows:r.data.results.bindings.length,cached:r.cached??false}));
}
fs.writeFileSync(new URL('sources/kb-isbn10-manifest.json',ROOT),JSON.stringify({complete:true,total:values.length,queries},null,2)+'\n');
