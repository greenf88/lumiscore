import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {buildTasteProfile} from '../lib/taste-test/profile.ts';
import {tasteVector} from '../lib/taste-test/traits.ts';
import {buildEffectiveWorkTraitVector,evidenceRowsForTraits,reliableProfileTraits} from '../lib/recommendations/work-trait-evidence.ts';

test('optimized guest and signed-in ranking exactly match the released implementation',async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const paths=['lib/recommendations/engine.ts','lib/taste-test/rating-result.ts'];
 const baseline=new Map(paths.map(path=>[root.replaceAll('\\','/')+path.replace('.ts','-speed-baseline.ts'),execFileSync('git',['show','cfb399ef422bdc2e969ddcd318bdaf71b677b432:'+path],{cwd:root,encoding:'utf8'})]));
 const vite=await createServer({root,configFile:false,envFile:false,cacheDir:root+'.wrangler/node_modules/taste-equivalence',resolve:{alias:{'@':root}},plugins:[{name:'released-ranking-oracle',enforce:'pre',resolveId(id){const path=id.startsWith('/lib/')?root.replaceAll('\\','/')+id.slice(1):id.replaceAll('\\','/');if(baseline.has(path))return path;},load(id){return baseline.get(id.replaceAll('\\','/'))??null;}}],server:{middlewareMode:true,hmr:false}});
 try{
  const current=await vite.ssrLoadModule('/lib/recommendations/engine.ts'),old=await vite.ssrLoadModule('/lib/recommendations/engine-speed-baseline.ts');
  const result=await vite.ssrLoadModule('/lib/taste-test/rating-result.ts'),oldResult=await vite.ssrLoadModule('/lib/taste-test/rating-result-speed-baseline.ts');
  const combinations=[{fantasy:1,worldbuilding:.8},{science_fiction:1,idea_driven:.7},{thriller_mystery:1,dark:.9},{literary:1,character_driven:.8},{romance:1,uplifting:.6},{classic:1}];
  const evidence=new Map(Array.from({length:150},(_,i)=>{const id=String(5001+i);return [id,buildEffectiveWorkTraitVector(evidenceRowsForTraits({workId:id,traits:combinations[i%6],confidence:1,source:'manual',sourceKey:'synthetic-equivalence',rawLabels:[],verifiedAt:'2026-11-17'}))];}));
  const candidates=[...evidence].map(([id,e],i)=>({book:{id:'work-'+id,workId:id,source:'supabase',title:'Synthetic '+i,author:i%7===0?'SAME author':'Author '+i%9,editionLanguage:i%2?'nld':'eng',firstPublishYear:1980+i%40,score:i%3?6+i%5:null,ratingsCount:i%7,match:null,cover:'orbit'},traits:reliableProfileTraits(e),coverageLevel:e.coverageLevel,metadataConfidence:e.metadataConfidence,seriesKey:i%3===0?'series-'+i%4:undefined}));
  candidates.push(candidates[0]);
  for(const locale of ['nl','en'])for(const mode of ['positive','negative','mixed']){
   const profile=buildTasteProfile({},Array.from({length:10},(_,i)=>({workId:String(i+1),rating:mode==='negative'?2:mode==='mixed'&&i%2?3:9,traits:tasteVector(combinations[i%6])})),locale);
   const input={profile,candidates,ratedWorkIds:new Set(['5001','5002']),excludedWorkIds:new Set(['5003']),locale,limit:25,languagePreference:locale==='nl'?{language:'dutch',source:'locale',strength:.8}:null,readingPeriods:['2015_present'],collaborativeSignals:new Map([['5017',{score:.8,weight:.1}]])};
   const before=JSON.stringify({profile,candidates});
   assert.deepEqual(current.recommendBooks(input),old.recommendBooks(input),locale+' '+mode+' guest/shared engine');
   const resultInput={profile,candidates,evidence,locale,excludedIds:new Set(['5001','5002','5003']),availableIds:new Set(evidence.keys())};
   assert.deepEqual(result.recommendRatingResult(resultInput),oldResult.recommendRatingResult(resultInput),locale+' '+mode+' signed-in');
   assert.equal(JSON.stringify({profile,candidates}),before);
  }
 }finally{await vite.close();}
});
