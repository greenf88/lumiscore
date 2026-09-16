import { createClient } from '@supabase/supabase-js';
import { writeFile } from 'node:fs/promises';
import {
  getPreferredEditionLanguages,
  normalizeEditionLanguage,
  rankEditionsForCover,
  selectRepresentativeEdition,
  type EditionCandidate,
} from '../lib/books/edition-ranking.ts';
import { SEED_BOOKS } from './open-library-seeds.ts';

type Row = Record<string, unknown>;
type StoredEdition = EditionCandidate & { row: Row; editionId: string | null };
type OpenLibraryDocument = {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
};
type OpenLibraryEdition = {
  key?: string;
  title?: string;
  subtitle?: string;
  physical_format?: string;
  isbn_10?: string[];
  isbn_13?: string[];
  languages?: Array<{ key?: string }>;
  publish_date?: string;
  publishers?: string[];
  covers?: number[];
  works?: Array<{ key?: string }>;
};
type AuditMembership = {
  collection: string;
  sequence: number | null;
  workId: string;
  title: string;
  author: string;
  currentYear: number | null;
  expectedYear: number | null;
  openLibraryWorkId: string | null;
  representativeEdition: string;
  editionLanguage: string;
  isbn: string;
  nlCover: string;
  enCover: string;
  identity: string;
};
type Repair = {
  workId: string;
  collection: string;
  title: string;
  currentValue: string;
  expectedValue: string;
  source: string;
  confidence: 'HIGH';
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const readKey = process.env.SUPABASE_SECRET_KEY ?? publicKey;
if (!url || !publicKey || !readKey) throw new Error('Supabase environment is required.');
const client = createClient(url, readKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function rows(value: unknown): Row[] {
  if (Array.isArray(value)) return value.filter((item): item is Row => Boolean(item && typeof item === 'object'));
  return value && typeof value === 'object' ? [value as Row] : [];
}

function text(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function number(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function openLibraryId(value: unknown, suffix: 'W' | 'M'): string | null {
  const id = text(value)?.split('/').filter(Boolean).at(-1)?.toUpperCase();
  return id && new RegExp(`^OL\\d+${suffix}$`).test(id) ? id : null;
}

function storedEdition(row: Row): StoredEdition {
  const language = text(row.language);
  return {
    row,
    editionId: text(row.id),
    openLibraryEditionId: openLibraryId(row.open_library_edition_id, 'M'),
    title: text(row.title),
    physicalFormat: text(row.physical_format),
    languageCodes: language ? [language] : [],
    isbn10: text(row.isbn_10),
    isbn13: text(row.isbn_13),
    publishDate: text(row.publish_date),
    publishers: text(row.publisher),
    coverIds: [],
  };
}

function externalEdition(row: OpenLibraryEdition): EditionCandidate {
  return {
    openLibraryEditionId: openLibraryId(row.key, 'M'),
    title: row.title ?? null,
    subtitle: row.subtitle ?? null,
    physicalFormat: row.physical_format ?? null,
    languageCodes: (row.languages ?? []).flatMap(({ key }) => key ? [key] : []),
    isbn10: row.isbn_10 ?? [],
    isbn13: row.isbn_13 ?? [],
    publishDate: row.publish_date ?? null,
    publishers: row.publishers ?? [],
    coverIds: row.covers ?? [],
  };
}

async function fetchJson<T>(url: URL): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'LumiScoreCollectionMetadataAudit/1.0' },
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) return await response.json() as T;
      lastError = new Error(`HTTP ${response.status} for ${url.pathname}`);
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
  }
  throw lastError instanceof Error ? lastError : new Error(`Open Library failed for ${url.pathname}.`);
}

async function concurrentMap<T, R>(values: readonly T[], concurrency: number, task: (value: T) => Promise<R>): Promise<R[]> {
  const result = new Array<R>(values.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (next < values.length) {
      const index = next++;
      result[index] = await task(values[index]);
    }
  }));
  return result;
}

async function exactWorkDocument(workId: string): Promise<OpenLibraryDocument | null> {
  const endpoint = new URL('/search.json', 'https://openlibrary.org');
  endpoint.searchParams.set('q', `key:/works/${workId}`);
  endpoint.searchParams.set('fields', 'key,title,author_name,first_publish_year');
  endpoint.searchParams.set('limit', '5');
  const result = await fetchJson<{ docs?: OpenLibraryDocument[] }>(endpoint);
  return (result.docs ?? []).find(({ key }) => openLibraryId(key, 'W') === workId) ?? null;
}

