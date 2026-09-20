import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  appendBookReturnContext,
  resolveBookReturnNavigation,
} from './book-return.ts';

const verifySuzanneMembership = async (workId: string, slug: string) => (
  workId === '1296' && slug === 'suzanne-vermeer'
    ? { slug, name: 'Suzanne Vermeer' }
    : null
);

test('Suzanne Vermeer Work 1296 returns to its trusted collection', async () => {
  const navigation = await resolveBookReturnNavigation(
    '/collection/suzanne-vermeer',
    '1296',
    verifySuzanneMembership,
  );

  assert.deepEqual(navigation, {
    kind: 'collection',
    href: '/collection/suzanne-vermeer',
    collectionName: 'Suzanne Vermeer',
  });
});

test('another valid collection resolves with the database name', async () => {
  const navigation = await resolveBookReturnNavigation(
    '/collection/the-witcher',
    '77',
    async (workId, slug) => workId === '77' && slug === 'the-witcher'
      ? { slug, name: 'The Witcher' }
      : null,
  );

  assert.deepEqual(navigation, {
    kind: 'collection',
    href: '/collection/the-witcher',
    collectionName: 'The Witcher',
  });
});

test('a Work in multiple collections returns to the selected source', async () => {
  const memberships = new Map([
    ['dune', 'Dune'],
    ['modern-classics', 'Modern Classics'],
  ]);

  const navigation = await resolveBookReturnNavigation(
    '/collection/modern-classics',
    '8',
    async (_workId, slug) => {
      const name = memberships.get(slug);
      return name ? { slug, name } : null;
    },
  );

  assert.deepEqual(navigation, {
    kind: 'collection',
    href: '/collection/modern-classics',
    collectionName: 'Modern Classics',
  });
});

test('false and unknown collection memberships fall back to Browse', async () => {
  assert.deepEqual(
    await resolveBookReturnNavigation(
      '/collection/suzanne-vermeer',
      '8',
      verifySuzanneMembership,
    ),
    { kind: 'browse', href: '/browse' },
  );
  assert.deepEqual(
    await resolveBookReturnNavigation(
      '/collection/unknown-collection',
      '1296',
      verifySuzanneMembership,
    ),
    { kind: 'browse', href: '/browse' },
  );
});

test('malformed, external and encoded collection contexts are rejected', async () => {
  const rejected = [
    'https://evil.example/collection/suzanne-vermeer',
    '//evil.example/collection/suzanne-vermeer',
    '/\\evil.example/collection/suzanne-vermeer',
    'javascript:alert(1)',
    'data:text/html,unsafe',
    '/collection/%73uzanne-vermeer',
    '/collection/suzanne-vermeer%2f..',
    '/collection/suzanne-vermeer?label=Fake',
    '/collection/suzanne-vermeer#fake',
    '/collection/Suzanne-Vermeer',
  ];

  for (const value of rejected) {
    assert.deepEqual(
      await resolveBookReturnNavigation(value, '1296', verifySuzanneMembership),
      { kind: 'browse', href: '/browse' },
      value,
    );
  }
});

test('search context keeps priority and preserves every parameter', async () => {
  let verifierCalls = 0;
  const path = '/search?q=dune&page=2&sort=rating&language=nl&language=en';
  const navigation = await resolveBookReturnNavigation(
    path,
    '8',
    async () => {
      verifierCalls += 1;
      return null;
    },
  );

  assert.deepEqual(navigation, { kind: 'search', href: path });
  assert.equal(verifierCalls, 0);
});

test('directory, direct and Browse traffic resolve without a collection query', async () => {
  let verifierCalls = 0;
  const verifier = async () => {
    verifierCalls += 1;
    return null;
  };

  assert.deepEqual(
    await resolveBookReturnNavigation('/collections', '8', verifier),
    { kind: 'collections', href: '/collections' },
  );
  assert.deepEqual(
    await resolveBookReturnNavigation(undefined, '8', verifier),
    { kind: 'browse', href: '/browse' },
  );
  assert.deepEqual(
    await resolveBookReturnNavigation('/browse?page=3', '8', verifier),
    { kind: 'browse', href: '/browse' },
  );
  assert.equal(verifierCalls, 0);
});

test('book links serialize only typed, validated internal context', () => {
  assert.equal(
    appendBookReturnContext('/book/1296', {
      kind: 'collection',
      slug: 'suzanne-vermeer',
    }),
    '/book/1296?returnTo=%2Fcollection%2Fsuzanne-vermeer',
  );
  assert.equal(
    appendBookReturnContext('/book/1296', {
      kind: 'collection',
      slug: 'https://evil.example',
    }),
    '/book/1296',
  );
  assert.equal(
    appendBookReturnContext('/book/8', { kind: 'collections' }),
    '/book/8?returnTo=%2Fcollections',
  );
  assert.equal(
    appendBookReturnContext('/book/8', { kind: 'home' }),
    '/book/8?returnTo=%2F',
  );
});

test('book SEO stays canonical and independent from navigation context', async () => {
  const page = await readFile(
    new URL('../../app/book/[workId]/page.tsx', import.meta.url),
    'utf8',
  );
  const metadataBlock = page.slice(
    page.indexOf('export async function generateMetadata'),
    page.indexOf('export default async function BookPage'),
  );

  assert.match(metadataBlock, /alternates: \{ canonical: `\/book\/\$\{workId\}` \}/);
  assert.doesNotMatch(metadataBlock, /searchParams|returnTo|returnNavigation/);
  assert.match(page, /canonicalPath=\{`\/book\/\$\{book\.workId\}`\}/);
});

test('back navigation remains a keyboard-accessible, mobile-safe anchor', async () => {
  const [detail, styles] = await Promise.all([
    readFile(new URL('../../app/components/LumiScoreBookDetail.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../app/globals.css', import.meta.url), 'utf8'),
  ]);

  assert.match(detail, /<a className="detail-back-link" href=\{returnNavigation\.href\}>/);
  assert.match(detail, /detail\.backToCollection/);
  assert.match(detail, /returnNavigation\.collectionName/);
  assert.match(styles, /\.detail-back-link \{[^}]*min-height: 44px/);
  assert.doesNotMatch(styles, /\.detail-back-link \{[^}]*white-space: nowrap/);
});
