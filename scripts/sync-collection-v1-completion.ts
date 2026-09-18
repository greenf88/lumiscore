import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, unknown>;
type PlannedMembership = {
  collectionSlug: string;
  sequenceNumber: number;
  title: string;
  author: string;
  openLibraryWorkId: string;
  actualProductionWorkId: number | null;
};
type FrozenPlan = {
  version: string;
  mode: string;
  productionWrites: number;
  writeGatePassed: boolean;
  classification: { unresolved: number; plannedMemberships: number; newWorkImports: number };
  expectedAfter: { works: number; collections: number; memberships: number };
  expectedTotalCorrections: Array<{ collectionSlug: string; from: number; to: number }>;
  plannedMemberships: PlannedMembership[];
  seriesCompleteness: Array<{
    slug: string;
    currentlyPublishedMainSeriesTotal: number;
  }>;
};

const write = process.argv.includes('--write');
const allowPending = process.argv.includes('--simulate-pending-work-ids');
const confirmation = process.argv.find((arg) => arg.startsWith('--confirm='))?.slice(10);
if (write && confirmation !== 'collection-v1-complete') {
  throw new Error('Write mode requires --confirm=collection-v1-complete.');
}
if (write && allowPending) throw new Error('Pending Work IDs may only be simulated in dry-run mode.');

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Server-side Supabase environment is required.');
const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function loadAll(client: SupabaseClient, table: string, select = '*'): Promise<Row[]> {
  const result: Row[] = [];
  for (let from = 0; ; from += 1_000) {
    const { data, error } = await client.from(table).select(select).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.code ?? 'unknown'} ${error.message}`);
    result.push(...((data ?? []) as unknown as Row[]));
    if ((data?.length ?? 0) < 1_000) return result;
  }
}

function normalizeOlId(value: unknown): string {
  return String(value ?? '').split('/').filter(Boolean).at(-1)?.toUpperCase() ?? '';
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

const plan = JSON.parse(await readFile(
  join(process.cwd(), 'catalog', 'collection-v1-final-frozen-plan.json'),
  'utf8',
)) as FrozenPlan;
if (
  plan.version !== 'collection_v1_final_frozen_plan_v1'
  || plan.mode !== 'FROZEN_REVIEWED_WRITE_PLAN'
  || plan.productionWrites !== 0
  || !plan.writeGatePassed
  || plan.classification.unresolved !== 0
  || plan.classification.plannedMemberships !== 32
  || plan.classification.newWorkImports !== 28
  || plan.plannedMemberships.length !== 32
) throw new Error('Collection V1 frozen plan failed its exact scope guard.');

const [collections, currentMemberships, works] = await Promise.all([
  loadAll(client, 'collections', 'id,slug,name,collection_type,expected_main_series_total'),
  loadAll(client, 'collection_books', 'collection_id,work_id,sequence_number,publication_order,subgroup'),
  loadAll(client, 'works', 'id,title,open_library_id'),
]);
const collectionBySlug = new Map(collections.map((row) => [String(row.slug), row]));
const workByOlId = new Map(works.flatMap((row) => {
  const id = normalizeOlId(row.open_library_id);
  return id ? [[id, row] as const] : [];
}));
let syntheticId = Math.max(...works.map((row) => Number(row.id))) + 1;
const missingWorks: PlannedMembership[] = [];
const resolved = plan.plannedMemberships.map((planned) => {
  const work = planned.openLibraryWorkId
    ? workByOlId.get(normalizeOlId(planned.openLibraryWorkId))
    : works.find((row) => Number(row.id) === planned.actualProductionWorkId);
  if (!work) {
    missingWorks.push(planned);
    if (!allowPending) throw new Error(`Missing production Work for ${planned.title}.`);
    return { ...planned, workId: syntheticId++ };
  }
  return { ...planned, workId: Number(work.id) };
});

const invalidCollections = resolved.filter((row) => {
  const collection = collectionBySlug.get(row.collectionSlug);
  return !collection || collection.collection_type !== 'series';
});
if (invalidCollections.length) throw new Error(`Invalid Collection identities: ${JSON.stringify(invalidCollections)}`);
const plannedPositionDuplicates = duplicates(resolved.map((row) => `${row.collectionSlug}:${row.sequenceNumber}`));
const plannedWorkDuplicates = duplicates(resolved.map((row) => `${row.collectionSlug}:${row.workId}`));
if (plannedPositionDuplicates.length || plannedWorkDuplicates.length) {
  throw new Error(`Frozen plan duplicates: ${JSON.stringify({ plannedPositionDuplicates, plannedWorkDuplicates })}`);
}

const inserts: Array<Row> = [];
const alreadyPresent: Array<Row> = [];
const conflicts: Array<Row> = [];
for (const planned of resolved) {
  const collection = collectionBySlug.get(planned.collectionSlug)!;
  const rows = currentMemberships.filter((row) => Number(row.collection_id) === Number(collection.id));
  const exact = rows.find((row) =>
    Number(row.work_id) === planned.workId && Number(row.sequence_number) === planned.sequenceNumber);
  if (exact) {
    alreadyPresent.push(planned);
    continue;
  }
  const conflicting = rows.find((row) =>
    Number(row.work_id) === planned.workId || Number(row.sequence_number) === planned.sequenceNumber);
  if (conflicting) {
    conflicts.push({ planned, conflicting });
    continue;
  }
  inserts.push({
    collection_id: collection.id,
    work_id: planned.workId,
    sequence_number: planned.sequenceNumber,
    publication_order: planned.sequenceNumber,
    subgroup: null,
  });
}

const totalUpdates: Array<{ id: number; slug: string; to: number }> = [];
const totalsAlreadyApplied: string[] = [];
const totalConflicts: Row[] = [];
for (const correction of plan.expectedTotalCorrections) {
  const collection = collectionBySlug.get(correction.collectionSlug);
  if (!collection) throw new Error(`Missing Collection ${correction.collectionSlug}.`);
  const current = Number(collection.expected_main_series_total);
  if (current === correction.from) totalUpdates.push({ id: Number(collection.id), slug: correction.collectionSlug, to: correction.to });
  else if (current === correction.to) totalsAlreadyApplied.push(correction.collectionSlug);
  else totalConflicts.push({ correction, current });
}

const preState = inserts.length === 32 && alreadyPresent.length === 0 && totalUpdates.length === 3;
const appliedState = inserts.length === 0 && alreadyPresent.length === 32 && totalUpdates.length === 0 && totalsAlreadyApplied.length === 3;
if (conflicts.length || totalConflicts.length || (!preState && !appliedState)) {
  throw new Error(`Collection V1 sync state is unsafe: ${JSON.stringify({ inserts: inserts.length, alreadyPresent: alreadyPresent.length, conflicts, totalUpdates, totalsAlreadyApplied, totalConflicts })}`);
}

const simulatedMemberships = [...currentMemberships, ...inserts];
const totals = new Map(collections.map((row) => [String(row.slug), row.expected_main_series_total === null ? null : Number(row.expected_main_series_total)]));
for (const update of totalUpdates) totals.set(update.slug, update.to);
const completeness = plan.seriesCompleteness.map((planned) => {
  const collection = collectionBySlug.get(planned.slug)!;
  const expected = totals.get(planned.slug);
  const positions = simulatedMemberships
    .filter((row) => Number(row.collection_id) === Number(collection.id))
    .map((row) => Number(row.sequence_number))
    .sort((left, right) => left - right);
  const missing = Array.from({ length: expected ?? 0 }, (_, index) => index + 1)
    .filter((position) => !positions.includes(position));
  return { slug: planned.slug, expected, positions, missing, complete: expected !== null && positions.length === expected && missing.length === 0 };
});
const incomplete = completeness.filter((row) => !row.complete);
const globalDuplicatePositions = duplicates(simulatedMemberships.flatMap((row) =>
  row.sequence_number === null ? [] : [`${row.collection_id}:${row.sequence_number}`]));
const globalDuplicateMemberships = duplicates(simulatedMemberships.map((row) => `${row.collection_id}:${row.work_id}`));
if (incomplete.length || globalDuplicatePositions.length || globalDuplicateMemberships.length) {
  throw new Error(`Post-sync simulation failed: ${JSON.stringify({ incomplete, globalDuplicatePositions, globalDuplicateMemberships })}`);
}

const summary = {
  mode: write ? 'WRITE' : 'DRY_RUN',
  productionState: preState ? 'EXACT_PRE_SYNC' : 'FULLY_APPLIED',
  pendingWorkIdsSimulated: missingWorks.length,
  before: { collections: collections.length, memberships: currentMemberships.length, works: works.length },
  changes: { inserts: inserts.length, alreadyPresent: alreadyPresent.length, totalUpdates: totalUpdates.length, deletes: 0, conflicts: 0 },
  after: { collections: collections.length, memberships: simulatedMemberships.length, works: works.length + (allowPending ? missingWorks.length : 0) },
  completeToDate: completeness.length,
  missingPublishedPositions: 0,
  secondRun: { inserts: 0, alreadyPresent: 32, totalUpdates: 0, conflicts: 0 },
  productionWrites: 0,
};

if (write && preState) {
  const { error: insertError } = await client.from('collection_books').insert(inserts);
  if (insertError) throw insertError;
  for (const update of totalUpdates) {
    const { error } = await client.from('collections')
      .update({ expected_main_series_total: update.to })
      .eq('id', update.id)
      .eq('expected_main_series_total', plan.expectedTotalCorrections.find((row) => row.collectionSlug === update.slug)!.from);
    if (error) throw error;
  }
  summary.productionWrites = inserts.length + totalUpdates.length;
}

console.log(JSON.stringify(summary, null, 2));
