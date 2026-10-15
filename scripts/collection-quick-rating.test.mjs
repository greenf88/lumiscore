import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('quick mode stays opt-in, private, same-origin and bound to the verified account',()=>{
  const page=read('app/collection/[slug]/rate/page.tsx'),api=read('app/api/collections/[slug]/rating-session/route.ts');
  assert.match(page,/slug !== QUICK_RATING_COLLECTION/);assert.match(page,/if \(!user\) redirect/);assert.match(page,/noIndex: true/);
  assert.match(api,/PRIVATE_RESPONSE_HEADERS/);assert.match(api,/if \(!user\).*401/);
  const rating=read('app/api/ratings/[workId]/route.ts'),store=read('lib/supabase/ratings.ts');
  assert.match(rating,/isSameOriginRequest\(request\)/);assert.match(rating,/onlyIfUnrated, expectedUserId/);
  assert.match(store,/if \(options.expectedUserId !== user.id\) throw/);
  assert.match(store,/insertUnrated\(supabase, user.id/);
});
test('both flows use the same score buttons, Work-scoped pending feedback and cooldown gate',()=>{
  for(const file of ['app/components/CollectionQuickRating.tsx','app/components/RatingTasteTest.tsx']){
    const text=read(file);assert.match(text,/<DirectRatingScores/);assert.match(text,/createRoundActionGate/);assert.match(text,/setSelection\(null\)|setSelectedScore\(null\)/);
  }
  const scores=read('app/components/DirectRatingScores.tsx');
  assert.match(scores,/isPendingWorkScore\(selection, workId, score, pending\)/);assert.match(scores,/event.detail <= 1/);assert.match(scores,/event.repeat/);
  const client=read('app/components/CollectionQuickRating.tsx');
  assert.match(client,/onlyIfUnrated: true, expectedUserId: userId/);assert.match(client,/snapshot.userId !== userId/);
  assert.doesNotMatch(client,/method: 'DELETE'|\/statuses\/bulk|saveBookStatus/);
});
test('local fixture is reachable only through explicit credential-free loopback runner',()=>{
  const runner=read('scripts/collection-rating-review-local.mjs');
  assert.match(runner,/host:'127.0.0.1'/);assert.match(runner,/envFile:false/);
  for(const file of ['app/components/CollectionQuickRating.tsx','app/collection/[slug]/rate/page.tsx','app/api/collections/[slug]/rating-session/route.ts'])assert.doesNotMatch(read(file),/test-support|review=|__review|synthetic-a/);
});
