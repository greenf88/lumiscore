import assert from'node:assert/strict';import test from'node:test';import fs from'node:fs';
test('long detail titles and neutral placeholder titles can wrap without global clipping or resized typography',()=>{
 const css=fs.readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
 assert.match(css,/\.detail-copy h1, \.detail-cover-wrap \.cover-title \{ overflow-wrap: anywhere; \}/);
 assert.match(css,/\.detail-copy h1 \{ max-width: 700px; margin: 18px 0 12px; font-family: var\(--serif\); font-size: clamp\(48px, 6vw, 82px\)/);
});
