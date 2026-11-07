import test from 'node:test';import assert from 'node:assert/strict';
import { ReliableCatalogPages, CatalogUnavailable } from './reliable-page.ts';
import { guardBrowseResponse } from './browse-response.ts';
const html=(n:number,total=n)=>`<head><title>Browse</title></head><main data-browse-state="available" data-browse-total="${total}">${Array.from({length:n},()=>'<a class="book-card-main-link" href="/en/book/1">Book</a>').join('')}<span hidden="" data-browse-result-end="${n}"></span>`;
const req=new Request('https://example.invalid/en/browse?page=2');
test('normal, last page, true empty, redirects and other routes retain their HTTP/content',async()=>{
 for(const[n,total]of[[16,6377],[9,6377],[0,0]]){const body=html(n,total),r=await guardBrowseResponse(req,new Response(body,{headers:{'content-type':'text/html'}}));assert.equal(r.status,200);assert.equal(await r.text(),body);}
 const redir=new Response(null,{status:307,headers:{location:'/en/browse?page=399'}});assert.equal(await guardBrowseResponse(req,redir),redir);
 const other=new Response('');assert.equal(await guardBrowseResponse(new Request('https://example.invalid/en/book/1'),other),other);
});
test('missing, incomplete, upstream error and unexpectedly empty HTML never become successful empty200',async()=>{
 for(const body of['','<head></head>',html(0,40),'<main><span data-browse-result-end="16"></span>', '<main><span data-browse-result-end="unavailable"></span>', '<span data-browse-result-end="0"></span>']){
  const r=await guardBrowseResponse(req,new Response(body,{headers:{'content-type':'text/html'}}));assert.equal(r.status,503);assert.equal(r.headers.get('Retry-After'),'5');assert.equal(r.headers.get('cache-control'),'private, no-store');await r.text();
 }
 assert.equal((await guardBrowseResponse(req,new Response('render error',{status:500,headers:{'content-type':'text/html'}}))).status,503);
});
test('response guard releases cards without waiting for optional trailing streams',async()=>{
 let finish!:(v:Uint8Array)=>void;const enc=new TextEncoder();let first=true;
 const body=new ReadableStream<Uint8Array>({pull(c){if(first){first=false;c.enqueue(enc.encode(html(16,40)));}else return new Promise<void>(r=>{finish=v=>{c.enqueue(v);c.close();r();};});}});
 const r=await guardBrowseResponse(req,new Response(body,{headers:{'content-type':'text/html'}}));assert.equal(r.status,200);
 await Promise.resolve();finish(enc.encode('<div>optional cover</div>'));assert.match(await r.text(),/optional cover/);
});
test('bounded retries classify429,5xx,timeouts,invalid payloads and preserve last good query snapshots',async()=>{
 let now=0;const logs:Record<string,unknown>[]=[],delays:number[]=[];const cache=new ReliableCatalogPages<{count:number}>(()=>now,async ms=>{delays.push(ms);},()=>0,r=>logs.push(r));
 let calls=0;const opts={key:'en2',locale:'en',page:2,validate:(v:{count:number})=>{if(!Number.isInteger(v.count)||v.count!==16)throw Error('invalid');return v.count;},load:async()=>{calls++;return {count:16};}};
 await cache.get(opts);now=6000;await cache.get({...opts,load:async()=>{calls++;throw new CatalogUnavailable('upstream_429',429);}});assert.equal(calls,4);assert.deepEqual(delays,[120,240]);assert.equal(logs.at(-1)?.outcome,'stale_fallback');
 now=31000;for(const fault of[new CatalogUnavailable('5xx',502),Object.assign(Error(),{name:'TimeoutError'}),{count:0},{count:NaN}]){
  await assert.rejects(cache.get({...opts,key:'cold'+String(fault),load:async()=>{if(fault instanceof Error)throw fault;return fault;}}),CatalogUnavailable);
 }
 assert.equal(logs.at(-1)?.outcome,'unavailable');assert.equal(logs.at(-1)?.retrycount,2);
});
for(const concurrency of[3,6,10])test(`coalesces ${concurrency} concurrent requests without empty pages or retry storms`,async()=>{
 let calls=0;const cache=new ReliableCatalogPages<number>(Date.now,async()=>{},()=>0,()=>{});
 const o={key:'nl1',locale:'nl',page:1,validate:(n:number)=>n,load:async()=>{calls++;await new Promise(r=>setTimeout(r,3));return 16;}};
 const values=await Promise.all(Array.from({length:concurrency},()=>cache.get(o)));assert.deepEqual(values,Array(concurrency).fill(16));assert.equal(calls,1);
 const en=await cache.get({...o,key:'en1',locale:'en'});assert.equal(en,16);assert.equal(calls,2);
});

test('large valid 128-card SSR prefixes fit, and query failures have a short error cooldown instead of retry storms',async()=>{
 const body=html(128,6377).replace('<head>','<head>'+(' '.repeat(300000)));
 const response=await guardBrowseResponse(req,new Response(body,{headers:{'content-type':'text/html'}}));
 assert.equal(response.status,200);assert.equal(await response.text(),body);
 let now=0,calls=0;const cache=new ReliableCatalogPages<number>(()=>now,async()=>{},()=>0,()=>{});
 const o={key:'failed',locale:'en',page:1,validate:(n:number)=>n,load:async()=>{calls++;throw new CatalogUnavailable('upstream_5xx',503);}};
 await assert.rejects(cache.get(o));assert.equal(calls,3);
 await assert.rejects(cache.get(o));assert.equal(calls,3);
 now=5001;await assert.rejects(cache.get(o));assert.equal(calls,6);
});
