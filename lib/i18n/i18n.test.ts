import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type { Book } from '../../app/data/books.ts';
import { recommendBooks, type RecommendationCandidate } from '../recommendations/engine.ts';
import { buildTasteProfile, getTasteProfileConfidenceCopy } from '../taste-test/profile.ts';
import { TASTE_TRAITS, tasteVector } from '../taste-test/traits.ts';
import {
  localeFromLanguage,
  resolveLocale,
  serializeLocaleCookie,
} from './config.ts';
import { translate } from './translations.ts';

test('browser language chooses Dutch only for nl locales on first visit', () => {
  assert.equal(localeFromLanguage('nl-NL'), 'nl');
  assert.equal(localeFromLanguage('nl'), 'nl');
  assert.equal(localeFromLanguage('en-US'), 'en');
  assert.equal(localeFromLanguage('de-DE'), 'en');
});

test('an explicit persisted locale wins over browser language and serializes for reloads', () => {
  assert.equal(resolveLocale({ persistedLocale: 'en', browserLanguage: 'nl-NL' }), 'en');
  assert.equal(resolveLocale({ persistedLocale: 'nl', browserLanguage: 'en-US' }), 'nl');
  assert.match(serializeLocaleCookie('nl'), /^lumiscore-locale=nl;/);
  assert.match(serializeLocaleCookie('nl'), /Max-Age=31536000/);
  assert.match(serializeLocaleCookie('nl'), /SameSite=Lax/);
});

test('Dutch and English public header and Taste Test copy are both available', () => {
  assert.equal(translate('nl', 'header.discover'), 'Ontdekken');
  assert.equal(translate('nl', 'header.signIn'), 'Inloggen');
  assert.equal(translate('en', 'header.discover'), 'Discover');
  assert.equal(translate('en', 'header.signIn'), 'Sign in');
  assert.equal(translate('nl', 'taste.readingTaste'), 'Jouw leessmaak');
  assert.equal(translate('en', 'taste.readingTaste'), 'Your reading taste');
  assert.deepEqual(getTasteProfileConfidenceCopy('LOW', 'nl'), {
    label: 'Eerste profiel',
    description: 'We leren je leessmaak nog kennen.',
  });
});

test('taste summaries and recommendation explanations use localized trait labels', () => {
  const answers = { 'fantasy-or-science-fiction': 'right' as const };
  const englishProfile = buildTasteProfile(answers, [], 'en');
  const dutchProfile = buildTasteProfile(answers, [], 'nl');
  assert.match(englishProfile.summary, /science fiction|immersive worlds/);
  assert.match(dutchProfile.summary, /sciencefiction|meeslepende werelden/);

  const book: Book = {
    id: 'work-9901', source: 'supabase', workId: '9901', title: 'Test',
    author: 'Writer', score: 8, ratingsCount: 10, match: null, cover: 'orbit',
  };
  const candidate: RecommendationCandidate = {
    book,
    traits: tasteVector({ science_fiction: 1, worldbuilding: 1 }),
    metadataConfidence: .9,
    coverageLevel: 'rich',
  };
  const english = recommendBooks({ candidates: [candidate], profile: englishProfile, ratedWorkIds: new Set(), locale: 'en' })[0];
  const dutch = recommendBooks({ candidates: [candidate], profile: dutchProfile, ratedWorkIds: new Set(), locale: 'nl' })[0];

  assert.match(english.explanation, /science fiction|immersive worlds/);
  assert.match(dutch.explanation, /sciencefiction|meeslepende werelden/);
  assert.equal(english.rankingScore, dutch.rankingScore);
  assert.equal(english.personalMatch, dutch.personalMatch);
  assert.equal(english.matchScore, dutch.matchScore);
});

test('localization does not change internal trait keys', () => {
  assert.deepEqual(TASTE_TRAITS, [
    'fantasy', 'science_fiction', 'speculative', 'literary', 'romance',
    'thriller_mystery', 'nonfiction', 'classic', 'contemporary', 'dark',
    'uplifting', 'fast_paced', 'slow_burn', 'worldbuilding', 'character_driven',
    'idea_driven', 'accessible', 'complex',
  ]);
});

test('the shared header exposes one accessible language switcher on all main pages', async () => {
  const [home, detail, login] = await Promise.all([
    readFile(new URL('../../app/components/LumiScoreHome.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../app/components/LumiScoreBookDetail.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../app/components/LumiScoreLogin.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(home, /<LanguageSwitcher \/>/);
  assert.match(detail, /<LanguageSwitcher \/>/);
  assert.match(login, /<LanguageSwitcher \/>/);
});
