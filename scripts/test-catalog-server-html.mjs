import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectServerHtml } from '../lib/seo/server-html.ts';
const origin=process.env.CATALOG_TEST_ORIGIN;
if(!origin||!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))throw new Error('Set local CATALOG_TEST_ORIGIN; do not run fixture assertions on production');
const html=async (path,locale='en')=>{
  const response=await fetch(origin+path,{headers:{cookie:'lumiscore-locale='+locale}});
  assert.equal(response.status,200,path);
  const body=await response.text();
  assert.doesNotMatch(body,/catalog unavailable|catalogus.*niet beschikbaar/i);
  return body;
};
const workIds=body=>[...body.matchAll(/class="book-card-main-link"[^>]*href="\/book\/(\d+)/g)].map(m=>m[1]);
test('real server HTML: Browse and Search produce identical filtered Work IDs, sizes and metadata',async()=>{
  for(const size of [32,64,128]){
    const params='?category=fiction_fantasy&selection=lumiscore-selectie-1000&pageSize='+size;
    const browse=await html('/browse'+params),search=await html('/search'+params);
    assert.deepEqual(workIds(browse),workIds(search));
    assert.equal(workIds(browse).length,Math.min(126,size));
    for(const [body,route] of [[browse,'/browse'],[search,'/search']]){
      const tags=inspectServerHtml(body);
      assert.deepEqual(tags.robots,['noindex, follow']);assert.equal(tags.canonical.length,1);
      assert.equal(new URL(tags.canonical[0]).pathname,route);assert.deepEqual(tags.duplicates,[]);
    }
    assert.match(browse,/126 books in the catalog/);
    assert.match(browse,/returnTo=.*fiction_fantasy/);
  }
});
test('pagination, clean Browse, language, empty category and reviewed translation alias',async()=>{
  const clean=await html('/browse');
  assert.deepEqual(inspectServerHtml(clean).robots,['index, follow']);
  assert.equal(workIds(clean).length,32);
  const page2=await html('/browse?page=2&pageSize=32');
  assert.ok(workIds(page2).every(id=>!workIds(clean).includes(id)));
  const dutch=await html('/browse?selection=lumiscore-selectie-1000','nl');
  assert.equal(inspectServerHtml(dutch).lang,'nl');
  assert.match(dutch,/986 boeken in de catalogus/);
  assert.match(dutch,/LumiScore Selectie 1000/);
  assert.equal(workIds(await html('/browse?category=nonfiction_cooking_food')).length,0);
  assert.deepEqual(workIds(await html('/search?q=La%20sombra%20del%20viento')),['1936']);
});
