// Use only thumbnail URLs actually embedded alongside the reviewed edition.
import fs from 'node:fs/promises';import {createHash} from 'node:crypto';
const root=new URL('../catalog/edition-recovery-20261031/',import.meta.url),review=JSON.parse(await fs.readFile(new URL('reviewed-editions.json',root))),proof=JSON.parse(await fs.readFile(new URL('cover-http.json',root))),out=[];
for(const e of review.editions.filter(e=>proof.find(p=>p.isbn===e.isbn)?.bytes>300000)){
 const source=JSON.parse(await fs.readFile(new URL('sources/'+e.sourceFile,root))),page=source.pages[e.page],r=await fetch(page.url,{signal:AbortSignal.timeout(15000)}),html=await r.text();
 const stem=e.cover.split('/').pop().replace('_0_0.jpg','');
 const candidates=[...new Set([...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>new URL(m[1].replaceAll('&amp;','&'),page.url).href).filter(u=>u.includes('/'+stem+'_2_')&&u.endsWith('.jpg')))];
 let url=candidates[0];
 if(!url&&e.isbn==='9789047516835'){
  const search=JSON.parse(await fs.readFile(new URL('sources/inwijding-isbn-search.json',root)));
  url=search.links.find(u=>u.includes('/'+stem+'_2_')&&u.endsWith('.jpg'));
  if(url)url=new URL(url,'https://metadata.isbn.nl').href;
 }
 if(!url){out.push({isbn:e.isbn,status:'no-observed-variant'});continue;}
 const start=performance.now(),ir=await fetch(url,{signal:AbortSignal.timeout(15000)}),b=Buffer.from(await ir.arrayBuffer());
 const p={isbn:e.isbn,source:page.url,url,status:ir.status,bytes:b.length,contentType:ir.headers.get('content-type'),ms:Math.round(performance.now()-start),checkedAt:new Date().toISOString(),sha256:createHash('sha256').update(b).digest('hex')};
 if(ir.ok&&b.length>1000&&p.contentType?.startsWith('image/')){p.file='cover-proof/'+e.isbn+'-card.jpg';await fs.writeFile(new URL(p.file,root),b);}
 out.push(p);console.log(JSON.stringify(p));await new Promise(r=>setTimeout(r,1500));
}
await fs.writeFile(new URL('card-cover-http.json',root),JSON.stringify(out,null,2)+'\n');
