// Sequential public HTTP baseline. No login, mutations, cache purge or load test.
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { TASTE_TEST_QUESTIONS } from '../lib/taste-test/config.ts';
const base = process.argv[2] ?? 'https://lumisco.re';
const url = new URL(base);
if (!['lumisco.re', 'localhost'].includes(url.hostname)) throw new Error('Unexpected measurement target.');
const output = `outputs/performance-review/http-${url.hostname === 'lumisco.re' ? 'production' : 'local'}.json`;
const routes = ['/', '/browse', '/browse?sort=highest', '/search?q=1984',
  '/browse?author=45', '/browse?category=fiction_fantasy',
  '/browse?author=45&category=fiction_mystery_crime&sort=highest&page=2',
  '/book/168?returnTo=%2Fbrowse%3Fsort%3Dhighest%26page%3D2', '/categories'];
const samples = [];
const filtersOnly = process.argv[3] === 'filters';
const measuredRoutes = filtersOnly ? routes.slice(4,7) : routes;
const summary = (values) => ({ median: [...values].sort((a,b)=>a-b)[1], min: Math.min(...values), max: Math.max(...values) });
for (const device of ['desktop', 'mobile']) {
  const agent = device === 'desktop' ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36'
    : 'Mozilla/5.0 (Linux; Android 11; Moto G Power) AppleWebKit/537.36 Chrome/153.0.0.0 Mobile Safari/537.36';
  for (const route of measuredRoutes) for (let repeat = 0; repeat < 3; repeat++) {
    const start = performance.now();
    const response = await fetch(new URL(route, url), { headers: { 'User-Agent': agent }, signal: AbortSignal.timeout(30000) });
    const headersMs = performance.now() - start;
    const body = await response.text();
    assert.equal(response.status, 200, `Baseline route unavailable: ${route}`);
    const links = [...body.matchAll(/href="(?:https:\/\/lumisco\.re)?\/book\/(\d+)[^"]*"/g)].map(m=>m[1]);
    samples.push({ device, route, repeat: repeat+1, at:new Date().toISOString(), status: response.status, headersMs: Math.round(headersMs),
      completeMs: Math.round(performance.now()-start), decodedBodyBytes: Buffer.byteLength(body),
      uniqueBookLinks: new Set(links).size, cache: response.headers.get('x-vercel-cache') ?? 'unknown',
      age: response.headers.get('age'), serverTiming: response.headers.get('server-timing'),
      contentEncoding: response.headers.get('content-encoding'), contentLength: response.headers.get('content-length'),
      robots: [...body.matchAll(/<meta[^>]*name="robots"[^>]*content="([^"]+)"/g)].map(m=>m[1]),
      canonicals: [...body.matchAll(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/g)].map(m=>m[1]),
    });
  }
}
const api = [];
for (let repeat=0; !filtersOnly && repeat<3; repeat++) {
  const start=performance.now();
  const response=await fetch(new URL('/api/recommendations/guest',url), {
    method:'POST', headers:{ Origin:url.origin, 'Content-Type':'application/json' },
    body:JSON.stringify({answers:Object.fromEntries(TASTE_TEST_QUESTIONS.map(q=>[q.key,'left'])),locale:'en',limit:20}),
    signal:AbortSignal.timeout(30000),
  });
  const headersMs=performance.now()-start, body=await response.text();
  const parsed=JSON.parse(body), recs=parsed.recommendations??[];
  assert.equal(response.status, 200, 'Recommendation baseline unavailable.');
  assert.equal(recs.length, 20, 'Baseline must actually contain twenty recommendations.');
  assert.equal(new Set(recs.map(r=>r.book.workId)).size, 20);
  assert.ok(response.headers.get('cache-control')?.includes('private'));
  assert.ok(response.headers.get('cache-control')?.includes('no-store'));
  api.push({repeat:repeat+1,status:response.status,headersMs:Math.round(headersMs),completeMs:Math.round(performance.now()-start),
    decodedBodyBytes:Buffer.byteLength(body),records:recs.length,uniqueWorks:new Set(recs.map(r=>r.book.workId)).size,
    cacheControl:response.headers.get('cache-control')});
}
const previous=filtersOnly?JSON.parse(await readFile(output,'utf8')):null;
if(previous) samples.push(...previous.samples.filter(s=>!measuredRoutes.includes(s.route)));
const sitemapResponse=filtersOnly?null:await fetch(new URL('/sitemap.xml',url),{signal:AbortSignal.timeout(30000)});
if(sitemapResponse) assert.equal(sitemapResponse.status, 200, 'Sitemap baseline unavailable.');
const sitemap=sitemapResponse?await sitemapResponse.text():'';
const paths=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>new URL(m[1]).pathname);
const report={at:new Date().toISOString(),base:url.origin,tool:`Node ${process.version} fetch; sequential`,
  location:'user Windows workstation; geographical egress not measured',network:'unthrottled; mobile user agent only, not browser/device/network emulation',
  cache:'CDN headers observed; internal function/public catalog cache unknown; no purge; three sequential samples; no separate warmup',
  limits:'headersMs includes network, edge and server, not pure server time; body bytes decoded, not wire transfer; no browser LCP; no p95/RUM',
  samples, api:previous?.api??api, summaries: [...new Set(samples.map(s=>`${s.device}|${s.route}`))].map(key=>{
    const subset=samples.filter(s=>`${s.device}|${s.route}`===key);
    return {key,headersMs:summary(subset.map(s=>s.headersMs)),completeMs:summary(subset.map(s=>s.completeMs))};
  }),sitemap:previous?.sitemap??{status:sitemapResponse.status,urls:paths.length,books:paths.filter(p=>p.startsWith('/book/')).length,
    collections:paths.filter(p=>p.startsWith('/collection/')).length,categories:paths.filter(p=>p==='/categories').length,
    duplicates:paths.length-new Set(paths).size}};
await mkdir('outputs/performance-review',{recursive:true});
await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({saved:output,requestsThisRun:measuredRoutes.length*6+(filtersOnly?0:4),api:report.api,sitemap:report.sitemap}));
