import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {buildRatingResultProfile} from '../lib/taste-test/rating-result.ts';
import {buildEffectiveWorkTraitVector,evidenceRowsForTraits} from '../lib/recommendations/work-trait-evidence.ts';

test('real shared summary React HTML: same supported preferences, honest sparse copy, no percentages or invented type, NL/EN',async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const vite=await createServer({root,configFile:false,envFile:false,cacheDir:root+'.wrangler/node_modules/shared-profile-html-vite',plugins:[react()],css:{postcss:{plugins:[]}},resolve:{alias:{'@':root},dedupe:['react','react-dom']},server:{middlewareMode:true,hmr:false}});
 try{
  const {TasteProfileSummary}=await vite.ssrLoadModule('/app/components/TasteProfileSummary.tsx');
  const {LumiScoreLocaleProvider}=await vite.ssrLoadModule('/app/components/LumiScoreLocale.tsx');
  const rows=Array.from({length:10},(_,i)=>({workId:String(i+1),rating:10}));
  const evidence=traits=>new Map(rows.map(r=>[r.workId,buildEffectiveWorkTraitVector(evidenceRowsForTraits({workId:r.workId,traits,confidence:1,source:'manual',sourceKey:'synthetic',rawLabels:[],verifiedAt:'2026-10-15'}))]));
  for(const locale of ['nl','en'])for(const level of [1,2]){
   const render=profile=>renderToStaticMarkup(createElement(LumiScoreLocaleProvider,{initialLocale:locale,hasPersistedChoice:true,initialPath:level===1?'/taste-test/result':'/account'},createElement(TasteProfileSummary,{profile,headingId:'profile-proof',level})));
   const rich=render(buildRatingResultProfile(rows,evidence({thriller_mystery:1,dark:.8,fast_paced:.7})));assert.match(rich,locale==='nl'?/speurneus/:/sleuth/);assert.equal((rich.match(/<li>/g)??[]).length,3);assert.match(rich,new RegExp(`<h${level}`));
   for(const traits of [new Map(),evidence({classic:1})]){
    const sparse=render(buildRatingResultProfile(rows,traits));assert.match(sparse,locale==='nl'?/missen nog inhoudelijke kenmerken/:/lack usable content traits/);assert.doesNotMatch(sparse,/<li>|speurneus|sleuth/);
   }
   // Percent signs exist only in decorative bar widths, never in visible text.
   assert.doesNotMatch(rich.replace(/style="[^"]*"/g,''),/%|10 books|10 boeken|nauwkeurigheid|accuracy/);
  }
 }finally{await vite.close();}
});
