import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogBreadcrumbs } from './breadcrumbs.ts';
import { breadcrumbJsonLd } from './breadcrumb-json-ld.ts';
test('real public parents and canonical locale URLs do not depend on returnTo or personal context',()=>{
  for(const locale of ['nl','en'] as const)for(const kind of ['book','collection'] as const){
    const path=kind==='book'?'/book/1220':'/collection/suzanne-vermeer';
    const entries=catalogBreadcrumbs(kind,'A title <script>',path,locale), schema=breadcrumbJsonLd(entries,locale);
    assert.equal(schema['@type'],'BreadcrumbList');assert.equal(schema.itemListElement.length,3);
    assert.deepEqual(schema.itemListElement.map(i=>i.position),[1,2,3]);
    assert.equal(schema.itemListElement[1].item,'https://lumisco.re/'+locale+(kind==='book'?'/browse':'/collections'));
    assert.equal(schema.itemListElement[2].item,'https://lumisco.re/'+locale+path);
    assert.doesNotMatch(JSON.stringify(schema),/returnTo|rating|userId/);
    assert.doesNotMatch(JSON.stringify(schema).replaceAll('<','\\u003c'),/<script>/);
  }
});
