import test from 'node:test';
import assert from 'node:assert/strict';
import { editorialQuery, editorialHref, editorialRpcArgs, editorialCategories } from './editorial-query.ts';
import { getSafeBrowseReturnPath, updateBrowseReturnPath } from '../navigation/browse-return.ts';
import { getSafeSearchReturnPath } from '../navigation/search-return.ts';
test('Browse and Search share normalized category IDs, language, size and server query', () => {
  const state=editorialQuery({ category:['fiction_fantasy','fiction_fantasy','unknown'],language:['nl','de'], pageSize:'128', page:'3', selection:'lumiscore-selectie-1000' });
  assert.deepEqual(state.categories,['fiction_fantasy']); assert.deepEqual(state.languages,['nl']); assert.equal(state.pageSize,128);
  for(const route of ['/browse','/search'] as const) {
    const url=new URL(editorialHref(route,state),'https://lumisco.re');
    const params=Object.fromEntries([...new Set(url.searchParams.keys())].map(k=>[k,url.searchParams.getAll(k)]));
    assert.deepEqual(editorialRpcArgs(editorialQuery(params)),editorialRpcArgs(state));
  }
});
test('return navigation preserves all twenty genres, selection, language and pagination', () => {
  const state=editorialQuery({category:editorialCategories.map(c=>c.id), language:['nl','en'],pageSize:'64',sort:'newest'});
  const path=editorialHref('/browse',state);
  assert.ok(getSafeBrowseReturnPath(path));
  const next=updateBrowseReturnPath(path,{page:4});
  assert.equal(new URL(next,'https://lumisco.re').searchParams.getAll('category').length,20);
  assert.equal(new URL(next,'https://lumisco.re').searchParams.get('pageSize'),'64');
  assert.ok(getSafeSearchReturnPath(editorialHref('/search',{...state,query:'De schaduw'})));
  assert.equal(getSafeBrowseReturnPath('/browse?selection=https://evil.test'),null);
});
test('unknown values normalize safely and reviewed title aliases survive', () => {
  const state=editorialQuery({q:'  Ragdoll ',pageSize:'999',sort:'ranking',page:'999999999999',category:'HIGH'});
  assert.equal(state.pageSize,32); assert.equal(state.sort,'az'); assert.deepEqual(state.categories,[]);
  assert.equal(editorialRpcArgs(state).p_page,2147483647);
  assert.ok(Array.isArray(editorialRpcArgs(state).p_alias_ids));
});
