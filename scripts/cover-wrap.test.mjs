import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
test('wrap only fallback lettering; retain the outlying score seal and do not mask page overflow',()=>{
 const css=fs.readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
 assert.match(css,/\.book-cover \.cover-title,\s*\.book-cover \.cover-author,\s*\.book-cover \.cover-kicker \{ min-width: 0; max-width: 100%; overflow-wrap: anywhere; \}/);
 assert.match(css,/\.book-cover \{ container-type: inline-size; overflow: visible; \}/);
 assert.match(css,/transform: translate\(25%, 25%\)/);
 assert.doesNotMatch(css,/(?:body|html)\s*\{[^}]*overflow-x:\s*(?:hidden|clip)/);
});
