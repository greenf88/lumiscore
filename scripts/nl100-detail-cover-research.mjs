// Bounded exact-source inspection, not a guessed CDN resize/proxy or catalogue writer.
import fs from'node:fs/promises';import{createHash}from'node:crypto';import{performance}from'node:perf_hooks';
const base=new URL('../catalog/nl100-completion-20261031/',import.meta.url),root=new URL('../catalog/nl100-hosted-20261031/',import.meta.url),read=async n=>JSON.parse(await fs.readFile(new URL(n,base)));
const large=(await read('dossiers.json')).dossiers.filter(d=>d.status==='approved_local_proposal'&&d.cover.bytes>=300000),offset=Number(process.argv[2]??0);if(!Number.isInteger(offset)||offset<0||offset>34)throw Error('Explicit offset required');
await fs.mkdir(new URL('detail-covers/',root),{recursive:true});
for(const d of large.slice(offset,offset+6)){const file=new URL('detail-covers/'+d.workId+'.json',root);try{await fs.access(file);console.log('retained '+d.workId);continue;}catch{}
 const sourceUrl=d.sources.find(s=>s.url.startsWith('https://metadata.isbn.nl/'))?.url;if(!sourceUrl)throw Error('No existing primary host');
 const proof={workId:d.workId,isbn:d.isbn13,sourceUrl,full:{url:d.cover.url,bytes:d.cover.bytes,dimensions:d.cover.dimensions},checkedAt:new Date().toISOString(),newDataWrite:false};
 try{const response=await fetch(sourceUrl,{signal:AbortSignal.timeout(15000)}),html=await response.text();proof.sourceStatus=response.status;proof.sourceSha256=createHash('sha256').update(html).digest('hex');if(!response.ok)throw Error('SourceHTTP'+response.status);
  const asset=new URL(d.cover.url).pathname.split('/').at(-1).split('_')[0];const actual=[...html.matchAll(/(?:src|href|content|srcset)="([^"]+\.(?:jpg|png|webp)[^"]*)"/gi)].map(m=>m[1].replaceAll('&amp;','&')).filter(u=>u.includes(asset));
  proof.publishedVariants=[...new Set(actual.map(u=>new URL(u,sourceUrl).href))].map(url=>({url,sizeHint:url.match(/_\d+_(\d+)_(\d+)_0_0\./)?.slice(1).map(Number)??null,exactAssetKey:asset}));
  proof.derivativeForDetail=proof.publishedVariants.find(v=>v.sizeHint?.[0]>=300&&v.sizeHint?.[1]>=400)??null;
  if(proof.derivativeForDetail){const v=proof.derivativeForDetail,start=performance.now(),r=await fetch(v.url,{signal:AbortSignal.timeout(15000)}),bytes=Buffer.from(await r.arrayBuffer());Object.assign(v,{http:r.status,contentType:r.headers.get('content-type'),bytes:bytes.length,sourceDownloadMs:performance.now()-start,sha256:createHash('sha256').update(bytes).digest('hex'),qualityReview:'pending_not_approved'});}
  proof.decision=proof.derivativeForDetail?'Published detail-sized candidate requires image identity/quality review':'Only full cover and small card/banner derivatives actually published in inspected source; these are not approved as upscaled detail replacements';
 }catch(e){proof.error=e.message;proof.decision='Retain verified full cover; source inspection not a false no-cover outcome';}
 await fs.writeFile(file,JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));await new Promise(r=>setTimeout(r,1700));
}
