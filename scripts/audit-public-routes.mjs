import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { inspectServerHtml } from '../lib/seo/server-html.ts';

const [input, output, overrideOrigin, mode] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: audit-public-routes.mjs Tabel.csv REPORT.json [ORIGIN]');
const csv = await readFile(input, 'utf8');
const rows = csv.trim().split(/\r?\n/).slice(1).map(line => {
  const split = line.lastIndexOf(',');
  return { originalUrl: line.slice(0, split), lastCrawled: line.slice(split + 1) };
});
const origin = overrideOrigin ?? 'https://lumisco.re';
const previous = mode === '--reparse' ? JSON.parse(await readFile(output,'utf8')) : null;
const decode = value => value.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#x27;', "'").replaceAll('&#39;', "'");
const text = value => decode(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, k, v]) => [k.toLowerCase(), decode(v)]));
const startedAt = new Date().toISOString();
await mkdir(dirname(resolve(output)), { recursive: true });
const htmlDir = resolve(dirname(output), 'server-html');
await mkdir(htmlDir, { recursive: true });
async function request(url) {
  const start = performance.now(), chain = [];
  for (let hop = 0; hop < 5; hop++) {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'LumiScore-ReadOnly-Audit/1.0', Accept: 'text/html,application/xml' } });
    const ttfbMs = performance.now() - start;
    chain.push({ url, status: response.status, location: response.headers.get('location') });
    if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
      await response.body?.cancel();
      const target = new URL(response.headers.get('location'), url);
      if (target.origin !== new URL(origin).origin) throw new Error('Cross-origin redirect requires review: ' + target.origin);
      url = target.href; continue;
    }
    let html = '', firstH1Ms = null, firstCardMs = null;
    const decoder = new TextDecoder();
    for await (const chunk of response.body) {
      html += decoder.decode(chunk, { stream: true });
      if (firstH1Ms === null && /<h1\b/.test(html)) firstH1Ms = performance.now() - start;
      if (firstCardMs === null && /<article\b[^>]*class="book-card/.test(html)) firstCardMs = performance.now() - start;
    }
    return { status: response.status, finalUrl: url, chain, headers: Object.fromEntries(['x-robots-tag','cache-control','server-timing','x-vercel-cache','content-type'].map(k=>[k,response.headers.get(k)])), ttfbMs, firstH1Ms, firstCardMs, totalMs: performance.now()-start, html };
  }
  throw new Error('Redirect limit exceeded');
}
const sitemap = previous ? previous.sitemap : await request(origin + '/sitemap.xml');
const sitemapUrls = new Set(previous ? previous.results.filter(r=>r.sitemapCanonical).flatMap(r=>r.canonical) : [...sitemap.html.matchAll(/<loc>(.*?)<\/loc>/g)].map(([,v])=>decode(v)));
const summary = { total: rows.length, bookUrls: rows.filter(r=>/\/book\/\d+/.test(new URL(r.originalUrl).pathname)).length, collectionUrls: rows.filter(r=>/\/collection\//.test(new URL(r.originalUrl).pathname)).length,
  uniqueWorks: new Set(rows.flatMap(r=>r.originalUrl.match(/\/book\/(\d+)/)?.[1]??[])).size,
  nl: rows.filter(r=>new URL(r.originalUrl).pathname.startsWith('/nl/')).length,
  en: rows.filter(r=>new URL(r.originalUrl).pathname.startsWith('/en/')).length,
  unprefixed: rows.filter(r=>!/^\/(nl|en)\//.test(new URL(r.originalUrl).pathname)).length,
  returnTo: rows.filter(r=>new URL(r.originalUrl).searchParams.has('returnTo')).length,
  firstCrawl: rows.map(r=>r.lastCrawled).sort()[0], lastCrawl: rows.map(r=>r.lastCrawled).sort().at(-1) };
const results = Array(rows.length); let cursor = 0;
async function worker() {
  while (cursor < rows.length) {
    const index=cursor++, row=rows[index], original=new URL(row.originalUrl), checkedAt=new Date().toISOString();
    try {
      const result=previous ? {...previous.results[index],html:await readFile(resolve(htmlDir,`${index+1}.html`),'utf8')} : await request(origin+original.pathname+original.search);
      const {html,...transport}=result, meta=inspectServerHtml(html);
      const markup=html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<!--[\s\S]*?-->/g,'');
      const main=markup.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1]??markup;
      const descriptionBlock=main.match(/(?:book-description|description-section)[\s\S]{0,10000}/)?.[0]??'';
      const jsonLd=[...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(([,v])=>{try{return {valid:true,value:JSON.parse(v)}}catch{return {valid:false}}});
      const canonical=meta.canonical[0]??null;
      const flags=[];
      if(result.status>=500)flags.push('temporary_server_failure');
      if(result.chain.length>1)flags.push('redirect');
      if(original.searchParams.has('returnTo'))flags.push('navigation_variant');
      if(/noindex/i.test([...meta.robots,result.headers['x-robots-tag']].join(' ')))flags.push('noindex');
      if(/verified English edition is not available|geen geverifieerde Nederlandse of Engelse editie/i.test(text(main)))flags.push('edition_unavailable');
      const missingDescription=/verified English description is not available|geen geverifieerde (?:Nederlandse|Engelse) beschrijving/i.test(text(main));
      if(missingDescription)flags.push('description_missing_or_uncertain');
      const images=[...main.matchAll(/<img\b[^>]*>/g)].map(([t])=>attrs(t));
      if(!images.length)flags.push('neutral_cover');
      if(!meta.h1.length)flags.push('missing_server_h1');
      if(!flags.length)flags.push('technically_usable_indexing_cause_unknown');
      const record={...row,checkedAt,...transport,route:new URL(result.finalUrl).pathname,workId:original.pathname.match(/\/book\/(\d+)/)?.[1]??null,collection:original.pathname.match(/\/collection\/([^/]+)/)?.[1]??null,
        ...meta,h1:meta.h1.map(decode),title:[...markup.matchAll(/<title[^>]*>(.*?)<\/title>/gs)].map(([,v])=>text(v)),description:meta.metadata.description??[],
        hreflang:[...markup.matchAll(/<link\b[^>]*hreflang[^>]*>/g)].map(([t])=>attrs(t)),
        serverMainText:text(main).slice(0,16000),serverMainTextLength:text(main).length,
        descriptionStatus:missingDescription?'missing_or_uncertain':descriptionBlock?'block_present':'inspect_required',
        covers:images.map(i=>({src:i.src,alt:i.alt,loading:i.loading})),actualImageLoad:'not_verified_by_HTTP_HTML',
        publicScore:main.match(/aria-labelledby="lumiscore-heading"[\s\S]*?<strong[^>]*>(.*?)<\/strong>/)?.[1]??null,
        jsonLd,sitemapOriginal:previous?previous.results[index].sitemapOriginal:sitemapUrls.has(row.originalUrl),sitemapCanonical:canonical?sitemapUrls.has(canonical):false,flags,
        suggestedAction:flags.includes('temporary_server_failure')?'investigate_transport':flags.includes('neutral_cover')||flags.includes('edition_unavailable')?'review_exact_edition_evidence':flags.includes('description_missing_or_uncertain')?'review_description_sources':'retain_canonical_and_monitor',
      };
      results[index]=record;await writeFile(resolve(htmlDir,`${index+1}.html`),html);
      console.log(JSON.stringify({index:index+1,status:result.status,h1:meta.h1,ms:Math.round(result.totalMs),flags}));
    } catch(error) {results[index]={...row,checkedAt,error:String(error),flags:['temporary_transport_failure']};console.log(JSON.stringify({index:index+1,error:String(error)}));}
  }
}
await Promise.all([worker(),worker()]);
await writeFile(output,JSON.stringify({startedAt:previous?.startedAt??startedAt,finishedAt:previous?.finishedAt??new Date().toISOString(),reparsedAt:previous?new Date().toISOString():undefined,inputSha256:createHash('sha256').update(csv).digest('hex'),origin,summary,
  setup:'2 concurrent guest HTTP GETs; 20s per response; max5 redirects; no automatic retries. First H1/card is server delivery, not browser paint. Historical Google HTML unavailable.',
  sitemap:{status:sitemap.status,count:previous?sitemap.count:sitemapUrls.size,totalMs:sitemap.totalMs},results},null,2));
console.log(JSON.stringify({summary,completed:results.length,output}));
