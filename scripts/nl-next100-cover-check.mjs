// Four explicitly selected follow-up dossiers, not an automated100/10k-cover crawl.
import fs from 'node:fs/promises';import{createHash}from'node:crypto';import{fileURLToPath}from'node:url';
const root=new URL('../catalog/nl-followup-002-20261031/',import.meta.url),out=new URL('../../../outputs/nl-followup-002-20261031/next-covers/',import.meta.url);
await fs.mkdir(out,{recursive:true});
const selected=[['next-dolfje','9789025845261',1132],['next-revolusi','9789403183404',1170],['next-alles','9789025440374',1215],['next-leven','9789029091015',1182]];
let proof=[];try{proof=JSON.parse(await fs.readFile(new URL('next100-cover-proof.json',root)));}catch{}
for(const[name,isbn,workId]of selected){if(proof.some(x=>x.isbn===isbn))continue;const s=JSON.parse(await fs.readFile(new URL('sources/'+name+'.json',root))),b=s.editions.filter(e=>e.facts.includes('ISBN '+isbn+' '));if(b.length!==1||!b[0].covers[0])throw Error('No exact edition cover');
 const p={workId,isbn,url:b[0].covers[0],source:s.url,sourceHash:s.sha256,editionFacts:b[0].facts,at:new Date().toISOString(),visualIdentity:'pending'};
 try{const r=await fetch(p.url,{signal:AbortSignal.timeout(18000)}),bytes=Buffer.from(await r.arrayBuffer());Object.assign(p,{status:r.status,bytes:bytes.length,type:r.headers.get('content-type'),sha256:createHash('sha256').update(bytes).digest('hex')});if(r.ok&&p.type?.startsWith('image/')&&bytes.length>1000){p.localQAFile=fileURLToPath(new URL(isbn+'.jpg',out));await fs.writeFile(p.localQAFile,bytes);}}catch(e){p.error=e.message;}
 proof.push(p);await fs.writeFile(new URL('next100-cover-proof.json',root),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(p));await new Promise(r=>setTimeout(r,1500));
}
