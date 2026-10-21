import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { Book } from '../../app/data/books.ts';
import { withStrictEdition } from '../books/strict-edition.ts';
import { getMirrorBookSeo, serializeMirrorBookJsonLd } from './mirror-book.ts';
import { createPageMetadata } from './page-metadata.ts';
import { buildLocalizedSitemap } from './sitemap.ts';
import { buildWebsiteJsonLd } from './site-identity.ts';

const work: Book = { id: 'work-10138', workId: '10138', source: 'supabase', title: 'The Mirror of Infinite Endings',
  author: 'Stephanie Garber', cover: 'orbit', score: null, ratingsCount: 0, match: null };
const us = { id: 91021202, work_id: 10138, title: work.title, language: 'eng',
  isbn_13: '9781250462039', open_library_edition_id: 'OL61433279M', publisher: 'Flatiron Books' };

test('reviewed Mirror SEO binds both locales to the exact English edition and first-response cover', () => {
  for (const locale of ['nl', 'en'] as const) {
    const book = withStrictEdition(work, us, locale)!;
    const seo = getMirrorBookSeo(book, locale)!;
    const schema = JSON.parse(serializeMirrorBookJsonLd(book, locale)!);
    assert.equal(schema['@type'], 'Book');
    assert.equal(schema.isbn, us.isbn_13);
    assert.equal(schema.inLanguage, 'en');
    assert.equal(schema.mainEntityOfPage.inLanguage, locale);
    assert.equal(schema.datePublished, '2026-09-22');
    assert.equal(schema.publisher.name, 'Flatiron Books');
    assert.equal(schema.illustrator.name, 'Lotusbubble');
    assert.equal(schema.isPartOf.name, 'Once Upon a Broken Heart');
    assert.equal(schema.aggregateRating, undefined);
    assert.equal(schema.review, undefined);
    assert.equal(schema.numberOfItems, undefined);
    assert.equal(schema['@id'], 'https://lumisco.re/#book-10138-edition-9781250462039');
    assert.equal(schema.url, `https://lumisco.re/${locale}/book/10138`);
    assert.equal(schema.image, book.coverUrls![0]);
    assert.match(schema.image, /15201916-L.jpg/);
    assert.ok(seo.description.length < 170);
    const metadata = createPageMetadata({title:work.title,description:seo.description,image:seo.image,canonicalPath:'/book/10138',locale});
    assert.equal(metadata.alternates.canonical, schema.url);
    assert.equal(metadata.alternates.languages.en, 'https://lumisco.re/en/book/10138');
    assert.equal(metadata.alternates.languages['nl-NL'], 'https://lumisco.re/nl/book/10138');
    assert.equal(metadata.openGraph.images[0].url, schema.image);
    assert.equal(metadata.openGraph.siteName, 'LumiScore');
    assert.deepEqual(metadata.robots,{index:true,follow:true});
  }
});

test('Orion dates and cover never inherit those of the US edition', () => {
  const book = withStrictEdition(work, {...us,id:91021203,isbn_13:'9781399641777',open_library_edition_id:null,publisher:'Orion'},'nl')!;
  const schema = getMirrorBookSeo(book,'nl')!.jsonLd;
  assert.equal(schema.datePublished,'2026-09-29');assert.equal(schema.publisher.name,'Orion');
  assert.match(schema.image,/metadata.isbn.nl/);assert.equal(schema.inLanguage,'en');
  assert.equal(book.englishEditionFallback,true);
});

test('wrong, missing or unavailable identities receive no new schema or search copy', () => {
  const book = withStrictEdition(work,us,'en')!;
  for (const mismatch of [{workId:'10139'},{title:'Other book'},{editionTitle:'Other title'},
    {author:'Other author'},{isbn13:'9789044970791'},{editionLanguage:'nld'},{editionLanguage:null},{editionAvailable:false},{editionId:null},{editionPublisher:'Other publisher'}]) {
    assert.equal(getMirrorBookSeo({...book,...mismatch},'nl'),null);
  }
  assert.equal('aggregateRating' in getMirrorBookSeo({...book,score:9,ratingsCount:10},'en')!.jsonLd,false);
});

test('existing sitemap includes exactly the two clean Mirror routes; website entity remains singular', () => {
  const xml=buildLocalizedSitemap(['10138'],['once-upon-a-broken-heart']);
  const urls=[...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
  assert.deepEqual(urls.filter(u=>u.includes('/book/10138')),['https://lumisco.re/en/book/10138','https://lumisco.re/nl/book/10138']);
  assert.ok(urls.every(u=>!u.includes('?')));
  assert.equal(buildWebsiteJsonLd()['@id'],'https://lumisco.re/#website');
});

test('server route owns Book JSON-LD and labelled detail covers expose descriptive HTML alt text', async () => {
  const route=await readFile(new URL('../../app/book/[workId]/page.tsx',import.meta.url),'utf8');
  const cover=await readFile(new URL('../../app/components/LumiScoreHome.tsx',import.meta.url),'utf8');
  assert.match(route,/serializeMirrorBookJsonLd\(book, locale\)/);
  assert.match(route,/type="application\/ld\+json"/);
  assert.match(cover,/alt=\{label \?\? ''\}/);
});
