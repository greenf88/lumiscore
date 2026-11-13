import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

test('category hub renders counts for its requested language and distinguishes missing discovery data from an empty category', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  // Exercise the actual async route and rendered HTML with bounded catalog
  // responses. No production database, session, or network is involved.
  const modules = {
    state: `export const state = { locale: 'nl', discoveryAvailable: true, fail: false, calls: [] };`,
    locale: `import {state} from 'virtual:category-state'; export async function resolveRequestLocale() { return {locale:state.locale}; }`,
    metadata: `export async function createLocalizedPageMetadata(options) { return options; }`,
    auth: `export async function loadHeaderAuthState() { return {authenticated:false}; }`,
    catalog: `import {state} from 'virtual:category-state';
      export async function loadEditorialCatalog(query, locale, hydrateBooks) {
        state.calls.push({locale,hydrateBooks});
        if (state.fail) throw new Error('Synthetic catalog outage');
        return {available:true,discoveryAvailable:state.discoveryAvailable,
          categories:state.discoveryAvailable ? [{id:'fiction_fantasy',nl:'Fantasy',en:'Fantasy'},{id:'nonfiction_cooking_food',nl:'Koken',en:'Cooking'}] : [],
          facets:{fiction_fantasy:locale==='nl'?2:9,nonfiction_cooking_food:0}};
      }`,
    shell: `export function DiscoveryPageShell({children}) { return children; }`,
    links: `import {createElement} from 'react'; import {state} from 'virtual:category-state';
      export function LocaleLink({href,children,...props}) { return createElement('a',{...props,href:'/'+state.locale+href},children); }`,
  };
  const replacements = {
    '@/lib/i18n/server': 'locale', '@/lib/seo/localized-metadata': 'metadata',
    '@/lib/supabase/auth': 'auth', '@/lib/supabase/editorial-catalog': 'catalog',
    '@/app/components/DiscoveryPageShell': 'shell', '@/app/components/LumiScoreLocale': 'links',
  };
  const vite = await createServer({ root, configFile: false, envFile: false,
    cacheDir: root + '.wrangler/node_modules/category-hub-html',
    plugins: [react(), {
      name: 'category-hub-test-boundaries',
      resolveId(id) { if (id.startsWith('virtual:category-')) return '\0' + id; },
      load(id) { if (id.startsWith('\0virtual:category-')) return modules[id.slice('\0virtual:category-'.length)]; },
    }],
    css: { postcss: { plugins: [] } },
    resolve: { alias: [...Object.entries(replacements).map(([find, name]) => ({find, replacement:'virtual:category-'+name})), {find:'@',replacement:root}], dedupe:['react','react-dom'] },
    server: { middlewareMode: true, hmr: false },
  });
  try {
    const { state } = await vite.ssrLoadModule('virtual:category-state');
    const { default: Page, generateMetadata } = await vite.ssrLoadModule('/app/categories/page.tsx');
    for (const locale of ['nl','en']) {
      state.locale = locale;
      const html = renderToStaticMarkup(await Page());
      assert.deepEqual(state.calls.at(-1), {locale,hydrateBooks:false});
      assert.match(html, new RegExp(`<span>${locale==='nl'?2:9} (?:<!-- -->)?${locale==='nl'?'boeken':'books'}`));
      assert.match(html, new RegExp(`href="/${locale}/browse\\?category=fiction_fantasy"`));
      assert.match(html, new RegExp(`href="/${locale}/toplijsten"`));
      assert.match(html, locale==='nl' ? /nog geen beschikbare boeken/ : /no available books yet/);
      assert.doesNotMatch(html, /role="status"/);
      state.discoveryAvailable = false;
      const missing = renderToStaticMarkup(await Page());
      assert.match(missing, /role="status"/);
      assert.doesNotMatch(missing, /category-overview|0 (?:<!-- -->)?(?:publieke|public) categorie/);
      assert.match(missing, new RegExp(`href="/${locale}/browse"`));
      state.discoveryAvailable = true;
    }
    state.fail = true;
    assert.match(renderToStaticMarkup(await Page()), /role="status"/);
    const metadata = await generateMetadata();
    assert.equal(metadata.canonicalPath, '/categories');
    assert.match(metadata.description, /Browse books by category/);
  } finally { await vite.close(); }
});
