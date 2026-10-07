// LOCAL ONLY, no credentials or remote calls. Runs the real UI against an explicitly
// synthetic in-memory round adapter. Never enables a bypass in the application.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { parseRoundAction } from '../lib/taste-test/rating-round.ts';
const root = fileURLToPath(new URL('../', import.meta.url));
const titles = ['De stad aan het einde van de wereld', 'Een reis door het onbekende', 'Het huis tussen de sterren',
  'Een uitzonderlijk lange synthetische boektitel over de vergeten geschiedenis van een stad aan de andere kant van de wereld'];
const books = titles.map((title, i) => ({ id: 'local-compact-' + i, workId: String(990001 + i), source: 'demo',
  title, author: i === 3 ? 'Een Uitzonderlijk Lange Synthetische Auteursnaam met Meerdere Medeauteurs' : 'Synthetische Auteur', cover: 'orbit', score: null, ratingsCount: null, match: null,
  coverUrls: ['/compact-cover.svg'] }));
let position = 0;
let round = { id: 'dddddddd-0000-4000-8000-000000000001', number: 1, language: 'nl', goal: 20,
  complete: false, ratedCount: 0, offeredCount: 1 };
const ratings = new Map();
const journal = [];
const response = () => ({ authenticated: true, available: true, state: {
  round, currentWorkId: round.complete ? null : books[position % books.length].workId, exhausted: false },
  book: round.complete ? null : books[position % books.length] });
const json = (res, data, status = 200) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
};
const server = await createServer({
  configFile: false, envFile: false, root: root + 'test-support/compact-taste', publicDir: false,
  cacheDir: root + '.wrangler/compact-taste-vite',
  resolve: { alias: { '@': root, 'next/image': root + 'node_modules/vinext/dist/shims/image.js' }, dedupe: ['react', 'react-dom'] },
  define: { 'process.env': '{}' },
  css: { postcss: { plugins: [] } },
  server: { host: '127.0.0.1', port: 3107, strictPort: true, fs: { allow: [root] } },
  plugins: [react(), { name: 'local-synthetic-round-adapter', configureServer(vite) {
    vite.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url, 'http://127.0.0.1:3107');
      if (url.pathname === '/compact-cover.svg') {
        res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
        return res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 66 100"><rect width="66" height="100" fill="#214956"/><circle cx="43" cy="36" r="20" fill="#dab071"/><path d="M0 90L34 38L66 84V100H0" fill="#12262f"/></svg>');
      }
      if (url.pathname === '/__evidence' && req.method === 'GET') return json(res, { syntheticUIOnly: true, round, ratings: [...ratings], journal });
      if (url.pathname === '/api/catalog/search') return json(res, { results: books });
      if (url.pathname === '/api/taste-test/rounds') {
        if (req.method === 'GET') return json(res, response());
        if (req.method !== 'POST') return json(res, {}, 405);
        let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 4096) return json(res, {}, 413); }
        let action; try { action = parseRoundAction(JSON.parse(body)); } catch { return json(res, {}, 400); }
        if (!action || (action.action !== 'start' && action.roundId !== round.id)) return json(res, {}, 400);
        journal.push(action);
        if (action.action === 'start') {
          round = { ...round, id: 'dddddddd-0000-4000-8000-' + String(round.number + 1).padStart(12, '0'), number: round.number + 1,
            language: action.language, goal: action.goal, complete: false, ratedCount: 0, offeredCount: 1 };
        } else if (action.action === 'rate' && !ratings.has(action.workId)) {
          ratings.set(action.workId, action.score); round.ratedCount++; position++; round.offeredCount++;
          round.complete = round.ratedCount >= round.goal;
        } else if (action.action === 'skip') { position++; round.offeredCount++; }
        else if (action.action === 'choose') { const i = books.findIndex(book => book.workId === action.workId); if (i >= 0) position = i; }
        return json(res, response());
      }
      if (url.pathname.startsWith('/api/')) return json(res, { localFixture: true }, 404);
      next();
    });
  } }],
});
await server.listen();
console.log('LOCAL SYNTHETIC UI ONLY — http://localhost:3107/taste-test — NO HOSTED CONNECTION OR AUTHENTICATION PROOF');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await server.close(); process.exit(0); });
