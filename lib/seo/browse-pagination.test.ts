import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMetadataToHtml } from 'vinext/shims/metadata';
import { browseQuery, editorialHref, type CatalogParams } from '../catalog/editorial-query.ts';
import { publicBrowsePage, browsePagePath } from './browse-pagination.ts';
import { createPageMetadata } from './page-metadata.ts';
import { inspectServerHtml } from './server-html.ts';

test('default public pagination has self canonicals without invented translated page equivalents', () => {
  for (const params of [{}, {page:'1'}, {page:'2'}, {page:'3',pageSize:'16',sort:'highest'}]) {
    const page=publicBrowsePage(params); assert.notEqual(page,null);
    for (const locale of ['nl','en'] as const) {
      const path=browsePagePath(page!);
      const metadata=createPageMetadata({title:'Browse',canonicalPath:path,locale,includeLanguageAlternates:page===1});
      const html=inspectServerHtml(renderMetadataToHtml(metadata));
      assert.deepEqual(html.canonical,[`https://lumisco.re/${locale}${path}`]);
      assert.deepEqual(html.robots,['index, follow']);
      const links=[...renderMetadataToHtml(metadata).matchAll(/<link\b[^>]*>/gi)].map(x=>x[0]);
      const alternates=links.filter(x=>/hreflang=/i.test(x)).map(x=>[x.match(/hreflang="([^"]+)"/i)![1],x.match(/href="([^"]+)"/i)![1].replaceAll('&amp;','&')]);
      assert.deepEqual(Object.fromEntries(alternates),page===1?{en:`https://lumisco.re/en${path}`,'nl-NL':`https://lumisco.re/nl${path}`,'x-default':`https://lumisco.re/en${path}`} : {});
    }
    assert.equal(editorialHref('/browse',browseQuery(params)),browsePagePath(page!));
  }
});

test('filters, other sizes/orders, unknown and ambiguous parameters stay outside the indexable series', () => {
  for (const params of [
    {q:'Dune'}, {category:'fiction_fantasy'}, {language:'nl'}, {author:'1'},
    {selection:'lumiscore-selectie-1000'}, {sort:'az'}, {sort:'newest'}, {pageSize:'32'},
    {pageSize:'64'}, {pageSize:'128'}, {pageSize:'invalid'}, {sort:''}, {utm_source:'x'},
    {returnTo:'/browse'}, {unknown:''}, {page:['2','3']}, {sort:['highest']},
    {page:'0'}, {page:'-1'}, {page:'2.5'}, {page:'02'}, {page:'1e2'}, {page:'2147483648'},
  ] satisfies CatalogParams[]) assert.equal(publicBrowsePage(params),null,JSON.stringify(params));
});

test('only public Browse links are shortened; filters, search, state and ranking are preserved', () => {
  for (const params of [{page:'2',category:'fiction_fantasy'}, {page:'3',sort:'az'}, {page:'4',pageSize:'64'}, {page:'2',language:'nl'}]) {
    const state=browseQuery(params);const before=structuredClone(state);
    const href=editorialHref('/browse',state);const parsed=new URL(href,'https://lumisco.re');
    for (const [key,value] of Object.entries(params)) assert.equal(parsed.searchParams.get(key),value);
    assert.deepEqual(state,before);
  }
  assert.match(editorialHref('/search',browseQuery({page:'2'})),/pageSize=16&sort=highest/);
});
