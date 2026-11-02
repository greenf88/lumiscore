// Real browser regression, invoked with the documented CUA Tab API.
// No raw requests, browser internals, credentials or changes to page styles.
export async function checkMobilePlaceholderOverflow(tab,baseUrl,expectedWidth){
 await tab.goto(baseUrl+'/nl/search?q=Het&pageSize=16&sort=relevance');
 await tab.playwright.domSnapshot();
 const result=await tab.playwright.evaluate(()=>({
  viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,
  cards:[...document.querySelectorAll('article')].map(a=>({
   title:a.querySelector('h3')?.textContent,
   placeholder:a.querySelector('.cover-title')?.textContent,
   images:[...a.querySelectorAll('img')].map(i=>({complete:i.complete,width:i.naturalWidth})),
  })),
 }));
 if(result.viewport!==expectedWidth)throw Error('Viewport override was not applied');
 if(result.cards.length!==16)throw Error('Expected the normal16-card catalogue page');
 if(!result.cards.some(c=>c.placeholder?.includes('drielichamenprobleem')))throw Error('Long placeholder regression fixture not present');
 if(result.documentWidth>result.viewport)throw Error('Hidden cover placeholder overflows viewport: '+result.documentWidth+'>'+result.viewport);
 return result;
}
