// QA of published same-edition thumbnails. Never synthesize a resized URL or upload.
import fs from'node:fs/promises';import{createHash}from'node:crypto';
const root=new URL('../catalog/nl100-completion-20261031/',import.meta.url);
const proof=JSON.parse(await fs.readFile(new URL('cover-proof.json',root)));
const selected=JSON.parse(await fs.readFile(new URL('draft-edition-selections.json',root)));
const pending=proof.filter(p=>p.bytes>=300000&&!p.card&&!p.cardAttempt&&selected.some(s=>s.isbn===p.isbn)).slice(0,8);
const pause=()=>new Promise(r=>setTimeout(r,1700));
for(const p of pending){p.cardAttempt={at:new Date().toISOString(),reason:'Full asset >=300000bytes; inspect published anchor/image relationship'};
 try{if(!p.sourceUrl.startsWith('https://metadata.isbn.nl/'))throw Error('No permitted primary thumbnail source');const r=await fetch(p.sourceUrl,{signal:AbortSignal.timeout(16000)});await pause();if(!r.ok)throw Error('Primary metadataHTTP'+r.status);const html=await r.text();const matches=[...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].filter(m=>new URL(m[1].replaceAll('&amp;','&'),p.sourceUrl).href===p.url).flatMap(m=>[...m[2].matchAll(/<img[^>]*src="([^"]+)"/gi)].map(i=>new URL(i[1].replaceAll('&amp;','&'),p.sourceUrl).href));const unique=[...new Set(matches)];p.cardAttempt.sourceSha256=createHash('sha256').update(html).digest('hex');if(unique.length!==1||unique[0]===p.url)throw Error('No unique published distinct thumbnail');const url=unique[0];if(!url.startsWith('https://metadata.isbn.nl/ie_fcache/'))throw Error('New host not allowed');const res=await fetch(url,{signal:AbortSignal.timeout(16000)}),b=Buffer.from(await res.arrayBuffer());await pause();if(!res.ok||!res.headers.get('content-type')?.startsWith('image/')||b.length<1000)throw Error('Unusable thumbnail');p.card={url,sourceUrl:p.sourceUrl,sourceSha256:p.cardAttempt.sourceSha256,status:res.status,bytes:b.length,type:res.headers.get('content-type'),sha256:createHash('sha256').update(b).digest('hex'),at:new Date().toISOString(),binding:'Actual image nested in exact full-cover anchor; not a guessed suffix',visualReview:'pending'};
 }catch(e){p.cardAttempt.error=e.message;}
 await fs.writeFile(new URL('cover-proof.json',root),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({workId:p.workId,isbn:p.isbn,full:p.bytes,card:p.card,error:p.cardAttempt.error}));
}
console.log(JSON.stringify({checked:pending.length,remaining:proof.filter(p=>p.bytes>=300000&&!p.card&&!p.cardAttempt&&selected.some(s=>s.isbn===p.isbn)).length}));
