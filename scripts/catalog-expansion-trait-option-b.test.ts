import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildEffectiveWorkTraitVector } from '../lib/recommendations/work-trait-evidence.ts';

type Row = {
  work_id: number;
  source_work_id: string;
  trait: string;
  source: string;
  evidence_basis: string;
  isbn13: string;
  source_key: string;
  source_identifier: string;
  confidence: number;
  weight: number;
  provenance: { exact_isbn13?: string };
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function loadPlan() {
  const bytes = await readFile(
    new URL('../test/fixtures/catalog-expansion-option-b.contract.json', import.meta.url),
  );
  assert.equal(createHash('sha256').update(bytes).digest('hex'),
    'ca482c7999f44f6be8af67723efaa49caafe535a4ee5e7ebee076280bdc89492');
  const plan = JSON.parse(bytes.toString('utf8'));
  assert.equal(plan.fixtureKind, 'historical-public-review-contract');
  assert.equal(plan.productionExecution, false);
  assert.equal(plan.sourceByteSha256,
    '3aff38e83dadf41fa9ee4a9f3b40a3dcdb393830d6343d45534ed9a3e62a4c2c');
  // Pin the original reviewed rows independently of the fixture's self-reported hash.
  assert.equal(plan.rowsSha256,
    'eaab592ae6079a10fcc3a8d1f5895299fad31e20d469344746d88d72c05bf192');
  return plan;
}

test('strict Option B plan contains only the five approved exact-ISBN nonfiction rows', async () => {
  const plan = await loadPlan() as {
    mode: string;
    explicitlyUnusedPlan: string;
    scope: { rowCount: number; targetWorkIds: number[] };
    rows: Row[];
    rowsSha256: string;
  };
  const expected = new Map([
    [1341, '9781401971373'],
    [1401, '9780822203070'],
    [1442, '9781607749165'],
    [1533, '9789021566665'],
    [1908, '9781668067246'],
  ]);

  assert.equal(plan.mode, 'APPROVED_STRICT_OPTION_B');
  assert.equal(plan.explicitlyUnusedPlan, 'catalog/catalog-expansion-trait-enrichment-write-plan.json');
  assert.equal(plan.scope.rowCount, 5);
  assert.deepEqual(plan.scope.targetWorkIds, [...expected.keys()]);
  assert.equal(plan.rows.length, 5);
  assert.equal(
    createHash('sha256').update(canonical(plan.rows)).digest('hex'),
    plan.rowsSha256,
  );
  for (const row of plan.rows) {
    const isbn13 = expected.get(row.work_id);
    assert.equal(row.trait, 'nonfiction');
    assert.equal(row.source, 'google_books');
    assert.equal(row.evidence_basis, 'exact_isbn_13');
    assert.equal(row.isbn13, isbn13);
    assert.equal(row.source_key, isbn13);
    assert.equal(row.source_identifier, `isbn:${isbn13}`);
    assert.equal(row.provenance.exact_isbn13, isbn13);
    assert.equal(row.confidence, .75);
    assert.equal(row.weight, 1);
  }
  assert.equal(plan.rows.some(({ source }) => source === 'publication_year'), false);
});

test('all five strict Option B works remain PARTIAL without era evidence', async () => {
  const plan = await loadPlan() as {
    rows: Array<Row & { raw_labels: string[]; mapping_version: string; verified_at: string }>;
  };

  assert.equal(plan.rows.length, 5);
  for (const row of plan.rows) {
    const effective = buildEffectiveWorkTraitVector([{
      workId: String(row.work_id),
      trait: 'nonfiction',
      weight: row.weight,
      confidence: row.confidence,
      source: 'google_books',
      sourceKey: row.source_key,
      rawLabels: row.raw_labels,
      mappingVersion: row.mapping_version,
      verifiedAt: row.verified_at,
    }]);
    assert.equal(effective.coverageLevel, 'partial', `work ${row.work_id}`);
    assert.equal(effective.traits.classic, 0, `work ${row.work_id}`);
    assert.equal(effective.traits.contemporary, 0, `work ${row.work_id}`);
  }
});
