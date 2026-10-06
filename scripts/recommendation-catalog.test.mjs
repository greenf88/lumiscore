import assert from 'node:assert/strict';
import test from 'node:test';
import { createRecommendationFixture,legacyCatalog,mapFixtureWorks } from './recommendation-performance-fixture.mjs';
import { loadRecommendationCatalog } from '../lib/supabase/recommendation-catalog.ts';
import { recommendBooks } from '../lib/recommendations/engine.ts';
import { buildTasteProfile } from '../lib/taste-test/profile.ts';
import { TASTE_TEST_QUESTIONS,TASTE_TEST_WORK_IDS } from '../lib/taste-test/config.ts';
import { emptyTasteVector } from '../lib/taste-test/traits.ts';

test('real PostgreSQL synthetic catalog: sparse loader preserves candidates, ranking, isolation and fresh ratings',async()=>{
  const f=await createRecommendationFixture();
  try {
    assert.equal(Number((await f.db.query("select sum(jsonb_array_length(payload->'editions')) as n from fixture_works")).rows[0].n),10293);
    const before=await legacyCatalog(f.client),beforeMetrics={...f.metrics};f.reset();
    const after=await loadRecommendationCatalog(f.client,mapFixtureWorks);
    assert.deepEqual(after.candidates,before.candidates);
    assert.equal(after.candidates.length,1283);
    assert.equal(f.metrics.evidenceRows,3942);
    assert.equal(beforeMetrics.works,10134);assert.equal(f.metrics.works,1292);
    assert.equal(beforeMetrics.requests,164);assert.equal(f.metrics.requests,24);
    assert.ok(f.metrics.decodedBytes<beforeMetrics.decodedBytes/3);
    // Reviewed correction-only Works are fetched even without stored evidence.
    assert.ok(after.traitsById.has('6'));assert.equal(after.traitsById.get('6').coverageLevel,'none');
    for(const locale of ['nl','en']) for(const choice of ['left','right','neither']) {
      const answers=Object.fromEntries(TASTE_TEST_QUESTIONS.map(q=>[q.key,choice]));
      for(const ratings of [[],[{workId:'1001',rating:9}],[{workId:'1001',rating:1},{workId:'9000',rating:10}]]) {
        const profile=catalog=>buildTasteProfile(answers,ratings.map(r=>({...r,traits:catalog.traitsById.get(r.workId)?.traits??emptyTasteVector()})),locale);
        assert.deepEqual(profile(after),profile(before));
        // Candidate equality above proves the unchanged ranker receives the
        // same full input. Run one full ranking per locale, not 18 redundant
        // expensive NL diversity sorts; other answer/rating vectors stay checked.
        if(choice!=='left'||ratings.length!==1) continue;
        const input={locale,ratedWorkIds:new Set(ratings.map(r=>r.workId)),excludedWorkIds:new Set([...TASTE_TEST_WORK_IDS,'1002']),
          languagePreference:locale==='nl'?{language:'dutch',source:'locale',strength:.8}:null,readingPeriods:['2015_present'],
          collaborativeSignals:new Map([['1003',{score:.8,weight:.1}]])};
        const oldRanking=recommendBooks({...input,candidates:before.candidates,profile:profile(before)});
        const newRanking=recommendBooks({...input,candidates:after.candidates,profile:profile(after)});
        assert.deepEqual(newRanking,oldRanking);assert.equal(newRanking.length,20);
        assert.equal(new Set(newRanking.map(r=>r.book.workId)).size,20);
        assert.ok(newRanking.every(r=>!input.ratedWorkIds.has(r.book.workId)&&!input.excludedWorkIds.has(r.book.workId)));
      }
    }
    const result=(choice,rated=new Set())=>recommendBooks({candidates:after.candidates,
      profile:buildTasteProfile({'fantasy-or-science-fiction':choice},[]),ratedWorkIds:rated});
    const a=result('left'),b=result('right');assert.notDeepEqual(a,b);
    const changed=result('left',new Set([a[0].book.workId]));assert.ok(changed.every(r=>r.book.workId!==a[0].book.workId));
    assert.deepEqual(result('right'),b); // A's update cannot contaminate B.
    // Public summaries remain freshly queried by the authenticated loader.
    f.reset();await loadRecommendationCatalog(f.client,mapFixtureWorks);assert.equal(f.metrics.rpc,13);
  } finally {await f.db.close();}
});
test('dense evidence pages are complete, primary-key ordered, failures are not empty success',async()=>{
  const f=await createRecommendationFixture({works:1400,evidenceWorks:400,dense:true});
  try {
    const result=await loadRecommendationCatalog(f.client,mapFixtureWorks);
    assert.equal(result.candidates.length,400);assert.equal(f.metrics.evidenceRows,2400);
    assert.deepEqual(f.metrics.queries.filter(q=>q.table==='work_trait_evidence').map(q=>q.offset).sort((a,b)=>a-b),[0,1000,2000]);
    f.failWhen(url=>url.pathname.endsWith('/work_trait_evidence')&&url.searchParams.get('offset')==='1000');
    await assert.rejects(loadRecommendationCatalog(f.client,mapFixtureWorks));
    f.failWhen(url=>url.pathname.endsWith('/works'));
    await assert.rejects(loadRecommendationCatalog(f.client,mapFixtureWorks));
  } finally {await f.db.close();}
});
test('empty and small evidence pools are genuine shortages, not filler recommendations',async()=>{
  for(const evidenceWorks of [0,3]) {
    const f=await createRecommendationFixture({works:1010,evidenceWorks});
    try {
      const catalog=await loadRecommendationCatalog(f.client,mapFixtureWorks);
      const ranked=recommendBooks({candidates:catalog.candidates,profile:buildTasteProfile({'fantasy-or-science-fiction':'left'},[]),ratedWorkIds:new Set()});
      assert.equal(ranked.length,evidenceWorks);
    } finally {await f.db.close();}
  }
});
