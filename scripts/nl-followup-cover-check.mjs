import fs from 'node:fs/promises';import{createHash}from'node:crypto';
const root=new URL('../catalog/nl-followup-002-20261031/',import.meta.url);
const selected=[['phm','9789401614078',1],['mars','9789045207858',17],['wind','9789022557068',23],['fifth','9789024580439',30],['prince','9789025310950',1993]];
const files=new URL('../../../outputs/nl-followup-002-20261031/covers/',import.meta.url);await fs.mkdir(files,{recursive:true});
let rows=[];try{rows=JSON.parse(await fs.readFile(new URL('cover-proof.json',root)));}catch{}
for(const[name,isbn,workId]of selected){
 if(rows.some(r=>r.isbn===isbn)){console.log(JSON.stringify({isbn,cached:true}));continue;}
 const source=JSON.parse(await fs.readFile(new URL('sources/'+name+'.json',root))),block=source.editions.filter(e=>new RegExp('ISBN '+isbn+'(?: |$)').test(e.facts));
 if(block.length!==1||!['Paperback','Hardback'].includes(block[0].format)||!block[0].covers[0])throw Error('Exact print/image block missing');
 const url=block[0].covers[0],row={workId,isbn,source:source.url,sourceHash:source.sha256,editionFacts:block[0].facts,url,at:new Date().toISOString(),visualIdentity:'pending_manual_inspection'};
 try{const r=await fetch(url,{signal:AbortSignal.timeout(18000)}),bytes=Buffer.from(await r.arrayBuffer());Object.assign(row,{status:r.status,bytes:bytes.length,type:r.headers.get('content-type'),sha256:createHash('sha256').update(bytes).digest('hex')});
  if(r.ok&&row.type.startsWith('image/')&&bytes.length>1000){row.localQAFile=new URL(isbn+'.jpg',files).pathname;await fs.writeFile(new URL(isbn+'.jpg',files),bytes);}
 }catch(e){row.error=e.message;}
 rows.push(row);await fs.writeFile(new URL('cover-proof.json',root),JSON.stringify(rows,null,2)+'\n');console.log(JSON.stringify(row));await new Promise(r=>setTimeout(r,1500));
}
