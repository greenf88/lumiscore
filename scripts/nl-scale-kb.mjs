// Public CC0 KB bibliographic adapter. Read-only, bounded, cached, no credentials.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export const ENDPOINT='https://data.bibliotheken.nl/sparql';
export const CACHE=new URL('../catalog/nl-scale-20261102/sources/',import.meta.url);
let lastRequest=0;
export async function readKB(query,{label='query'}={}){
 if(!/^\s*(?:PREFIX[^]*?)?(?:SELECT|CONSTRUCT)\b/i.test(query)||/\b(?:INSERT|DELETE|LOAD|CLEAR|DROP|CREATE|SERVICE)\b/i.test(query))throw Error('Only reviewed local read queries');
 const key=createHash('sha256').update(ENDPOINT+'\n'+query).digest('hex');
 const path=new URL('kb-'+key+'.json',CACHE);
 await fs.mkdir(CACHE,{recursive:true});
 try{const cached=JSON.parse(await fs.readFile(path,'utf8'));if(cached.status!==200||cached.error)throw Error('Previous source failure recorded; no automatic retry');return {...cached,cached:true};}catch(e){if(e.code!=='ENOENT')throw e;}
 const wait=Math.max(0,1250-(Date.now()-lastRequest));if(wait)await new Promise(r=>setTimeout(r,wait));lastRequest=Date.now();
 const url=new URL(ENDPOINT);url.searchParams.set('query',query);
 const response=await fetch(url,{headers:{Accept:'application/sparql-results+json','User-Agent':'LumiScore-catalogue-review/20261102'},signal:AbortSignal.timeout(40000)});
 let length=0,chunks=[];for await(const chunk of response.body){length+=chunk.length;if(length>4000000)throw Error('Source response cap 4MB exceeded');chunks.push(chunk);}
 const body=Buffer.concat(chunks).toString('utf8');
 let data=null,error=null;
 try{if(response.ok)data=JSON.parse(body);else error='HTTP '+response.status;}catch{error='Expected SPARQL JSON, received '+response.headers.get('content-type');}
 const record={source:'KB Nederlandse Bibliografie Totaal',license:'CC0',licenseUrl:'https://data.bibliotheken.nl/',endpoint:ENDPOINT,query,label,checkedAt:new Date().toISOString(),status:response.status,contentType:response.headers.get('content-type'),finalUrl:response.url,bytes:length,sha256:createHash('sha256').update(body).digest('hex'),data,error};
 await fs.writeFile(path,JSON.stringify(record,null,2)+'\n');if(!response.ok||error)throw Error('KB response '+response.status+' '+error+'; stored failure, no retries');
 return record;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const query=process.argv[2]?await fs.readFile(process.argv[2],'utf8'):'SELECT ?p ?o WHERE { GRAPH <http://data.bibliotheken.nl/nbt> { <http://data.bibliotheken.nl/id/nbt/p455901074> ?p ?o } } LIMIT 100';
 const r=await readKB(query,{label:'official NBT example schema probe'});
 console.log(JSON.stringify({checkedAt:r.checkedAt,status:r.status,rows:r.data.results?.bindings,cached:r.cached??false}));
}
