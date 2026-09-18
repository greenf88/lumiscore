import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  SUZANNE_VERMEER_AUTHOR,
  SUZANNE_VERMEER_COVER_REPAIRS,
  SUZANNE_VERMEER_EXCLUSIONS,
  SUZANNE_VERMEER_REVIEWED_IDENTITIES,
} from '../lib/catalog/suzanne-vermeer-reviewed-identities.ts';
import { getNativeWorkIdentityKey } from './lumiscore-native-import.ts';

type Row = Record<string, unknown>;
type Fingerprint = { count: number; sha256: string };
type FrozenPlan = {
  version: 'suzanne_vermeer_catalog_frozen_plan_v1';
  writeGatePassed: true;
  productionWrites: 0;
  baseline: Record<string, Fingerprint>;
  protected: Record<string, Fingerprint>;
  expectedAfter: Record<string, number>;
  completeOfficialTitleList: Array<{
    title: string;
    originalPublicationDate: string;
    representativeIsbn13: string;
    expectedProductionWorkId: number | null;
  }>;
};

const write = process.argv.includes('--write');
const inspect = process.argv.includes('--inspect');
const confirmation = process.argv.find((value) => value.startsWith('--confirm='))?.slice(10);
if (write && confirmation !== 'suzanne-vermeer-reviewed-54') {
  throw new Error('Write mode requires --confirm=suzanne-vermeer-reviewed-54.');
}

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Server-side Supabase environment is required.');
const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const TABLES = [
  'works', 'authors', 'editions', 'ratings', 'user_book_status', 'collections',
  'collection_books', 'work_trait_evidence', 'work_cover_resolutions',
] as const;

const WORK_REPAIRS = [
  { id: 1220, fromTitle: 'All-Inclusive', toTitle: 'All-inclusive', fromYear: 2006, toYear: 2006 },
  { id: 1221, fromTitle: 'De vlucht', toTitle: 'De vlucht', fromYear: 2008, toYear: 2007 },
  { id: 1225, fromTitle: 'De Suite', toTitle: 'De suite', fromYear: 2010, toYear: 2010 },
  { id: 1227, fromTitle: 'Bella Italia', toTitle: 'Bella Italia', fromYear: 2012, toYear: 2011 },
  { id: 1229, fromTitle: 'Noorderlicht', toTitle: 'Noorderlicht', fromYear: 2013, toYear: 2012 },
  { id: 1241, fromTitle: 'Winternacht', toTitle: 'Winternacht', fromYear: 2018, toYear: 2017 },
  { id: 1245, fromTitle: 'Flamingo beach', toTitle: 'Flamingo Beach', fromYear: 2024, toYear: 2024 },
] as const;
const REPAIRED_WORK_IDS = new Set<number>(WORK_REPAIRS.map(({ id }) => id));
const EXISTING_REVIEWED_WORK_IDS = new Set(SUZANNE_VERMEER_REVIEWED_IDENTITIES
  .flatMap(({ expectedProductionWorkId }) => expectedProductionWorkId === null ? [] : [expectedProductionWorkId]));
const FESTIVAL_WORK_ID = 1296;
const COLLECTION_SLUG = 'suzanne-vermeer';
const ALL_COVER_REPAIRS = [
  ...SUZANNE_VERMEER_COVER_REPAIRS.map(([title, isbn13, coverUrl]) => ({ title, isbn13, coverUrl })),
  { title: 'Winterberg', isbn13: '9789400517905', coverUrl: 'https://boekboek.s3.eu-central-003.backblazeb2.com/BRBR/p/9789400517905/vdh9789400517905.png' },
  { title: 'De eilanden', isbn13: '9789400517813', coverUrl: 'https://boekboek.s3.eu-central-003.backblazeb2.com/BRBR/p/9789400517813/vdh9789400517813.png' },
] as const;

