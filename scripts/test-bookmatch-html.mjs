// Read-only local review and local production-build gates. No session or rating writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectServerHtml} from '../lib/seo/server-html.ts';
const origin=process.env.BOOKMATCH_REVIEW_ORIGIN,production=process.env.BOOKMATCH_PRODUCTION_ORIGIN;
for(const value of [origin,production]) if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(value??'')) throw new Error('Two local review origins are required.');
test('local prototype HTML has one noindex/canonical; bounded deck is private and invalid owner query fails',async()=>{
  const response=await fetch(origin+'/bookmatch');assert.equal(response.status,200);
  const body=await response.text(),seo=inspectServerHtml(body);
  assert.equal(seo.robots.length,1);assert.equal(seo.canonical.length,1);assert.deepEqual(seo.duplicates,[]);assert.match(body,/noindex, follow/);
  assert.match(body,/Ten swipes\. One next book/);
  const deck=await fetch(origin+'/api/bookmatch?seed=12345678-abcd-abcd-abcd-123456789abc');
  assert.equal(deck.status,200);assert.match(deck.headers.get('cache-control'),/private.*no-store/);
  const payload=await deck.json();assert.equal(payload.owner,'guest');assert.equal(payload.cards.length,80);assert.equal(new Set(payload.cards.map(x=>x.book.workId)).size,80);
  const invalid=await fetch(origin+'/api/bookmatch?seed=12345678-abcd-abcd-abcd-123456789abc&owner=other');assert.equal(invalid.status,400);
});
test('local production build refuses both prototype APIs and page; no sitemap link',async()=>{
  for(const route of ['/bookmatch','/api/bookmatch?seed=12345678-abcd-abcd-abcd-123456789abc']) assert.equal((await fetch(production+route)).status,404);
  const writer=await fetch(production+'/api/bookmatch/wishlist',{method:'POST',headers:{origin:production,'content-type':'application/json'},body:'{"workId":"8800030"}'});assert.equal(writer.status,404);
  const sitemap=await fetch(production+'/sitemap.xml');assert.equal(sitemap.status,200);assert.doesNotMatch(await sitemap.text(),/\/bookmatch/);
});
