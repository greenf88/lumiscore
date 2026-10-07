import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('active scoring is compact, with both explicit actions and optional search outside the card', async () => {
  const source = await read('app/components/RatingTasteTest.tsx');
  const css = await read('app/globals.css');
  assert.match(source, /className="taste-book-identity"[\s\S]*<BookCover[\s\S]*<h3 title=\{book.title\}>\{book.title\}/);
  assert.doesNotMatch(source, /<BookCardIdentity/);
  assert.match(source, /className="taste-save-skip"/);
  assert.match(source, /<details className="taste-book-search">/);
  assert.match(css, /\.taste-book-identity \{[^}]*display: flex/);
  assert.match(css, /\.taste-book-identity \.book-cover \{[^}]*100svh[^}]*100dvh/);
  assert.match(css, /\.taste-rating-card \{[^}]*overflow: visible/);
  assert.match(css, /\.taste-score-buttons \{[^}]*repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.taste-score-buttons button \{[^}]*min-height: 44px/);
  assert.match(css, /\.taste-save-skip button \{[^}]*min-height: 44px/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});

test('active rounds show Pause, paused rounds show Resume; failed resume does not clear pause', async () => {
  const source = await read('app/components/RatingTasteTest.tsx');
  assert.match(source, /paused\s*\? <button[\s\S]*act\('resume'\)[\s\S]*: <button[\s\S]*onClick=\{pause\}/);
  assert.match(source, /round && !round.complete && !paused/);
  assert.match(source, /if \(!r.ok\) throw new Error\(\);\s*const next = await r.json\(\) as Response;\s*if \(action === 'resume'/);
  assert.match(source, /writeRoundPause\(sessionStorage, round.id, true\)/);
  assert.match(source, /setSaved\(action === 'rate'\)/);
  assert.match(source, /if \(workId\) window.scrollTo\(\{ top: 0, behavior: 'instant' \}\)/);
});

test('polished scoring keeps a readable cover rather than a thumbnail on short screens', async () => {
  const css = await read('app/globals.css');
  assert.match(css, /\.taste-book-identity \.book-cover \{[^}]*clamp\(88px, calc\(100svh - 350px\), 156px\)[^}]*clamp\(88px, calc\(100dvh - 350px\), 156px\)/);
  assert.match(css, /\.taste-book-identity h3 \{[^}]*font-size: 20px[^}]*-webkit-line-clamp: 2/);
  assert.doesNotMatch(css, /\.taste-book-identity \.book-cover \{[^}]*clamp\(32px/);
  // Geometry is separately checked in the real component at 320x430 and 390x520.
  assert.match(css, /\.taste-score-buttons button \{[^}]*min-height: 44px/);
  assert.match(css, /\.taste-save-skip button \{[^}]*min-height: 44px/);
});
