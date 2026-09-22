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
  assert.match(css, /\.collection-bulk-action-bar \{[^}]*max-width: calc\(100vw - 28px\)[^}]*min-width: 0/);
  assert.match(css, /\.collection-bulk-action-bar > div \{[^}]*width: 100%[^}]*min-width: 0[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.collection-bulk-action-bar button \{[^}]*min-width: 0[^}]*overflow-wrap: anywhere/);
});

test('wide layouts remain bounded instead of creating horizontal overflow', () => {
  assert.match(css, /\.collection-book-list \{ width: min\(980px, calc\(100% - 48px\)\)/);
  assert.match(css, /\.continue-series \{ width: min\(1380px, calc\(100% - 48px\)\)/);
  assert.match(css, /\.continue-series-list \{[^}]*min-width: 0/);
  assert.match(css, /\.collection-book-copy strong \{[^}]*overflow-wrap: anywhere/);
});

