import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('shared header prevents wrapping and preserves compact mobile controls', async () => {
  const css = await readFile(new URL('../../app/globals.css', import.meta.url), 'utf8');
  assert.match(css, /\.main-nav \{[^}]*white-space: nowrap/);
  assert.match(css, /\.main-nav > a \{[^}]*min-height: 44px[^}]*white-space: nowrap/);
  assert.match(css, /@media \(max-width: 1040px\)[\s\S]*?a:not\(\.taste-test-nav-link\):not\(\.header-sign-in\)/);
  assert.match(css, /@media \(max-width: 1040px\)[\s\S]*?\.mobile-navigation \{ position: static;/);
  assert.match(css, /\.mobile-navigation-panel \{ right: max\(12px, env\(safe-area-inset-right\)\); width: min\(220px, calc\(100vw - 24px\)\);/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*?grid-template-columns: auto minmax\(0, 1fr\)/);
  assert.match(css, /@media \(max-width: 440px\)[\s\S]*?\.taste-test-nav-link::before/);
  assert.match(css, /\.site-header \.language-switcher a \{ min-width: 27px;/);
  assert.match(css, /\.detail-header \.wordmark > span:last-child \{ display: none;/);
  assert.match(css, /\.detail-header-actions \{ min-width: 0; gap: 3px;/);
  assert.match(css, /\.detail-taste-test-link::before \{ content: '✦';/);
  assert.match(css, /\.want-button \{[^}]*min-height: 44px/);
  assert.match(css, /\.mobile-navigation-trigger \{[^}]*min-height: 44px/);
  assert.match(css, /\.hamburger-icon i \{[^}]*background: currentColor/);
  assert.doesNotMatch(css, /\.mobile-navigation summary/);
});

test('middle-width header keeps wordmark and taste link with compact account controls', async () => {
  const css = await readFile(new URL('../../app/globals.css', import.meta.url), 'utf8');
  const middleWidth = css.split('@media (560px < width <= 760px) {')[1]?.split('@media')[0];
  assert.ok(middleWidth, 'explicitly cover the previous 682px collision and its neighbours');
  assert.match(middleWidth, /\.site-header \{ gap: 8px; padding-inline: 12px;/);
  assert.match(middleWidth, /\.site-header \.main-nav \{ gap: 4px;/);
  assert.match(middleWidth, /\.site-header \.header-account-label, \.site-header \.header-account-chevron,\s*\.site-header \.theme-sun, \.site-header \.theme-moon \{ display: none;/);
  assert.match(middleWidth, /\.site-header \.header-account-trigger \{ width: 44px; justify-content: center;/);
  assert.doesNotMatch(middleWidth, /wordmark|taste-test-nav-link|font-size|overflow/);
});
