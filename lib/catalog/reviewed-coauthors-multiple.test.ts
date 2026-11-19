import assert from 'node:assert/strict';
import test from 'node:test';
import type { Book } from '../../app/data/books.ts';
import { bookAuthorByline, reviewedCoauthors } from './reviewed-coauthors.ts';
import { rankCatalogSearchResults, reviewedCoauthorSearchKeys } from '../books/catalog-search.ts';
import { bookPageJsonLd } from '../seo/book-json-ld.ts';

const book: Book = { id: 'work-3991', workId: '3991', editionId: '4150',
  title: 'Value proposition design', editionTitle: 'Value proposition design',
  author: 'Alexander Osterwalder', authorId: '1', isbn13: '9781118968055',
  editionAvailable: true, editionLanguage: 'eng', strictEditionLanguage: 'en', source: 'supabase', cover: 'orbit',
  score: null, match: null, ratingsCount: null };

test('all verified authors appear in the byline, search and structured edition', () => {
  assert.equal(bookAuthorByline(book, 'en'), 'Alexander Osterwalder, Yves Pigneur, Gregory Bernarda and Alan Smith');
  assert.equal(bookAuthorByline(book, 'nl'), 'Alexander Osterwalder, Yves Pigneur, Gregory Bernarda en Alan Smith');
  const other = { ...book, isbn13: '9780141439518' };
  const graph = bookPageJsonLd(book, 'en')['@graph'];
  const edition = graph.find(node => node['@id'] === 'https://lumisco.re/#edition-4150');
  assert.ok(edition);
  const authors = edition.author as { '@id': string }[];
  assert.equal(authors.length, 4);
  for (const name of ['Yves Pigneur', 'Gregory Bernarda', 'Alan Smith']) {
    assert.deepEqual(rankCatalogSearchResults([other, book], name), [book]);
    assert.deepEqual(reviewedCoauthorSearchKeys(name), { workIds: [], editionIsbns: ['9781118968055'] });
    const person = graph.find(node => node.name === name);
    assert.ok(person && authors.some(author => author['@id'] === person['@id']));
  }
  assert.deepEqual(reviewedCoauthors(other), []);
  assert.deepEqual(reviewedCoauthors({ ...book, author: 'Different author' }), []);
});

test('the publishing organisation is not described as a person', () => {
  const graph = bookPageJsonLd({ ...book, author: 'Routledge', workId: '6644', isbn13: '9780415191326' }, 'en')['@graph'];
  assert.equal(graph.find(node => node.name === 'Routledge')?.['@type'], 'Organization');
});
