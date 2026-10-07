import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const css = read('app/globals.css');
const rgb = s => s.startsWith('#') ? s.slice(1).match(/../g).map(x => parseInt(x, 16)) : s.match(/[\d.]+/g).map(Number);
const over = (a, b) => a.slice(0, 3).map((v, i) => v * (a[3] ?? 1) + b[i] * (1 - (a[3] ?? 1)));
const lum = a => a.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);
const tokens = block => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
const ink = tokens(css.match(/:root \{([^}]+)/)[1]);
const paper = { ...ink, ...tokens(css.match(/:root\[data-theme='paper'\] \{([^}]+)/)[1]) };

test('Inter and Lora are self-hosted WOFF2 subsets with preserved licenses', () => {
  for (const name of ['inter-latin', 'lora-latin', 'lora-latin-italic']) {
    const path = new URL('../public/fonts/' + name + '.woff2', import.meta.url);
    assert.equal(readFileSync(path).subarray(0, 4).toString(), 'wOF2');
    assert.ok(statSync(path).size < 50000);
    assert.ok(css.includes("url('/fonts/" + name + ".woff2')"));
  }
  for (const name of ['Inter', 'Lora']) assert.match(read('public/fonts/' + name + '-OFL.txt'), /SIL OPEN FONT LICENSE/);
  assert.match(css, /--serif: Lora, Georgia/);
  assert.match(css, /--sans: Inter, ui-sans-serif/);
  assert.doesNotMatch(css, /https?:.*(?:googleapis|gstatic)/);
});

test('only the two normal UI font faces are preloaded, italic loads on use', () => {
  const layout = read('app/layout.tsx');
  assert.equal((layout.match(/as="font"/g) || []).length, 2);
  assert.match(layout, /href="\/fonts\/inter-latin.woff2"[^>]*crossOrigin="anonymous"/);
  assert.match(layout, /href="\/fonts\/lora-latin.woff2"[^>]*crossOrigin="anonymous"/);
  assert.doesNotMatch(layout, /lora-latin-italic/);
});

for (const [name, theme] of [['Ink', ink], ['Paper', paper]]) {
  test(name + ' normal text tokens meet 4.5 on flat and composited card backgrounds', () => {
    const backgrounds = ['bg', 'bg-2', 'surface', 'surface-raised'].map(key => rgb(theme[key]));
    backgrounds.push(over(rgb(theme.panel), rgb(theme.bg)), over(rgb(theme.header), rgb(theme.bg)));
    for (const key of ['text', 'muted', 'teal', 'gold-text', 'danger']) for (const bg of backgrounds) {
      assert.ok(contrast(rgb(theme[key]), bg) >= 4.5, name + ' ' + key + ' contrast ' + contrast(rgb(theme[key]), bg));
    }
    assert.ok(contrast([255, 255, 255], rgb(theme['action-bg'])) >= 4.5);
    assert.ok(contrast([255, 255, 255], rgb(theme['teal-deep'])) >= 4.5);
  });
}

test('the central scale retains compact scoring and the original logo face/colors', () => {
  assert.match(css, /--type-book: clamp\(18px, 1.5vw, 20px\)/);
  assert.match(css, /--type-body: 16px/);
  assert.match(css, /--type-meta: 14px/);
  assert.match(css, /--logo-serif: Georgia/);
  assert.match(css, /\.wordmark[^}]*font-family: var\(--logo-serif\)/);
  assert.match(css, /\.logo-mark i \{[^}]*#4f9ba0/);
  assert.match(css, /\.taste-save-skip button \{[^}]*min-height: 44px/);
  assert.match(css, /\.taste-score-buttons button \{[^}]*min-height: 44px/);
});
