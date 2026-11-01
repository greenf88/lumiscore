import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('homepage general search stays results; explicit book choice stays a book; compact UI shares Browse',async()=>{
  const home=await read('app/components/LumiScoreHome.tsx'),search=await read('app/components/LumiScoreSearchPage.tsx');
  assert.match(home,/action=\{localizedHref\('\/search', locale\)\} method="get"/);
  assert.match(home,/<LocaleLink\s+className="book-card-main-link"/);
  assert.match(search,/<BrowseCatalogControls[\s\S]*?route="\/search"/);
  assert.match(search,/searchTargetId="browse-query"/);
  assert.doesNotMatch(search,/AuthorFilter|<EditorialCatalogControls|search.fullCatalog/);
  const route=await read('app/search/page.tsx');assert.match(route,/searchQuery\(resolvedSearchParams\)/);assert.doesNotMatch(route,/redirect\(/);
});
test('search loads matching identities once, paginates before rating/cover enrichment; errors stay errors',async()=>{
  const src=await read('lib/supabase/search-catalog.ts');
  assert.match(src,/const selection = await readSelection[\s\S]*?const window = searchWindow\(selection.books/);
  assert.match(src,/return \{ \.\.\.selected, categories, selectedAuthor/);
  assert.ok(src.indexOf('const window = searchWindow')<src.indexOf('const scoreRead ='));
  assert.match(src,/loadPublicRatingSummariesBatched\(supabase, window.books/);
  assert.match(src,/deferEditionCoverEvidence\(applyRatingSummaries\(books/);
  assert.match(src,/validateProjectedPage\(keys, mapCatalogWorks/);
  assert.match(src,/if \(projection.error\) throw projection.error/);
  assert.doesNotMatch(src,/searchCatalog\(|\.from\('ratings'\)|\.from\('user_/);
  assert.match(src,/if \(error\) throw error/);
  assert.match(src,/AbortSignal.timeout\(5000\)/);
  assert.doesNotMatch(src,/loadMatchingIdentities|readSearchIdentityBatches/);
});
