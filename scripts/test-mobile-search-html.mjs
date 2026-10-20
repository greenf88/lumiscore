// Opt-in local transport fixture. Never contacts a live catalog.
import test from 'node:test';import assert from 'node:assert/strict';
const origin=process.env.SEARCH_REVIEW_ORIGIN;
if(origin!=='http://127.0.0.1:3136')throw Error('Exact local search fixture required');
const html=async path=>{const r=await fetch(origin+path);assert.equal(r.status,200);return(await r.text()).replace(/<!--.*?-->/g,'');};
const ids=s=>[...s.matchAll(/<article class="book-card browse-card" id="work-(\d+)"/g)].map(m=>m[1]);
for(const locale of ['nl','en'])test(locale+' search SSR: six exact eligible results, Dune first, collapsed filters/one input',async()=>{
  const s=await html('/'+locale+'/search?q=Dune');
  assert.equal(ids(s).length,6);assert.equal(ids(s)[0],'991006');
  assert.match(s,locale==='nl'?/Resultaten voor ‘Dune’/:/Results for “Dune”/);
  assert.equal((s.match(/type="search"/g)??[]).length,1);
  assert.match(s,/aria-expanded="false" aria-controls="browse-filter-panel"/);
  assert.doesNotMatch(s,/author-filter|name="author"[^>]*type="text"|role="region" aria-labelledby="browse-filter-title"/);
  assert.match(s,/sort%3Drelevance/);assert.match(s,/pageSize%3D16/);
});
test('author search uses same input with16 default, full total and non-overlapping pages',async()=>{
  const a=await html('/en/search?q=Ada%20Vermeer'),b=await html('/en/search?q=Ada%20Vermeer&page=2');
  assert.equal(ids(a).length,16);assert.equal(ids(b).length,16);assert.ok(ids(b).every(id=>!ids(a).includes(id)));
  assert.match(a,/160 books/);
  const last=await html('/en/search?q=Ada%20Vermeer&page=999');assert.match(last,/10 \/ 10/);
});
test('filters precede count and pagination; URL and detail return preserve context',async()=>{
  const s=await html('/nl/search?q=Dune&category=fiction_fantasy&sort=az&pageSize=32');
  assert.equal(ids(s).length,3);assert.match(s,/3 boeken/);assert.match(s,/sort%3Daz/);
  const href=s.match(/class="book-card-main-link"[^>]*href="([^"]+)"/)[1].replaceAll('&amp;','&');
  const u=new URL(href,origin),returnTo=new URL(u.searchParams.get('returnTo'),origin);
  assert.equal(returnTo.searchParams.get('q'),'Dune');assert.equal(returnTo.searchParams.get('category'),'fiction_fantasy');
  assert.equal(returnTo.searchParams.get('sort'),'az');
  assert.equal((await fetch(origin+href)).status,200);
});
test('empty versus unavailable, explicit32/64/128; query not in client synthetic bypass',async()=>{
  const s=await html('/nl/search?q=zznotfound');assert.equal(ids(s).length,0);assert.match(s,/0 boeken/);
  const fail=await html('/nl/search?q=fixture-load-error');assert.equal(ids(fail).length,0);assert.doesNotMatch(fail,/0 boeken/);
  for(const size of [32,64,128])assert.equal(ids(await html('/en/search?q=Ada%20Vermeer&pageSize='+size)).length,size);
});
