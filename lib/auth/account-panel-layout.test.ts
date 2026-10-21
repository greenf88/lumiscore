import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {accountPanelLayout} from './account-panel-layout.ts';

for (const width of [320,375,390,430,844,1440]) {
  for (const height of [240,320,390,844]) {
    test(`menu edges remain within ${width} × ${height}, including old middle avatar and scrolled header`, () => {
      for (const x of [12,width/2,width-56]) for (const y of [-120,12,height-44]) {
        const anchor={left:x,right:x+44,top:y,bottom:y+44};
        const panel=accountPanelLayout(anchor,{left:0,top:0,width,height});
        assert.ok(x+panel.left>=12);
        assert.ok(x+panel.left+panel.width<=width-12);
        assert.ok(y+panel.top>=12);
        assert.ok(y+panel.top+panel.maxHeight<=height-12);
        assert.ok(panel.maxHeight>=160);
      }
    });
  }
}
test('visual viewport offsets from zoom/keyboard stay inside the visible area',()=>{
  const anchor={left:176.6,right:220.6,top:11.6,bottom:55.6};
  const viewport={left:40,top:100,width:260,height:250};
  const panel=accountPanelLayout(anchor,viewport);
  assert.ok(anchor.left+panel.left>=52);
  assert.ok(anchor.left+panel.left+panel.width<=288);
  assert.ok(anchor.top+panel.top>=112);
  assert.ok(anchor.top+panel.top+panel.maxHeight<=338);
});

test('both header variants use bounded geometry, scrolling and existing keyboard dismissal',async()=>{
  const menu=await readFile(new URL('../../app/components/LumiScoreAccountMenu.tsx',import.meta.url),'utf8');
  const detail=await readFile(new URL('../../app/components/LumiScoreBookDetail.tsx',import.meta.url),'utf8');
  const css=await readFile(new URL('../../app/globals.css',import.meta.url),'utf8');
  assert.match(menu,/accountPanelLayout\(root\.getBoundingClientRect\(\)/);
  assert.match(menu,/visualViewport\?\.addEventListener\('resize', updatePosition\)/);
  assert.match(menu,/ref=\{panelRef\}/);
  assert.match(menu,/triggerRef\.current\?\.focus\(\)/);
  assert.match(css,/\.header-account-panel \{[^}]*overflow-y: auto[^}]*overscroll-behavior: contain/);
  assert.match(detail,/<LanguageSwitcher \/>[\s\S]*?<ThemeToggle[^>]+\/>\s*<LumiScoreAccountMenu/);
});
