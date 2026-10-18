// Loopback-only source capture. Actual router, SSR, edition selection,
// description resolver, cover/badge and collection UI; no DB/Auth connection.
import { createServer } from 'vite';
import vinext from 'vinext';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url)).replaceAll('\\', '/');
for (const key of Object.keys(process.env)) if (/SUPABASE|GOOGLE_BOOKS|DATABASE/.test(key)) delete process.env[key];
const bookSource = `import {selectStrictEdition,withStrictEdition,unavailableEdition} from '${root}lib/books/strict-edition.ts';
const original={id:'work-1305',workId:'1305',source:'supabase',sourceType:'lumiscore_native',title:'Madonna',author:'Suzanne Vermeer',firstPublishYear:2013,score:null,ratingsCount:null,match:null,cover:'orbit'};
const edition={id:1305,work_id:1305,title:'Madonna',language:'nld',isbn_13:'9789044970791',open_library_edition_id:null,publisher:'A.W. Bruna Uitgevers'};
function book(locale){return withStrictEdition(original,selectStrictEdition([edition],locale,original.title),locale)??unavailableEdition(original,locale)};`;
const modules = {
  'lib/supabase/auth.ts': `export async function loadHeaderAuthState(){return {authenticated:false}};export async function getVerifiedServerUser(){return {client:null,user:null}}`,
  'lib/supabase/books.ts': bookSource + `export async function loadCatalogBook(id,locale='en'){return id==='1305'?book(locale):null};`,
  'lib/supabase/ratings.ts': `export async function loadBookRatingState(){return {authenticated:false,userEmail:null,userRating:null,lumiscore:null,ratingCount:null}}`,
  'lib/supabase/book-status.ts': `export async function loadUserBookStatuses(){return {authenticated:false,statuses:new Map()}}`,
  'lib/supabase/taste-test.ts': `export async function loadBookDetailPersonalization(){return {authenticated:false,hasEvidence:false,candidate:null,match:null}}`,
  'lib/supabase/collections.ts': bookSource + `
const collection={id:'11',slug:'suzanne-vermeer',name:'Suzanne Vermeer',collectionType:'author_collection',description:'Local review: only the public Madonna record is captured.',expectedMainSeriesTotal:null};
export async function loadCollectionPageData(slug,locale='en'){if(slug!==collection.slug)return null;const chosen=book(locale);const rows=chosen.editionAvailable?[{book:chosen,workId:'1305',sequenceNumber:null,publicationOrder:null,subgroup:null}]:[];return {collection,books:rows,authenticated:false,statuses:{},ratedWorkIds:[],userRatings:{},progress:{read:0,cataloguedTotal:rows.length,total:rows.length,percentage:0},highlightedUnreadWorkId:null}};
export async function loadBookCollectionContext(){return null};
export async function loadVerifiedBookCollectionReturnTarget(id,slug){return id==='1305'&&slug===collection.slug?{slug,name:collection.name}:null}`,
};
const server = await createServer({root,configFile:false,envFile:false,cacheDir:root+'node_modules/.vite-madonna-20261018',
  css:{postcss:{plugins:[tailwindcss()]}},resolve:{alias:{'@':root}},
  plugins:[{name:'loopback-madonna-public-capture',enforce:'pre',load(id){const relative=id.replaceAll('\\','/').replace(root.replaceAll('\\','/'),'').split('?')[0];return modules[relative]??null},
    configureServer(vite){vite.middlewares.use((req,res,next)=>{if(!['GET','HEAD'].includes(req.method)||req.url.startsWith('/api/')){res.writeHead(405);res.end('LOCAL READ-ONLY REVIEW');return;}next()})}},vinext()],
  server:{host:'127.0.0.1',port:3145,strictPort:true},
});
await server.listen();
console.log('LOCAL Madonna public capture: http://127.0.0.1:3145/nl/book/1305 — no database/Auth; collection contains only this captured book.');
