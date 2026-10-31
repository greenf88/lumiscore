import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../catalog/edition-recovery-20261031/',import.meta.url);
const review=JSON.parse(await fs.readFile(new URL('reviewed-editions.json',root)));
await fs.mkdir(new URL('cover-proof/',root),{recursive:true});
let proofs=[];try{proofs=JSON.parse(await fs.readFile(new URL('cover-http.json',root)));}catch{}
for(const e of [...review.editions,review.existingCover]){
 if(proofs.some(p=>p.isbn===e.isbn))continue;
 const p={isbn:e.isbn,url:e.cover,checkedAt:new Date().toISOString()};
 try{const start=performance.now(),r=await fetch(e.cover,{signal:AbortSignal.timeout(15000)}),b=Buffer.from(await r.arrayBuffer());
  Object.assign(p,{status:r.status,contentType:r.headers.get('content-type'),bytes:b.length,ms:Math.round(performance.now()-start),sha256:createHash('sha256').update(b).digest('hex')});
  if(r.ok&&p.contentType?.startsWith('image/')&&b.length>1000){p.file='cover-proof/'+e.isbn+'.jpg';await fs.writeFile(new URL(p.file,root),b);}
 }catch(err){p.error=err.message;}
 proofs.push(p);await fs.writeFile(new URL('cover-http.json',root),JSON.stringify(proofs,null,2)+'\n');console.log(JSON.stringify(p));await new Promise(r=>setTimeout(r,1500));
}
