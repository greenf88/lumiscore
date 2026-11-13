import { readSitemapShards } from './sitemap-http-helpers.mjs';
// Actual Vinext router with isolated synthetic loaders; no database or provider writes.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import net from 'node:net';
const root=fileURLToPath(new URL('../',import.meta.url)),py=process.env.METADATA_AUDIT_PYTHON??(process.platform==='win32'?'python':'python3');
const port=await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
let log='';const child=spawn(process.execPath,['scripts/seo-critical-local.mjs','--port='+port,'--slow-cover','--slow-description'],{cwd:root,stdio:['ignore','pipe','pipe'],windowsHide:true});
const run=(exe,args)=>new Promise((resolve,reject)=>{const p=spawn(exe,args,{cwd:root,stdio:['ignore','pipe','pipe'],windowsHide:true});let output='';p.stdout.on('data',b=>output+=b);p.stderr.on('data',b=>output+=b);p.once('error',reject);p.once('exit',c=>c===0?resolve(output):reject(Error('Command failed '+c+'\n'+output.slice(-5000))));});
try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Fixture start timed out\n'+log.slice(-3000))),45000);child.once('exit',c=>{clearTimeout(timer);reject(Error('Fixture exited '+c+'\n'+log.slice(-3000)));});for(const stream of[child.stdout,child.stderr])stream.on('data',b=>{log=(log+b).slice(-10000);if(log.includes('SYNTHETIC SEO SSR PREVIEW')){clearTimeout(timer);resolve();}});});
 // Compile the real home route before the bounded parallel audit; compilation is not metadata latency.
 const warm=await fetch('http://127.0.0.1:'+port+'/en',{signal:AbortSignal.timeout(90000)});assert.equal(warm.status,200);await warm.text();
 const sitemap=(await readSitemapShards('http://127.0.0.1:'+port)).join('');
 const article='/nl/nieuws/andy-weir-volgende-boek-geen-project-hail-mary-2';
 for (const path of ['/nl/nieuws', article, '/en'+article.slice(3), '/nl/nieuws/onbekend']) {
  const found = path === '/nl/nieuws' || path === article;
  const response = await fetch('http://127.0.0.1:'+port+path, {redirect:'manual'});
  assert.equal(response.status, found ? 200 : 404, path);
  const html = await response.text();
  const head = html.split('</head>')[0];
  assert.doesNotMatch(head, /hreflang=/i, path);
  assert.deepEqual([...head.matchAll(/rel="canonical" href="([^"]+)"/g)].map(match => match[1]),
   found ? ['https://lumisco.re'+path] : [], path);
  if (found) assert.ok(sitemap.includes('<loc>https://lumisco.re'+path+'</loc>'), path);
  if (path === article) {
   assert.match(head, /property="og:image" content="https:\/\/lumisco\.re\/assets\/news\/andy-weir-volgende-boek\.jpg"/);
   assert.match(html, /95\.000 woorden/);
   assert.match(html, /href="\/nl\/book\/1"/);
  }
 }
 const sitemapBooks=[...sitemap.matchAll(/<url><loc>https:\/\/lumisco\.re(\/(?:en|nl)\/book\/\d+)<\/loc>(.*?)<\/url>/g)];
 assert.deepEqual(sitemapBooks.map(m=>m[1]),['/en/book/1','/en/book/3','/en/book/5','/nl/book/1','/nl/book/2','/nl/book/3','/nl/book/5']);
 assert.equal(sitemapBooks[0][2],sitemapBooks[3][2]);assert.match(sitemapBooks[0][2],/hreflang="x-default"/);
 assert.doesNotMatch(sitemapBooks[4][2],/hreflang/);
 const listedBooks = new Set(sitemapBooks.map(entry => entry[1]));
 const isBook = pathname => /^\/(en|nl)\/book\/\d+$/.test(pathname);
 const offSitemapBook = pathname => isBook(pathname) && !listedBooks.has(pathname);
 for (const locale of ['en', 'nl']) {
  const response = await fetch('http://127.0.0.1:' + port + '/' + locale + '/book/1');
  assert.equal(response.status, 200);
  const html = await response.text();
  const graphs = [...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)]
    .map(match => JSON.parse(match[1]));
  const graph = graphs.find(value => value['@graph'])['@graph'];
  const work = graph.find(node => node['@id'] === 'https://lumisco.re/#work-1');
  const edition = graph.find(node => node['@id'] === 'https://lumisco.re/#edition-1-' + locale);
  assert.deepEqual(edition.exampleOfWork, { '@id': work['@id'] });
  assert.equal(edition.inLanguage, locale);
  assert.equal(edition.isbn, undefined);
  assert.equal(graph.filter(node => node['@type'] === 'BreadcrumbList').length, 1);
  assert.equal(graphs.filter(node => node['@type'] === 'WebSite').length, 1);
 }
 const paths=['','/browse','/book/1','/book/2','/book/3','/book/4','/book/5','/collection/synthetic-series','/toplijsten/dystopie-vanaf-1990','/taste-test','/search?q=test','/browse?page=2&sort=highest','/browse?page=3','/browse?page=999','/browse?page=2&category=fiction_fantasy','/browse?page=2&pageSize=32','/browse?page=bad','/login','/account','/metadata-missing-page','/book/999999999'].flatMap(p=>['/nl'+p,'/en'+p]);paths.push('/nl/imdb-voor-boeken','/en/imdb-for-books');
 const browseCanonical = u => u.pathname.endsWith('/browse') && /^\?page=[235](?:&sort=highest)?$/.test(u.search) ? '?page='+u.searchParams.get('page') : '';
 const legacy=new Map([['/book/1?returnTo=%2Fbrowse%3Fpage%3D2','/en/book/1'],['/books/1','/en/book/1'],['/book/2?returnTo=%2F','/nl/book/2'],['/books/2?returnTo=%2F','/nl/book/2'],['/nl/books/1','/nl/book/1']]);paths.push(...legacy.keys());
 // A confirmed missing Work reaches the real book 404 boundary. A known
 // Work without an eligible edition stays a terminal, noindex 200.
 for (const prefix of ['book','books']) {
  for (const [id,status] of [[4,200],[6,503],[999999999,404]]) {
   const response=await fetch('http://127.0.0.1:'+port+'/'+prefix+'/'+id,{redirect:'manual'});
   assert.equal(response.status,status,prefix+'/'+id);
   assert.equal(response.headers.get('location'),null);
   const body=await response.text();
   assert.doesNotMatch(body,/<link[^>]+(?:rel="canonical"|hreflang=)|"@type":"Book"/);
   if(id===4){
    assert.match(body,/noindex, follow/);
    assert.match(body,/Synthetic book 4/);
   }
   if(status===404)assert.match(body,/This book isn&#x27;t in the catalog|This book isn.t in the catalog/);
   if(status===503){
    assert.equal(response.headers.get('retry-after'),'5');
    assert.match(response.headers.get('cache-control')??'',/no-store/);
   }
  }
 }
 const output='outputs/metadata-head-http-regression';await mkdir(new URL('../'+output+'/',import.meta.url),{recursive:true});
 await run(py,['scripts/test-metadata-head-parser.py']);
 await run(py,['scripts/audit-metadata-head.py','--origin','http://127.0.0.1:'+port,'--output',output,'--paths',...paths]);
 const report=JSON.parse(await readFile(new URL('../'+output+'/responses.json',import.meta.url),'utf8'));
 for(const row of report.rows){assert.deepEqual(row.html.invalidHeadElements,[],row.url);const target=legacy.get(new URL(row.url).pathname+new URL(row.url).search);if(target){assert.equal(row.redirects.length,1,row.url);assert.equal(row.redirects[0].status,308,row.url);assert.equal(new URL(row.finalUrl).pathname,target,row.url);assert.equal(new URL(row.finalUrl).search,new URL(row.url).search,row.url);}}
 for(const row of report.rows){assert(!row.error,row.url+' '+row.error);const u=new URL(row.finalUrl),h=row.html;const canonical=h.tags.filter(t=>t.kind==='canonical');assert.equal(canonical[0]?.value,row.status===404||offSitemapBook(u.pathname)?undefined:'https://lumisco.re'+u.pathname+browseCanonical(u),'Exact canonical '+row.url);const alternate=h.tags.filter(t=>t.kind==='hreflang');if(alternate.length){let logical=u.pathname.replace(/^\/(en|nl)/,'');let en='/en'+logical+browseCanonical(u),nl='/nl'+logical+browseCanonical(u);if(logical==='/imdb-for-books'||logical==='/imdb-voor-boeken'){en='/en/imdb-for-books';nl='/nl/imdb-voor-boeken';}assert.deepEqual(Object.fromEntries(alternate.map(t=>[t.hreflang,t.value])),{en:'https://lumisco.re'+en,'nl-NL':'https://lumisco.re'+nl,'x-default':'https://lumisco.re'+en},'Reciprocal actual routes '+row.url);}if(u.pathname.endsWith('/book/3'))assert.equal(h.tags.find(t=>t.kind==='og:image')?.value,'https://example.invalid/stored-cover.jpg','Stored exact cover remains share image');}
 for(const row of report.rows){assert(!row.error,row.url+' '+row.error);const missing=/metadata-missing-page|999999999/.test(row.url);assert.equal(row.status,missing?404:200,row.url);const u=new URL(row.finalUrl),h=row.html;if(row.url.includes('browse?page=999')){assert.equal(row.redirects.length,1);assert.equal(row.redirects[0].status,307);assert.equal(u.search,'?page=5');}assert.equal(h.headOpen.length,1,row.url);assert.equal(h.headClose.length,1,row.url);assert.equal(h.title.length,1,row.url);assert.equal(h.title[0].inHead,true,row.url);assert.deepEqual(h.relevantOutsideHead,[],row.url);assert.deepEqual(h.duplicateKinds,{},row.url);const can=h.tags.filter(t=>t.kind==='canonical');assert.equal(can.length,missing||offSitemapBook(u.pathname)?0:1,row.url);if(can.length)assert(can[0].value.startsWith('https://lumisco.re/'),row.url);const privateRoute=/\/(?:search|login|account)(?:\?|$)/.test(row.url)||(u.pathname.endsWith('/browse')&&u.search!==''&&!browseCanonical(u));const robots=h.tags.filter(t=>t.kind==='robots');assert.equal(robots.length,1,row.url);assert.equal(robots[0].value.includes('noindex'),privateRoute||missing||offSitemapBook(u.pathname),row.url);const alts=h.tags.filter(t=>t.kind==='hreflang');assert.equal(alts.length,privateRoute||missing||browseCanonical(u)||u.pathname.endsWith('/book/2')||u.pathname.endsWith('/book/4')?0:3,row.url);assert(alts.every(t=>t.value.startsWith('https://lumisco.re/')));}
 const counts = { indexable: 0, noindex: 0, retired: 0 };
 for (const path of [...listedBooks, '/en/book/2', '/en/book/4', '/nl/book/4', '/en/book/999999999', '/nl/book/999999999']) {
  const response = await fetch('http://127.0.0.1:' + port + path, {redirect:'manual'});
  const html = await response.text();
  const status = listedBooks.has(path) ? 'indexable' : path.endsWith('999999999') ? 'retired' : 'noindex';
  counts[status]++;
  assert.equal(response.status,status==='retired'?404:200,path);
  const graphs = [...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)].map(match => JSON.parse(match[1]));
  const bookGraph = graphs.find(graph => graph['@graph']?.some(node => node['@type']==='Book'));
  assert.equal(Boolean(bookGraph), status==='indexable', path);
  if (status==='noindex') assert.match(html,/<meta name="robots" content="noindex, follow"/,path);
 }
 for (const locale of ['en','nl']) {
  const response = await fetch('http://127.0.0.1:' + port + '/' + locale + '/taste-test');
  assert.equal(response.status,200);
  const html = await response.text();
  const headings = [...html.matchAll(/<h1\b[^>]*>[^<]+<\/h1>/g)];
  assert.equal(headings.length,1,locale);
  assert.match(headings[0][0],locale==='nl'?/Smaaktest/:/Taste test/);
  assert.doesNotMatch(headings[0][0],/sr-only|hidden/);
 }
 console.log(JSON.stringify({ bookLifecycle: counts }));
 // Approved stored content must be actual initial main HTML, not a late provider placeholder.
 for(const lang of ['nl','en']){const r=await fetch('http://127.0.0.1:'+port+'/'+lang+'/book/5');const body=await r.text();const section=body.match(/<section class="book-description"[\s\S]*?<\/section>/)?.[0];assert(section?.includes(lang==='nl'?'Een gecontroleerde Nederlandse samenvatting':'A reviewed English summary'));assert(!section.includes(lang==='nl'?'De beschrijving wordt geladen':'Loading the description'));assert(section.includes('https://example.invalid/reviewed-book-5'));}
 // Compile once, then prove optional2s sources do not hold up metadata or H1.
 const url='http://127.0.0.1:'+port+'/en/book/1';for(let n=0;n<3;n++){const start=performance.now(),r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'}});let html='',headMs=null,h1Ms=null;for await(const b of r.body){html+=new TextDecoder().decode(b);if(headMs===null&&html.includes('</head>'))headMs=performance.now()-start;if(h1Ms===null&&html.includes('<h1'))h1Ms=performance.now()-start;}assert(html.includes('https://example.invalid/reviewed-cover.jpg'),'Late verified cover still renders in the page');assert(html.includes('This is a synthetic English description'),'Late description still renders');assert(html.indexOf('rel="canonical"')<html.indexOf('</head>'),'Canonical within original head');assert(!html.includes('property="og:image"'),'No unrelated share image when the exact cover is only available later');if(n>0){assert(headMs<1500,'Head delayed by optional sources');assert(h1Ms<1500,'H1 delayed by optional sources');assert(performance.now()-start>=1900,'Slow source simulation was not exercised');}}
 console.log(JSON.stringify({actualRouterRequests:report.rows.length,allFiveUserAgents:true,parserTests:8,legacyRedirectCases:legacy.size*5,completeOriginalHead:true,all404Correct:true,optionalSourcesNonblocking:true,lateCoverAndDescriptionPreserved:true}));
}finally{child.kill('SIGTERM');}
