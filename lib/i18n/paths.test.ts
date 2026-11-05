import assert from 'node:assert/strict';
import test from 'node:test';
import { languageRoute, localizedHref, languageAlternates } from './paths.ts';
import { authDestination, getReadingPreferencesOnboardingPath } from '../auth/request.ts';

test('legacy paths have one stable English destination; existing Work IDs and queries survive', () => {
  for (const [path, target] of [['/', '/en'], ['/book/123', '/en/book/123'], ['/books/123', '/en/book/123'], ['/nl/books/123', '/nl/book/123'], ['/nl/', '/nl']]) {
    assert.deepEqual(languageRoute(path), {kind:'redirect',path:target});
  }
  assert.deepEqual(languageRoute('/nl/browse'),{kind:'rewrite',path:'/browse',locale:'nl'});
  assert.deepEqual(languageRoute('/en/book/123'),{kind:'rewrite',path:'/book/123',locale:'en'});
});
test('actions, private APIs and static assets are not exposed through language aliases', () => {
  for(const path of ['/api/ratings','/auth/callback','/sitemap.xml','/robots.txt','/fonts/inter-latin.woff2','/_vercel/speed-insights/vitals']) {
    assert.deepEqual(languageRoute(path),{kind:'pass'});
    assert.deepEqual(languageRoute('/nl'+path),{kind:'redirect',path});
    assert.equal(localizedHref(path,'nl'),path);
  }
});
test('language links preserve query/filter/book return context; external and fragment links stay intact', () => {
  assert.equal(localizedHref('/en/browse?page=2&category=fiction','nl'),'/nl/browse?page=2&category=fiction');
  assert.equal(localizedHref('/book/1?returnTo=%2Fbrowse%3Fpage%3D2','nl'),'/nl/book/1?returnTo=%2Fbrowse%3Fpage%3D2');
  assert.equal(localizedHref('/?q=a','en'),'/en?q=a');
  for(const path of ['https://example.org','mailto:hello@lumisco.re','#ratings','//example.org']) assert.equal(localizedHref(path,'nl'),path);
  assert.deepEqual(languageAlternates('/book/1'),{en:'/en/book/1','nl-NL':'/nl/book/1','x-default':'/en/book/1'});
});
test('Auth and onboarding keep a safe localized destination', () => {
  assert.equal(authDestination('/login?error=invalid_credentials','/nl/book/1'),'/nl/login?error=invalid_credentials');
  assert.equal(authDestination('/login','//example.org'),'/login');
  assert.equal(getReadingPreferencesOnboardingPath('/nl/book/1'),'/nl/reading-preferences?next=%2Fnl%2Fbook%2F1');
});

test('English editorial overview and every nested list share existing Dutch content routes without redirect loops',()=>{
  for(const suffix of ['','/dystopie-vanaf-1990','/na-project-hail-mary']){
    assert.deepEqual(languageRoute('/en/toplijsten'+suffix),{kind:'redirect',path:'/en/toplists'+suffix});
    assert.deepEqual(languageRoute('/en/toplists'+suffix),{kind:'rewrite',path:'/toplijsten'+suffix,locale:'en'});
    assert.deepEqual(languageRoute('/nl/toplijsten'+suffix),{kind:'rewrite',path:'/toplijsten'+suffix,locale:'nl'});
    assert.deepEqual(languageRoute('/nl/toplists'+suffix),{kind:'redirect',path:'/nl/toplijsten'+suffix});
    for(const prefix of ['/toplijsten','/toplists'])assert.deepEqual(languageRoute(prefix+suffix),{kind:'redirect',path:'/en/toplists'+suffix});
    assert.deepEqual(languageRoute('/en/toplijsten'+suffix+'/'),{kind:'redirect',path:'/en/toplists'+suffix});
    assert.equal(localizedHref('/en/toplists'+suffix+'?utm_source=facebook#books','nl'),'/nl/toplijsten'+suffix+'?utm_source=facebook#books');
    assert.equal(localizedHref('/nl/toplijsten'+suffix+'?utm_source=facebook#books','en'),'/en/toplists'+suffix+'?utm_source=facebook#books');
    assert.deepEqual(languageAlternates('/toplijsten'+suffix),{en:'/en/toplists'+suffix,'nl-NL':'/nl/toplijsten'+suffix,'x-default':'/en/toplists'+suffix});
  }
});

test('editorial path mapping never rewrites partial segments, assets, APIs or nested return query values',()=>{
  for(const path of ['/toplijsten-extra','/toplists-extra','/book/toplijsten','/images/toplijsten.jpg','/api/toplijsten']){
    assert.equal(localizedHref(path,'en'),path.startsWith('/api/')||path.endsWith('.jpg')?path:'/en'+path);
  }
  assert.equal(localizedHref('/book/197?returnTo=%2Ftoplijsten%2Feerste-delen-fantasyreeksen','en'),'/en/book/197?returnTo=%2Ftoplijsten%2Feerste-delen-fantasyreeksen');
  assert.deepEqual(languageRoute('/en/imdb-voor-boeken'),{kind:'redirect',path:'/en/imdb-for-books'});
  assert.deepEqual(languageRoute('/nl/imdb-voor-boeken'),{kind:'rewrite',path:'/imdb-for-books',locale:'nl'});
});