async function editionDocument(editionId: string): Promise<OpenLibraryEdition | null> {
  try {
    return await fetchJson<OpenLibraryEdition>(new URL(`/books/${editionId}.json`, 'https://openlibrary.org'));
  } catch {
    return null;
  }
}

async function bestReplacement(
  workId: string,
  title: string,
  workType: string | null,
  languages: readonly string[],
  purpose: 'representative' | 'cover',
) {
  try {
    const endpoint = new URL(`/works/${workId}/editions.json`, 'https://openlibrary.org');
    endpoint.searchParams.set('limit', '500');
    const result = await fetchJson<{ entries?: OpenLibraryEdition[] }>(endpoint);
    const editions = (result.entries ?? []).map(externalEdition);
    const context = {
      workTitle: title,
      workType,
      preferredLanguages: languages,
    };
    return purpose === 'cover'
      ? rankEditionsForCover(editions, context)[0] ?? null
      : selectRepresentativeEdition(editions, context);
  } catch {
    return null;
  }
}

function primaryIsbn(edition: EditionCandidate | null): string {
  const value = edition?.isbn13 ?? edition?.isbn10;
  return String(Array.isArray(value) ? value[0] ?? '—' : value ?? '—');
}

function primaryLanguage(edition: EditionCandidate | null): string {
  return edition?.languageCodes?.map(normalizeEditionLanguage).find(Boolean) ?? 'und';
}

function editionLabel(edition: EditionCandidate | null): string {
  if (!edition) return '—';
  return `${openLibraryId(edition.openLibraryEditionId, 'M') ?? text(edition.id) ?? 'local'} (${primaryLanguage(edition)}, ${primaryIsbn(edition)})`;
}

function coverLabel(edition: StoredEdition | null, detail: OpenLibraryEdition | null): string {
  const editionId = edition ? openLibraryId(edition.openLibraryEditionId, 'M') : null;
  const coverId = detail?.covers?.find((value) => Number.isSafeInteger(value) && value > 0);
  if (coverId) return `Open Library cover ${coverId} (${editionId ?? 'edition'})`;
  if (editionId) return `Open Library edition ${editionId} (no verified cover metadata)`;
  const isbn = primaryIsbn(edition);
  return isbn !== '—' ? `exact ISBN ${isbn} fallback` : 'placeholder';
}

