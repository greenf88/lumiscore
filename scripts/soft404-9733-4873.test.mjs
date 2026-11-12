import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { loadPublicBookDescriptionState } from '../lib/books/public-description.ts';
import { applyStoredPresentation } from '../lib/books/stored-presentation.ts';
import { selectStrictEdition, withStrictEdition } from '../lib/books/strict-edition.ts';

const directory = new URL('../catalog/soft404-9733-4873-20261110/', import.meta.url);
const read = name => readFileSync(new URL(name, directory), 'utf8');
const manifest = JSON.parse(read('release-hashes.json'));
const plan = JSON.parse(read('production-plan.json'));
const baseline = JSON.parse(read('review.json')).production;

test('only two bound, original English descriptions enter the production package', async () => {
  for (const [name, hash] of Object.entries(manifest.sha256)) {
    assert.equal(createHash('sha256').update(read(name)).digest('hex'), hash, name);
  }
  assert.deepEqual(plan.actions.map(action => [action.relation, action.key, action.before]), [
    ['catalog_work_descriptions', { work_id: 4873, language: 'en' }, null],
    ['catalog_work_descriptions', { work_id: 9733, language: 'en' }, null],
  ]);
  for (const { key, after } of plan.actions) {
    const { work, author } = plan.bindings.find(binding => binding.work.id === key.work_id);
    const edition = plan.editionBindings.find(row => row.work_id === work.id);
    const book = withStrictEdition({
      id: String(work.id), workId: String(work.id), authorId: String(author.id),
      title: work.title, author: author.name, source: 'supabase', cover: 'orbit',
      score: null, ratingsCount: null, match: null,
    }, selectStrictEdition([edition], 'en', work.title), 'en');
    assert.equal(book.editionId, String(edition.id));
    assert.equal(book.isbn13, edition.isbn_13);
    assert.equal(selectStrictEdition([edition], 'nl', work.title), null);
    const failure = async () => { throw new Error('Synthetic provider unavailable'); };
    const snapshots = { loadDescriptionSnapshot: failure, saveDescriptionSnapshot: failure, markDescriptionSnapshotFailure: failure };
    assert.deepEqual(await loadPublicBookDescriptionState(book, 'en', failure, snapshots), { state: 'temporary_failure', description: null });
    const [selected] = applyStoredPresentation([book], 'en', [after], []);
    for (let n = 0; n < 2; n++) {
      const result = await loadPublicBookDescriptionState(selected, 'en', failure, snapshots);
      assert.equal(result.state, 'resolved');
      assert.equal(result.description.text, after.text);
      assert.equal(result.description.sourceUrl, after.source_url);
    }
    assert.equal(applyStoredPresentation([book], 'nl', [after], [])[0].storedDescription, undefined);
    assert.equal(selected.score, book.score);
  }
});

test('the exact SQL supports no-op replay and guarded committed recovery', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create table authors(id bigint primary key, open_library_id text unique, name text, created_at timestamptz);
      create table works(id bigint primary key, open_library_id text unique, title text, subtitle text, author_id bigint references authors,
        first_publish_year int, cover_id bigint, subjects text[], created_at timestamptz, source_type text, work_type text, native_identity_key text unique);
      create table editions(id bigint primary key, work_id bigint references works, open_library_edition_id text unique, isbn_10 text, isbn_13 text,
        language text, publisher text, created_at timestamptz, title text);
      create table synthetic_ratings(work_id bigint references works, score int);
      create table synthetic_progress(work_id bigint references works, status text);
    `);
    for (const table of ['authors', 'works', 'editions']) {
      await db.query('insert into '+table+' select * from jsonb_populate_recordset(null::'+table+',$1)', [JSON.stringify(baseline[table])]);
    }
    for (const file of ['20261030063949_nl_pilot_reviewed_presentation.sql', '20261030120602_catalog_integrity_presentation_guards.sql']) {
      await db.exec(readFileSync(new URL('../supabase/migrations/'+file, import.meta.url), 'utf8'));
    }
    await db.exec("insert into synthetic_ratings values (4873,9); insert into synthetic_progress values (9733,'reading');");
    const snapshot = async () => Promise.all(['authors','works','editions','catalog_work_descriptions','catalog_edition_metadata','synthetic_ratings','synthetic_progress'].map(async table =>
      (await db.query('select to_jsonb(t) as row from '+table+' t order by to_jsonb(t)::text')).rows));
    const getReceipt = results => results.find(result => result.rows?.[0]?.receipt).rows[0].receipt;
    const original = await snapshot();
    assert.equal(getReceipt(await db.exec(read('production-dry-run.sql'))).rows.length, 2);
    assert.deepEqual(await snapshot(), original);
    const first = getReceipt(await db.exec(read('production-apply.sql')));
    assert.equal(first.rows.length, 2);
    const applied = await snapshot();
    assert.equal(getReceipt(await db.exec(read('production-apply.sql'))).rows.length, 0);
    assert.deepEqual(await snapshot(), applied);
    const set = receipt => db.query("select set_config('lumiscore.catalog_release_receipt',$1,false)", [JSON.stringify(receipt)]);
    const wrong = structuredClone(first);
    wrong.rows[0].key.work_id = 8856;
    await set(wrong);
    await assert.rejects(db.exec(read('production-restore.sql')), /outside exact reviewed scope/);
    await db.exec('rollback');
    await set(first);
    await db.exec("update catalog_work_descriptions set text=text||' A later reviewed change.' where work_id=4873");
    await assert.rejects(db.exec(read('production-restore.sql')), /Later legitimate change/);
    await db.exec('rollback');
    await db.query('update catalog_work_descriptions set text=$1 where work_id=4873', [plan.actions[0].after.text]);
    await db.exec(read('production-restore.sql'));
    assert.deepEqual(await snapshot(), original);
  } finally {
    await db.close();
  }
});
