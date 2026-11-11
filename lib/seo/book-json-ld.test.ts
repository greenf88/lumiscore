import assert from 'node:assert/strict';
import test from 'node:test';
import type { Book } from '../../app/data/books.ts';
import { bookPageJsonLd } from './book-json-ld.ts';

const book: Book = {
  id: 'work-30', source: 'supabase', workId: '30', workTitle: 'The Work', title: 'Het werk',
  author: 'Example Author', authorId: '19', editionId: '24', editionAvailable: true,
  editionLanguage: 'nld', strictEditionLanguage: 'nl', firstPublishYear: 1993,
  isbn13: '9780306406157', isbn10: '0306406152',
  coverUrls: ['https://covers.openlibrary.org/b/id/123-M.jpg?default=false'],
  cover: 'orbit', score: 8, ratingsCount: 40, match: null,
};

test('one Work and author are shared across two distinct visible editions', () => {
  const nl = bookPageJsonLd(book, 'nl')['@graph'];
  const en = bookPageJsonLd({
    ...book, title: 'The Work', editionId: '25', editionLanguage: 'eng', strictEditionLanguage: 'en',
    isbn13: null, isbn10: null, coverUrls: [],
  }, 'en')['@graph'];
  assert.equal(nl[1]['@id'], en[1]['@id']);
  assert.equal(nl[3]['@id'], en[3]['@id']);
  assert.notEqual(nl[2]['@id'], en[2]['@id']);
  assert.equal(nl[1].name, undefined);
  assert.equal(nl[1].datePublished, '1993');
  assert.equal(nl[2].datePublished, undefined);
  assert.deepEqual(nl[0].mainEntity, { '@id': nl[2]['@id'] });
  assert.deepEqual(nl[1].workExample, { '@id': nl[2]['@id'] });
  assert.deepEqual(nl[2].exampleOfWork, { '@id': nl[1]['@id'] });
  assert.equal(nl[2].name, book.title);
  assert.equal(nl[2].inLanguage, 'nl');
  assert.equal(nl[2].isbn, book.isbn13);
  assert.equal(nl[2].image, 'https://covers.openlibrary.org/b/id/123-L.jpg?default=false');
  assert(!('isbn' in en[2]));
  assert(!('image' in en[2]));
  assert(!nl.some(node => 'aggregateRating' in node));
});

test('an unavailable locale advertises only the visible Work and known author', () => {
  const graph = bookPageJsonLd({ ...book, editionAvailable: false }, 'nl')['@graph'];
  assert.equal(graph.filter(node => node['@type'] === 'Book').length, 1);
  assert.deepEqual(graph[0].mainEntity, { '@id': graph[1]['@id'] });
  assert(!('workExample' in graph[1]));
  assert(!('isbn' in graph[1]));
});

test('the Waterpark Work and edition credit distinct authors', () => {
  const graph = bookPageJsonLd({
    ...book, workId: '10473', editionId: '11109', author: 'Thomas van Grinsven', authorId: '5768',
  }, 'nl')['@graph'];
  const people = graph.filter(node => node['@type'] === 'Person');
  assert.deepEqual(people.map(person => person.name), ['Thomas van Grinsven', 'Rutger Vink']);
  assert.notEqual(people[0]['@id'], people[1]['@id']);
  for (const node of graph.filter(node => node['@type'] === 'Book')) {
    assert.deepEqual(node.author, people.map(person => ({ '@id': person['@id'] })));
  }
});
