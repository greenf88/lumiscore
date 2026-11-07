import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const origin='http://127.0.0.1:45432',report={kind:'actual Vercel production bundle; synthetic loopback PostgREST; not hosted/production data',at:new Date().toISOString(),faults:[],runs:[]};
async function request(path){const start=performance.now(),r=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(20000)}),html=await r.text();return {path,status:r.status,retryAfter:r.headers.get('retry-after'),location:r.headers.get('location'),ms:Math.round(performance.now()-start),ids:[...html.matchAll(/<article class="book-card browse-card" id="work-(\d+)"/g)].map(m=>m[1]),cardcount:[...html.matchAll(/class="book-card-main-link"/g)].length,html};}
for(const [query,status]of[['',200],['flaky429',200],['flaky503',200],['timeout',503],['emptypayload',503],['invalidjson',503],['emptycatalog',200]]){
 const r=await request('/en/browse'+(query?'?q='+query:''));assert.equal(r.status,status,query);
 if(status===503){assert.equal(r.cardcount,0);assert.equal(r.retryAfter,'5');}
 else assert.equal(r.cardcount,query==='emptycatalog'?0:16);
 if(!query){
  const head=r.html.slice(0,r.html.indexOf('</head>'));
  const images=[...head.matchAll(/<link(?=[^>]*rel="preload")(?=[^>]*as="image")[^>]*>/g)];
  assert.equal(images.length,1,'only the real first cover is preloaded in the original head');
  assert.match(images[0][0],/imagesrcset=/i);assert.match(images[0][0],/imagesizes=/i);
  assert.match(r.html,/width="660" height="1000"/);
 }
 const {path,status:responseStatus,retryAfter,location,ms,cardcount}=r;report.faults.push({path,status:responseStatus,retryAfter,location,ms,cardcount});
}
const outside=await request('/en/browse?page=999');assert.equal(outside.status,307);assert.equal(outside.location,'/en/browse?page=399');
for(const concurrency of[3,6,10]){
 const pages=[];let next=1;await Promise.all(Array.from({length:concurrency},async()=>{
  for(;;){const page=next++;if(page>399)break;const r=await request('/en/browse'+(page>1?'?page='+page:''));
   assert.equal(r.status,200,`page ${page} / concurrency ${concurrency}`);assert.equal(r.cardcount,page===399?9:16);
   assert.equal(r.ids.length,r.cardcount);pages.push({page,status:r.status,ids:r.ids,cardcount:r.cardcount,ms:r.ms});}
 }));pages.sort((a,b)=>a.page-b.page);const ids=pages.flatMap(p=>p.ids);
 assert.equal(ids.length,6377);assert.equal(new Set(ids).size,6377);
 assert.deepEqual(ids,Array.from({length:6377},(_,i)=>String(i+1)));
 report.runs.push({concurrency,pages:pages.length,books:ids.length,unique:new Set(ids).size,empty200:0,results:pages});
 console.log(`PASS ${concurrency} concurrent: 399 pages, 6377 unique, zero empty200`);
}
await mkdir('outputs/seo-reliability-20261107',{recursive:true});await writeFile('outputs/seo-reliability-20261107/built-browse.json',JSON.stringify(report,null,2));
console.log('PASS all synthetic built-server Browse checks');
