import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildWebsiteJsonLd,serializeWebsiteJsonLd,LUMISCORE_WEBSITE_ID,LUMISCORE_WEBSITE_URL} from './site-identity.ts';
import {createPageMetadata} from './page-metadata.ts';
import {getInformationPageContent,buildInformationPageJsonLd,INFORMATION_PAGE_KEYS} from '../information/pages.ts';

test('one root website identity is shared by every language and information-page reference',()=>{
  assert.equal(LUMISCORE_WEBSITE_URL,'https://lumisco.re/');
  assert.equal(LUMISCORE_WEBSITE_ID,'https://lumisco.re/#website');
  assert.deepEqual(JSON.parse(serializeWebsiteJsonLd()),{
    '@context':'https://schema.org','@type':'WebSite','@id':'https://lumisco.re/#website',
    name:'LumiScore',url:'https://lumisco.re/',inLanguage:['en','nl'],
  });
  assert.deepEqual(buildWebsiteJsonLd(),JSON.parse(serializeWebsiteJsonLd()));
  for(const locale of ['en','nl'] as const)for(const key of INFORMATION_PAGE_KEYS){
    const nodes=buildInformationPageJsonLd(getInformationPageContent(key,locale));
    assert.deepEqual(nodes[0].isPartOf,{'@id':LUMISCORE_WEBSITE_ID});
    assert.doesNotMatch(JSON.stringify(nodes),/\/(?:nl|en)#website|"@type":"WebSite"/);
    const breadcrumb=nodes.find(node=>node['@type']==='BreadcrumbList');
    assert.ok(breadcrumb?.itemListElement);
    assert.equal(breadcrumb.itemListElement[0].item,`https://lumisco.re/${locale}`,'localized breadcrumb stays localized');
  }
});

test('brand-only change leaves titles, descriptions, canonical/hreflang and indexing policy localized',()=>{
  for(const locale of ['en','nl'] as const){
    const title=locale==='nl'?'Een boek van een auteur | LumiScore':'A book by an author | LumiScore';
    const description=locale==='nl'?'Nederlandse beschrijving.':'English description.';
    const metadata=createPageMetadata({title,description,canonicalPath:'/book/1906',locale,type:'article'});
    assert.equal(metadata.title,title);assert.equal(metadata.description,description);
    assert.equal(metadata.openGraph.siteName,'LumiScore');
    assert.equal(metadata.openGraph.locale,locale==='nl'?'nl_NL':'en_US');
    assert.equal(metadata.alternates.canonical,`https://lumisco.re/${locale}/book/1906`);
    assert.deepEqual(metadata.alternates.languages,{en:'https://lumisco.re/en/book/1906','nl-NL':'https://lumisco.re/nl/book/1906','x-default':'https://lumisco.re/en/book/1906'});
    assert.deepEqual(metadata.robots,{index:true,follow:true});
  }
});

test('server root layout emits the website once; metadata API remains the only OG owner',async()=>{
  const layout=await readFile(new URL('../../app/layout.tsx',import.meta.url),'utf8');
  assert.equal((layout.match(/__html: serializeWebsiteJsonLd\(\)/g)??[]).length,1);
  assert.match(layout,/<head>[\s\S]*type="application\/ld\+json"/);
  assert.doesNotMatch(layout,/property="og:site_name"/);
});
