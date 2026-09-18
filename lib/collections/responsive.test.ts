import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');

test('collection, status and continuation layouts collapse safely at phone widths', () => {
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.continue-series \{[^}]*grid-template-columns: 1fr/);
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.continue-series-item \{[^}]*grid-template-columns: 1fr/);
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.collection-book-row \{[^}]*grid-template-columns: 1fr/);
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.reading-status-control label \{[^}]*grid-template-columns: 1fr/);
  assert.match(css, /\.collection-hero, \.collection-book-list \{ width: calc\(100% - 28px\); \}/);
  assert.match(css, /\.reading-status-control select \{[^}]*min-height: 44px/);
});

test('wide layouts remain bounded instead of creating horizontal overflow', () => {
  assert.match(css, /\.collection-book-list \{ width: min\(980px, calc\(100% - 48px\)\)/);
  assert.match(css, /\.continue-series \{ width: min\(1380px, calc\(100% - 48px\)\)/);
  assert.match(css, /\.continue-series-list \{[^}]*min-width: 0/);
  assert.match(css, /\.collection-book-copy strong \{[^}]*overflow-wrap: anywhere/);
});

