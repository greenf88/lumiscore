import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';

test('source HTML exposes three home entries, differentiated choices and honest guest/account continuation',async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const vite=await createServer({root,configFile:false,envFile:false,cacheDir:root+'.wrangler/node_modules/priority-reading',plugins:[react()],css:{postcss:{plugins:[]}},resolve:{alias:{'@':root,'next/image':root+'node_modules/vinext/dist/shims/image.js'},dedupe:['react','react-dom']},server:{middlewareMode:true,hmr:false}});
 try{
  const {LumiScoreLocaleProvider:Provider}=await vite.ssrLoadModule('/app/components/LumiScoreLocale.tsx');
  const {PriorityReadingRoutes}=await vite.ssrLoadModule('/app/components/PriorityReadingRoutes.tsx');
  const {EditorialTopList}=await vite.ssrLoadModule('/app/components/EditorialTopList.tsx');
  const {EditorialResponsibility,GuideNextStep}=await vite.ssrLoadModule('/app/components/EditorialLandingGuide.tsx');
  const {getEditorialTopList,getEditorialTopBook,getEditorialWorkSourceId,localizeEditorialList}=await vite.ssrLoadModule('/lib/catalog/top-lists.ts');
  const {getLandingGuide}=await vite.ssrLoadModule('/lib/editorial/landing-guides.ts');
  const {PRIORITY_DESTINATIONS}=await vite.ssrLoadModule('/lib/editorial/priority-destinations.ts');
  const render=(element,locale='nl',path='/')=>renderToStaticMarkup(h(Provider,{initialLocale:locale,hasPersistedChoice:true,initialPath:path},element));
  const home=render(h(PriorityReadingRoutes));
  for(const item of PRIORITY_DESTINATIONS)assert.ok(home.includes('href="/nl'+item.path+'"'));
  assert.equal((home.match(/<h2/g)??[]).length,1);assert.doesNotMatch(home,/<h1|<button|<img|persoonlijk advies/);
  for(const item of PRIORITY_DESTINATIONS.slice(1)){
   const list=localizeEditorialList(getEditorialTopList(item.id),'nl'),guide=getLandingGuide(item.path,'nl');
   const books=list.workIds.map((id,i)=>({id:'synthetic-'+id,workId:String(800000+i),source:'supabase',openLibraryWorkId:getEditorialWorkSourceId(id),editionAvailable:true,editionLanguage:'nld',title:'Synthetic NL '+id,author:getEditorialTopBook(id).author,cover:'orbit',coverUrls:[],score:null,ratingsCount:null,match:null}));
   const selections=Object.fromEntries(list.workIds.map((id,i)=>[id,{...getEditorialTopBook(id),sourceId:getEditorialWorkSourceId(id),href:'/book/'+books[i].workId}]));
   const html=render(h(EditorialTopList,{list,books,selections,relatedLists:[],authenticated:false}),'nl',item.path);
   assert.equal((html.match(/<h1/g)??[]).length,1);assert.ok(html.includes('data-reading-destination="'+item.id+'"'));
   assert.equal((html.match(/class="guide-choice"/g)??[]).length,10);
   assert.match(html,/Als gast bewaar je je keuze in deze browser/);assert.match(html,/href="\/nl\/taste-test\/preferences"/);
   assert.ok(html.includes('next='+encodeURIComponent('/nl'+item.path)));
   for(const card of guide.cards)assert.ok(html.includes(card.choice.replaceAll('&','&amp;')));
   assert.match(html,/LumiScore-redactie/);assert.match(html,/<time dateTime="2026-11-25"|<time datetime="2026-11-25"/);
   const failure=render(h(EditorialTopList,{list,books:[],selections,relatedLists:[],unavailable:true}),'nl',item.path);assert.doesNotMatch(failure,/data-reading-destination=/);
   const en=render(h(EditorialTopList,{list:getEditorialTopList(item.id),books:[],selections,relatedLists:[]}), 'en',item.path);assert.doesNotMatch(en,/data-reading-destination=|class="guide-choice"|25 november/);
  }
  const suzanne=getLandingGuide('/collection/suzanne-vermeer','nl');
  assert.match(render(h(EditorialResponsibility,{guide:suzanne})),/Selectie en keuzehulp: LumiScore-redactie/);
  const account=render(h(GuideNextStep,{authenticated:true,returnTo:'/nl/collection/suzanne-vermeer'}));
  assert.match(account,/href="\/nl\/taste-test"/);assert.doesNotMatch(account,/Als gast|next=/);
 }finally{await vite.close();}
});
