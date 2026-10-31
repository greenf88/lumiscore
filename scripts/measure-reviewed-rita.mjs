import fs from 'node:fs';
import {createHash} from 'node:crypto';
const prefix='https://metadata.isbn.nl/ie_fcache/0000523349_De_heilige_Rita_';
const results=[];
for(const variant of ['0_0.jpg','3_130_250_0_0.jpg'])for(let sample=1;sample<=3;sample++){
 const started=performance.now(),res=await fetch(prefix+variant,{signal:AbortSignal.timeout(20000)}),headers=performance.now();
 if(!res.ok||!res.headers.get('content-type')?.startsWith('image/'))throw Error('Stop on provider failure, no retries');
 const bytes=Buffer.from(await res.arrayBuffer());results.push({variant,sample,status:res.status,bytes:bytes.length,ttfbMs:Math.round(headers-started),completeMs:Math.round(performance.now()-started),sha256:createHash('sha256').update(bytes).digest('hex')});
}
const proof={checkedAt:new Date().toISOString(),isbn:'9789023458753',source:'https://metadata.isbn.nl/993728/de-heilige-rita.html',profile:'Node direct GET on this desktop network, three sequential visits per offered image; no forced CDN cold start, mobile throttling or LCP claim',offeredVariantsOnly:true,mediumOffered:false,decision:'Keep exact high-resolution detail image. Offered162x250 card image is too small to replace312px detail at2x density. No invented resize URL or new host/storage.',results};
fs.writeFileSync(new URL('../catalog/release-20261031/rita-delivery-measurement.json',import.meta.url),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
