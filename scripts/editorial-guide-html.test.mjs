import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

test('Dutch dystopia route renders only supported editions, with matching guide links and structured item count', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const vite = await createServer({ root, configFile:false, envFile:false,
    cacheDir:root+'.wrangler/node_modules/editorial-guide-html', plugins:[react()],
    css:{postcss:{plugins:[]}},
    resolve:{alias:{'@':root,'next/image':root+'node_modules/vinext/dist/shims/image.js'},dedupe:['react','react-dom']},
    server:{middlewareMode:true,hmr:false},
  });
  try {
    const { LumiScoreLocaleProvider:Provider } = await vite.ssrLoadModule('/app/components/LumiScoreLocale.tsx');
    const { EditorialTopList } = await vite.ssrLoadModule('/app/components/EditorialTopList.tsx');
    const { getEditorialTopList,getEditorialTopBook,getEditorialWorkSourceId } = await vite.ssrLoadModule('/lib/catalog/top-lists.ts');
    const { getLandingGuide } = await vite.ssrLoadModule('/lib/editorial/landing-guides.ts');
    const { editorialPageJsonLd } = await vite.ssrLoadModule('/lib/seo/editorial.ts');
    const { applyStoredPresentation } = await vite.ssrLoadModule('/lib/books/stored-presentation.ts');
    const { bookReadingRoutes } = await vite.ssrLoadModule('/lib/editorial/landing-guides.ts');
    const list = getEditorialTopList('dystopie-vanaf-1990');
    const guide = getLandingGuide('/toplijsten/'+list.slug,'nl');
    const titles = {'102':'Hongerspelen','2718':'Laat me nooit alleen','199':'De testamenten'};
    const books = list.workIds.filter(id=>titles[id]).map(id=>({
      id:'work-'+id,workId:id,openLibraryWorkId:getEditorialWorkSourceId(id),
      source:'supabase',editionAvailable:true,editionLanguage:'nld',title:titles[id],
      author:getEditorialTopBook(id).author,cover:'orbit',coverUrls:[],score:null,ratingsCount:null,match:null,
    }));
    const selections = Object.fromEntries(list.workIds.map(id=>[id,{
      ...getEditorialTopBook(id),sourceId:getEditorialWorkSourceId(id),href:titles[id]?'/book/'+id:null,
    }]));
    const render = (items, unavailable=false) => renderToStaticMarkup(h(Provider,{initialLocale:'nl',hasPersistedChoice:true,initialPath:'/toplijsten/'+list.slug},
      h(EditorialTopList,{list,books:items,selections,relatedLists:[],unavailable})));
    const html = render(books);
    assert.equal(list.workIds.length,10,'the original editorial candidates remain intact');
    assert.equal((html.match(/class="editorial-book"/g)??[]).length,3);
    assert.equal((html.match(/<h1>/g)??[]).length,1);
    assert.ok(html.includes('<h1>'+guide.h1+'</h1>'));
    assert.doesNotMatch(html,/Top 10|editorial-unavailable|Boek tijdelijk niet beschikbaar/);
    assert.match(html.replaceAll('<!-- -->',''),/3 van de 10 oorspronkelijke keuzes/);
    for (const id of Object.keys(titles)) {
      assert.ok(html.includes('href="/nl/book/'+id+'"'));
      assert.ok(html.includes('href="#keuze-'+id+'"'));
    }
    const graph=editorialPageJsonLd(list,books,'nl')['@graph'];
    assert.equal(graph[0].name,guide.h1);
    assert.equal(graph[0].description,guide.meta_description);
    assert.equal(graph[1].numberOfItems,3);
    assert.deepEqual(graph[1].itemListElement.map(entry=>entry.item.url),books.map(book=>'https://lumisco.re/nl/book/'+book.workId));
    const removed = render(books.map(book=>book.workId==='199'?{...book,editionAvailable:false}:book));
    assert.equal((removed.match(/class="editorial-book"/g)??[]).length,2);
    assert.doesNotMatch(removed,/href="#keuze-199"|href="\/nl\/book\/199"|Is De testamenten een vervolg/);
    assert.match(render([],true),/role="alert"/);
    // Exercise the exact reviewed additions, not synthetic language fallbacks.
    const additions=JSON.parse(readFileSync(new URL('../docs/operations/nl-dystopia-20261116/editions.json',import.meta.url),'utf8'));
    const complete=[...books,...additions.map((r,i)=>{
      const editionId=String(80000+i);
      const item={id:'work-'+r.id,workId:String(r.id),authorId:String(r.authorId),openLibraryWorkId:r.ol,
        source:'supabase',editionAvailable:true,editionLanguage:'nld',editionId,editionTitle:r.title,
        isbn13:r.isbn,title:r.title,author:r.author,cover:'orbit',coverUrls:[],score:null,ratingsCount:null,match:null};
      return applyStoredPresentation([item],'nl',[
        {work_id:r.id,language:'nl',bound_author_id:r.authorId,text:r.description,source_type:r.sourceType,source_name:r.sourceName,source_url:r.sourceUrl,review_status:'approved',reviewed_at:'2026-11-16T00:00:00Z'}
      ],[{edition_id:Number(editionId),work_id:r.id,bound_author_id:r.authorId,bound_title:r.title,bound_language:'nld',bound_isbn13:r.isbn,format:r.format,cover_url:r.cover,card_cover_url:r.cover,evidence_url:r.coverSource,review_status:'approved'}])[0];
    })].sort((a,b)=>list.workIds.indexOf(a.workId)-list.workIds.indexOf(b.workId));
    for(const b of complete)selections[b.workId].href='/book/'+b.workId;
    const fullHtml=render(complete).replaceAll('<!-- -->','');
    assert.equal((fullHtml.match(/class="editorial-book"/g)??[]).length,10);
    assert.match(fullHtml,/10 van de 10 boeken/);
    assert.doesNotMatch(fullHtml,/De overige \d+ keuzes|editorial-unavailable/);
    assert.equal(editorialPageJsonLd(list,complete,'nl')['@graph'][1].numberOfItems,10);
    assert.equal((fullHtml.match(/<h3 class="editorial-angle">/g)??[]).length,10);
    for(const b of complete){
      assert.ok(fullHtml.includes('href="#keuze-'+b.workId+'"'));
      assert.ok(fullHtml.includes('href="/nl/book/'+b.workId+'"'));
      assert.ok(bookReadingRoutes(b,'nl').some(r=>r.href==='/toplijsten/dystopie-vanaf-1990'));
    }
    for(const r of additions){
      const b=complete.find(b=>b.workId===String(r.id));
      assert.equal(b.storedDescription?.text,r.description);
      assert.equal(b.cardCoverUrl,r.cover);
      assert.equal(b.editionFormat,r.format);
      assert.ok(b.storedDescription?.sourceUrl);
    }
  } finally { await vite.close(); }
});
