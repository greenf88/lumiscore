// LOCAL SSR UI evidence only: real router/components, synthetic loader substitutes.
// No credentials, database connections, Auth writes, external catalog or deployment.
import { createServer } from 'vite';
import vinext from 'vinext';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const port = 3122;
for (const key of Object.keys(process.env)) if (/SUPABASE|GOOGLE_BOOKS|DATABASE|SECRET|TOKEN/.test(key)) delete process.env[key];
const fixture = JSON.stringify(root.replaceAll('\\', '/') + 'test-support/browse/fixture.ts');
const modules = {
  'lib/supabase/editorial-catalog.ts': `export {loadEditorialCatalog,unavailableEditorialPage} from ${fixture};`,
  'lib/supabase/books.ts': `export {books,loadCatalogBook,loadCatalogBooksByIds,loadCatalogBooksByIdsWithStoredCovers,loadHighestRatedCatalog} from ${fixture};`,
  'lib/supabase/auth.ts': 'export async function loadHeaderAuthState(){return {authenticated:false}};export async function getVerifiedServerUser(){return {client:null,user:null}}',
  'lib/supabase/categories.ts': `import {categories} from ${fixture};export async function loadPublicCategories(){return categories}`,
  'lib/supabase/ratings.ts': 'export async function loadBookRatingState(){return {authenticated:false,userEmail:null,userRating:null,lumiscore:null,ratingCount:null}}',
  'lib/supabase/book-status.ts': 'export async function loadUserBookStatuses(){return {authenticated:false,statuses:new Map()}};export async function loadMyBooksPageData(){return {authenticated:false,available:true,items:[]}}',
  'lib/supabase/taste-test.ts': 'export async function loadBookDetailPersonalization(){return {authenticated:false,hasEvidence:false,candidate:null,match:null}};export async function loadHomepagePersonalization(){return {authenticated:false,hasEvidence:false,recommendations:[],ratingCount:0,tasteTestAnsweredCount:0}}',
  'lib/supabase/collections.ts': 'export async function loadBookCollectionContext(){return null};export async function loadVerifiedBookCollectionReturnTarget(){return null};export async function loadHomepageSeriesContinuations(){return []}',
  'lib/books/public-description.ts': "export async function loadPublicBookDescriptionState(){return {state:'confirmed_missing',description:null}}",
};
// Vinext's CommonJS transform excludes node_modules, including Vite's optimized RSC cache.
const server = await createServer({ root, configFile: false, envFile: false, cacheDir: root + '.wrangler/node_modules/browse-review-vite',
  css: { postcss: { plugins: [tailwindcss()] } }, resolve: { alias: { '@': root } },
  plugins: [{ name: 'loopback-browse-fixtures', enforce: 'pre',
    load(id) { const relative = id.replaceAll('\\', '/').replace(root.replaceAll('\\', '/'), '').split('?')[0]; return modules[relative] ?? null; },
    configureServer(vite) { vite.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      if (url.pathname === '/browse-review-cover.svg') {
        res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
        return res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><rect width="200" height="300" fill="#23464d"/><circle cx="118" cy="117" r="58" fill="#d1a963"/><path d="M0 260L110 120L200 250V300H0" fill="#102b35"/><text x="16" y="38" fill="#f7f3eb" font-family="Georgia" font-size="18">Een nieuwe horizon</text></svg>');
      }
      if (url.pathname === '/api/catalog/authors') {
        const { authors } = await vite.ssrLoadModule('/test-support/browse/fixture.ts');
        const q = (url.searchParams.get('q') ?? '').toLocaleLowerCase();
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify({ authors: q.length >= 2 ? authors.filter(a => a.name.toLocaleLowerCase().includes(q)) : [] }));
      }
      next();
    }); },
  }, vinext()], server: { host: '127.0.0.1', port, strictPort: true },
});
await server.listen();
console.log(`LOCAL SYNTHETIC BROWSE SSR — http://127.0.0.1:${port}/nl/browse — NO DATABASE/AUTH PROOF`);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await server.close(); process.exit(0); });
