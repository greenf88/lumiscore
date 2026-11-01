// Bounded public-source transport measurements, never reported as application LCP.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
const packet=new URL('../catalog/nl100-completion-20261031/',import.meta.url);
const out=new URL('../catalog/nl100-hosted-20261031/',import.meta.url);
const proofs=JSON.parse(await fs.readFile(new URL('cover-proof.json',packet)));
const selected=proofs.filter(p=>p.identity==='manual_title_author_plus_exact_isbn_bibliographic_binding'&&p.card&&p.bytes>=300000).sort((a,b)=>b.bytes-a.bytes);
const examples=[selected[0],selected[Math.floor(selected.length/2)],selected.at(-1)];
const rows=[];
for(const p of examples) for(const kind of ['detail','mobileCard']) for(let visit=1;visit<=3;visit++){
 const url=kind==='detail'?p.url:p.card.url,start=performance.now();
 const row={workId:p.workId,isbn:p.isbn,kind,visit,url,checkedAt:new Date().toISOString(),cacheCondition:visit===1?'First request in this process; origin/CDN cold state not controlled':'Repeated URL in same process; origin/CDN cold state not controlled'};
 try{const response=await fetch(url,{signal:AbortSignal.timeout(15000)});row.headersMs=performance.now()-start;const bytes=Buffer.from(await response.arrayBuffer());Object.assign(row,{completeDownloadMs:performance.now()-start,status:response.status,contentType:response.headers.get('content-type'),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),sameAsVerifiedAsset:createHash('sha256').update(bytes).digest('hex')===(kind==='detail'?p.sha256:p.card.sha256)});}catch(e){row.error=e.message;}
 rows.push(row);console.log(JSON.stringify(row));await new Promise(r=>setTimeout(r,1700));
}
const summarize=rs=>{const a=rs.map(r=>r.completeDownloadMs).filter(Number.isFinite).sort((a,b)=>a-b);return{n:a.length,min:a[0],median:a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2,max:a.at(-1)};};
await fs.writeFile(new URL('cover-load-measurements.json',out),JSON.stringify({environment:'Agent computer to existing public source, normal connection, no mobile throttling; not hosted page/LCP/TTFB',rows,byExample:examples.map(p=>({workId:p.workId,isbn:p.isbn,detail:summarize(rows.filter(r=>r.workId===p.workId&&r.kind==='detail')),mobileCard:summarize(rows.filter(r=>r.workId===p.workId&&r.kind==='mobileCard'))})),noBindingsChanged:true},null,2)+'\n');
