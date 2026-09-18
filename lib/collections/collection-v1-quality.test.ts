import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

type Audit = {
  productionWrites: number;
  counts: {
    collections: number;
    seriesCollections: number;
    memberships: number;
    missingPublishedBooks: number;
  };
  collectionAudit: Array<{
    slug: string;
    type: string;
    positions: number[];
    currentPublishedMainSeriesTotal: number | null;
    missingPositions: number[];
    classification: string;
  }>;
  missingBooks: Array<{ collectionSlug: string; position: number; title: string }>;
  writeGate: { passed: boolean };
};

type FinalPlan = {
  productionWrites: number;
  writeGatePassed: boolean;
  scopeDecisions: { witcher: string; inheritanceGames: string };
  classification: {
    reviewedIdentities: number;
    high: number;
    alreadyPresent: number;
    unresolved: number;
    rejected: number;
    membershipOnly: number;
    newWorkImports: number;
    plannedMemberships: number;
  };
  expectedAfter: { works: number; collections: number; memberships: number };
  newWorkImports: Array<{ openLibraryWorkId: string; isbn13: string; title: string }>;
  seriesCompleteness: Array<{
    slug: string;
    currentlyPublishedMainSeriesTotal: number;
    positionsAfter: number[];
    missingPublishedPositionsAfter: number[];
    status: string;
  }>;
};

async function loadAudit(): Promise<Audit> {
  return JSON.parse(await readFile(
    new URL('../../catalog/collection-v1-quality-audit.json', import.meta.url),
    'utf8',
  )) as Audit;
}

async function loadFinalPlan(): Promise<FinalPlan> {
  return JSON.parse(await readFile(
    new URL('../../catalog/collection-v1-final-frozen-plan.json', import.meta.url),
    'utf8',
  )) as FinalPlan;
}

test('the frozen V1 audit covers every live collection and refuses unsafe writes', async () => {
  const audit = await loadAudit();
  assert.deepEqual(
    [audit.counts.collections, audit.counts.seriesCollections, audit.counts.memberships],
    [59, 57, 291],
  );
  assert.equal(audit.productionWrites, 0);
  assert.equal(audit.writeGate.passed, false);
  assert.equal(audit.counts.missingPublishedBooks, 31);
});

test('complete reviewed series are contiguous and every known gap has one explicit row', async () => {
  const audit = await loadAudit();
  for (const collection of audit.collectionAudit) {
    if (
      collection.type !== 'series' ||
      collection.classification !== 'COMPLETE NOW' ||
      collection.currentPublishedMainSeriesTotal === null
    ) continue;
    assert.deepEqual(
      collection.positions,
      Array.from(
        { length: collection.currentPublishedMainSeriesTotal },
        (_, index) => index + 1,
      ),
      collection.slug,
    );
  }

  const gapKeys = audit.collectionAudit.flatMap((collection) =>
    collection.missingPositions.map((position) => `${collection.slug}:${position}`));
  const rowKeys = audit.missingBooks.map(({ collectionSlug, position }) =>
    `${collectionSlug}:${position}`);
  assert.deepEqual([...new Set(rowKeys)].sort(), [...new Set(gapKeys)].sort());
  assert.equal(new Set(rowKeys).size, rowKeys.length);
});

test('the final frozen V1 plan resolves every reviewed identity without expanding scope', async () => {
  const plan = await loadFinalPlan();
  assert.equal(plan.productionWrites, 0);
  assert.equal(plan.writeGatePassed, true);
  assert.deepEqual(plan.classification, {
    reviewedIdentities: 31,
    high: 31,
    alreadyPresent: 3,
    unresolved: 0,
    rejected: 0,
    membershipOnly: 4,
    newWorkImports: 28,
    plannedMemberships: 32,
  });
  assert.deepEqual(plan.expectedAfter, { works: 2539, collections: 59, memberships: 323 });
  assert.match(plan.scopeDecisions.witcher, /position 9/);
  assert.match(plan.scopeDecisions.inheritanceGames, /four-book/);
});

test('all 57 numbered series are complete-to-date in the final plan', async () => {
  const plan = await loadFinalPlan();
  assert.equal(plan.seriesCompleteness.length, 57);
  for (const series of plan.seriesCompleteness) {
    assert.equal(series.status, 'COMPLETE_TO_DATE', series.slug);
    assert.deepEqual(series.missingPublishedPositionsAfter, [], series.slug);
    assert.deepEqual(
      series.positionsAfter,
      Array.from({ length: series.currentlyPublishedMainSeriesTotal }, (_, index) => index + 1),
      series.slug,
    );
  }
});

test('new V1 imports retain unique exact Work and ISBN identities', async () => {
  const plan = await loadFinalPlan();
  assert.equal(new Set(plan.newWorkImports.map((row) => row.openLibraryWorkId)).size, 28);
  assert.equal(new Set(plan.newWorkImports.map((row) => row.isbn13)).size, 28);
  assert.equal(
    plan.newWorkImports.find((row) => row.title === 'Heartstopper: Volume Six')?.openLibraryWorkId,
    'OL45345337W',
  );
});
