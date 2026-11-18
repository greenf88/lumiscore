import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import type { Book } from '../../app/data/books.ts';
import { reviewedBookLinks } from './reviewed-book-links.ts';
import { REVIEWED_BOOK_LINKS } from './reviewed-book-links-data.ts';

const english: Book = { id:'work-6756', source:'supabase', workId:'6756', openLibraryWorkId:'OL8053274W',
  title:'LAST WATCH (Night Watch)', editionTitle:'LAST WATCH (Night Watch)', author:'Sergeĭ Lukʹi͡anenko',
  editionLanguage:'eng', strictEditionLanguage:'en', editionAvailable:true, score:null, ratingsCount:null, match:null, cover:'orbit' };
const dutch: Book = { ...english, id:'work-5714', workId:'5714', openLibraryWorkId:'OL957837W', title:'Gent, Rabot',
  editionTitle:'Gent, Rabot', author:'Bart de Wilde', editionLanguage:'nld', strictEditionLanguage:'nl' };

test('a fantasy comparison distinguishes unrelated Night Watch series and never invents a sequel', () => {
  const links=reviewedBookLinks(english,'en');
  assert.equal(links.length,1);
  assert.equal(links[0].href,'/book/8472');
  assert.equal(links[0].title,'Night Watch');
  assert.match(links[0].reason,/Pratchett.*Discworld, not Lukyanenko/);
});

test('foreign, unavailable or reassigned catalogue identities cannot display production links', () => {
  for(const mismatch of [
    {workId:'999999'}, {openLibraryWorkId:'OL999999W'}, {openLibraryWorkId:null},
    {editionTitle:'Night Watch'}, {editionTitle:null}, {author:'Terry Pratchett'},
    {editionLanguage:'nld'}, {editionLanguage:null}, {editionAvailable:false},
    {strictEditionLanguage:'nl' as const}, {detailLocales:['nl'] as const}, {source:'demo' as const},
  ]) assert.deepEqual(reviewedBookLinks({...english,...mismatch},'en'),[],JSON.stringify(mismatch));
  assert.deepEqual(reviewedBookLinks(english,'nl'),[]);
  assert.deepEqual(reviewedBookLinks(dutch,'en'),[]);
});

test('each comparison stays within the same language and links to a distinct reviewed work', () => {
  const seen=new Set<string>();
  for(const entry of REVIEWED_BOOK_LINKS){
    assert.ok(entry.links.length>0 && entry.links.length<=3);
    for(const link of entry.links){
      const target=REVIEWED_BOOK_LINKS.find(e=>e.workId===link.workId && e.language===entry.language);
      assert.ok(target);
      assert.equal(target.language,entry.language);
      assert.notEqual(target.workId,entry.workId);
      const key=entry.language+':'+entry.workId+'>'+target.workId;
      assert.ok(!seen.has(key));seen.add(key);
    }
  }
});

test('Hill House keeps independent Dutch and English reading suggestions', () => {
  const base: Book = { ...english, id: 'work-1894', workId: '1894', author: 'Shirley Jackson', openLibraryWorkId: 'OL3171069W' };
  const nl = { ...base, editionTitle: 'De geesten van Hill house', editionLanguage: 'nld', strictEditionLanguage: 'nl' as const };
  const en = { ...base, editionTitle: 'The Haunting of Hill House' };
  assert.deepEqual(reviewedBookLinks(nl, 'nl').map(l => l.href), ['/book/106']);
  const enLinks = reviewedBookLinks(en, 'en');
  assert.deepEqual(enLinks.map(l => l.href), ['/book/9762', '/book/3660', '/book/2273']);
  assert.ok(enLinks.every(l => l.href !== '/book/106'));
  assert.deepEqual(reviewedBookLinks(nl, 'en'), []);
  assert.deepEqual(reviewedBookLinks(en, 'nl'), []);
});

test('the book page renders visible, localized reading links with context in server HTML', async () => {
  const root=fileURLToPath(new URL('../../',import.meta.url));
  const vite=await createServer({root,configFile:false,envFile:false,cacheDir:root+'.wrangler/node_modules/reviewed-links-tests',plugins:[react()],
    css:{postcss:{plugins:[]}},resolve:{alias:{'@':root},dedupe:['react','react-dom']},server:{middlewareMode:true,hmr:false,ws:false}});
  try {
    const {BookEditorialGuide:Guide}=await vite.ssrLoadModule('/app/components/EditorialLandingGuide.tsx');
    const {LumiScoreLocaleProvider:Provider}=await vite.ssrLoadModule('/app/components/LumiScoreLocale.tsx');
    for(const [book,locale,target,heading] of [[english,'en','8472','Keep exploring'],[dutch,'nl','6488','Verder lezen']] as const){
      const html=renderToStaticMarkup(createElement(Provider,{initialLocale:locale,hasPersistedChoice:true,initialPath:'/book/'+book.workId},
        createElement(Guide,{book,locale,hasSuzanneCollectionLink:false})));
      assert.ok(html.includes(`href="/${locale}/book/${target}"`));
      assert.ok(html.includes(`<h2>${heading}</h2>`));
      assert.ok(html.includes('class="book-reading-links"'));
      assert.doesNotMatch(html,/returnTo=|<[^>]+\shidden(?:\s|=|>)/);
    }
  } finally { await vite.close(); }
});
