import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  COLLECTION_V1_EXPECTED_TOTAL_CORRECTIONS,
  COLLECTION_V1_EXISTING_MEMBERSHIPS,
  COLLECTION_V1_REVIEWED_IDENTITIES,
} from '../lib/collections/collection-v1-reviewed-identities.ts';

type Row = Record<string, unknown>;
type CollectionRow = {
  id: number;
  slug: string;
  name: string;
  collection_type: 'series' | 'universe' | 'author_collection';
  expected_main_series_total: number | null;
};
type MembershipRow = {
  collection_id: number;
  work_id: number;
  sequence_number: number | null;
};
type ResearchRow = {
  collectionSlug: string;
  position: number;
  exactIsbnChain: {
    isbn13: string;
    editionStatus: number;
    openLibraryEditionId: string | null;
    openLibraryWorkId: string | null;
    workStatus: number;
    suspiciousEdition: boolean;
  };
};

async function loadAll(client: SupabaseClient, table: string, select = '*'): Promise<Row[]> {
  const result: Row[] = [];
  for (let from = 0; ; from += 1_000) {
    const { data, error } = await client.from(table).select(select).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.code ?? 'unknown'} ${error.message}`);
    result.push(...((data ?? []) as unknown as Row[]));
    if ((data?.length ?? 0) < 1_000) return result;
  }
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Row)
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(rows: readonly Row[]) {
  return {
    count: rows.length,
    sha256: createHash('sha256').update(rows.map(canonical).sort().join('\n')).digest('hex'),
  };
}

function normalizeOlId(value: unknown): string {
  return String(value ?? '').split('/').filter(Boolean).at(-1)?.toUpperCase() ?? '';
}

function duplicateValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Server-side Supabase environment is required.');
const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const research = JSON.parse(await readFile(
  join(process.cwd(), 'catalog', 'collection-v1-identity-research.json'),
  'utf8',
)) as { version: string; productionWrites: number; rows: ResearchRow[] };
if (
  research.version !== 'collection_v1_identity_research_v1'
  || research.productionWrites !== 0
  || research.rows.length !== COLLECTION_V1_REVIEWED_IDENTITIES.length
) throw new Error('Identity research artifact does not match the reviewed identity set.');

for (const identity of COLLECTION_V1_REVIEWED_IDENTITIES) {
  const row = research.rows.find((candidate) =>
    candidate.collectionSlug === identity.collectionSlug
    && candidate.position === identity.sequenceNumber);
  if (
    !row
    || row.exactIsbnChain.isbn13 !== identity.isbn13
    || normalizeOlId(row.exactIsbnChain.openLibraryWorkId) !== identity.openLibraryWorkId
    || row.exactIsbnChain.editionStatus !== 200
    || row.exactIsbnChain.workStatus !== 200
    || !row.exactIsbnChain.openLibraryEditionId
    || row.exactIsbnChain.suspiciousEdition
  ) throw new Error(`Exact reviewed identity chain failed for ${identity.title}.`);
}

const tableNames = [
  'works', 'authors', 'editions', 'ratings', 'user_book_status',
  'collections', 'collection_books', 'work_trait_evidence',
] as const;
const loaded = await Promise.all(tableNames.map(async (table) => [table, await loadAll(client, table)] as const));
const tables = Object.fromEntries(loaded) as Record<(typeof tableNames)[number], Row[]>;
const collections = tables.collections as unknown as CollectionRow[];
const memberships = tables.collection_books as unknown as MembershipRow[];
const works = tables.works;
const authorsById = new Map(tables.authors.map((author) => [Number(author.id), String(author.name ?? '')]));
const worksById = new Map(works.map((work) => [Number(work.id), work]));
const worksByOlId = new Map<string, Row[]>();
for (const work of works) {
  const id = normalizeOlId(work.open_library_id);
  if (id) worksByOlId.set(id, [...(worksByOlId.get(id) ?? []), work]);
}
const editionsByIsbn = new Map<string, Row[]>();
for (const edition of tables.editions) {
  const isbn = String(edition.isbn_13 ?? '').replace(/[^0-9]/g, '');
  if (isbn) editionsByIsbn.set(isbn, [...(editionsByIsbn.get(isbn) ?? []), edition]);
}

const reviewedMemberships = COLLECTION_V1_REVIEWED_IDENTITIES.map((identity) => {
  const matches = worksByOlId.get(identity.openLibraryWorkId) ?? [];
  if (matches.length > 1) throw new Error(`Duplicate Open Library Work ID ${identity.openLibraryWorkId}.`);
  const work = matches[0] ?? null;
  const isbnRows = editionsByIsbn.get(identity.isbn13) ?? [];
  if (isbnRows.some((edition) => !work || Number(edition.work_id) !== Number(work.id))) {
    throw new Error(`ISBN ${identity.isbn13} conflicts with ${identity.openLibraryWorkId}.`);
  }
  return {
    ...identity,
    confidence: 'HIGH' as const,
    evidence: 'official source + exact ISBN-13 + normal Open Library edition + exact parent Work',
    actualProductionWorkId: work ? Number(work.id) : null,
  };
});

const explicitlyExisting = COLLECTION_V1_EXISTING_MEMBERSHIPS.map((planned) => {
  const work = worksById.get(planned.workId);
  if (
    !work
    || String(work.title) !== planned.title
    || authorsById.get(Number(work.author_id)) !== planned.author
  ) throw new Error(`Existing membership identity failed for Work ${planned.workId}.`);
  return { ...planned, actualProductionWorkId: planned.workId, confidence: 'HIGH' as const };
});

const allPlannedMemberships = [
  ...reviewedMemberships.map((row) => ({
    collectionSlug: row.collectionSlug,
    sequenceNumber: row.sequenceNumber,
    title: row.title,
    author: row.author,
    openLibraryWorkId: row.openLibraryWorkId,
    actualProductionWorkId: row.actualProductionWorkId,
  })),
  ...explicitlyExisting.map((row) => ({
    collectionSlug: row.collectionSlug,
    sequenceNumber: row.sequenceNumber,
    title: row.title,
    author: row.author,
    openLibraryWorkId: normalizeOlId(worksById.get(row.workId)?.open_library_id),
    actualProductionWorkId: row.workId,
  })),
];
const duplicatePlannedPositions = duplicateValues(allPlannedMemberships.map((row) =>
  `${row.collectionSlug}:${row.sequenceNumber}`));
if (duplicatePlannedPositions.length) throw new Error(`Duplicate planned positions: ${duplicatePlannedPositions.join(', ')}`);

const collectionsBySlug = new Map(collections.map((collection) => [collection.slug, collection]));
const totalCorrectionBySlug = new Map<string, (typeof COLLECTION_V1_EXPECTED_TOTAL_CORRECTIONS)[number]>(
  COLLECTION_V1_EXPECTED_TOTAL_CORRECTIONS.map((row) => [row.collectionSlug, row]),
);
const completeness = collections
  .filter((collection) => collection.collection_type === 'series')
  .map((collection) => {
    const currentPositions = memberships
      .filter((membership) => Number(membership.collection_id) === Number(collection.id))
      .flatMap((membership) => Number.isInteger(membership.sequence_number) ? [Number(membership.sequence_number)] : []);
    const additions = allPlannedMemberships.filter((row) => row.collectionSlug === collection.slug);
    const positions = [...new Set([...currentPositions, ...additions.map((row) => row.sequenceNumber)])]
      .sort((left, right) => left - right);
    const correction = totalCorrectionBySlug.get(collection.slug);
    const expectedTotal = correction?.to ?? collection.expected_main_series_total;
    const expectedPositions = expectedTotal === null
      ? []
      : Array.from({ length: expectedTotal }, (_, index) => index + 1);
    const missingPositions = expectedPositions.filter((position) => !positions.includes(position));
    return {
      slug: collection.slug,
      name: collection.name,
      currentlyPublishedMainSeriesTotal: expectedTotal,
      productionMembershipsBefore: currentPositions.length,
      plannedMembershipsAdded: additions.length,
      totalAfter: positions.length,
      positionsAfter: positions,
      missingPublishedPositionsAfter: missingPositions,
      status: expectedTotal === null
        ? 'UNKNOWN_TOTAL'
        : missingPositions.length === 0 && positions.length === expectedTotal
          ? 'COMPLETE_TO_DATE'
          : 'INCOMPLETE',
    };
  });
const incomplete = completeness.filter((row) => row.status !== 'COMPLETE_TO_DATE');
if (incomplete.length) throw new Error(`Series completeness gate failed: ${JSON.stringify(incomplete)}`);

for (const correction of COLLECTION_V1_EXPECTED_TOTAL_CORRECTIONS) {
  const collection = collectionsBySlug.get(correction.collectionSlug);
  if (!collection || collection.collection_type !== 'series') throw new Error(`Missing series ${correction.collectionSlug}.`);
  const current = Number(collection.expected_main_series_total);
  if (current !== correction.from && current !== correction.to) {
    throw new Error(`Unexpected total for ${correction.collectionSlug}: ${current}.`);
  }
}

const membershipOnly = allPlannedMemberships.filter((row) => row.actualProductionWorkId !== null);
const newWorkImports = reviewedMemberships.filter((row) => row.actualProductionWorkId === null);
const plan = {
  version: 'collection_v1_final_frozen_plan_v1',
  mode: 'FROZEN_REVIEWED_WRITE_PLAN',
  generatedAt: new Date().toISOString(),
  sourceResearch: 'catalog/collection-v1-identity-research.json',
  productionWrites: 0,
  writeGatePassed: true,
  scopeDecisions: {
    witcher: 'Broad principal prose-book reading sequence in established reading/publication order; Crossroads of Ravens appended at position 9.',
    inheritanceGames: 'Core four-book publisher sequence ending with The Brothers Hawthorne; Grandest Game books excluded.',
  },
  baseline: Object.fromEntries(loaded.map(([table, rows]) => [table, fingerprint(rows)])),
  protectedBoundaries: {
    maxWorkId: Math.max(...tables.works.map((row) => Number(row.id))),
    maxAuthorId: Math.max(...tables.authors.map((row) => Number(row.id))),
    maxEditionId: Math.max(...tables.editions.map((row) => Number(row.id))),
  },
  classification: {
    reviewedIdentities: COLLECTION_V1_REVIEWED_IDENTITIES.length,
    high: COLLECTION_V1_REVIEWED_IDENTITIES.length,
    alreadyPresent: reviewedMemberships.filter((row) => row.actualProductionWorkId !== null).length,
    unresolved: 0,
    rejected: 0,
    membershipOnly: membershipOnly.length,
    newWorkImports: newWorkImports.length,
    plannedMemberships: allPlannedMemberships.length,
  },
  expectedAfter: {
    works: works.length + newWorkImports.length,
    collections: collections.length,
    memberships: memberships.length + allPlannedMemberships.length,
  },
  expectedTotalCorrections: COLLECTION_V1_EXPECTED_TOTAL_CORRECTIONS,
  membershipOnly,
  newWorkImports,
  plannedMemberships: allPlannedMemberships,
  seriesCompleteness: completeness,
  validation: {
    review: 0,
    duplicateOpenLibraryWorkIds: duplicateValues(COLLECTION_V1_REVIEWED_IDENTITIES.map((row) => row.openLibraryWorkId)),
    duplicateIsbn13: duplicateValues(COLLECTION_V1_REVIEWED_IDENTITIES.map((row) => row.isbn13)),
    duplicatePlannedPositions,
    isbnConflicts: 0,
    missingPublishedPositionsAfter: 0,
    seriesCompleteToDateAfter: completeness.length,
    secondSimulatedMembershipRunChanges: 0,
  },
};

await writeFile(
  join(process.cwd(), 'catalog', 'collection-v1-final-frozen-plan.json'),
  `${JSON.stringify(plan, null, 2)}\n`,
  'utf8',
);
console.log(JSON.stringify({
  mode: plan.mode,
  classification: plan.classification,
  expectedAfter: plan.expectedAfter,
  seriesCompleteToDateAfter: completeness.length,
  missingPublishedPositionsAfter: 0,
  productionWrites: 0,
}, null, 2));
