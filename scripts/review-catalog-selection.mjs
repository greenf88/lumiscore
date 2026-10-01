// Read-only reconciliation of every CSV cell and every proposed year change.
// Output is a review report, never an import or a bibliographic UPDATE plan.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readCsv, buildPlan, digest } from './catalog-selection-core.mjs';
import { inputs } from './catalog-selection-local.mjs';
import model from '../lib/catalog/categories.json' with { type: 'json' };
import { refuseLegacyRewrite } from './catalog-selection-inputs.mjs';

const directory = new URL('../catalog/selection-v1/', import.meta.url);
const bytes = name => fs.readFile(new URL(name, directory));
const originalBytes = await bytes('lumiscore-catalogusselectie-v1.original.csv');
const correctedBytes = await bytes('lumiscore-catalogusselectie-v1.corrected.csv');
const original = readCsv(originalBytes.toString('utf8'));
const corrected = readCsv(correctedBytes.toString('utf8'));
const changes = readCsv((await bytes('changes.csv')).toString('utf8'));
// This historical CSV reconciliation deliberately reads the frozen V1 records.
const { works, pins } = await inputs();
const records = JSON.parse(await bytes('reviewed-records.json'));
const plan = buildPlan(records, works, pins);
const proposed = JSON.parse(await bytes('proposed-import-plan.json'));
assert.deepEqual(plan, proposed);
assert.equal(original.length, 1000);
assert.equal(corrected.length, 1000);
const byId = new Map(original.map(r => [r['kandidaat-ID'], r]));
const changeMap = new Map(changes.map(c => [c['kandidaat-ID'] + ':' + c.veld, c]));
assert.equal(changeMap.size, changes.length);
const derivedChanges = {};
for (const [index, row] of corrected.entries()) {
  const id = row['kandidaat-ID'], old = byId.get(id), record = records[index];
  assert.ok(old);
  assert.equal(record.candidate_id, id);
  assert.equal(record.title, row.titel);
  assert.equal(record.author, row.auteur);
  assert.equal(record.year, row['oorspronkelijke publicatiejaar'] ? Number(row['oorspronkelijke publicatiejaar']) : null);
  assert.equal(record.existing_work_id, Number(row['bestaande LumiScore Work-ID']) || null);
  assert.equal(record.status, row.classificatiestatus);
  assert.equal(record.form, row.werkvorm);
  assert.equal(record.audience, row.doelgroep);
  assert.equal(model.categories.find(c => c.id === record.categories[0]).nl, row['hoofdcategorie NL']);
  assert.equal(model.categories.find(c => c.id === record.categories[0]).en, row['hoofdcategorie EN']);
  assert.equal(record.categories.slice(1).map(id => model.categories.find(c => c.id === id).nl).join('; '), row['aanvullende genres']);
  for (const [field, value] of Object.entries(row)) {
    const change = changeMap.get(id + ':' + field);
    if (change) {
      assert.equal(change.oud, old[field]); assert.equal(change.nieuw, value); assert.ok(change.reden);
    } else if (value !== old[field]) {
      assert.ok(['bron-URL’s', 'korte twijfel- of correctienotitie'].includes(field), `Unlogged ${id}:${field}`);
      derivedChanges[field] = (derivedChanges[field] ?? 0) + 1;
    }
  }
}
const years = changes.filter(c => c.veld === 'oorspronkelijke publicatiejaar').map(c => {
  const action = plan.actions.find(a => a.candidate_id === c['kandidaat-ID']);
  const current = works.find(w => w.id === action.work_id);
  return { candidate_id: action.candidate_id, action: action.kind,
    input_year: c.oud, reviewed_year: c.nieuw || null,
    work_id: action.work_id, existing_database_year: current?.first_publish_year ?? null,
    new_work_insert_year: action.kind === 'insert' ? Number(c.nieuw) || null : null,
    existing_database_update: false };
});
assert.equal(years.length, 221);
const yearGroups = Object.fromEntries(['link', 'insert', 'skip'].map(kind => [kind, years.filter(y => y.action === kind).length]));
const report = {
  reviewed_commit: 'a79cf84692b49c95cc8319e8056cd30e512f0e7a',
  original_sha256: createHash('sha256').update(originalBytes).digest('hex'),
  corrected_sha256: createHash('sha256').update(correctedBytes).digest('hex'),
  reviewed_records_semantic_sha256: digest(records),
  counts: plan.counts,
  category_links: records.reduce((n, r, i) => n + (plan.actions[i].kind === 'skip' ? 0 : r.categories.length), 0),
  changed_years: yearGroups,
  existing_bibliographic_updates: [],
  derived_note_and_source_changes_not_in_field_log: derivedChanges,
  years,
  new_work_years: plan.actions.filter(a => a.kind === 'insert').map(a => {
    const r = records.find(r => r.candidate_id === a.candidate_id);
    return { candidate_id: r.candidate_id, title: r.title, year: r.year, basis: r.year_basis };
  }),
  // Non-authorizing proposals. These must NOT be consumed by the importer.
  deferred_existing_year_differences: plan.actions.filter(a => a.kind === 'link').flatMap(a => {
    const r = records.find(r => r.candidate_id === a.candidate_id), w = works.find(w => w.id === a.work_id);
    return r.year !== w.first_publish_year ? [{ candidate_id: r.candidate_id, work_id: w.id,
      current: w.first_publish_year, proposed: r.year, basis: r.year_basis, approved: false }] : [];
  }),
  exclusions: plan.actions.filter(a => a.kind === 'skip'),
};
if (process.argv.includes('--write-report')) {
  await refuseLegacyRewrite();
  await fs.writeFile(new URL('REVIEW-DATA.json', directory), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ ...report, years: undefined, new_work_years: undefined,
  deferred_existing_year_differences: report.deferred_existing_year_differences.length,
  exclusions: report.exclusions.map(r => r.candidate_id),
  changed_new_work_years: years.filter(r => r.action === 'insert'),
}, null, 2));
