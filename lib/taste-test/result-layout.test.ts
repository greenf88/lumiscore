import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Taste Profile confidence uses body copy and responsive action hierarchy', async () => {
  const [component, css] = await Promise.all([
    readFile(new URL('../../app/components/LumiScoreTasteTest.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../app/globals.css', import.meta.url), 'utf8'),
  ]);
  assert.match(component, /<div className="taste-confidence">/);
  assert.match(css, /\.taste-result-summary \{[^}]*font-size: clamp\(19px, 2\.5vw, 25px\)/);
  assert.match(css, /\.taste-confidence span \{[^}]*font-family: var\(--sans\)[^}]*text-transform: none/);
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.taste-confidence \{[^}]*flex-direction: column/);
  assert.match(css, /\.taste-sign-in \{[^}]*min-height: 44px/);
});
