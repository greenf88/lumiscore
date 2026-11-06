// Public anonymous reads only; point the environment at the intended project.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { selectSitemapBookLocales } from '../lib/seo/book-locales.ts';
import { buildLocalizedSitemap } from '../lib/seo/sitemap.ts';
import { EDITION_PRESENTATION_SELECT } from '../lib/supabase/edition-rows.ts';

const [directory, auditCrawl, auditPagination] = process.argv.slice(2);
const project = process.env.NEXT_PUBLIC_SUPABASE_URL;
const apiKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert(directory && auditCrawl && auditPagination && project && apiKey, 'Evidence paths and public project configuration required');
const get = async (path, params) => {
  const url = new URL('/rest/v1/' + path, project);
  url.search = new URLSearchParams(params).toString();
  const r = await fetch(url, { headers: { apikey: apiKey }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw Error(path + ' responded ' + r.status);
  return r.json();
};
async function all(table, select, sort) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await get(table, {select, order:sort+'.asc', limit:1000, offset});
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}
async function browse(locale) {
  const args = {p_locale:locale,p_sort:'az',p_page_size:128};
  const first = await get('rpc/catalog_browse_page_v3', {...args, p_page:1});
  const ids = [...first.workIds];
  for (let start = 2; start <= first.pageCount; start += 4) {
    const batch = await Promise.all(Array.from({length:Math.min(4, first.pageCount - start + 1)}, (_,i) => get('rpc/catalog_browse_page_v3', {...args, p_page:start+i})));
    for (const page of batch) {
      assert.equal(page.total, first.total);
      ids.push(...page.workIds);
    }
  }
  assert.equal(new Set(ids).size, first.total);
  return new Set(ids.map(String));
}
const beforeXml = await readFile(directory + '/production-sitemap.xml', 'utf8');
assert(/<urlset\b/.test(beforeXml) && !/<sitemapindex\b/.test(beforeXml), 'Expected the observed flat sitemap');
const [works, editions, collections, enBrowse, nlBrowse] = await Promise.all([
  all('works','id,title','id'), all('editions',EDITION_PRESENTATION_SELECT,'id'), all('collections','slug','slug'), browse('en'), browse('nl'),
]);
const selected = selectSitemapBookLocales(works, editions);
const candidateXml = buildLocalizedSitemap(selected, collections.map(c=>c.slug));
await writeFile(directory + '/candidate-sitemap.xml', candidateXml);
const locs = xml => [...xml.matchAll(/<loc>(https:\/\/lumisco\.re\/[^<]+)<\/loc>/g)].map(m=>m[1]);
const before = locs(beforeXml), after = locs(candidateXml);
assert.equal(before.length, new Set(before).size);
assert.equal(after.length, new Set(after).size);
const bookId = (url, locale) => url.match(new RegExp('/'+locale+'/book/([1-9][0-9]*)$'))?.[1];
const audit = JSON.parse(await readFile(auditCrawl, 'utf8'));
const pagination = JSON.parse(await readFile(auditPagination, 'utf8'));
const discovered = new Set();
function addLink(href, parent) {
  const source = new URL(parent, 'https://lumisco.re');
  const target = new URL(href, source);
  if (target.origin !== source.origin || source.pathname === target.pathname) return;
  const match = /^\/(en|nl)\/book\/([1-9]\d*)$/.exec(target.pathname);
  if (match) discovered.add(match[1]+'/'+match[2]);
}
for (const page of audit.pages) if (page.status === 200) {
  for (const link of page.internal_links) addLink(link.href, page.final_url);
}
for (const page of pagination.pages) if (page.status === 200) {
  for (const href of page.book_links) addLink(href, page.url);
}
const editionsByWork = new Set(editions.map(e=>String(e.work_id)));
const output = {productionWorks:works.length, productionEditions:editions.length, nonBookBefore:before.filter(u=>!u.includes('/book/')).length, nonBookAfter:after.filter(u=>!u.includes('/book/')).length, locales:{}};
for (const [locale,browseIds] of [['en',enBrowse],['nl',nlBrowse]]) {
  const beforeIds = new Set(before.map(u=>bookId(u,locale)).filter(Boolean));
  const afterIds = new Set(after.map(u=>bookId(u,locale)).filter(Boolean));
  const removed = [...beforeIds].filter(id=>!afterIds.has(id));
  const idsWithoutKnownDiscovery = [...afterIds].filter(id=>!discovered.has(locale+'/'+id));
  output.locales[locale] = {before:beforeIds.size, after:afterIds.size, added:[...afterIds].filter(id=>!beforeIds.has(id)), removedCount:removed.length, removedWithoutAnyEdition:removed.filter(id=>!editionsByWork.has(id)).length, removedWithEditions:removed.filter(id=>editionsByWork.has(id)).length, allowedCrossLanguageFallback:0, browse:browseIds.size, detailOnly:[...afterIds].filter(id=>!browseIds.has(id)), browseOnly:[...browseIds].filter(id=>!afterIds.has(id)), eligibleNotSeenInAuditedLinks:idsWithoutKnownDiscovery.length, excludedSeenInAuditedLinks:removed.filter(id=>discovered.has(locale+'/'+id)), removedIds:removed};
}
await writeFile(directory+'/sitemap-selection.json',JSON.stringify(output,null,2)+'\n');
const { locales, ...totals } = output;
console.log(JSON.stringify({...totals,locales:Object.fromEntries(Object.entries(locales).map(([l,{removedIds,excludedSeenInAuditedLinks,...v}])=>[l,{...v,exampleRemoved:removedIds.slice(0,10),excludedSeenInAuditedLinks:excludedSeenInAuditedLinks.length}]))},null,2));
