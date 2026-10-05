import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('page/API are both fail-closed and interest state has no database writer or rating conversion',async()=>{
  const file=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
  const [page,api,server,ui]=await Promise.all(['app/bookmatch/page.tsx','app/api/bookmatch/route.ts','lib/supabase/bookmatch.ts','app/components/Bookmatch.tsx'].map(file));
  assert.match(page,/prototypeAllowed.*\n/s);assert.match(page,/notFound\(\)/);assert.match(api,/prototypeAllowed/);assert.match(api,/404/);assert.match(api,/PRIVATE_RESPONSE_HEADERS/);
  assert.doesNotMatch(server,/\.(insert|update|delete|upsert|rpc)\(/);
  assert.doesNotMatch(ui,/taste_rating|\/ratings|status:\s*['"]read/);
  assert.match(ui,/sessionStorage.setItem/);assert.match(ui,/deck.owner!==owner/);
  assert.match(ui,/onPointerUp/);assert.match(ui,/onKeyDown/);assert.match(ui,/onPointerCancel/);
  assert.match(ui,/className="bookmatch-stage" aria-busy=\{loading\}/);
  const css=await file('app/globals.css');
  assert.match(css,/\.bookmatch-stage\s*\{\s*min-block-size:/);
  assert.doesNotMatch(css,/\.bookmatch-stage\s*\{[^}]*(?:overflow:\s*hidden|(?<!-)\bheight\s*:)/);
  const sitemap=await file('lib/seo/sitemap.ts');assert.doesNotMatch(sitemap,/bookmatch/);
  const wishlist=await file('app/api/bookmatch/wishlist/route.ts');
  assert.match(wishlist,/prototypeAllowed/);assert.match(wishlist,/isSameOriginRequest/);assert.match(wishlist,/user_id:user.id/);assert.match(wishlist,/ignoreDuplicates:true/);
});
