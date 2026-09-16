import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getHeaderAuthPresentation } from './header.ts';

test('logged-out desktop header receives a safe Sign in destination', () => {
  assert.deepEqual(
    getHeaderAuthPresentation(
      { authenticated: false },
      '/search?q=science fiction',
    ),
    {
      authenticated: false,
      returnTo: '/search?q=science%20fiction',
      signInHref: '/login?next=%2Fsearch%3Fq%3Dscience%2520fiction',
    },
  );
});

test('logged-in header retains a safe return path for Sign out', () => {
  assert.deepEqual(
    getHeaderAuthPresentation({ authenticated: true }, '/taste-test'),
    {
      authenticated: true,
      returnTo: '/taste-test',
      signInHref: '/login?next=%2Ftaste-test',
    },
  );
});

test('shared header renders accessible logged-out and logged-in controls', async () => {
  const source = await readFile(
    new URL('../../app/components/LumiScoreHome.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /className="header-sign-in"[^>]+>\{t\('header\.signIn'\)\}<\/a>/);
  assert.match(source, /<details className="header-account">/);
  assert.match(source, /<summary aria-label=\{t\('header\.openAccount'\)\}>/);
  assert.match(source, /action="\/auth\/sign-out" method="post"/);
  assert.match(source, /<button type="submit">\{t\('header\.signOut'\)\}<\/button>/);
  assert.match(source, /<LanguageSwitcher \/>/);
  assert.doesNotMatch(source, /className="avatar"[^>]+disabled/);
});

test('mobile header keeps a visible, keyboard-accessible Sign in path', async () => {
  const css = await readFile(
    new URL('../../app/globals.css', import.meta.url),
    'utf8',
  );

  assert.match(
    css,
    /a:not\(\.taste-test-nav-link\):not\(\.header-sign-in\)/,
  );
  assert.match(css, /\.header-sign-in \{ min-height: 44px;/);
  assert.match(css, /\.mobile-search-button \{ display: none; width: 44px; min-width: 44px; height: 44px;/);
});

test('header auth state is verified by the existing server Supabase client', async () => {
  const source = await readFile(
    new URL('../supabase/auth.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /createServerSupabaseClient\(\)/);
  assert.match(source, /client\.auth\.getUser\(\)/);
  assert.doesNotMatch(source, /createBrowserClient|SUPABASE_SECRET_KEY/);
});
