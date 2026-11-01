// Limited public GET measurements. No cookies, credentials, production writes or load test.
import fs from'node:fs/promises';
const base='https://lumiscore-girsv1hd9-rgkgroeneveld-9102.vercel.app';
const cases=[['preview-search',base+'/nl/search?q=Hof&pageSize=16&sort=relevance'],['preview-detail',base+'/nl/book/976100101'],['preview-page2',base+'/nl/browse?page=2&pageSize=16&sort=score_desc'],['old-cover6234','https://covers.openlibrary.org/b/id/12146827-L.jpg?default=false'],['old-cover1596','https://covers.openlibrary.org/b/id/11455072-L.jpg?default=false'],['selected-cover3301','https://covers.openlibrary.org/b/id/15162548-L.jpg?default=false']];
const rows=[];for(const[name,url]of cases)for(let i=0;i<3;i++){
 const start=performance.now(),at=new Date().toISOString(),o={name,url,attempt:i+1,at};
 try{const r=await fetch(url,{signal:AbortSignal.timeout(16000)});o.headersMs=performance.now()-start;o.status=r.status;if([401,403,429].includes(r.status)||new URL(r.url).origin!==new URL(url).origin)throw Error('Provider refusal/protection redirect/rate limit; stop, no alternate route');
 const b=await r.arrayBuffer();o.bodyCompleteMs=performance.now()-start;o.bytes=b.byteLength;o.contentType=r.headers.get('content-type');}catch(e){o.error=e.message;if(/Provider refusal/.test(o.error)){rows.push(o);await fs.writeFile('catalog/nl-research-005-20261101/limited-transfer-measurements.json',JSON.stringify(rows,null,2)+'\n');throw e;}}
 rows.push(o);console.log(JSON.stringify(o));await new Promise(r=>setTimeout(r,1200));
}
await fs.writeFile('catalog/nl-research-005-20261101/limited-transfer-measurements.json',JSON.stringify({method:'Node client time to response headers (TTFB approximation including connection), full body transfer; not browser LCP/visible-content time. First/second/third sequential requests, CDN/application coldness not controlled. No production load test.',rows},null,2)+'\n');