function escapeCell(value: unknown): string {
  return String(value ?? '—').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

const collectionsResult = await client.from('collections').select(
  'id,slug,name,collection_type,collection_books(work_id,sequence_number,publication_order)',
).order('name');
if (collectionsResult.error) throw collectionsResult.error;
const collections = rows(collectionsResult.data);
const memberships = collections.flatMap((collection) => rows(collection.collection_books).map((membership) => ({
  collection,
  membership,
})));
const workIds = [...new Set(memberships.flatMap(({ membership }) => text(membership.work_id) ?? []))];
const worksResult = await client.from('works').select(
  'id,title,first_publish_year,open_library_id,source_type,work_type,authors(name),editions(id,open_library_edition_id,isbn_10,isbn_13,language,publisher,title)',
).in('id', workIds.map(Number));
if (worksResult.error) throw worksResult.error;
const worksById = new Map(rows(worksResult.data).map((work) => [text(work.id)!, work]));
const reviewedYearsByWorkId = new Map(SEED_BOOKS.flatMap((seed) => {
  const workId = openLibraryId(seed.expectedOpenLibraryWorkId, 'W');
  return workId && Number.isInteger(seed.firstPublishYear)
    ? [[workId, { year: seed.firstPublishYear!, source: 'reviewed pinned catalog seed' }] as const]
    : [];
}));
const olWorkIds = [...new Set([...worksById.values()].flatMap((work) => openLibraryId(work.open_library_id, 'W') ?? []))];
const workDocs = await concurrentMap(olWorkIds, 5, async (id) => {
  try { return [id, await exactWorkDocument(id)] as const; }
  catch { return [id, null] as const; }
});
const workDocsById = new Map(workDocs);

const selectedByWork = new Map<string, {
  nlRepresentative: StoredEdition | null;
  enRepresentative: StoredEdition | null;
  nlCover: StoredEdition | null;
  enCover: StoredEdition | null;
}>();
for (const [workId, work] of worksById) {
  const editions = rows(work.editions).map(storedEdition);
  const title = text(work.title) ?? '[untitled]';
  const sourceType = text(work.source_type);
  const workType = text(work.work_type);
  const nlContext = {
      workTitle: title,
      workType,
      firstPublishYear: number(work.first_publish_year),
      preferredLanguages: getPreferredEditionLanguages('nl', sourceType),
    };
  const enContext = {
      workTitle: title,
      workType,
      firstPublishYear: number(work.first_publish_year),
      preferredLanguages: getPreferredEditionLanguages('en', sourceType),
    };
  selectedByWork.set(workId, {
    nlRepresentative: selectRepresentativeEdition(editions, nlContext),
    enRepresentative: selectRepresentativeEdition(editions, enContext),
    nlCover: rankEditionsForCover(editions, nlContext)[0] ?? null,
    enCover: rankEditionsForCover(editions, enContext)[0] ?? null,
  });
}
const selectedEditionIds = [...new Set([...selectedByWork.values()].flatMap((selection) =>
  Object.values(selection).flatMap((edition) => openLibraryId(edition?.openLibraryEditionId, 'M') ?? []),
))];
const editionDocs = await concurrentMap(selectedEditionIds, 6, async (id) => [id, await editionDocument(id)] as const);
const editionDocsById = new Map(editionDocs);
const repairs: Repair[] = [];
const auditRows: AuditMembership[] = [];

for (const { collection, membership } of memberships) {
  const workId = text(membership.work_id)!;
  const work = worksById.get(workId);
  if (!work) continue;
  const collectionName = text(collection.name) ?? text(collection.slug) ?? '[collection]';
  const title = text(work.title) ?? '[untitled]';
  const author = text(rows(work.authors)[0]?.name) ?? 'Unknown author';
  const currentYear = number(work.first_publish_year);
  const olWorkId = openLibraryId(work.open_library_id, 'W');
  const exact = olWorkId ? workDocsById.get(olWorkId) : null;
  const doc = exact ?? null;
  const expectedYear = doc?.first_publish_year && doc.first_publish_year >= 1400
    ? doc.first_publish_year : null;
  const reviewedYear = olWorkId ? reviewedYearsByWorkId.get(olWorkId) : null;
  if (reviewedYear && currentYear !== reviewedYear.year) {
    repairs.push({
      workId,
      collection: collectionName,
      title,
      currentValue: `first_publish_year=${currentYear ?? 'NULL'}`,
      expectedValue: `first_publish_year=${reviewedYear.year}`,
      source: `${reviewedYear.source}; exact Open Library work ${olWorkId}`,
      confidence: 'HIGH',
    });
  }

  const selected = selectedByWork.get(workId) ?? {
    nlRepresentative: null,
    enRepresentative: null,
    nlCover: null,
    enCover: null,
  };
  const selectedChecks = [
    ['NL representative', selected.nlRepresentative, 'representative'] as const,
    ['EN representative', selected.enRepresentative, 'representative'] as const,
    ['NL cover source', selected.nlCover, 'cover'] as const,
    ['EN cover source', selected.enCover, 'cover'] as const,
  ];
  const identityProblems: string[] = [];
  for (const [label, edition, purpose] of selectedChecks) {
    const editionId = openLibraryId(edition?.openLibraryEditionId, 'M');
    const editionDoc = editionId ? editionDocsById.get(editionId) ?? null : null;
    if (!olWorkId || !editionId || !editionDoc) continue;
    const linkedWorkIds = (editionDoc.works ?? []).flatMap(({ key }) => openLibraryId(key, 'W') ?? []);
    if (!linkedWorkIds.includes(olWorkId)) {
      identityProblems.push(`${label} ${editionId} is not linked to ${olWorkId}`);
      const replacement = await bestReplacement(
        olWorkId,
        title,
        text(work.work_type),
        getPreferredEditionLanguages(label.startsWith('NL') ? 'nl' : 'en', text(work.source_type)),
        purpose,
      );
      repairs.push({
        workId,
        collection: collectionName,
        title,
        currentValue: `${label} ${editionLabel(edition)}`,
        expectedValue: `${label} ${editionLabel(replacement)}`,
        source: `Open Library exact work ${olWorkId} edition membership`,
        confidence: 'HIGH',
      });
    }
  }
  const representative = selected.enRepresentative ?? selected.nlRepresentative;
  const nlCoverId = openLibraryId(selected.nlCover?.openLibraryEditionId, 'M');
  const enCoverId = openLibraryId(selected.enCover?.openLibraryEditionId, 'M');
  const nlCoverDoc = nlCoverId ? editionDocsById.get(nlCoverId) ?? null : null;
  const enCoverDoc = enCoverId ? editionDocsById.get(enCoverId) ?? null : null;
  auditRows.push({
    collection: collectionName,
    sequence: number(membership.sequence_number ?? membership.publication_order),
    workId,
    title,
    author,
    currentYear,
    expectedYear,
    openLibraryWorkId: olWorkId,
    representativeEdition: editionLabel(representative),
    editionLanguage: primaryLanguage(representative),
    isbn: primaryIsbn(representative),
    nlCover: coverLabel(selected.nlCover, nlCoverDoc),
    enCover: coverLabel(selected.enCover, enCoverDoc),
    identity: !olWorkId
      ? 'LumiScore-native (no Open Library Work ID)'
      : !doc
        ? 'exact Open Library lookup unavailable'
        : identityProblems.length
          ? identityProblems.join('; ')
          : `exact ${olWorkId} verified`,
  });
}

const duplicateMemberships = new Set<string>();
for (const row of auditRows) {
  const key = `${row.collection}\u0000${row.workId}`;
  if (duplicateMemberships.has(key)) continue;
  if (auditRows.filter((candidate) => `${candidate.collection}\u0000${candidate.workId}` === key).length > 1) {
    duplicateMemberships.add(key);
  }
}
const report = [
  '# LumiScore live Collection metadata audit',
  '',
  `Generated: ${new Date().toISOString()}`,
  `Collections: ${collections.length}`,
  `Memberships: ${auditRows.length}`,
  `Unique works: ${worksById.size}`,
  `Duplicate memberships: ${duplicateMemberships.size}`,
  `HIGH-confidence repairs: ${repairs.length}`,
  '',
  '## Complete membership audit',
  '',
  '| Work ID | Collection | Seq | Title | Author | Current year | Exact OL year | OL Work | Representative edition | Language | ISBN | NL-selected cover | EN-selected cover | Identity |',
  '|---:|---|---:|---|---|---:|---:|---|---|---|---|---|---|---|',
  ...auditRows.map((row) => `| ${[
    row.workId, row.collection, row.sequence ?? '—', row.title, row.author,
    row.currentYear ?? '—', row.expectedYear ?? '—', row.openLibraryWorkId ?? '—',
    row.representativeEdition, row.editionLanguage, row.isbn, row.nlCover, row.enCover, row.identity,
  ].map(escapeCell).join(' | ')} |`),
  '',
  '## Proposed HIGH-confidence repairs',
  '',
  '| Work ID | Collection | Title | Current value | Expected value | Source | Confidence |',
  '|---:|---|---|---|---|---|---|',
  ...(repairs.length ? repairs.map((repair) => `| ${[
    repair.workId, repair.collection, repair.title, repair.currentValue,
    repair.expectedValue, repair.source, repair.confidence,
  ].map(escapeCell).join(' | ')} |`) : ['| — | — | No HIGH-confidence repairs found | — | — | — | — |']),
  '',
  'No database writes were performed. Open Library identity checks used exact stored Work and Edition IDs only.',
  '',
].join('\n');

const outputPath = new URL('../reports/collection-metadata-audit.md', import.meta.url);
await writeFile(outputPath, report, 'utf8');
console.log(JSON.stringify({
  collections: collections.length,
  memberships: auditRows.length,
  uniqueWorks: worksById.size,
  exactOpenLibraryWorks: olWorkIds.length,
  nativeWorks: worksById.size - olWorkIds.length,
  duplicateMemberships: duplicateMemberships.size,
  highConfidenceRepairs: repairs,
  report: outputPath.pathname,
}, null, 2));
