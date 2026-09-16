import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(
  new URL('../../app/globals.css', import.meta.url),
  'utf8',
);

test('mobile and coarse-pointer form controls use iOS-safe text sizing', () => {
  assert.match(
    css,
    /@media \(max-width: 820px\), \(hover: none\) and \(pointer: coarse\) \{[\s\S]*?\.search-bar input,[\s\S]*?\.auth-form input:not\(\[type='hidden'\]\),[\s\S]*?\.reading-status-control\.is-compact select,[\s\S]*?textarea \{ font-size: 16px; \}/,
  );
});

test('desktop search typography remains unchanged', () => {
  assert.match(css, /\.search-bar input \{[^}]*font-size: 13px;/);
});
