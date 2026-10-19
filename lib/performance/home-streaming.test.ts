import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('homepage streams unchanged strict-edition loaders without a new shared/private cache',async()=>{
 const page=await readFile(new URL('../../app/page.tsx',import.meta.url),'utf8');
 const ui=await readFile(new URL('../../app/components/LumiScoreHome.tsx',import.meta.url),'utf8');
 assert.match(page,/loadHighestRatedCatalog\(8,locale\)/);
 assert.match(page,/loadHomepagePersonalization\(locale, 3\)/);
 assert.match(page,/if \(!\(await authPromise\)\.authenticated\) return emptyPersonalization/);
 assert.match(page,/const authState = await authPromise/);
 assert.match(page,/export const dynamic = 'force-dynamic'/);
 assert.doesNotMatch(page,/await catalogPromise|await personalizationPromise|unstable_cache|s-maxage/);
 assert.match(page,/deferred=\{\{catalog:catalogPromise, personalization:personalizationPromise, series:seriesPromise\}\}/);
 assert.match(ui,/<Suspense fallback=\{<FeaturedPending\/>\}>/);
 assert.match(ui,/const catalog=use\(data\)/);
 assert.match(ui,/const personal=use\(data\)/);
 assert.match(ui,/deferred && authenticated/);
 assert.doesNotMatch(page+ui,/data-local-performance|data-local-header-hydrated/);
});
