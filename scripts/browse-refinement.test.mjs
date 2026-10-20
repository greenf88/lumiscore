import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {translate} from '../lib/i18n/translations.ts';

test('Browse uses native single-select tiles and a separate empty clear form, without an author input UI',async()=>{
  const ui=await readFile(new URL('../app/components/BrowseCatalogControls.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(ui,/AuthorFilter|<select name="(?:selection|pageSize)"/);
  assert.match(ui,/type="radio" name="pageSize" value=\{size\} aria-label=\{String\(size\)\}/);
  assert.match(ui,/type="radio" name="selection"/);
  assert.match(ui,/form="browse-clear-form"/);
  assert.match(ui,/<form id="browse-clear-form" action=\{action\} method="get" \/>/);
  assert.match(ui,/state\.author && <input type="hidden" name="author"/);
  assert.equal(translate('nl','browse.applyFilters'),'Toepassen');
  assert.equal(translate('en','browse.applyFilters'),'Apply');
});

test('Browse and Search reuse their page field; other headers retain the original global search',async()=>{
  const header=await readFile(new URL('../app/components/LumiScoreHome.tsx',import.meta.url),'utf8');
  const page=await readFile(new URL('../app/components/LumiScoreBrowsePage.tsx',import.meta.url),'utf8');
  assert.match(page,/searchTargetId="browse-query"/);
  const search=await readFile(new URL('../app/components/LumiScoreSearchPage.tsx',import.meta.url),'utf8');
  assert.match(search,/searchTargetId="browse-query"/);
  assert.match(header,/!searchTargetId && <div className="header-search"/);
  assert.match(header,/document\.getElementById\(searchTargetId\)\?\.focus\(\)/);
});
