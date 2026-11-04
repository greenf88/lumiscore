// Exact Dutch first-novel printing alternatives discovered from library/merchant sources.
// Three ISBNs for one identity, not a catalogue API crawl. No description export.
import fs from 'node:fs/promises';import{createHash}from'node:crypto';
import{ROOT}from'./nl-scale-snapshot.mjs';import{readKB}from'./nl-scale-kb.mjs';
const isbns=['9789044623987','9789053337264','9789044600360'];
const query='PREFIX schema:<http://schema.org/> SELECT ?isbn ?book ?p ?value WHERE {GRAPH <http://data.bibliotheken.nl/nbt> {VALUES ?isbn {'+isbns.map(JSON.stringify).join(' ')+'} ?book schema:isbn ?isbn;?p ?value}} LIMIT 1500';
const kb=await readKB(query,{label:'Bridget first novel: three exact independently discovered Dutch printings, not German Goldmann or sequels'});if(kb.data.results.bindings.length>=1500)throw Error('Truncated exact bibliography');
const file=new URL('sources/ol-three-bridget-isbns-010.json',ROOT);try{const r=JSON.parse(await fs.readFile(file,'utf8'));console.log(JSON.stringify({cached:true,status:r.status,sha256:r.sha256}));process.exit(0);}catch(e){if(e.code!=='ENOENT')throw e;}
const url='https://openlibrary.org/api/books?bibkeys='+isbns.map(x=>'ISBN:'+x).join(',')+'&format=json&jscmd=data';const start=Date.now(),response=await fetch(url,{signal:AbortSignal.timeout(18000),headers:{'User-Agent':'LumiScore-exact-bibliography/20261102 (+https://lumisco.re)'}});let bytes=0,chunks=[];
for await(const chunk of response.body){bytes+=chunk.length;if(bytes>262144)throw Error('Bounded metadata response cap');chunks.push(chunk);}const raw=Buffer.concat(chunks),record={url,status:response.status,checkedAt:new Date().toISOString(),bytes,fullBodyMs:Date.now()-start,sha256:createHash('sha256').update(raw).digest('hex'),kbResponseSha256:kb.sha256,results:[]};
if(response.ok)record.results=Object.entries(JSON.parse(raw.toString())).map(([key,v])=>({key,title:v.title,url:v.url,authors:v.authors,identifiers:v.identifiers,publishers:v.publishers,publish_date:v.publish_date,number_of_pages:v.number_of_pages,cover:v.cover}));else record.error='HTTP '+response.status+'; no retry';await fs.writeFile(file,JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record));
