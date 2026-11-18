import assert from 'node:assert/strict';
import test from 'node:test';
import type {Book} from '../../app/data/books.ts';
import {getInitialPublicBookDescription,loadPublicBookDescriptionState} from './public-description.ts';
import {getBookMetadataDescription} from './book-detail.ts';
import {publicDescriptionSource} from './description-source.ts';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';

const cases=[
 {locale:'nl' as const,book:{id:'work-5591',workId:'5591',editionId:'5750',title:'De gelovige geest',editionTitle:'De gelovige geest',author:'Michiel van Elk',authorId:'3002',isbn13:'9789035137486',editionLanguage:'dut',editionAvailable:true,openLibraryWorkId:'OL23451793W',openLibraryEditionId:'OL31312394M',cover:'orbit',score:null,ratingsCount:null,match:null} as Book,marker:/religieuze ervaringen/,source:'https://www.bibliotheek.nl/catalogus/titel.340529512.html/de-gelovige-geest/'},
 {locale:'en' as const,book:{id:'work-1647',workId:'1647',editionId:'11733',title:'Sunken Red',editionTitle:'Sunken Red',author:'Jeroen Brouwers',authorId:'655',isbn13:'9781561310258',editionLanguage:'eng',editionAvailable:true,openLibraryWorkId:'OL15304955W',cover:'orbit',score:null,ratingsCount:null,match:null} as Book,marker:/mother/,source:'https://www.letterenfonds.nl/en/books/sunken-red'}
];
for(const {book,locale,marker,source} of cases){
 test(`${book.workId}: initial synopsis and metadata are present without a provider or snapshot request`,async()=>{
 const description=getInitialPublicBookDescription(book,locale);assert.ok(description);assert.match(description.text,marker);assert.equal(description.language,locale);assert.equal(publicDescriptionSource(description)?.href,source);
 assert.notEqual(getBookMetadataDescription(book,locale,description),getBookMetadataDescription(book,locale));
 let requests=0,reads=0;
 const provider:typeof fetch=async()=>{requests++;throw Error('Simulated provider outage');};
 const snapshot={loadDescriptionSnapshot:async()=>{reads++;throw Error('Simulated snapshot outage');},saveDescriptionSnapshot:async()=>{throw Error('No writes');},markDescriptionSnapshotFailure:async()=>{throw Error('No writes');}};
 assert.deepEqual(await loadPublicBookDescriptionState(book,locale,provider,snapshot),{state:'resolved',description});assert.equal(requests,0);assert.equal(reads,0);
 });
 test(`${book.workId}: wrong edition identity or locale never reuses the synopsis`,()=>{
 for(const patch of [{workId:'999999'},{editionTitle:'Other title'},{author:'Other author'},{isbn13:'9780141439518'},{editionLanguage:locale==='nl'?'eng':'nld'},{editionAvailable:false}])assert.equal(getInitialPublicBookDescription({...book,...patch},locale),null);
 assert.equal(getInitialPublicBookDescription(book,locale==='nl'?'en':'nl'),null);
 });
}
test('both summaries and their sources render in initial guest HTML without loading/error placeholders',async()=>{
 const root=fileURLToPath(new URL('../../',import.meta.url));
 const vite=await createServer({root,configFile:false,envFile:false,cacheDir:root+'.verification/gsc-priority',plugins:[react()],css:{postcss:{plugins:[]}},resolve:{alias:{'@':root},dedupe:['react','react-dom']},server:{middlewareMode:true,hmr:false,ws:false}});
 try{
 const {LumiScoreBookDescription:Description}=await vite.ssrLoadModule('/app/components/LumiScoreBookDescription.tsx');
 const {LumiScoreLocaleProvider:Provider}=await vite.ssrLoadModule('/app/components/LumiScoreLocale.tsx');
 for(const {book,locale,marker,source} of cases){const description=getInitialPublicBookDescription(book,locale);assert.ok(description);
 const html=renderToStaticMarkup(createElement(Provider,{initialLocale:locale,hasPersistedChoice:true,initialPath:'/book/'+book.workId},createElement(Description,{description})));
 assert.match(html,marker);assert.ok(html.includes('href="'+source+'"'));assert.match(html,/description-source/);assert.doesNotMatch(html,/Loading the description|beschrijving wordt geladen|could not load|kon tijdelijk niet/);
 }
 }finally{await vite.close();}
});
