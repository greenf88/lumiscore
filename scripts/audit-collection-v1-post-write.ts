import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, unknown>;
type Fingerprint = { count: number; sha256: string };
type Plan = {
  version: string;
  baseline: Record<string, Fingerprint>;
  protectedBoundaries: { maxWorkId: number; maxAuthorId: number; maxEditionId: number };
  expectedAfter: { works: number; collections: number; memberships: number };
  expectedTotalCorrections: Array<{ collectionSlug: string; to: number }>;
  newWorkImports: Array<{ title: string; openLibraryWorkId: string }>;
  plannedMemberships: Array<{ collectionSlug: string; sequenceNumber: number; openLibraryWorkId: string; title: string }>;
};

async function loadAll(client: SupabaseClient, table: string): Promise<Row[]> {
  const result: Row[] = [];
  for (let from = 0; ; from += 1_000) {
    const { data, error } = await client.from(table).select('*').range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.code ?? 'unknown'} ${error.message}`);
    result.push(...((data ?? []) as unknown as Row[]));
    if ((data?.length ?? 0) < 1_000) return result;
  }
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Row)
      .sort(([a], [b]) => a.localeCompare(b, 'en'))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(rows: readonly Row[]): Fingerprint {
  return {
    count: rows.length,
    sha256: createHash('sha256').update(rows.map(canonical).sort().join('\n')).digest('hex'),
  };
}

function normalizeOl(value: unknown): string {
  return String(value ?? '').split('/').filter(Boolean).at(-1)?.toUpperCase() ?? '';
}

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Server-side Supabase environment is required.');
const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const plan = JSON.parse(await readFile(
  join(process.cwd(), 'catalog', 'collection-v1-final-frozen-plan.json'),
  'utf8',
)) as Plan;
if (plan.version !== 'collection_v1_final_frozen_plan_v1') throw new Error('Unexpected plan version.');

const names = ['works', 'authors', 'editions', 'ratings', 'user_book_status', 'collections', 'collection_books', 'work_trait_evidence'] as const;
const loaded = await Promise.all(names.map(async (name) => [name, await loadAll(client, name)] as const));
const tables = Object.fromEntries(loaded) as Record<(typeof names)[number], Row[]>;
const after = Object.fromEntries(loaded.map(([name, rows]) => [name, fingerprint(rows)]));
const protectedComparisons = {
  existingWorks: {
    before: plan.baseline.works,
    after: fingerprint(tables.works.filter((row) => Number(row.id) <= plan.protectedBoundaries.maxWorkId)),
  },
  existingAuthors: {
    before: plan.baseline.authors,
    after: fingerprint(tables.authors.filter((row) => Number(row.id) <= plan.protectedBoundaries.maxAuthorId)),
  },
  existingEditions: {
    before: plan.baseline.editions,
    after: fingerprint(tables.editions.filter((row) => Number(row.id) <= plan.protectedBoundaries.maxEditionId)),
  },
  ratings: { before: plan.baseline.ratings, after: after.ratings },
  userBookStatus: { before: plan.baseline.user_book_status, after: after.user_book_status },
  traitEvidence: { before: plan.baseline.work_trait_evidence, after: after.work_trait_evidence },
};
const protectedMismatches = Object.entries(protectedComparisons).filter(([, value]) =>
  value.before.count !== value.after.count || value.before.sha256 !== value.after.sha256);
if (protectedMismatches.length) throw new Error(`Protected data changed: ${JSON.stringify(protectedMismatches)}`);

if (
  tables.works.length !== plan.expectedAfter.works
  || tables.collections.length !== plan.expectedAfter.collections
  || tables.collection_books.length !== plan.expectedAfter.memberships
) throw new Error(`Unexpected final counts: ${JSON.stringify({ works: tables.works.length, collections: tables.collections.length, memberships: tables.collection_books.length })}`);

const workByOl = new Map(tables.works.map((row) => [normalizeOl(row.open_library_id), row]));
const importedWorks = plan.newWorkImports.map((planned) => {
  const work = workByOl.get(planned.openLibraryWorkId);
  if (!work) throw new Error(`Missing imported Work ${planned.openLibraryWorkId}.`);
  return { workId: Number(work.id), title: String(work.title), openLibraryWorkId: planned.openLibraryWorkId };
});
const collectionBySlug = new Map(tables.collections.map((row) => [String(row.slug), row]));
for (const correction of plan.expectedTotalCorrections) {
  if (Number(collectionBySlug.get(correction.collectionSlug)?.expected_main_series_total) !== correction.to) {
    throw new Error(`Total correction missing for ${correction.collectionSlug}.`);
  }
}
const membershipKeys = new Set(tables.collection_books.map((row) => `${row.collection_id}:${row.work_id}:${row.sequence_number}`));
for (const planned of plan.plannedMemberships) {
  const collection = collectionBySlug.get(planned.collectionSlug);
  const work = workByOl.get(planned.openLibraryWorkId);
  if (!collection || !work || !membershipKeys.has(`${collection.id}:${work.id}:${planned.sequenceNumber}`)) {
    throw new Error(`Missing planned membership ${planned.collectionSlug}:${planned.sequenceNumber}.`);
  }
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicate = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicate.add(value);
    seen.add(value);
  }
  return [...duplicate].sort();
}

const collectionIds = new Set(tables.collections.map((row) => Number(row.id)));
const workIds = new Set(tables.works.map((row) => Number(row.id)));
const seriesCollections = tables.collections.filter((row) => row.collection_type === 'series');
const completeness = seriesCollections.map((collection) => {
  const expected = Number(collection.expected_main_series_total);
  const positions = tables.collection_books
    .filter((row) => Number(row.collection_id) === Number(collection.id))
    .flatMap((row) => row.sequence_number === null ? [] : [Number(row.sequence_number)])
    .sort((left, right) => left - right);
  const missingPositions = Array.from({ length: expected }, (_, index) => index + 1)
    .filter((position) => !positions.includes(position));
  return {
    slug: String(collection.slug),
    expectedPublishedTotal: expected,
    membershipCount: positions.length,
    positions,
    missingPositions,
    impossibleDenominator: positions.some((position) => position > expected),
    completeToDate: expected > 0 && positions.length === expected && missingPositions.length === 0,
  };
});
const integrity = {
  duplicateMemberships: duplicates(tables.collection_books.map((row) => `${row.collection_id}:${row.work_id}`)),
  duplicatePositions: duplicates(tables.collection_books.flatMap((row) =>
    row.sequence_number === null ? [] : [`${row.collection_id}:${row.sequence_number}`])),
  orphanedMemberships: tables.collection_books.filter((row) =>
    !collectionIds.has(Number(row.collection_id)) || !workIds.has(Number(row.work_id))).length,
  impossibleDenominators: completeness.filter((row) => row.impossibleDenominator).map((row) => row.slug),
  missingPublishedPositions: completeness.reduce((total, row) => total + row.missingPositions.length, 0),
};
if (
  seriesCollections.length !== 57
  || completeness.filter((row) => row.completeToDate).length !== 57
  || integrity.duplicateMemberships.length
  || integrity.duplicatePositions.length
  || integrity.orphanedMemberships
  || integrity.impossibleDenominators.length
  || integrity.missingPublishedPositions
) throw new Error(`Final Collection integrity failed: ${JSON.stringify({ completeness, integrity })}`);

const report = {
  version: 'collection_v1_final_post_write_audit_v1',
  mode: 'READ_ONLY',
  generatedAt: new Date().toISOString(),
  productionWrites: 0,
  before: plan.baseline,
  after,
  protectedComparisons,
  protectedDataUnchanged: true,
  importedWorks,
  totals: plan.expectedTotalCorrections.map((row) => ({
    slug: row.collectionSlug,
    final: collectionBySlug.get(row.collectionSlug)?.expected_main_series_total,
  })),
  final: {
    works: tables.works.length,
    collections: tables.collections.length,
    numberedSeries: seriesCollections.length,
    memberships: tables.collection_books.length,
    completeToDate: completeness.filter((row) => row.completeToDate).length,
  },
  integrity,
  seriesCompleteness: completeness,
};
await writeFile(
  join(process.cwd(), 'catalog', 'collection-v1-final-post-write-audit.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
console.log(JSON.stringify(report, null, 2));
