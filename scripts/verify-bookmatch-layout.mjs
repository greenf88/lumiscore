// Optional real-browser regression; no dependency installation or hosted writes.
// BOOKMATCH_LAYOUT_ORIGIN must name the existing localhost review server.
// PLAYWRIGHT_PACKAGE_JSON can identify an already installed Playwright runtime.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';

const origin=new URL(process.env.BOOKMATCH_LAYOUT_ORIGIN??'http://127.0.0.1:3016');
assert.equal(origin.origin,'http://127.0.0.1:3016','Only the approved local review server is allowed');
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON??import.meta.url);
const {chromium}=require('playwright');
const browser=await chromium.launch({channel:process.env.BOOKMATCH_BROWSER_CHANNEL??'msedge',headless:true});
const results=[];
try {
  for(const width of [390,1280]) for(const locale of ['nl','en']) for(const theme of ['ink','paper']) {
    const context=await browser.newContext({viewport:{width,height:width===390?844:900},isMobile:width===390,hasTouch:width===390});
    try {
      const page=await context.newPage(),errors=[];
      page.on('pageerror',()=>errors.push('Application exception'));
      await page.addInitScript(({locale,theme})=>{
        localStorage.setItem('lumiscore-locale',locale);localStorage.setItem('lumiscore-theme',theme);
        document.cookie='lumiscore-locale='+locale+'; Path=/; SameSite=Lax';
        window.layoutReview={cls:0};
        new PerformanceObserver(list=>{for(const entry of list.getEntries()) if(!entry.hadRecentInput) window.layoutReview.cls+=entry.value;}).observe({type:'layout-shift',buffered:true});
      },{locale,theme});
      let releaseDeck;
      const gate=new Promise(resolve=>{releaseDeck=resolve;});
      await page.route('**/api/bookmatch?*',async route=>{
        const response=await route.fetch();
        await gate;
        await route.fulfill({response});
      });
      await page.goto(origin.origin+'/bookmatch',{waitUntil:'domcontentloaded'});
      await page.getByRole('status').filter({hasText:locale==='nl'?'Beschikbare boeken laden':'Loading available books'}).waitFor();
      await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));window.layoutReview.cls=0;});
      const before=await page.locator('footer').boundingBox();
      releaseDeck();
      await page.locator('.bookmatch-card').waitFor();
      await page.waitForLoadState('networkidle');
      const after=await page.locator('footer').boundingBox();
      const measured=await page.evaluate(()=>({width:innerWidth,client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,locale:document.documentElement.lang,theme:document.querySelector('[data-theme]')?.getAttribute('data-theme'),cls:window.layoutReview.cls,buttons:[...document.querySelectorAll('.bookmatch button')].map(button=>button.getBoundingClientRect().height)}));
      results.push({width,locale,theme,measured,footerMovement:after.y-before.y,errors:errors.length});
      assert.equal(measured.width,width);assert.equal(measured.client,width);assert.equal(measured.scroll,width);
      assert.equal(measured.locale,locale);assert.equal(measured.theme,theme);
      assert.ok(measured.buttons.every(height=>height>=44),'Buttons remain usable');
      assert.equal(errors.length,0);
    } finally {await context.close();}
  }
  const report={scope:'Local actual-browser layout regression; real test catalog delayed until loading layout is measured; NOT hosted login or production evidence',browser:browser.version(),results};
  if(process.env.BOOKMATCH_LAYOUT_REPORT) await writeFile(process.env.BOOKMATCH_LAYOUT_REPORT,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
  assert.ok(results.every(result=>result.measured.cls<=0.1),'Loading must not cause a large layout shift (CLS > 0.1)');
} finally {await browser.close();}
