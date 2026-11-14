import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

test('book discovery renders bounded, localized canonical anchors and omits empty or unknown relationships',async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url));
  const vite=await createServer({root,configFile:false,envFile:false,
    cacheDir:root+'.wrangler/node_modules/book-discovery-html',plugins:[react()],
    css:{postcss:{plugins:[]}},resolve:{alias:{'@':root},dedupe:['react','react-dom']},
    server:{middlewareMode:true,hmr:false},
  });
  try {
    const {LumiScoreLocaleProvider:Provider}=await vite.ssrLoadModule('/app/components/LumiScoreLocale.tsx');
    const {BookEditorialGuide}=await vite.ssrLoadModule('/app/components/EditorialLandingGuide.tsx');
    const {BookAuthorLinks}=await vite.ssrLoadModule('/app/components/BookAuthorLinks.tsx');
    const book={id:'work-987654',workId:'987654',title:'Project Hail Mary',author:'Andy Weir',openLibraryWorkId:'OL21745884W',editionAvailable:true};
    for(const locale of ['nl','en']){
      const render=node=>renderToStaticMarkup(h(Provider,{initialLocale:locale,hasPersistedChoice:true,initialPath:'/book/987654'},node));
      const html=render(h(BookEditorialGuide,{book,locale,hasSuzanneCollectionLink:false}));
      const hrefs=[...html.matchAll(/href="([^"]+)"/g)].map(m=>m[1]);
      assert.ok(hrefs.length>0&&hrefs.length<=3);
      assert.equal(new Set(hrefs).size,hrefs.length);
      assert.ok(hrefs.every(href=>href.startsWith('/'+locale+'/toplijsten/')&&!href.includes('?')));
      assert.ok(hrefs.includes('/'+locale+'/toplijsten/na-project-hail-mary'));
      assert.ok(html.includes(locale==='nl'?'Een volgende leesrichting':'Explore these reading lists'));
      if(locale==='en')assert.doesNotMatch(html,/Verder lezen|Leesroutes bij dit boek/);
      assert.equal(render(h(BookEditorialGuide,{book:{...book,openLibraryWorkId:'OL999999999W'},locale,hasSuzanneCollectionLink:false})), '');
      assert.equal(render(h(BookEditorialGuide,{book:{...book,editionAvailable:false},locale,hasSuzanneCollectionLink:false})), '');
      const authorHtml=render(h(BookAuthorLinks,{author:'A & B',links:[{workId:'20',title:'A < B',author:'A & B'}]}));
      assert.match(authorHtml,new RegExp('href="/'+locale+'/book/20"'));
      assert.ok(authorHtml.includes(locale==='nl'?'Meer van A &amp; B':'More by A &amp; B'));
      assert.ok(authorHtml.includes('A &lt; B'));
      assert.match(authorHtml,locale==='nl'?/van A &amp; B<\/li>/:/by A &amp; B<\/li>/);
      assert.doesNotMatch(authorHtml,/returnTo|similar|vergelijkbaar|onclick/i);
      assert.equal(render(h(BookAuthorLinks,{author:'A & B',links:[]})), '');
    }
  }finally{await vite.close();}
});
