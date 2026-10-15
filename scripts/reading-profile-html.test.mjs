import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {buildRatingResultProfile} from '../lib/taste-test/rating-result.ts';
test('real React account HTML: owner-only props, empty/error evidence, NL/EN and existing destinations',async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const vite=await createServer({root,configFile:false,envFile:false,cacheDir:root+'.wrangler/node_modules/profile-html-vite',plugins:[react()],css:{postcss:{plugins:[]}},resolve:{alias:{'@':root,'next/image':root+'node_modules/vinext/dist/shims/image.js'},dedupe:['react','react-dom']},server:{middlewareMode:true,hmr:false}});
 try{
  const {LumiScoreReadingProfile}=await vite.ssrLoadModule('/app/components/LumiScoreReadingProfile.tsx');
  const {LumiScoreLocaleProvider}=await vite.ssrLoadModule('/app/components/LumiScoreLocale.tsx');
  const data={totals:{read:1209,rated:1205,wantToRead:8,reading:5},profile:buildRatingResultProfile([],new Map())};
  for(const locale of ['nl','en']){
   const render=data=>renderToStaticMarkup(createElement(LumiScoreLocaleProvider,{initialLocale:locale,hasPersistedChoice:true,initialPath:'/account'},createElement(LumiScoreReadingProfile,{authState:{authenticated:true,displayName:'Synthetic Reader',avatarLetter:'S'},email:'synthetic@example.invalid',data})));
   const html=render(data);assert.match(html,/synthetic@example.invalid/);assert.match(html,/Synthetic Reader/);
   assert.match(html,new RegExp(`href="/${locale}/my-books"`));assert.match(html,new RegExp(`href="/${locale}/taste-test"`));
   assert.match(html,/action="\/auth\/sign-out" method="post"/);assert.match(html,locale==='nl'?/Mijn leesprofiel/:/My reading profile/);
   assert.equal((html.match(/<dt>/g)??[]).length,4);assert.doesNotMatch(html,/Luminator|personality|Mijn reeksen/);
   assert.match(html,locale==='nl'?/Nog even ontdekken/:/Keep discovering/);
   const empty=render({...data,totals:{read:0,rated:0,wantToRead:0,reading:0}});assert.match(empty,locale==='nl'?/Ontdek je leessmaak/:/Discover your reading taste/);
   const failed=render(null);assert.match(failed,/role="alert"/);assert.doesNotMatch(failed,/<dd>0<\/dd>/);
  }
 }finally{await vite.close();}
});
