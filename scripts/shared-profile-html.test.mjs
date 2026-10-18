import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {buildRatingResultProfile} from '../lib/taste-test/rating-result.ts';
import {buildEffectiveWorkTraitVector,evidenceRowsForTraits} from '../lib/recommendations/work-trait-evidence.ts';

test('real shared summary React HTML: keep supported preferences, remove empty panels and sparse copy, NL/EN',async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const vite=await createServer({root,configFile:false,envFile:false,cacheDir:root+'.wrangler/node_modules/shared-profile-html-vite',plugins:[react()],css:{postcss:{plugins:[]}},resolve:{alias:{'@':root,'next/image':root+'node_modules/vinext/dist/shims/image.js'},dedupe:['react','react-dom']},server:{middlewareMode:true,hmr:false}});
 try{
  const {TasteProfileSummary}=await vite.ssrLoadModule('/app/components/TasteProfileSummary.tsx');
  const {LumiScoreLocaleProvider}=await vite.ssrLoadModule('/app/components/LumiScoreLocale.tsx');
  const {TasteResultContent}=await vite.ssrLoadModule('/app/components/TasteRatingResult.tsx');
  const rows=Array.from({length:10},(_,i)=>({workId:String(i+1),rating:10}));
  const evidence=traits=>new Map(rows.map(r=>[r.workId,buildEffectiveWorkTraitVector(evidenceRowsForTraits({workId:r.workId,traits,confidence:1,source:'manual',sourceKey:'synthetic',rawLabels:[],verifiedAt:'2026-10-15'}))]));
  for(const locale of ['nl','en'])for(const level of [1,2]){
   const render=profile=>renderToStaticMarkup(createElement(LumiScoreLocaleProvider,{initialLocale:locale,hasPersistedChoice:true,initialPath:level===1?'/taste-test/result':'/account'},createElement(TasteProfileSummary,{profile,headingId:'profile-proof',level})));
   const rich=render(buildRatingResultProfile(rows,evidence({thriller_mystery:1,dark:.8,fast_paced:.7})));assert.match(rich,locale==='nl'?/speurneus/:/sleuth/);assert.equal((rich.match(/<li>/g)??[]).length,3);assert.match(rich,new RegExp(`<h${level}`));
   for(const traits of [new Map(),evidence({classic:1})]){
    const profile=buildRatingResultProfile(rows,traits),before=JSON.stringify(profile);
    assert.equal(render(profile),'');assert.equal(JSON.stringify(profile),before);
   }
   const limitedEvidence=new Map([...evidence({thriller_mystery:1,dark:.8,fast_paced:.7})].slice(0,3));
   const supported=buildRatingResultProfile(rows,limitedEvidence);assert.equal(supported.archetype,null);
   const partial=render(supported);assert.match(partial,locale==='nl'?/Jouw leessmaak/:/Your reading taste/);assert.equal((partial.match(/<li>/g)??[]).length,3);
   assert.doesNotMatch(partial,/Nog even ontdekken|Keep discovering|inhoudelijke kenmerken|usable content traits|<p>|speurneus|sleuth/);
   // Percent signs exist only in decorative bar widths, never in visible text.
   assert.doesNotMatch(rich.replace(/style="[^"]*"/g,''),/%|10 books|10 boeken|nauwkeurigheid|accuracy/);
   if(level===1){
    const profile=buildRatingResultProfile(rows,new Map());
    const recommendations=[31,32].map(id=>({book:{id:String(id),workId:String(id),source:'demo',title:'Synthetic retained book '+id,author:'Synthetic author',score:null,ratingsCount:null,match:null,cover:'orbit',coverUrls:[]},matchScore:null,matchLabel:null,matchConfidence:'low',explanation:'',coverageLevel:'none',metadataConfidence:0,collaborativeExplanation:''}));
    const result={kind:'result',profile,recommendations,roundRatedCount:10,language:locale,partial:false,exhausted:false},before=JSON.stringify(result);
    const html=renderToStaticMarkup(createElement(LumiScoreLocaleProvider,{initialLocale:locale,hasPersistedChoice:true,initialPath:'/taste-test/result'},createElement(TasteResultContent,{result})));
    assert.match(html,locale==='nl'?/<h1 id="taste-result-title">Meer boeken voor jou<\/h1>/:/<h1 id="taste-result-title">More books for you<\/h1>/);
    for(const id of [31,32])assert.match(html,new RegExp('Synthetic retained book '+id));
    assert.doesNotMatch(html,/Nog even ontdekken|Keep discovering|missen nog inhoudelijke kenmerken|lack usable content traits|class="taste-profile"|Strong match|Sterke match/);
    assert.equal(JSON.stringify(result),before);
   }
  }
 }finally{await vite.close();}
});
