import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {canOpenRoundResult} from '../lib/taste-test/direct-rating.ts';
test('homepage spacing uses intrinsic layout, scoped section spacing and no negative offset',async()=>{
 const css=await readFile(new URL('../app/globals.css',import.meta.url),'utf8');
 const hero=css.match(/\.hero-inner \{[^}]+\}/g).join('\n');
 assert.doesNotMatch(hero,/min-height|margin[^;]*-\d/);
 assert.match(hero,/align-items: start/);assert.match(hero,/padding: 28px 0 24px/);
 assert.match(css,/\.hero \+ #discover \{ padding-top: 20px;/);
});
test('guest action retains its destination and makes no account-persistence promise',async()=>{
 const ui=await readFile(new URL('../app/components/RatingTasteTest.tsx',import.meta.url),'utf8');
 const copy=await readFile(new URL('../lib/i18n/translations.ts',import.meta.url),'utf8');
 assert.match(ui,/className="taste-secondary-action" href="\/taste-test\/preferences"/);
 assert.match(ui,/hasResult && <LocaleLink className="taste-result-link" href="\/taste-test\/result"/);
 for(const label of ['Continue as guest','Doorgaan als gast','View your reading profile','Bekijk je leesprofiel'])assert.ok(copy.includes(label));
});
test('no profile action without existing sufficient round evidence',()=>{
 assert.equal(canOpenRoundResult(null),false);
 for(const ratedCount of [0,9,10,20])assert.equal(canOpenRoundResult({round:{ratedCount}}),ratedCount>=10);
});