async function loadAll(table: string, select = '*'): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += 1_000) {
    const { data, error } = await client.from(table).select(select).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.code ?? 'unknown'} ${error.message}`);
    rows.push(...((data ?? []) as unknown as Row[]));
    if ((data?.length ?? 0) < 1_000) return rows;
  }
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Row)
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([name, nested]) => `${JSON.stringify(name)}:${canonical(nested)}`)
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

function sameFingerprint(left: Fingerprint | undefined, right: Fingerprint): boolean {
  return Boolean(left && left.count === right.count && left.sha256 === right.sha256);
}

function normalizeTitle(value: unknown): string {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('nl-NL').replace(/[^a-z0-9]+/g, ' ').trim();
}

function protectedState(tables: Record<string, Row[]>, authorId: number, collectionId: number) {
  const authorWorkIds = new Set(tables.works
    .filter((row) => Number(row.author_id) === authorId)
    .map((row) => Number(row.id)));
  const coverWorkIds = new Set(ALL_COVER_REPAIRS.flatMap(({ title }) => {
    const row = tables.works.find((work) => Number(work.author_id) === authorId && normalizeTitle(work.title) === normalizeTitle(title));
    return row ? [Number(row.id)] : [];
  }));
  return {
    nonSuzanneWorks: fingerprint(tables.works.filter((row) => Number(row.author_id) !== authorId)),
    existingSuzanneUntouchedWorks: fingerprint(tables.works.filter((row) =>
      Number(row.author_id) === authorId
      && EXISTING_REVIEWED_WORK_IDS.has(Number(row.id))
      && !REPAIRED_WORK_IDS.has(Number(row.id)))),
    authors: fingerprint(tables.authors),
    editionsOutsideScope: fingerprint(tables.editions.filter((row) =>
      !authorWorkIds.has(Number(row.work_id))
      || (EXISTING_REVIEWED_WORK_IDS.has(Number(row.work_id)) && Number(row.work_id) !== FESTIVAL_WORK_ID))),
    ratings: fingerprint(tables.ratings),
    userBookStatus: fingerprint(tables.user_book_status),
    traitEvidence: fingerprint(tables.work_trait_evidence),
    otherCollections: fingerprint(tables.collections.filter((row) => Number(row.id) !== collectionId)),
    otherMemberships: fingerprint(tables.collection_books.filter((row) => Number(row.collection_id) !== collectionId)),
    coversOutsideScope: fingerprint(tables.work_cover_resolutions.filter((row) => !coverWorkIds.has(Number(row.work_id)))),
  };
}

async function loadState() {
  const loaded = await Promise.all(TABLES.map(async (table) => [table, await loadAll(table)] as const));
  const tables = Object.fromEntries(loaded) as Record<(typeof TABLES)[number], Row[]> & Record<string, Row[]>;
  const authors = tables.authors.filter((row) => normalizeTitle(row.name) === normalizeTitle(SUZANNE_VERMEER_AUTHOR.name));
  if (authors.length !== 1) throw new Error(`Expected one canonical Suzanne Vermeer author, found ${authors.length}.`);
  const author = authors[0];
  if (Number(author.id) !== SUZANNE_VERMEER_AUTHOR.productionAuthorId) {
    throw new Error(`Canonical author ID changed: ${String(author.id)}.`);
  }
  const collections = tables.collections.filter((row) => row.slug === COLLECTION_SLUG);
  if (collections.length !== 1 || collections[0].collection_type !== 'author_collection') {
    throw new Error('Expected one existing Suzanne Vermeer author_collection.');
  }
  const collection = collections[0];
  return {
    tables,
    author,
    collection,
    baseline: Object.fromEntries(loaded.map(([table, rows]) => [table, fingerprint(rows)])),
    protected: protectedState(tables, Number(author.id), Number(collection.id)),
  };
}

function findReviewedWork(tables: Record<string, Row[]>, authorId: number, title: string): Row | null {
  const matches = tables.works.filter((row) =>
    Number(row.author_id) === authorId && normalizeTitle(row.title) === normalizeTitle(title));
  if (matches.length > 1) throw new Error(`Duplicate Suzanne Vermeer work identity: ${title}.`);
  return matches[0] ?? null;
}

function validateAndPlan(state: Awaited<ReturnType<typeof loadState>>) {
  const authorId = Number(state.author.id);
  const collectionId = Number(state.collection.id);
  const worksByTitle = new Map<string, Row>();
  for (const identity of SUZANNE_VERMEER_REVIEWED_IDENTITIES) {
    const work = findReviewedWork(state.tables, authorId, identity.title);
    if (work) worksByTitle.set(identity.title, work);
  }
  const currentSuzanneWorks = state.tables.works.filter((row) => Number(row.author_id) === authorId);
  const unknownWorks = currentSuzanneWorks.filter((row) =>
    !SUZANNE_VERMEER_REVIEWED_IDENTITIES.some(({ title }) => normalizeTitle(title) === normalizeTitle(row.title)));
  if (unknownWorks.length) throw new Error(`Unexpected Suzanne Vermeer works: ${JSON.stringify(unknownWorks.map(({ id, title }) => ({ id, title })))}.`);

  const missing = SUZANNE_VERMEER_REVIEWED_IDENTITIES.filter(({ title }) => !worksByTitle.has(title));
  if (missing.some(({ confidence }) => confidence !== 'HIGH')) throw new Error('Non-HIGH import in plan.');
  const unexpectedMissing = missing.filter(({ title }) => title !== 'Winterberg' && title !== 'De eilanden');
  if (unexpectedMissing.length) throw new Error(`Unexpected missing works: ${unexpectedMissing.map(({ title }) => title).join(', ')}.`);

  for (const identity of SUZANNE_VERMEER_REVIEWED_IDENTITIES.filter(({ expectedProductionWorkId }) => expectedProductionWorkId !== null)) {
    const work = worksByTitle.get(identity.title);
    if (!work || Number(work.id) !== identity.expectedProductionWorkId) {
      throw new Error(`Existing Work-ID guard failed for ${identity.title}.`);
    }
  }

  const isbnConflicts = missing.flatMap((identity) => state.tables.editions
    .filter((edition) => String(edition.isbn_13) === identity.representativeIsbn13)
    .map((edition) => ({ identity: identity.title, edition })));
  if (isbnConflicts.length) throw new Error(`New ISBN conflict: ${JSON.stringify(isbnConflicts)}.`);

  const workRepairs = WORK_REPAIRS.flatMap((repair) => {
    const work = state.tables.works.find((row) => Number(row.id) === repair.id);
    if (!work) throw new Error(`Missing repair Work ${repair.id}.`);
    const current = { title: String(work.title), year: Number(work.first_publish_year) };
    const before = { title: repair.fromTitle, year: repair.fromYear };
    const after = { title: repair.toTitle, year: repair.toYear };
    if (current.title === after.title && current.year === after.year) return [];
    if (current.title !== before.title || current.year !== before.year) {
      throw new Error(`Unexpected repair state for Work ${repair.id}: ${JSON.stringify(current)}.`);
    }
    return [{ ...repair, current }];
  });

  const collectionRows = state.tables.collection_books.filter((row) => Number(row.collection_id) === collectionId);
  const plannedMemberships = SUZANNE_VERMEER_REVIEWED_IDENTITIES.map((identity, index) => ({
    title: identity.title,
    workId: worksByTitle.has(identity.title) ? Number(worksByTitle.get(identity.title)!.id) : null,
    sequenceNumber: null,
    publicationOrder: index + 1,
  }));
  const membershipChanges = plannedMemberships.filter((planned) => {
    if (planned.workId === null) return true;
    const current = collectionRows.find((row) => Number(row.work_id) === planned.workId);
    return !current || current.sequence_number !== null || Number(current.publication_order) !== planned.publicationOrder;
  });

  const festivalEdition = state.tables.editions.find((row) =>
    Number(row.work_id) === FESTIVAL_WORK_ID && String(row.isbn_13) === '9789400517134');
  if (!festivalEdition) throw new Error('Festival representative edition is missing.');
  if (festivalEdition.language !== null && festivalEdition.language !== 'nld') {
    throw new Error(`Festival edition has unexpected language ${String(festivalEdition.language)}.`);
  }

  const coverChanges = ALL_COVER_REPAIRS.filter(({ title, isbn13, coverUrl }) => {
    const work = worksByTitle.get(title);
    if (!work) return true;
    const row = state.tables.work_cover_resolutions.find((candidate) =>
      Number(candidate.work_id) === Number(work.id) && candidate.source === 'google_books');
    return !row || row.cover_url !== coverUrl || row.source_key !== isbn13 || row.state !== 'resolved' || !row.verified_at;
  });

  return {
    worksByTitle,
    missing,
    workRepairs,
    festivalEdition,
    plannedMemberships,
    membershipChanges,
    coverChanges,
    currentSuzanneWorks,
  };
}

async function verifyCoverUrls(): Promise<Array<{ title: string; status: number; contentType: string | null }>> {
  const results = [];
  for (const repair of ALL_COVER_REPAIRS) {
    const response = await fetch(repair.coverUrl, {
      headers: { Range: 'bytes=0-1023', 'User-Agent': 'LumiScoreCatalogAudit/1.0' },
      signal: AbortSignal.timeout(10_000),
    });
    const contentType = response.headers.get('content-type');
    await response.body?.cancel();
    if (!response.ok || !contentType?.startsWith('image/')) {
      throw new Error(`Cover verification failed for ${repair.title}: HTTP ${response.status} ${String(contentType)}.`);
    }
    results.push({ title: repair.title, status: response.status, contentType });
  }
  return results;
}

async function loadFrozenPlan(): Promise<FrozenPlan> {
  const plan = JSON.parse(await readFile(
    join(process.cwd(), 'catalog', 'suzanne-vermeer-catalog-frozen-plan.json'), 'utf8',
  )) as FrozenPlan;
  if (plan.version !== 'suzanne_vermeer_catalog_frozen_plan_v1'
    || !plan.writeGatePassed || plan.productionWrites !== 0
    || plan.completeOfficialTitleList.length !== 54) {
    throw new Error('Frozen plan failed its exact scope guard.');
  }
  return plan;
}

const before = await loadState();
const planned = validateAndPlan(before);
const coverVerification = await verifyCoverUrls();

if (inspect) {
  console.log(JSON.stringify({
    version: 'suzanne_vermeer_catalog_inspection_v1',
    generatedAt: new Date().toISOString(),
    baseline: before.baseline,
    protected: before.protected,
    current: {
      suzanneWorks: planned.currentSuzanneWorks.length,
      missing: planned.missing.map(({ title }) => title),
      workRepairs: planned.workRepairs,
      membershipChanges: planned.membershipChanges.length,
      coverChanges: planned.coverChanges.map(({ title }) => title),
      coverVerification,
    },
    expectedAfter: {
      works: before.tables.works.length + planned.missing.length,
      authors: before.tables.authors.length,
      editions: before.tables.editions.length + planned.missing.length,
      collections: before.tables.collections.length,
      collection_books: before.tables.collection_books.length + planned.missing.length,
      work_cover_resolutions: before.tables.work_cover_resolutions.length
        + ALL_COVER_REPAIRS.filter(({ title }) => {
          const work = planned.worksByTitle.get(title);
          return !work || !before.tables.work_cover_resolutions.some((row) =>
            Number(row.work_id) === Number(work.id) && row.source === 'google_books');
        }).length,
    },
    completeOfficialTitleList: SUZANNE_VERMEER_REVIEWED_IDENTITIES,
    exclusions: SUZANNE_VERMEER_EXCLUSIONS,
    deletes: 0,
  }, null, 2));
  process.exit(0);
}

const frozen = await loadFrozenPlan();
for (const [name, current] of Object.entries(before.protected)) {
  if (!sameFingerprint(frozen.protected[name], current)) {
    throw new Error(`Protected baseline changed for ${name}; refusing to write.`);
  }
}
const exactFrozenBaseline = Object.entries(before.baseline).every(([name, current]) =>
  sameFingerprint(frozen.baseline[name], current));
const fullyAppliedCounts = Object.entries(frozen.expectedAfter).every(([table, expected]) =>
  before.tables[table]?.length === expected);
const alreadyConverged = planned.missing.length === 0
  && planned.workRepairs.length === 0
  && planned.membershipChanges.length === 0
  && planned.coverChanges.length === 0
  && planned.festivalEdition.language === 'nld';
if (!exactFrozenBaseline && !(fullyAppliedCounts && alreadyConverged)) {
  throw new Error('Frozen baseline changed outside the exact fully-applied idempotent state; refusing to write.');
}

const writes = { authors: 0, worksInserted: 0, worksUpdated: 0, editionsInserted: 0, editionsUpdated: 0, membershipsInserted: 0, membershipsUpdated: 0, coversInserted: 0, coversUpdated: 0, deletes: 0 };

if (write) {
  for (const repair of planned.workRepairs) {
    const { data, error } = await client.from('works')
      .update({ title: repair.toTitle, first_publish_year: repair.toYear })
      .eq('id', repair.id).eq('title', repair.fromTitle).eq('first_publish_year', repair.fromYear)
      .select('id');
    if (error || data?.length !== 1) throw error ?? new Error(`Guarded Work repair failed for ${repair.id}.`);
    writes.worksUpdated += 1;
  }

  const resolvedWorkIds = new Map<string, number>();
  for (const identity of SUZANNE_VERMEER_REVIEWED_IDENTITIES) {
    const existing = planned.worksByTitle.get(identity.title);
    if (existing) {
      resolvedWorkIds.set(identity.title, Number(existing.id));
      continue;
    }
    const { data, error } = await client.from('works').insert({
      open_library_id: null,
      title: identity.title,
      author_id: Number(before.author.id),
      first_publish_year: Number(identity.originalPublicationDate.slice(0, 4)),
      source_type: 'lumiscore_native',
      work_type: identity.workType,
      native_identity_key: getNativeWorkIdentityKey(identity.title, SUZANNE_VERMEER_AUTHOR.name),
    }).select('id').single();
    if (error) throw error;
    const workId = Number(data.id);
    resolvedWorkIds.set(identity.title, workId);
    writes.worksInserted += 1;
    const { error: editionError } = await client.from('editions').insert({
      open_library_edition_id: null,
      title: identity.title,
      work_id: workId,
      isbn_13: identity.representativeIsbn13,
      publisher: 'A.W. Bruna Uitgevers',
      language: 'nld',
    });
    if (editionError) throw editionError;
    writes.editionsInserted += 1;
  }

  if (planned.festivalEdition.language !== 'nld') {
    const { data, error } = await client.from('editions').update({ language: 'nld' })
      .eq('id', planned.festivalEdition.id).is('language', null).select('id');
    if (error || data?.length !== 1) throw error ?? new Error('Festival edition language repair failed.');
    writes.editionsUpdated += 1;
  }

  const currentMemberships = before.tables.collection_books.filter((row) => Number(row.collection_id) === Number(before.collection.id));
  for (let index = 0; index < SUZANNE_VERMEER_REVIEWED_IDENTITIES.length; index += 1) {
    const identity = SUZANNE_VERMEER_REVIEWED_IDENTITIES[index];
    const workId = resolvedWorkIds.get(identity.title)!;
    const current = currentMemberships.find((row) => Number(row.work_id) === workId);
    if (!current) {
      const { error } = await client.from('collection_books').insert({ collection_id: before.collection.id, work_id: workId, sequence_number: null, publication_order: index + 1, subgroup: null });
      if (error) throw error;
      writes.membershipsInserted += 1;
    } else if (current.sequence_number !== null || Number(current.publication_order) !== index + 1) {
      const { error } = await client.from('collection_books').update({ sequence_number: null, publication_order: index + 1, subgroup: null })
        .eq('collection_id', before.collection.id).eq('work_id', workId);
      if (error) throw error;
      writes.membershipsUpdated += 1;
    }
  }

  const checkedAt = new Date().toISOString();
  for (const repair of ALL_COVER_REPAIRS) {
    const workId = resolvedWorkIds.get(repair.title)!;
    const existing = before.tables.work_cover_resolutions.find((row) => Number(row.work_id) === workId && row.source === 'google_books');
    const exact = existing && existing.cover_url === repair.coverUrl && existing.source_key === repair.isbn13
      && existing.state === 'resolved' && existing.verified_at;
    if (exact) continue;
    const { error } = await client.from('work_cover_resolutions').upsert({
      work_id: workId,
      source: 'google_books',
      cover_url: repair.coverUrl,
      source_key: repair.isbn13,
      state: 'resolved',
      verified_at: checkedAt,
      checked_at: checkedAt,
      retry_after: null,
    }, { onConflict: 'work_id,source' });
    if (error) throw error;
    if (existing) writes.coversUpdated += 1;
    else writes.coversInserted += 1;
  }
}

const after = write ? await loadState() : before;
const post = validateAndPlan(after);
if (write) {
  for (const [name, expected] of Object.entries(frozen.protected)) {
    const actual = (after.protected as Record<string, Fingerprint>)[name];
    if (!sameFingerprint(expected, actual)) throw new Error(`Protected post-write hash changed for ${name}.`);
  }
  for (const [table, expected] of Object.entries(frozen.expectedAfter)) {
    if (after.tables[table]?.length !== expected) throw new Error(`Unexpected after count for ${table}.`);
  }
  if (post.missing.length || post.workRepairs.length || post.membershipChanges.length || post.coverChanges.length) {
    throw new Error(`Post-write convergence failed: ${JSON.stringify({ missing: post.missing.length, workRepairs: post.workRepairs.length, memberships: post.membershipChanges.length, covers: post.coverChanges.length })}`);
  }
}

console.log(JSON.stringify({
  mode: write ? 'WRITE' : 'DRY_RUN',
  writeGatePassed: true,
  beforeCounts: Object.fromEntries(TABLES.map((table) => [table, before.tables[table].length])),
  plannedChanges: {
    worksInserted: planned.missing.length,
    worksUpdated: planned.workRepairs.length,
    editionsInserted: planned.missing.length,
    editionsUpdated: planned.festivalEdition.language === 'nld' ? 0 : 1,
    memberships: planned.membershipChanges.length,
    covers: planned.coverChanges.length,
    deletes: 0,
  },
  writes,
  afterCounts: Object.fromEntries(TABLES.map((table) => [table, after.tables[table].length])),
  protectedHashesMatch: Object.keys(frozen.protected).every((name) => sameFingerprint(frozen.protected[name], (after.protected as Record<string, Fingerprint>)[name])),
  convergence: { missing: post.missing.length, workRepairs: post.workRepairs.length, membershipChanges: post.membershipChanges.length, coverChanges: post.coverChanges.length },
  coverVerification,
}, null, 2));
