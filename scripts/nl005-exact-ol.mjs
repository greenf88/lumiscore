// Eight named historical edition checks, not catalogue harvesting. <=1 request/second.
import fs from'node:fs/promises';import{createHash}from'node:crypto';
const root=new URL('../catalog/nl-research-005-20261101/sources/',import.meta.url);
const rows=[[18,'9789022953358'],[146,'9789044611120'],[178,'9789044611137'],[228,'9789044611114'],[1596,'9789022513590'],[1600,'9789029532853'],[3015,'9789024539772'],[6234,'9789022916490']];
for(const[id,isbn]of rows){const path=new URL('ol-exact-'+id+'.json',root);try{console.log(await fs.readFile(path,'utf8'));continue;}catch{}
 const url='https://openlibrary.org/isbn/'+isbn+'.json';const out={candidateId:String(id),isbn,url,at:new Date().toISOString(),role:'Exact edition evidence; community metadata needs source corroboration'};
 try{const r=await fetch(url,{signal:AbortSignal.timeout(15000)});out.status=r.status;if([401,403,429].includes(r.status)){await fs.writeFile(path,JSON.stringify(out,null,2));throw Error('Provider refusal: stop');}const raw=await r.text();out.sha256=createHash('sha256').update(raw).digest('hex');if(r.ok){const j=JSON.parse(raw);out.edition={key:j.key,title:j.title,works:j.works,authors:j.authors,isbn_13:j.isbn_13,isbn_10:j.isbn_10,languages:j.languages,physical_format:j.physical_format,publishers:j.publishers,publish_date:j.publish_date,covers:j.covers};}}
 catch(e){out.error=e.message;if(/Provider refusal/.test(e.message))throw e;}await fs.writeFile(path,JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out));await new Promise(r=>setTimeout(r,1100));}
