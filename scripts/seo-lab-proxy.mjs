// Local-only measurement adapter, never imported by the application.
// Use with a production build listening on 127.0.0.1:3100.
// Exposes browser PerformanceObserver results as readable DOM for restricted test browsers.
import { createServer } from 'node:http';

const observer = `<script>
(() => {
  const result = {method:'local production build; cold HTTP cache; no CPU/network throttling', lcp:null, shifts:[], errors:[]};
  new PerformanceObserver(list => {for(const e of list.getEntries()) result.lcp={ms:e.startTime,size:e.size,url:e.url,element:e.element?.tagName,className:e.element?.className};}).observe({type:'largest-contentful-paint',buffered:true});
  new PerformanceObserver(list => {for(const e of list.getEntries()) if(!e.hadRecentInput) result.shifts.push({ms:e.startTime,value:e.value});}).observe({type:'layout-shift',buffered:true});
  addEventListener('error', e => result.errors.push(e.message));
  addEventListener('unhandledrejection', e => result.errors.push(String(e.reason)));
  setInterval(() => {
    result.viewport={width:innerWidth,height:innerHeight,dpr:devicePixelRatio};
    result.overflow=document.documentElement.scrollWidth>innerWidth;
    result.theme=document.documentElement.dataset.theme;
    result.resources=performance.getEntriesByType('resource').filter(e=>/reading-scene|book-stack/.test(e.name)).map(e=>({url:e.name,start:e.startTime,end:e.responseEnd,encodedBytes:e.encodedBodySize,transferBytes:e.transferSize,initiator:e.initiatorType}));
    document.documentElement.setAttribute('data-seo-lab',JSON.stringify(result));
  },500);
})();</script>`;

createServer(async (request, response) => {
  if (!['GET','HEAD'].includes(request.method ?? '')) {response.writeHead(405).end();return;}
  try {
    const upstream = await fetch(new URL(request.url ?? '/', 'http://127.0.0.1:3100'), {
      redirect:'manual', headers:{'accept-language':request.headers['accept-language'] ?? 'en', cookie:request.headers.cookie ?? ''},
    });
    const headers=Object.fromEntries(upstream.headers);
    for(const key of ['content-length','content-encoding','transfer-encoding']) delete headers[key];
    headers['cache-control']='no-store';
    const data=Buffer.from(await upstream.arrayBuffer());
    response.writeHead(upstream.status, headers);
    response.end(headers['content-type']?.includes('text/html') ? data.toString().replace('<head>','<head>'+observer) : data);
  } catch (error) {response.writeHead(502).end(String(error));}
}).listen(3101,'127.0.0.1',()=>console.log('Read-only measurement proxy http://127.0.0.1:3101'));
