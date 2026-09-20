import assert from 'node:assert/strict';
import test from 'node:test';
import {
  browsePathFromSearchParams,
  getSafeBrowseReturnPath,
  updateBrowseReturnPath,
} from './browse-return.ts';

test('Browse context preserves page, page size, sort and repeated supported filters', () => {
  const path = browsePathFromSearchParams({
    page: '2',
    pageSize: '64',
    sort: 'newest',
    language: ['nl', 'en'],
    genre: ['thriller', 'historical-fiction'],
  });

  assert.equal(
    path,
    '/browse?page=2&pageSize=64&sort=newest&language=nl&language=en&genre=thriller&genre=historical-fiction',
  );
  assert.equal(getSafeBrowseReturnPath(path), path);
});

test('Browse links retain 64 and 128 as explicit page sizes', () => {
  assert.equal(
    updateBrowseReturnPath('/browse?page=2&pageSize=64&sort=newest', { page: 3 }),
    '/browse?page=3&pageSize=64&sort=newest',
  );
  assert.equal(
    updateBrowseReturnPath('/browse?pageSize=128', { page: 2 }),
    '/browse?page=2&pageSize=128',
  );
});

test('explicit default page size remains bookmarkable while implicit defaults stay canonical', () => {
  assert.equal(getSafeBrowseReturnPath('/browse?page=1&pageSize=32&sort=az'), '/browse?pageSize=32');
  assert.equal(updateBrowseReturnPath('/browse?page=2', { page: 1 }), '/browse');
});

test('invalid, excessive and ambiguous Browse contexts are rejected', () => {
  const rejected = [
    'https://evil.example/browse?page=2',
    '//evil.example/browse?page=2',
    '/\\evil.example/browse?page=2',
    '/browse%2f..%2flogin',
    '/browse?next=javascript%3Aalert(1)',
    '/browse?page=0',
    '/browse?page=-2',
    '/browse?page=2.5',
    '/browse?page=2&page=3',
    '/browse?pageSize=30',
    '/browse?pageSize=129',
    '/browse?pageSize=100000',
    '/browse?pageSize=64&pageSize=128',
    '/browse?sort=rating',
    '/browse#catalog',
    '/browse?language=de',
    '/api/books',
    '/login',
    'javascript:alert(1)',
    'data:text/html,unsafe',
  ];

  for (const value of rejected) {
    assert.equal(getSafeBrowseReturnPath(value), null, value);
  }
});

test('unknown parameters fail closed instead of being reflected into book links', () => {
  assert.equal(
    browsePathFromSearchParams({ page: '2', campaign: 'untrusted' }),
    null,
  );
});
