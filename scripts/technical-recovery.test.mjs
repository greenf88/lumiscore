import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {createElement as h} from 'react';
import {renderToPipeableStream,renderToStaticMarkup} from 'react-dom/server';
import {PassThrough} from 'node:stream';
import {fileURLToPath} from 'node:url';
import {getReviewedDescription} from '../lib/books/reviewed-descriptions.ts';
const root=fileURLToPath(new URL('../',import.meta.url));

test('Souvenir synopsis is exact-edition Dutch copy, no accidental English or other ISBN reuse',()=>{
 const exact={editionTitle:'Souvenir',author:'Suzanne Vermeer',isbn13:'9789044978834',editionLanguage:'nld'};
 assert.match(getReviewedDescription(exact,'nl').text,/Carolien/);
 for(const other of [{isbn13:'9789046173404'},{editionLanguage:'eng'},{editionTitle:'Other'},{author:'Other'}])assert.equal(getReviewedDescription({...exact,...other},'nl'),null);
 assert.equal(getReviewedDescription(exact,'en'),null);
});

test('optional synopsis streams after usable HTML; failure, missing and loading have distinct accessible copy',async()=>{
 const vite=await createServer({root,configFile:false,envFile:false,cacheDir:root+'.wrangler/node_modules/recovery-tests',plugins:[react()],css:{postcss:{plugins:[]}},resolve:{alias:{'@':root},dedupe:['react','react-dom']},server:{middlewareMode:true,hmr:false}});
 try{
  const {StreamedBookDescription:Streamed,LumiScoreBookDescription:Description}=await vite.ssrLoadModule('/app/components/LumiScoreBookDescription.tsx');
  const {LumiScoreLocaleProvider:Provider}=await vite.ssrLoadModule('/app/components/LumiScoreLocale.tsx');
  for(const locale of ['nl','en']){
   const render=state=>renderToStaticMarkup(h(Provider,{initialLocale:locale,hasPersistedChoice:true,initialPath:'/book/1'},h(Description,{description:null,state})));
   assert.notEqual(render('temporary_failure'),render('confirmed_missing'));assert.match(render('temporary_failure'),/role="status"/);
   let resolve;const resolution=new Promise(r=>{resolve=r}), chunks=[];
   const output=new PassThrough();output.on('data',c=>chunks.push(c.toString()));
   const ended=new Promise((done,reject)=>{output.on('end',done);output.on('error',reject)});
   let shell;const shellReady=new Promise(r=>{shell=r});
   const stream=renderToPipeableStream(h(Provider,{initialLocale:locale,hasPersistedChoice:true,initialPath:'/book/1'},h('main',null,h('h1',null,'Known Work'),h('a',{href:'/browse'},'Back'),h(Streamed,{resolution}))),{
    onShellReady(){stream.pipe(output);shell()},onError(error){throw error},
   });
   await shellReady;assert.match(chunks.join(''),/Known Work/);assert.match(chunks.join(''),/href="\/browse"/);assert.doesNotMatch(chunks.join(''),/Reviewed synopsis/);
   resolve({state:'resolved',description:{text:'Reviewed synopsis.',source:'open_library',sourceKey:'OL1M',language:locale,verifiedAt:'2026-10-21'}});
   await ended;assert.match(chunks.join(''),/Reviewed synopsis/,'complete original response contains real description');
  }
 }finally{await vite.close()}
});

test('loaded cover paint has no hydration gate; detail title does not await optional cover/description',async()=>{
 const css=await readFile(root+'app/globals.css','utf8'),home=await readFile(root+'app/components/LumiScoreHome.tsx','utf8'),page=await readFile(root+'app/book/[workId]/page.tsx','utf8');
 assert.doesNotMatch(css.match(/\.book-cover-image\s*\{[^}]*\}/)[0],/opacity:\s*0/);
 assert.doesNotMatch(home,/coverLoaded|setCoverLoaded/);
 assert.match(home,/loading=\{presentation==='detail'\?'eager':'lazy'\}/);
 assert.match(page,/loadCatalogBook\(workId, locale, true\)/);
 assert.match(page,/descriptionPromise=\{descriptionPromise\}/);
 assert.doesNotMatch(page,/await descriptionPromise/);
 assert.match(page,/book\.coverUrls\?\.\[0\] \?\? \(await book\.editionCoverUrls\)\?\.\[0\]/,'late verified cover is retained in social metadata using the shared promise');
});
