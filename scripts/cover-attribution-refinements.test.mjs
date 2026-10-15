import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
test('shared badge scales 25 percent without resizing rating controls; primary more action has spacing',async()=>{
 const css=await readFile(root+'app/globals.css','utf8');
 assert.match(css,/width: clamp\(26\.25px, 33\.75cqw, 77\.5px\)/);
 assert.match(css,/border: clamp\(1\.25px, 1cqw, 2\.5px\)/);
 assert.match(css,/font-size: clamp\(10px, 10\.625cqw, 28\.75px\)/);
 assert.match(css,/font-size: clamp\(3\.75px, 3\.375cqw, 8\.75px\)/);
 assert.match(css,/\.recommendation-panel \.view-all\.ui-primary \{\s+margin: 20px/);
 const home=await readFile(root+'app/components/LumiScoreHome.tsx','utf8');
 assert.match(home,/className="view-all ui-control ui-primary" href="\/recommendations"/);
});
test('description renders exact provider attribution in both locales, never mislabels Google or missing text',async()=>{
 const vite=await createServer({root,configFile:false,envFile:false,cacheDir:root+'.wrangler/node_modules/attribution-tests',plugins:[react()],css:{postcss:{plugins:[]}},resolve:{alias:{'@':root},dedupe:['react','react-dom']},server:{middlewareMode:true,hmr:false}});
 try{
  const {LumiScoreBookDescription:Description}=await vite.ssrLoadModule('/app/components/LumiScoreBookDescription.tsx');
  const {LumiScoreLocaleProvider:Provider}=await vite.ssrLoadModule('/app/components/LumiScoreLocale.tsx');
  const render=(locale,description)=>renderToStaticMarkup(h(Provider,{initialLocale:locale,hasPersistedChoice:true,initialPath:'/book/1'},h(Description,{description})));
  for(const language of ['nl','en']){
   const d={text:'Local synthetic description.',source:'open_library',sourceKey:'OL893415W',language,verifiedAt:'2026-10-15'};
   const html=render(language,d);
   assert.match(html,/href="https:\/\/openlibrary.org\/works\/OL893415W"/);
   assert.match(html,new RegExp(language==='nl'?'Bron(?:<!-- -->)?:':'Source(?:<!-- -->)?:'));
   const google=render(language,{...d,source:'google_books',sourceKey:'9780441172719'});
   assert.match(google,/Google Books/);assert.doesNotMatch(google,/Open Library/);
   assert.doesNotMatch(render(language,null),/description-source/);
   assert.doesNotMatch(render(language,{...d,sourceKey:'https://private.invalid'}),/description-source/);
  }
 }finally{await vite.close();}
});
