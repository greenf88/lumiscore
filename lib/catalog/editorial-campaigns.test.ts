import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import campaigns from './editorial-campaigns-20261028.json' with { type: 'json' };
import { editorialTopLists, getEditorialWorkSourceId } from './top-lists.ts';
import { editorialPageJsonLd } from '../seo/editorial.ts';
import { createPageMetadata } from '../seo/page-metadata.ts';
import { buildLocalizedSitemap } from '../seo/sitemap.ts';
import { withStrictEdition } from '../books/strict-edition.ts';
import covers from '../books/reviewed-editorial-covers-20261028.json' with { type: 'json' };
import type { Book } from '../../app/data/books.ts';

test('ten distinct reading routes have ten unique existing Works and specific bilingual reasons', () => {
  assert.equal(campaigns.lists.length, 10);
  for (const list of campaigns.lists) {
    assert.equal(list.workIds.length, 10);
    assert.equal(new Set(list.workIds).size, 10);
    assert.deepEqual(Object.keys(list.notes).sort(), [...list.workIds].sort());
    for (const locale of ['nl', 'en'] as const) {
      assert.ok(list.title[locale] && list.description[locale] && list.criteria[locale]);
      assert.equal(new Set(Object.values(list.notes).map(note => note[locale])).size, 10);
      for (const id of list.workIds) {
        assert.match(getEditorialWorkSourceId(id), /^OL\d+W$/);
        const note = Object.entries(list.notes).find(([key]) => key === id)?.[1];
        assert.ok(note && note[locale].length > 40);
      }
      const image = readFileSync(new URL('../../public'+list.shareImage.replace('.png','-'+locale+'.png'), import.meta.url));
      assert.equal(image.subarray(1, 4).toString(), 'PNG');
      assert.equal(image.readUInt32BE(16), 1200); assert.equal(image.readUInt32BE(20), 630);
      assert.ok(image.length < 300_000);
    }
    assert.ok(list.related.every(slug => slug !== list.slug && editorialTopLists.some(other => other.slug === slug)));
    for (const other of campaigns.lists.filter(other => other.slug !== list.slug)) {
      assert.ok(list.workIds.filter(id => other.workIds.includes(id)).length < 5, 'avoid near-duplicate selections');
    }
  }
});

test('reviewed images remain bound to the exact Work, title, author, ISBN, edition and language', () => {
  for (const cover of covers) {
    const base = {id:'fixture',workId:'928100001',openLibraryWorkId:cover.openLibraryWorkId,title:cover.title,author:cover.author,score:null,ratingsCount:null,match:null,cover:'orbit'} as Book;
    const edition = {id:123,work_id:base.workId ?? undefined,title:cover.title,language:cover.editionLanguage,isbn_13:cover.isbn13,open_library_edition_id:cover.openLibraryEditionId};
    const result = withStrictEdition(base, edition, cover.editionLanguage === 'nld' ? 'nl' : 'en');
    assert.ok(result?.coverUrls?.length);
    for (const mismatch of [{author:'Another author'}, {openLibraryWorkId:'OL999999W'}]) {
      assert.equal(withStrictEdition({...base,...mismatch},edition,'en')?.coverUrls?.length ?? 0,0);
    }
    assert.equal(withStrictEdition(base,{...edition,isbn_13:'9780000000000'},'en')?.coverUrls?.length ?? 0,0);
  }
});

test('metadata is bilingual, clean of UTM parameters and reuses the single website identity', () => {
  const sitemap = buildLocalizedSitemap([], []);
  for (const list of campaigns.lists) for (const locale of ['nl','en'] as const) {
    const path = '/toplijsten/'+list.slug;
    const metadata = createPageMetadata({title:list.title[locale],description:list.description[locale],canonicalPath:path,locale});
    assert.equal(metadata.alternates.canonical,'https://lumisco.re/'+locale+path);
    assert.ok(sitemap.includes(metadata.alternates.canonical));
    assert.equal(metadata.openGraph.siteName,'LumiScore');assert.equal(metadata.robots.index,true);
    const json = editorialPageJsonLd(list, [], locale);
    assert.ok(JSON.stringify(json).includes('https://lumisco.re/#website'));
    assert.doesNotMatch(JSON.stringify(json),/AggregateRating|"@type":"WebSite"|utm_/);
  }
});

test('missing editions do not become fake Book entries and statuses use portable database identities', () => {
  const list=editorialTopLists[2];
  const book={id:'fixture',workId:'928100001',title:'Verified title',author:'Verified author',editionAvailable:true} as Book;
  const graph=editorialPageJsonLd(list,[book,{...book,workId:'2',editionAvailable:false}], 'nl');
  assert.equal(graph['@graph'][1].numberOfItems,1);
  const ui=readFileSync(new URL('../../app/components/EditorialTopList.tsx',import.meta.url),'utf8');
  assert.match(ui,/statuses.get\(book.workId!\)/);
  assert.match(ui,/book.editionAvailable === false/);
});

test('editorial reasons cannot inherit the narrow six-column catalogue grid', () => {
  const css=readFileSync(new URL('../../app/globals.css',import.meta.url),'utf8');
  assert.match(css,/\.editorial-books\s*\{[^}]*minmax\(min\(100%, 220px\), 1fr\)/);
  assert.match(css,/\.editorial-reason\s*\{[^}]*overflow-wrap: anywhere/);
});

test('publisher-proven Dutch Final Empire cover stays bound to ISBN, Work, author and language without inventing an OL edition', () => {
  const base={id:'test-final-empire',workId:'8800309',openLibraryWorkId:'OL5738148W',title:'The Final Empire',author:'Brandon Sanderson',score:null,ratingsCount:null,match:null,cover:'orbit'} as Book;
  const nl={id:614,work_id:8800309,title:'Het laatste rijk',language:'nld',isbn_13:'9789024581269',open_library_edition_id:null};
  const presented=withStrictEdition(base,nl,'nl')!;
  assert.match(presented.coverUrls![0],/lsuitgeverij\.nl.*9789024581269_frontcover/);
  assert.equal(presented.openLibraryEditionId,null);
  assert.equal(withStrictEdition(base,nl,'en'),null);
  for(const change of [{isbn_13:'9789024565306'},{language:'eng'}]) assert.deepEqual(withStrictEdition(base,{...nl,...change},'nl')?.coverUrls,[]);
  for(const change of [{author:'Another author'},{openLibraryWorkId:'OL999999W'}]) assert.deepEqual(withStrictEdition({...base,...change},nl,'nl')?.coverUrls,[]);
});
