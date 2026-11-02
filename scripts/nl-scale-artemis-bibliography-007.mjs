// Three independently identified Dutch print ISBNs, not a guessed edition grid.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readKB} from './nl-scale-kb.mjs';
import {ROOT} from './nl-scale-snapshot.mjs';
const isbns=['9789000365906','9789047500445','9789050006040'];
const q='PREFIX schema: <http://schema.org/> SELECT ?isbn ?book ?p ?value WHERE { GRAPH <http://data.bibliotheken.nl/nbt> { VALUES ?isbn { '+isbns.map(JSON.stringify).join(' ')+' } ?book schema:isbn ?isbn ; ?p ?value } } LIMIT 1500';
const kb=await readKB(q,{label:'Artemis Fowl first novel: exact three Dutch printing alternatives from Bibliotheek; no inference from Lijsters'});
if(kb.data.results.bindings.length>=1500)throw Error('Truncated bibliography');
console.log(JSON.stringify({kind:'KB',status:kb.status,sha256:kb.sha256,rows:kb.data.results.bindings.filter(x=>/name$|inLanguage$|isbn$|label$/.test(x.p.value)).map(x=>({isbn:x.isbn.value,book:x.book.value,p:x.p.value,value:x.value.value}))}));
const file=new URL('sources/ol-three-artemis-isbns-007.json',ROOT);
try{console.log(await fs.readFile(file,'utf8'));process.exit(0);}catch(e){if(e.code!=='ENOENT')throw e;}
const url='https://openlibrary.org/api/books?bibkeys='+isbns.map(x=>'ISBN:'+x).join(',')+'&format=json&jscmd=data';
const start=Date.now(),response=await fetch(url,{signal:AbortSignal.timeout(18000),headers:{'User-Agent':'LumiScore-exact-bibliography/20261102'}});let bytes=0,chunks=[];
for await(const chunk of response.body){bytes+=chunk.length;if(bytes>262144)throw Error('Bounded metadata response cap');chunks.push(chunk);}
const raw=Buffer.concat(chunks),record={url,status:response.status,checkedAt:new Date().toISOString(),bytes,fullBodyMs:Date.now()-start,sha256:createHash('sha256').update(raw).digest('hex'),results:[]};
if(response.ok){const data=JSON.parse(raw.toString());record.results=Object.entries(data).map(([key,v])=>({key,title:v.title,url:v.url,authors:v.authors,identifiers:v.identifiers,publishers:v.publishers,publish_date:v.publish_date,number_of_pages:v.number_of_pages,cover:v.cover}));}
else record.error='HTTP '+response.status+'; no retry';
await fs.writeFile(file,JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record));
