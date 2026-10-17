import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('active scoring uses one-click score buttons and a distinct search button outside the card', async () => {
  const source = await read('app/components/RatingTasteTest.tsx');
  const css = await read('app/globals.css');
  assert.match(source, /taste-book-identity[\s\S]*<BookCover[\s\S]*<h2 ref=\{bookHeading\}/);
  assert.doesNotMatch(source, /<BookCardIdentity/);
  assert.doesNotMatch(source, /Save rating|setScore\(|taste-save-skip/);
  assert.match(source, /<DirectRatingScores[\s\S]*?onRate=\{score => \{if \(workId\) void act\('rate', workId, score\)/);
  const scores = await read('app/components/DirectRatingScores.tsx');
  assert.match(scores, /disabled=\{pending \|\| !workId\}/);
  assert.match(scores, /onClick=\{event => \{if \(event.detail <= 1\) onRate\(score\)/);
  assert.match(source, /className="taste-search-toggle"/);
  assert.match(css, /\.taste-book-identity \{[^}]*display: flex/);
  assert.match(css, /\.taste-book-identity \.book-cover \{[^}]*100svh[^}]*100dvh/);
  assert.match(css, /\.taste-rating-card \{[^}]*overflow: visible/);
  assert.match(css, /\.taste-score-buttons \{[^}]*repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.taste-score-buttons button \{[^}]*min-height: 44px/);
  assert.match(css, /\.taste-save-skip button \{[^}]*min-height: 44px/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});

test('active rounds show Pause; only paused rounds show Resume, and successful responses preserve server authority', async () => {
  const source = await read('app/components/RatingTasteTest.tsx');
  assert.match(source, /active && <button[^>]*onClick=\{pause\}/);
  assert.match(source, /round && !round.complete && !paused/);
  assert.match(source, /paused \? <div className="taste-paused"[\s\S]*act\('resume'\)/);
  assert.match(source, /if \(!r.ok\) throw new Error\(\);[\s\S]*if \(!next.authenticated \|\| !next.available \|\| !next.state\?\.round\) throw new Error\(\)/);
  assert.match(source, /writeRoundPause\(sessionStorage, round.id, true\)/);
  assert.match(source, /setSaved\(action === 'rate'\)/);
  assert.match(source, /bookHeading.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /if \(!round \|\| gate.current\?\.isBusy\(\)\) return/);
});

test('polished scoring keeps a readable cover rather than a thumbnail on short screens', async () => {
  const css = await read('app/globals.css');
  assert.match(css, /\.taste-direct-test \.taste-book-identity \.book-cover \{[^}]*clamp\(100px, calc\(100svh - 540px\), 180px\)/);
  assert.match(css, /\.taste-direct-test \.taste-book-identity h2 \{[^}]*overflow-wrap: anywhere/);
  assert.match(css, /\.taste-direct-test \.taste-score-buttons button \{[^}]*min-width: 44px; min-height: 48px/);
  assert.doesNotMatch(css, /\.taste-book-identity \.book-cover \{[^}]*clamp\(32px/);
  // Geometry is separately checked in the real component at 320x430 and 390x520.
  assert.match(css, /\.taste-score-buttons button \{[^}]*min-height: 44px/);
  assert.match(css, /\.taste-save-skip button \{[^}]*min-height: 44px/);
});
