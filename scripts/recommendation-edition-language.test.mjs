import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createRecommendationFixture } from './recommendation-performance-fixture.mjs';
import { buildTasteProfile } from '../lib/taste-test/profile.ts';
import { TASTE_TEST_QUESTIONS } from '../lib/taste-test/config.ts';

// Public bibliographic snapshot only. All evidence/scores/account state below
// are disposable local fixtures, never copied reader data or remote writes.
const snapshot = JSON.parse(readFileSync(new URL('../outputs/nl-recommendation-editions-20261029/public-edition-snapshot.json', import.meta.url)));
const answers = Object.fromEntries(TASTE_TEST_QUESTIONS.map(q => [q.key, 'left']));
const identity = b => [b.workId, b.editionId, b.title, b.editionLanguage, b.isbn13, b.openLibraryEditionId, b.englishEditionFallback, b.coverUrls];

test('actual recommendation, hydration and detail loaders: NL first; English majority explained by catalogue gaps', async t => {
  const f = await createRecommendationFixture({ works: 1, evidenceWorks: 0 });
  const marker = '__recommendationEditionTransport';
  const root = fileURLToPath(new URL('../', import.meta.url));
  let vite;
  try {
    await f.db.exec('delete from fixture_works');
    for (const w of snapshot.rows) {
      const payload = { ...w, authors: { name: w.author }, first_publish_year: 1970, source_type: 'open_library', work_type: 'novel' };
      await f.db.query('insert into fixture_works values ($1,$2)', [w.id, JSON.stringify(payload)]);
      for (const trait of ['fantasy', 'speculative']) {
        const evidence = { work_id: w.id, trait, weight: .9, confidence: .9, source: 'open_library', source_key: 'local-synthetic-only', raw_labels: ['synthetic test evidence'], mapping_version: 'taste_traits_v1', verified_at: '2026-10-29T00:00:00Z' };
        await f.db.query('insert into fixture_evidence values ($1,$2,$3,$4,$5)', [w.id, trait, evidence.source, evidence.source_key, JSON.stringify(evidence)]);
      }
    }
    const fixture = {
      client: { from(table) { return { select(...args) {
        const q = f.client.from(table).select(...args);
        q.eq = (column, value) => q.in(column, [column === 'id' ? Number(value) : value]);
        q.maybeSingle = async () => { const { data, error } = await q; return { data: data?.[0] ?? null, error }; };
        return q;
      } }; }, rpc: (name, args) => name === 'taste_rating_state'
        ? Promise.resolve({ data: { round: { language: 'en', ratedCount: 20, goal: 20 } }, error: null })
        : f.client.rpc(name, args), auth: { getUser: async () => ({ data: { user: { id: 'local-synthetic-account' } }, error: null }) } },
      reader: locale => ({ ratings: [], statuses: [], answers, profile: buildTasteProfile(answers, [], locale) }),
    };
    globalThis[marker] = fixture;
    const modules = {
      'lib/supabase/client.ts': `export const supabase=globalThis.${marker}.client`,
      'lib/supabase/server.ts': `export async function createServerSupabaseClient(){return globalThis.${marker}.client}`,
      'lib/supabase/auth.ts': `export async function getVerifiedServerUser(){return {client:globalThis.${marker}.client,user:{id:'local-synthetic-account'}}}`,
      'lib/supabase/reader-taste-profile.ts': `export async function loadReaderTasteProfile(c,id,locale){return globalThis.${marker}.reader(locale)}`,
      // Legacy account has no saved era preferences or reading-language field.
      'lib/supabase/reading-preferences.ts': 'export async function loadReaderEraPreferences(){return null}',
      'lib/supabase/collaborative.ts': 'export async function loadCollaborativeRecommendationSignals(){return new Map()}',
    };
    t.mock.method(globalThis, 'fetch', async input => {
      const url = new URL(String(input));
      assert.equal(url.origin, 'https://openlibrary.org');
      assert.equal(url.pathname, '/api/get_many');
      // Cover sources prove exact edition binding in this local test only.
      const keys = JSON.parse(url.searchParams.get('keys'));
      const result = {};
      for (const w of snapshot.rows) for (const e of w.editions) {
        const key = '/books/' + e.open_library_edition_id;
        if (!keys.includes(key)) continue;
        result[key] = { key, title: e.title, works: [{ key: '/works/' + w.open_library_id }], languages: [{ key: '/languages/' + e.language }], isbn_13: e.isbn_13 ? [e.isbn_13] : [], covers: [Number(e.id) + 80000000] };
      }
      return new Response(JSON.stringify({ status: 'ok', result }));
    });
    vite = await createServer({ root, configFile: false, envFile: false, cacheDir: root + '.wrangler/node_modules/recommendation-edition-vite', resolve: { alias: { '@': root } }, plugins: [{ name: 'isolated-recommendation-transport', enforce: 'pre', load(id) { return modules[id.replaceAll('\\', '/').replace(root.replaceAll('\\', '/'), '').split('?')[0]] ?? null; } }], server: { middlewareMode: true, hmr: false } });
    const books = await vite.ssrLoadModule('/lib/supabase/books.ts');
    const taste = await vite.ssrLoadModule('/lib/supabase/taste-test.ts');
    const resultLoader = await vite.ssrLoadModule('/lib/supabase/rating-result.ts');
    const dutch = await taste.loadGuestHomepagePersonalization(answers, 'nl', 20);
    assert.equal(dutch.recommendations.length, 20);
    assert.equal(dutch.recommendations.filter(r => !r.book.englishEditionFallback).length, 8);
    assert.equal(dutch.recommendations.filter(r => r.book.englishEditionFallback).length, 12);
    for (const { book } of dutch.recommendations) {
      const row = snapshot.rows.find(w => String(w.id) === book.workId);
      const hasDutch = row.editions.some(e => ['dut', 'nld', 'nl'].includes(e.language));
      assert.equal(book.englishEditionFallback, !hasDutch, book.workId);
      assert.equal(book.strictEditionLanguage, 'nl');
      const detail = await books.loadCatalogBook(book.workId, 'nl');
      assert.ok(detail, JSON.stringify({ workId: book.workId, queries: f.metrics.queries.slice(-3) }));
      assert.deepEqual(identity(detail), identity(book));
    }
    const english = await taste.loadGuestHomepagePersonalization(answers, 'en', 20);
    assert.equal(english.recommendations.length, 19, 'Dutch-only Work is not an English candidate');
    assert.ok(english.recommendations.every(r => r.book.editionLanguage === 'eng' && !r.book.englishEditionFallback));
    const reloaded = await taste.loadGuestHomepagePersonalization(answers, 'nl', 20);
    assert.deepEqual(reloaded, dutch, 'locale-keyed warm cache and reload retain exact editions, order and matches');
    const legacy = await taste.loadHomepagePersonalization('nl', 20);
    assert.deepEqual(legacy.recommendations, dutch.recommendations, 'legacy preference absence does not select English');
    const resumed = await resultLoader.loadRatingResult('nl');
    assert.equal(resumed.language, 'en', 'stored round language is retained, not rewritten');
    assert.ok(resumed.recommendations.every(r => r.book.strictEditionLanguage === 'nl'), 'current UI language controls presentation even for an older EN round');
    for (const { book } of resumed.recommendations) assert.deepEqual(identity(book), identity(await books.loadCatalogBook(book.workId, 'nl')));

    // NL edition beyond the REST page boundary must not disappear behind the
    // first English edition or the recommendation limit of twenty Works.
    const w = snapshot.rows.find(w => w.id === 1397);
    const extra = Array.from({ length: 1001 }, (_, i) => ({ ...w.editions[1], id: 9000000 + i }));
    const nl = { ...w.editions[0], id: 9999999, language: 'nld', title: 'Synthetic Dutch edition beyond page one', open_library_edition_id: null };
    await f.db.query("update fixture_works set payload=jsonb_set(payload,'{editions}',$1) where id=1397", [JSON.stringify([...w.editions, ...extra, nl])]);
    f.reset();
    const after = await taste.loadHomepagePersonalization('nl', 20);
    assert.equal(after.recommendations.find(r => r.book.workId === '1397').book.editionId, '9999999');
    assert.ok(f.metrics.queries.some(q => q.table === 'editions' && q.offset === 1000));
    const matches = rows => rows.map(r => [r.book.workId, r.matchScore]).sort(([a], [b]) => Number(a) - Number(b));
    assert.deepEqual(matches(after.recommendations), matches(legacy.recommendations), 'all Work matches retained; existing Dutch ranking nudge can change position after a catalogue correction');
  } finally { if (vite) await vite.close(); await f.db.close(); delete globalThis[marker]; }
});

test('browser/API locale and private-cache boundaries remain explicit', () => {
  const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  assert.match(read('app/components/TasteRatingResult.tsx'), /result\?locale=\$\{locale\}/);
  assert.match(read('app/components/TasteRatingResult.tsx'), /loaded\?\.locale\s*===\s*locale/);
  assert.match(read('app/components/RecommendationOverview.tsx'), /JSON\.stringify\(\{ answers, locale, limit \}\)/);
  assert.match(read('app/components/RecommendationOverview.tsx'), /result\?\.locale === locale/);
  assert.match(read('app/components/RatingTasteTest.tsx'), /localizedHref\('\/taste-test\/result', locale\)/);
  assert.match(read('app/components/EditionPresentationLabel.tsx'), /book\.englishEditionFallback && locale==='nl'/);
  assert.match(read('lib/supabase/taste-test.ts'), /new Map<Locale/);
  for (const route of ['app/api/taste-test/result/route.ts', 'app/api/recommendations/guest/route.ts']) assert.match(read(route), /PRIVATE_RESPONSE_HEADERS/);
  assert.match(read('lib/auth/request.ts'), /no-store/);
});
