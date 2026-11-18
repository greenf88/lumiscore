import assert from 'node:assert/strict';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {bookUrlPolicy} from '../seo/book-locales.ts';

test('unavailable editions offer only a verified other language, without changing indexing or nesting links in cards',async()=>{
  const root=fileURLToPath(new URL('../../',import.meta.url));
  const vite=await createServer({root,configFile:false,envFile:false,cacheDir:root+'.verification/edition-navigation',plugins:[react()],css:{postcss:{plugins:[]}},resolve:{alias:{'@':root},dedupe:['react','react-dom']},server:{middlewareMode:true,hmr:false,ws:false}});
  try{
    const {EditionPresentationLabel}=await vite.ssrLoadModule('/app/components/EditionPresentationLabel.tsx');
    const {LumiScoreLocaleProvider}=await vite.ssrLoadModule('/app/components/LumiScoreLocale.tsx');
    for(const locale of ['en','nl'] as const){
      const other=locale==='en'?'nl':'en';
      const render=(patch={},showAlternatives=true)=>renderToStaticMarkup(createElement(LumiScoreLocaleProvider,{initialLocale:locale,initialPath:'/book/5591',hasPersistedChoice:true},createElement(EditionPresentationLabel,{book:{workId:'5591',editionAvailable:false,detailLocales:[other],...patch},showAlternatives})));
      assert.match(render(),new RegExp(`href="/${other}/book/5591"`));
      assert.match(render(),locale==='en'?/Read about the Dutch edition/:/Bekijk de Engelse editie/);
      for(const patch of [{detailLocales:[]},{detailLocales:undefined},{detailLocales:[locale]},{workId:'../other'},{editionAvailable:true}])assert.doesNotMatch(render(patch),/<a\b/);
      assert.doesNotMatch(render({},false),/<a\b/);
      const policy=bookUrlPolicy([other],locale);
      assert.equal(policy.robots,'noindex, follow');assert.equal(policy.inSitemap,false);assert.equal(policy.includeCanonical,false);
    }
  }finally{await vite.close();}
});
