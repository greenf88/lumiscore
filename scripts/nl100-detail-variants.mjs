// Never infer dimensions from a CDN filename: fetch actual published same-asset variants.
import fs from'node:fs/promises';import{createHash}from'node:crypto';import{performance}from'node:perf_hooks';import{fileURLToPath}from'node:url';
const root=new URL('../catalog/nl100-hosted-20261031/',import.meta.url),folder=new URL('../../../outputs/nl100-hosted-20261031/detail-variants/',import.meta.url),offset=Number(process.argv[2]);if(!Number.isInteger(offset)||offset<0||offset>34)throw Error('Explicit bounded offset required');
const names=(await fs.readdir(new URL('detail-covers/',root))).sort(),proofs=await Promise.all(names.map(async n=>JSON.parse(await fs.readFile(new URL('detail-covers/'+n,root)))));await fs.mkdir(folder,{recursive:true});await fs.mkdir(new URL('detail-variants/',root),{recursive:true});
for(const p of proofs.slice(offset,offset+8)){
 const out=new URL('detail-variants/'+p.workId+'.json',root);try{await fs.access(out);console.log('retained '+p.workId);continue;}catch{}
 const candidate=p.publishedVariants.find(v=>/_2_710_130_0_0\./.test(v.url)),row={workId:p.workId,isbn:p.isbn,sourceUrl:p.sourceUrl,sourceSha256:p.sourceSha256,original:p.full,checkedAt:new Date().toISOString(),actualPublishedUrl:candidate?.url??null,filenameSizeIsNotDimensions:true,qualityReview:'pending'};
 if(candidate){try{const start=performance.now(),r=await fetch(candidate.url,{signal:AbortSignal.timeout(15000)});row.headersMs=performance.now()-start;const b=Buffer.from(await r.arrayBuffer());Object.assign(row,{status:r.status,contentType:r.headers.get('content-type'),bytes:b.length,downloadMs:performance.now()-start,sha256:createHash('sha256').update(b).digest('hex')});if(r.ok&&row.contentType?.startsWith('image/')&&b.length<2000000){const file=new URL(p.isbn+'.jpg',folder);await fs.writeFile(file,b);row.localQAFile=fileURLToPath(file);}else row.error='Unusable response';}catch(e){row.error=e.message;}}
 else row.error='No actual published710variant';
 await fs.writeFile(out,JSON.stringify(row,null,2)+'\n');console.log(JSON.stringify(row));await new Promise(r=>setTimeout(r,1700));
}
