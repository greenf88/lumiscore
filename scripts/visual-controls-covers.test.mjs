// Actual shared component HTML and existing privacy formatter, synthetic books only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
test('one privacy-filtered badge inside each shared cover at every presentation size',async()=>{
 const vite=await createServer({root,configFile:false,envFile:false,cacheDir:root+'.wrangler/node_modules/visual-cover-tests',plugins:[react()],css:{postcss:{plugins:[]}},resolve:{alias:{'@':root,'next/image':root+'node_modules/vinext/dist/shims/image.js'},dedupe:['react','react-dom']},server:{middlewareMode:true,hmr:false}});
 try{
  const {BookCover,BookCard}=await vite.ssrLoadModule('/app/components/LumiScoreHome.tsx');
  const {LumiScoreLocaleProvider:Provider}=await vite.ssrLoadModule('/app/components/LumiScoreLocale.tsx');
  const base={id:'synthetic-cover',workId:'990001',source:'supabase',title:'A long title without losing its accessible book link',author:'Synthetic Author',cover:'orbit',coverUrls:[],firstPublishYear:2000,score:9.2,ratingsCount:null,ratingBand:'3–4',match:null};
  const render=(locale,node)=>renderToStaticMarkup(h(Provider,{initialLocale:locale,hasPersistedChoice:true,initialPath:'/browse'},node));
  for(const locale of ['nl','en'])for(const presentation of ['compact','card','detail','taste'])for(const available of [true,false]){
   const html=render(locale,h(BookCover,{book:{...base,ratingBand:available?'3–4':null},presentation,small:presentation==='compact',label:base.title,resolveMissing:false}));
   assert.equal((html.match(/cover-rating-badge/g)??[]).length,1);
   assert.match(html,new RegExp(`data-cover-presentation="${presentation}"`));
   assert.match(html,available?/aria-label="LumiScore 9.2"/:/aria-label="LumiScore —"/);
   assert.match(html,/role="img" aria-label="A long title/);
   assert.doesNotMatch(html,/LumiScore 0|ratingsCount/);
  }
  for(const variant of ['standard','browse']){
   const html=render('en',h(BookCard,{book:base,variant,resolveMissingCover:false}));
   assert.equal((html.match(/cover-rating-badge/g)??[]).length,1);
   assert.match(html,/href="\/en\/book\/990001"/);
   assert.doesNotMatch(html,/class="browse-score"/); // Not a second rectangular badge.
  }
  const detail=render('en',h(BookCover,{book:base,presentation:'detail',publicScoreDisplay:'—',resolveMissing:false}));
  assert.match(detail,/aria-label="LumiScore —"/); // Live, withheld aggregate wins over the original book prop.
  assert.doesNotMatch(detail,/LumiScore 9.2/);
 }finally{await vite.close();}
});
test('visual tokens and account entry preserve semantics without broad link styling',async()=>{
 const read=path=>readFile(root+path,'utf8');
 const css=await read('app/globals.css');
 assert.match(css,/--control-surface: #173844/);
 assert.match(css,/--control-surface: #fffdf8/);
 assert.match(css,/\.book-cover \.cover-rating-badge/);
 assert.match(css,/\.book-cover \{ container-type: inline-size/);
 assert.match(css,/\.collection-quick-editor \.collection-rating-options \{ grid-template-columns: repeat\(5, minmax\(44px, 1fr\)\)/);
 assert.match(css,/\.reading-profile-page \.reading-profile-action\.ui-primary/);
 const nav=await read('app/components/MobileNavigation.tsx');
 assert.match(nav,/authenticated && <LocaleLink className="ui-control ui-secondary" href="\/account"/);
 const profile=await read('app/components/LumiScoreReadingProfile.tsx');
 assert.match(profile,/reading-profile-action ui-control ui-primary/);
 assert.match(profile,/href="\/taste-test"/);
});

test('collection cards reserve width for two score rows and do not stretch with an open neighbour',async()=>{
 const css=await readFile(root+'app/globals.css','utf8');
 assert.match(css,/--score-badge-bg: #e2a24c;/);
 assert.equal((css.match(/--score-badge-bg:/g)??[]).length,1); // No theme-specific recolouring.
 assert.match(css,/\.book-cover \.cover-rating-badge \{[^}]*background: var\(--score-badge-bg\)/);
 assert.match(css,/\.collection-book-list\.book-grid \{[^}]*minmax\(min\(100%, 320px\), 1fr\)[^}]*align-items: start/);
 assert.match(css,/\.collection-book-card \{ height: auto;/);
 assert.match(css,/\.collection-book-card \.book-card-main-link \{[^}]*grid-template-columns: minmax\(0, \.42fr\) minmax\(0, \.58fr\)/);
 assert.match(css,/\.collection-hero > \.detail-back-link \{ display: flex; width: fit-content; margin: 0 0 12px;/);
 assert.doesNotMatch(css,/\.collection-quick-editor \.collection-rating-options \{[^}]*auto-fit/);
});
