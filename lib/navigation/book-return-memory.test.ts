import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { bookReturnMemoryKey, cleanBookLink, resolveLocalBookReturn, safeLocalBookReturn, serializeBookReturnMemory } from './book-return-memory.ts';

const now = 1_800_000_000_000;
const book = 'https://lumisco.re/nl/book/8';

test('rendered book links discard return context while preserving locale and other explicit URL parts', () => {
  assert.deepEqual(cleanBookLink('/nl/book/8?returnTo=%2Fbrowse%3Fpage%3D2'), {
    href: '/nl/book/8', returnPath: '/browse?page=2',
  });
  assert.deepEqual(cleanBookLink('/en/book/8?returnTo=%2F&campaign=one#rating'), {
    href: '/en/book/8?campaign=one#rating', returnPath: '/',
  });
  assert.deepEqual(cleanBookLink('/nl/book/8?returnTo=https%3A%2F%2Fevil.example'), {
    href: '/nl/book/8', returnPath: null,
  });
  assert.deepEqual(cleanBookLink('/nl/book/8?returnTo=%2F&returnTo=%2Fbrowse'), {
    href: '/nl/book/8', returnPath: null,
  });
  for (const href of ['/nl/login?next=%2Fbook%2F8', '/nl/search?q=Dune', 'https://other.example/book/8?returnTo=%2F', '//other.example/book/8']) {
    assert.deepEqual(cleanBookLink(href), { href, returnPath: null });
  }
});

test('same-tab clicks keep virtual homepage search and full browse filters out of URLs', () => {
  const source = 'https://lumisco.re/nl';
  const path = '/search?q=duin&page=2&language=nl&language=en';
  const stored = serializeBookReturnMemory('/nl/book/8', path, source, now);
  assert.deepEqual(resolveLocalBookReturn({ currentUrl: book, referrer: source, stored, now }), { kind: 'search', href: path });
  const filteredSource = 'https://lumisco.re/nl/browse?page=2&pageSize=64&sort=newest&category=science_fiction';
  assert.deepEqual(resolveLocalBookReturn({ currentUrl: book, referrer: filteredSource, stored: null, now }), {
    kind: 'browse', href: '/browse?page=2&pageSize=64&sort=newest&category=science_fiction',
  });
});

test('new-tab clicks and disabled storage recover safe overview paths from the same-origin referrer', () => {
  for (const [path, kind] of [
    ['/collection/dune', 'collection'], ['/toplijsten/fantasy-sciencefiction', 'editorial'],
    ['/collections?type=series', 'collections'], ['/recommendations?limit=25', 'recommendations'],
  ]) {
    assert.deepEqual(resolveLocalBookReturn({ currentUrl: book, referrer: `https://lumisco.re/nl${path}`, stored: null, now }), { kind, href: path });
  }
  assert.deepEqual(resolveLocalBookReturn({ currentUrl: book, referrer: 'https://lumisco.re/nl', stored: '{broken', now }), { kind: 'home', href: '/' });
});

test('reload and sign-in keep the selected path, while direct and external arrivals ignore old tab state', () => {
  const source = 'https://lumisco.re/nl/toplijsten/na-project-hail-mary';
  const stored = serializeBookReturnMemory('/nl/book/8', '/toplijsten/na-project-hail-mary', source, now);
  for (const input of [
    { referrer: '', navigationType: 'reload' },
    { referrer: '', navigationType: 'back_forward' },
    { referrer: 'https://lumisco.re/nl/login?next=%2Fnl%2Fbook%2F8' },
    { referrer: 'https://lumisco.re/auth/callback?code=private' },
  ]) {
    assert.deepEqual(resolveLocalBookReturn({ currentUrl: book, stored, now, ...input }), { kind: 'editorial', href: '/toplijsten/na-project-hail-mary' });
  }
  assert.equal(resolveLocalBookReturn({ currentUrl: book, referrer: '', stored, now, navigationType: 'navigate' }), null);
  assert.equal(resolveLocalBookReturn({ currentUrl: book, referrer: 'https://google.com/', stored, now }), null);
  assert.equal(resolveLocalBookReturn({ currentUrl: book.replace('/nl/', '/en/'), referrer: '', stored, now, navigationType: 'reload' }), null);
  assert.equal(resolveLocalBookReturn({ currentUrl: book, referrer: '', stored, now: now + 30 * 60 * 1_000, navigationType: 'reload' }), null);
  assert.equal(resolveLocalBookReturn({ currentUrl: book, referrer: '', stored, now: now - 1, navigationType: 'reload' }), null);
});

test('legacy explicit contexts remain server-verified and untrusted local paths cannot escape the site', () => {
  assert.equal(resolveLocalBookReturn({ currentUrl: book + '?returnTo=%2Fcollection%2Fdune', referrer: 'https://lumisco.re/nl', stored: null, now }), null);
  for (const value of ['//evil.example', 'https://evil.example/', '/\\evil.example', '/collection/%2e%2e', '/collection/dune?label=Fake', '/toplijsten/x#fragment', '/browse?unknown=1', '/login?next=/']) {
    assert.equal(safeLocalBookReturn(value), null, value);
  }
  assert.equal(serializeBookReturnMemory('https://evil.example/nl/book/8', '/', 'https://lumisco.re/nl', now), null);
  assert.equal(bookReturnMemoryKey('/nl/book/8'), 'lumiscore-book-return:v1:/nl/book/8');
});

test('a language-switch click explicitly carries the selected overview into the new locale', () => {
  const stored = serializeBookReturnMemory('/en/book/8', '/browse?page=2&pageSize=64', book, now);
  assert.deepEqual(resolveLocalBookReturn({ currentUrl: 'https://lumisco.re/en/book/8', referrer: book, stored, now }), {
    kind: 'browse', href: '/browse?page=2&pageSize=64',
  });
});

test('book-link rendering uses clean hrefs without intercepting native navigation or leaking storage into metadata', async () => {
  const component = await readFile(new URL('../../app/components/LumiScoreLocale.tsx', import.meta.url), 'utf8');
  assert.match(component, /cleanBookLink\(localizedHref\(href, locale\)\)/);
  assert.match(component, /href=\{target\?\.href \?\? href\}/);
  assert.match(component, /onClick\?\.\(event\)/);
  assert.match(component, /onAuxClick\?\.\(event\)/);
  assert.doesNotMatch(component, /preventDefault\(|window\.location\.assign\(target/);
});
