// Explicit single-public-record lookup; no bulk extraction and no automatic retry.
import fs from'node:fs/promises';
import{ROOT,CACHE,hash}from'./nl-continuation-bootstrap.mjs';
const key=process.argv[2];if(!/^OL\d+M$/.test(key??''))throw Error('Exact edition identifier required');
const path=new URL('edition-'+key+'.json',ROOT);let old;
try{old=JSON.parse(await fs.readFile(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
if(old){console.log(JSON.stringify({...old,reused:true}));process.exit(0);}
const url='https://openlibrary.org/books/'+key+'.json';let out={url,checkedAt:new Date().toISOString()};
try{
 const r=await fetch(url,{signal:AbortSignal.timeout(18000),headers:{'User-Agent':'LumiScore-exact-edition-review/20261103 (OpenAI Codex GPT-6; +https://lumisco.re)'}});
 out.status=r.status;if(!r.ok){await r.body?.cancel();throw Error(([401,403,429].includes(r.status)?'ACCESS_STOP ':'HTTP ')+r.status);}
 let bytes=0;const parts=[];for await(const p of r.body){bytes+=p.length;if(bytes>300000)throw Error('Source cap exceeded');parts.push(p);}
 const raw=Buffer.concat(parts),record=JSON.parse(raw);if(record.key!=='/books/'+key)throw Error('Edition identity drift');
 await fs.mkdir(new URL('sources/',CACHE),{recursive:true});await fs.writeFile(new URL('sources/'+key+'.json',CACHE),raw);
 out={...out,bytes,sha256:hash(raw),record:{key:record.key,title:record.title,authors:record.authors,works:record.works,languages:record.languages,isbn_13:record.isbn_13,isbn_10:record.isbn_10,publishers:record.publishers,publish_date:record.publish_date,physical_format:record.physical_format,covers:record.covers}};
}catch(e){out.error=e.message;out.noRetry=true;}
await fs.writeFile(path,JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out));
