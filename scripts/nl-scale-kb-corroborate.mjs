// One cached public bibliographic SELECT per 40 ISBNs; no writes or inferred format.
import fs from 'node:fs';
import {readKB} from './nl-scale-kb.mjs';
import {ROOT,OUTPUT,readJson} from './nl-scale-snapshot.mjs';
import {createHash} from 'node:crypto';
const cache=new URL('../.research-cache/nl-scale-20261102/',import.meta.url);
const e=readJson(new URL('editions-extract.json',cache));
export function isbn13(value){
 const s=String(value).replace(/[-\s]/g,'');
 if(s.length===13)return s;
 if(s.length!==10)return null;
 const p='978'+s.slice(0,9);return p+((10-[...p].reduce((n,c,i)=>n+Number(c)*(i%2?3:1),0)%10)%10);
}
const isbns=[...new Set(e.entries.flatMap(x=>[...x.record.isbn_13,...x.record.isbn_10].map(isbn13)).filter(Boolean))].sort();
const queries=[];
for(let start=0;start<isbns.length;start+=40){
 const values=isbns.slice(start,start+40);
 const query='PREFIX schema: <http://schema.org/>\nSELECT ?isbn ?book ?p ?value ?authorName WHERE { GRAPH <http://data.bibliotheken.nl/nbt> { VALUES ?isbn { '+values.map(JSON.stringify).join(' ')+' } ?book schema:isbn ?isbn ; ?p ?value . OPTIONAL { ?book schema:author ?a . ?a schema:name ?authorName } } } LIMIT 9000';
 const r=await readKB(query,{label:'exact NL candidate ISBN corroboration '+start+'..'+(start+values.length-1)});
 const bindings=r.data.results.bindings;
 if(bindings.length>=9000)throw Error('KB truncation: split query before interpreting');
 queries.push({isbns:values,querySha256:createHash('sha256').update(query).digest('hex'),responseSha256:r.sha256,rows:bindings.length,cached:r.cached??false,checkedAt:r.checkedAt});
 fs.writeFileSync(new URL('kb-corroboration-progress.json',OUTPUT),JSON.stringify({complete:false,done:start+values.length,total:isbns.length,queries},null,2));
 console.log(JSON.stringify({done:start+values.length,total:isbns.length,rows:bindings.length,cached:r.cached??false}));
}
fs.writeFileSync(new URL('sources/kb-isbn-manifest.json',ROOT),JSON.stringify({complete:true,total:isbns.length,endpoint:'https://data.bibliotheken.nl/sparql',purpose:'Independent bibliographic corroboration; absence of a result is not absence of a Dutch edition; notes are not plot evidence; absent bookFormat is unknown.',queries},null,2)+'\n');
