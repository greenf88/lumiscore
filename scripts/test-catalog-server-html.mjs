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
test('Rendez-vous identity correction: Browse/Search select 1078, not English large-print 1739',async()=>{
  // Browse has category/selection controls, not Search's q input.
  const ids=[];
  for(const page of [1,2]){
    const params='?selection=lumiscore-selectie-1000&category=fiction_thriller_suspense&pageSize=128&page='+page;
    const browse=await html('/browse'+params,'nl'),search=await html('/search'+params,'nl');
    assert.deepEqual(workIds(browse),workIds(search));ids.push(...workIds(browse));
    assert.match(browse,/LumiScore Selectie(?:<!-- -->)? \(974\)/);
  }
  assert.ok(ids.includes('1078'));assert.ok(!ids.includes('1739'));
  const selected=await html('/search?q=Rendez&selection=lumiscore-selectie-1000&category=fiction_thriller_suspense','nl');
  assert.deepEqual(workIds(selected),['1078']);assert.match(selected,/Rendez-vous/);assert.match(selected,/Esther Verhoef/);
  const unfiltered=workIds(await html('/search?q=Rendez'));
  assert.ok(unfiltered.includes('1078')&&unfiltered.includes('1739'),'Both old Works remain searchable');
});
test('real server HTML: Browse and Search produce identical filtered Work IDs, sizes and metadata',async()=>{
  for(const size of [32,64,128]){
    const params='?category=fiction_fantasy&selection=lumiscore-selectie-1000&pageSize='+size;
    const browse=await html('/browse'+params),search=await html('/search'+params);
    assert.deepEqual(workIds(browse),workIds(search));
    assert.equal(workIds(browse).length,Math.min(124,size));
    for(const [body,route] of [[browse,'/browse'],[search,'/search']]){
      const tags=inspectServerHtml(body);
      assert.deepEqual(tags.robots,['noindex, follow']);assert.equal(tags.canonical.length,1);
      assert.equal(new URL(tags.canonical[0]).pathname,route);assert.deepEqual(tags.duplicates,[]);
    }
    assert.match(browse,/124 books in the catalog/);
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
  assert.match(dutch,/974 boeken in de catalogus/);
  assert.match(dutch,/LumiScore Selectie(?:<!-- -->)? \(974\)/);
  assert.doesNotMatch(dutch,/LumiScore Selectie 1000/);
  assert.equal(workIds(await html('/browse?category=nonfiction_cooking_food')).length,0);
  assert.deepEqual(workIds(await html('/search?q=La%20sombra%20del%20viento')),['1936']);
});

test('page two detail return preserves editorial filters; excluded Works remain searchable outside selection',async()=>{
  for(const route of ['/browse','/search']){
    const params='?page=2&pageSize=64&category=fiction_fantasy&selection=lumiscore-selectie-1000';
    const page=await html(route+params);
    const match=page.match(/class="book-card-main-link"[^>]*href="([^\"]+)"/);
    assert.ok(match);
    const detailPath=match[1].replaceAll('&amp;','&');
    const returnTo=new URL(detailPath,origin).searchParams.get('returnTo');
    const parsed=new URL(returnTo,origin);
    assert.equal(parsed.pathname,route);
    for(const [key,value] of new URLSearchParams(params))assert.equal(parsed.searchParams.get(key),value);
    const detail=await html(detailPath);
    assert.ok(detail.includes(returnTo.replaceAll('&','&amp;')));
    const metadata=inspectServerHtml(detail);
    assert.equal(metadata.robots.length,1);assert.equal(metadata.canonical.length,1);assert.deepEqual(metadata.duplicates,[]);
  }
  for(const [title,id] of [['De avonden','1016'],['Charlie and the Chocolate Factory','111'],['Herinneringen van een engelbewaarder','1015']]){
    const query='/search?q='+encodeURIComponent(title);
    assert.ok(workIds(await html(query)).includes(id));
    assert.ok(!workIds(await html(query+'&selection=lumiscore-selectie-1000')).includes(id));
  }
});

test('real language filtering and non-default sort survive Browse/Search detail return',async()=>{
  const params='?category=fiction_fantasy&selection=lumiscore-selectie-1000&language=nl&sort=newest&pageSize=64';
  const pages=await Promise.all(['/browse','/search'].map(route=>html(route+params)));
  assert.deepEqual(workIds(pages[0]),workIds(pages[1]));
  assert.deepEqual(workIds(pages[0]),['93'],'Frozen public fixture has one classified Dutch fantasy Work');
  for(const [index,route] of ['/browse','/search'].entries()){
    const match=pages[index].match(/class="book-card-main-link"[^>]*href="([^\"]+)"/);
    assert.ok(match);
    const detailPath=match[1].replaceAll('&amp;','&');
    const returnTo=new URL(detailPath,origin).searchParams.get('returnTo');
    const parsed=new URL(returnTo,origin);
    assert.equal(parsed.pathname,route);
    for(const [key,value] of new URLSearchParams(params))assert.equal(parsed.searchParams.get(key),value);
    const detail=await html(detailPath);
    assert.ok(detail.includes(returnTo.replaceAll('&','&amp;')));
    const tags=inspectServerHtml(detail);
    assert.equal(tags.canonical.length,1);assert.equal(new URL(tags.canonical[0]).pathname,'/book/93');
    assert.deepEqual(tags.robots,['index, follow']);assert.deepEqual(tags.duplicates,[]);
  }
});
