// Explicit loopback-only review: actual search route/loader with fake PUBLIC DB transport.
import {createServer} from 'vite';
import vinext from 'vinext';
import tailwindcss from '@tailwindcss/postcss';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),port=3136;
for(const key of Object.keys(process.env))if(/SUPABASE|DATABASE|SECRET|TOKEN|GOOGLE_BOOKS/.test(key))delete process.env[key];
const file=p=>JSON.stringify(root.replaceAll('\\','/')+p);
const modules={
 'lib/supabase/client.ts':`export {supabase} from ${file('test-support/search/backend.ts')};`,
 'lib/supabase/auth.ts':'export async function loadHeaderAuthState(){return {authenticated:false}};export async function getVerifiedServerUser(){return {client:null,user:null}}',
 'lib/supabase/books.ts':`export {mapCatalogWorks} from ${file('lib/supabase/books.ts?identity-review')};export {loadCatalogBook} from ${file('test-support/search/backend.ts')};export {books,loadCatalogBooksByIds,loadCatalogBooksByIdsWithStoredCovers,loadHighestRatedCatalog} from ${file('test-support/browse/fixture.ts')};`,
 'lib/books/edition-cover-evidence.ts':`export const deferEditionCoverEvidence=books=>books.map(b=>({...b,coverUrls:['/search-review-cover.svg']})); export const withEditionCoverEvidence=async books=>deferEditionCoverEvidence(books);`,
 'lib/supabase/ratings.ts':'export async function loadBookRatingState(){return {authenticated:false,userEmail:null,userRating:null,lumiscore:null,ratingCount:null}}',
 'lib/supabase/book-status.ts':'export async function loadUserBookStatuses(){return {authenticated:false,statuses:new Map()}}',
 'lib/supabase/taste-test.ts':'export async function loadBookDetailPersonalization(){return {authenticated:false,hasEvidence:false,candidate:null,match:null}}',
 'lib/supabase/collections.ts':'export async function loadBookCollectionContext(){return null};export async function loadVerifiedBookCollectionReturnTarget(){return null}',
 'lib/books/public-description.ts':'export async function loadPublicBookDescription(){return null}',
 'app/page.tsx':`'use client';import {useState}from'react';import{Header,BookCard}from'./components/LumiScoreHome';export default function ReviewHome(){const[q,set]=useState('');return <main className="site-shell"><Header query={q} onQueryChange={set} onThemeToggle={()=>{}} authState={{authenticated:false}} returnTo="/"/><section className="browse-page"><h1>LumiScore — local search review</h1><p>Use the real header search and press Enter.</p><BookCard book={{id:'review-choice',workId:'991006',title:'Dune',author:'Frank Herbert',score:null,ratingsCount:null,match:null,cover:'orbit'}} wanted={false} onToggle={()=>{}} resolveMissingCover={false}/></section></main>}`,
};
const server=await createServer({root,configFile:false,envFile:false,cacheDir:root+'.wrangler/node_modules/mobile-search-review',
 css:{postcss:{plugins:[tailwindcss()]}},resolve:{alias:{'@':root}},
 plugins:[{name:'loopback-search-transport',enforce:'pre',load(id){
   if(id.includes('?identity-review'))return null;
   const relative=id.replaceAll('\\','/').replace(root.replaceAll('\\','/'),'').split('?')[0];return modules[relative]??null;
 },configureServer(vite){vite.middlewares.use(async(req,res,next)=>{
   const url=new URL(req.url,'http://127.0.0.1:'+port);
   if(url.pathname==='/search-review-cover.svg'){res.writeHead(200,{'Content-Type':'image/svg+xml'});return res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><rect width="200" height="300" fill="#12313a"/><circle cx="100" cy="150" r="62" fill="#ca8d30"/><text x="30" y="55" fill="white" font-size="25">BOOK</text></svg>');}
   next();
 });}},vinext()],server:{host:'127.0.0.1',port,strictPort:true}});
await server.listen();console.log('LOCAL SEARCH REVIEW http://127.0.0.1:'+port+'/nl/search?q=Dune — synthetic PUBLIC transport, no database/Auth access');
for(const s of ['SIGINT','SIGTERM'])process.on(s,async()=>{await server.close();process.exit(0)});
