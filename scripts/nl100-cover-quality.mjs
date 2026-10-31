// Retain three measured, exact published card assets and one published banner for visual QA.
import fs from'node:fs/promises';import{createHash}from'node:crypto';
const root=new URL('../catalog/nl100-hosted-20261031/',import.meta.url),proof=JSON.parse(await fs.readFile(new URL('cover-load-measurements.json',root)));
const folder=new URL('../../../outputs/nl100-hosted-20261031/covers/',import.meta.url);await fs.mkdir(folder,{recursive:true});
const requested=proof.rows.filter(r=>r.kind==='mobileCard'&&r.visit===1).map(r=>({...r,file:r.isbn+'-card.jpg'}));
const full=JSON.parse(await fs.readFile(new URL('detail-covers/1369.json',root)));
requested.push({workId:1369,isbn:full.isbn,url:full.publishedVariants.find(v=>v.sizeHint?.[0]===710)?.url,file:full.isbn+'-banner.jpg'});
const rows=[];for(const r of requested){if(!r.url)throw Error('No actual published variant');const response=await fetch(r.url,{signal:AbortSignal.timeout(15000)}),bytes=Buffer.from(await response.arrayBuffer()),hash=createHash('sha256').update(bytes).digest('hex');if(!response.ok||!response.headers.get('content-type')?.startsWith('image/')||r.sha256&&hash!==r.sha256)throw Error('Changed or invalid image');await fs.writeFile(new URL(r.file,folder),bytes);rows.push({workId:r.workId,isbn:r.isbn,url:r.url,status:response.status,bytes:bytes.length,sha256:hash,localQAFile:new URL(r.file,folder).pathname,qualityReview:'pending_not_detail_approved'});console.log(JSON.stringify(rows.at(-1)));await new Promise(r=>setTimeout(r,1700));}
await fs.writeFile(new URL('cover-quality-examples.json',root),JSON.stringify(rows,null,2)+'\n');
