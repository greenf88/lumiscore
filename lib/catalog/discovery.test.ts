import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendationLimit } from './discovery.ts';
import { editorialQuery, editorialHref } from './editorial-query.ts';
import { getSafeBrowseReturnPath, updateBrowseReturnPath } from '../navigation/browse-return.ts';
import { resolveBookReturnNavigation } from '../navigation/book-return.ts';
import { parseRoundAction } from '../taste-test/rating-round.ts';
import { isProductionBackedReview } from '../supabase/review-target.ts';
import { getCatalogBrowseOrder } from '../books/catalog-browse.ts';
import { overviewScrollKey } from '../navigation/overview-scroll.ts';

test('scroll origin survives canonical query ordering and explicit defaults added on detail return', () => {
  assert.equal(overviewScrollKey('/browse','?category=fiction_fantasy'), overviewScrollKey('/browse','?page=1&pageSize=32&sort=az&q=&selection=&category=fiction_fantasy'));
  assert.equal(overviewScrollKey('/recommendations',''), overviewScrollKey('/recommendations','?limit=20'));
  assert.notEqual(overviewScrollKey('/browse','?sort=highest'),overviewScrollKey('/browse','?sort=az'));
});

test('review writes fail closed for production or unverified backend; legacy sorting cannot silently fall back', () => {
  const url = 'https://qvplwejffhjvxaypmjut.supabase.co';
  assert.equal(isProductionBackedReview({ deploymentEnvironment:'preview', nodeEnvironment:'production', supabaseUrl:url }),true);
  assert.equal(isProductionBackedReview({ nodeEnvironment:'development', supabaseUrl:url }),true);
  assert.equal(isProductionBackedReview({ deploymentEnvironment:'preview', nodeEnvironment:'production' }),true);
  assert.equal(isProductionBackedReview({ deploymentEnvironment:'preview', nodeEnvironment:'production', supabaseUrl:'https://separate-test.supabase.co' }),false);
  assert.equal(isProductionBackedReview({ deploymentEnvironment:'production', nodeEnvironment:'production', supabaseUrl:url }),false);
  assert.throws(()=>getCatalogBrowseOrder('highest'),/server-paged/);
});
test('highest-score return retains author, query, categories, languages, page and size after a rating', async () => {
  const state=editorialQuery({ q:'Dune',author:'32',category:'fiction_fantasy',language:'en',sort:'highest',page:'3',pageSize:'64' });
  const url=editorialHref('/browse',state), safe=getSafeBrowseReturnPath(url)!;
  assert.equal(new URL(safe,'https://lumisco.re').searchParams.get('sort'),'highest');
  assert.equal(new URL(safe,'https://lumisco.re').searchParams.get('author'),'32');
  const back=await resolveBookReturnNavigation(url,'8',async()=>null);
  assert.equal(back.href,safe);
  const next=new URL(updateBrowseReturnPath(safe,{page:4}),'https://lumisco.re');
  assert.equal(next.searchParams.get('q'),'Dune'); assert.equal(next.searchParams.get('page'),'4');
});
test('recommendation URLs are bounded, internal and preserve count', async () => {
  for(const n of [10,20,25]) assert.equal(recommendationLimit(String(n)),n);
  assert.equal(recommendationLimit('10000'),20);
  assert.equal((await resolveBookReturnNavigation('/recommendations?limit=25','8',async()=>null)).href,'/recommendations?limit=25');
  for(const url of ['//evil.test','/recommendations?limit=99','/recommendations?next=//evil.test','/book/null'])
    assert.equal((await resolveBookReturnNavigation(url,'8',async()=>null)).href,'/browse');
});
test('round input requires explicit integer rating; skips cannot carry implicit scores or arbitrary owner IDs', () => {
  const base={language:'en',roundId:'00000000-0000-4000-8000-000000000001',workId:'8'};
  assert.ok(parseRoundAction({...base,action:'rate',score:7}));
  for(const score of [null,7.5,0,11,'7']) assert.equal(parseRoundAction({...base,action:'rate',score}),null);
  assert.equal(parseRoundAction({...base,action:'skip',score:7}),null);
  assert.equal(parseRoundAction({...base,action:'rate',score:7,userId:'other'}),null);
  assert.ok(parseRoundAction({...base,action:'skip'}));
});
