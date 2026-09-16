import { createClient } from '@supabase/supabase-js';
import {
  normalizeEditionLanguage,
  selectRepresentativeEdition,
  type EditionCandidate,
} from '../lib/books/edition-ranking.ts';
import { REVIEWED_COLLECTION_SEEDS } from '../lib/collections/seed-data.ts';
import {
  REVIEWED_SERIES_CATALOG_PLANS,
} from '../lib/collections/series-catalog-plan.ts';

type Row = Record<string, unknown>;
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
};
type RankedEdition = EditionCandidate & { row: OpenLibraryEdition };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('Supabase public environment is required.');
const client = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function normalizeOpenLibraryWorkId(value: unknown): string | null {
  const id = typeof value === 'string'
    ? value.split('/').filter(Boolean).at(-1)?.toUpperCase()
    : null;
  return id && /^OL\d+W$/.test(id) ? id : null;
}

function relationRows(value: unknown): Row[] {
  if (Array.isArray(value)) return value.filter((row): row is Row => Boolean(row && typeof row === 'object'));
  return value && typeof value === 'object' ? [value as Row] : [];
}

function toRankedEdition(row: OpenLibraryEdition): RankedEdition {
  return {
    row,
    openLibraryEditionId: row.key ?? null,
    title: row.title ?? null,
    subtitle: row.subtitle ?? null,
    physicalFormat: row.physical_format ?? null,
    languageCodes: (row.languages ?? []).flatMap(({ key }) => key ? [key] : []),
    isbn10: row.isbn_10 ?? [],
    isbn13: row.isbn_13 ?? [],
    publishDate: row.publish_date ?? null,
    publishers: row.publishers ?? [],
    coverIds: (row.covers ?? []).filter((cover) => Number.isSafeInteger(cover) && cover > 0),
  };
}

async function fetchJson<T>(url: URL): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'LumiScoreSeriesAudit/1.0' },
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) return await response.json() as T;
      lastError = new Error(`HTTP ${response.status}`);
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt));
  }
  throw lastError instanceof Error ? lastError : new Error('Open Library request failed.');
}

async function loadOpenLibraryEditions(workId: string): Promise<RankedEdition[]> {
  const endpoint = new URL(`/works/${workId}/editions.json`, 'https://openlibrary.org');
  endpoint.searchParams.set('limit', '500');
  const result = await fetchJson<{ entries?: OpenLibraryEdition[] }>(endpoint);
  return (result.entries ?? []).map(toRankedEdition);
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  task: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await task(values[index]);
    }
  }));
  return results;
}

function editionLanguage(edition: RankedEdition | null): string {
  return edition?.languageCodes?.map(normalizeEditionLanguage).find(Boolean) ?? 'und';
}

function editionIsbn(edition: RankedEdition | null): string {
  return String(edition?.isbn13?.[0] ?? edition?.isbn10?.[0] ?? '—');
}

function formatEdition(edition: RankedEdition | null): string {
  if (!edition) return '—';
  const id = String(edition.openLibraryEditionId ?? 'unknown').split('/').filter(Boolean).at(-1);
  return `${id} (${editionLanguage(edition)}, ${editionIsbn(edition)}, cover:${edition.coverIds?.length ? 'yes' : 'no'})`;
}

const firstPage = await client.from('works').select(
  'id,title,first_publish_year,open_library_id,source_type,authors(name),editions(id,open_library_edition_id,isbn_10,isbn_13,language,publisher,title)',
  { count: 'exact' },
).order('id').range(0, 999);
if (firstPage.error) throw firstPage.error;
const totalWorks = firstPage.count ?? firstPage.data?.length ?? 0;
const remainingPages = await Promise.all(Array.from(
  { length: Math.max(0, Math.ceil(totalWorks / 1000) - 1) },
  (_, index) => client.from('works').select(
    'id,title,first_publish_year,open_library_id,source_type,authors(name),editions(id,open_library_edition_id,isbn_10,isbn_13,language,publisher,title)',
  ).order('id').range((index + 1) * 1000, (index + 2) * 1000 - 1),
));
const failedPage = remainingPages.find(({ error }) => error);
if (failedPage?.error) throw failedPage.error;
const works = [...(firstPage.data ?? []), ...remainingPages.flatMap(({ data }) => data ?? [])] as unknown as Row[];
const worksByOpenLibraryId = new Map(works.flatMap((work) => {
  const id = normalizeOpenLibraryWorkId(work.open_library_id);
  return id ? [[id, work] as const] : [];
}));
const worksById = new Map(works.map((work) => [Number(work.id), work]));

const plannedBooks = REVIEWED_SERIES_CATALOG_PLANS.flatMap((series) =>
  series.books.map((book) => ({ series, book })),
);
const editionResults = await mapWithConcurrency(plannedBooks, 4, async ({ book }) => {
  try {
    return { workId: book.openLibraryWorkId, editions: await loadOpenLibraryEditions(book.openLibraryWorkId), error: null };
  } catch (error) {
    return { workId: book.openLibraryWorkId, editions: [], error: error instanceof Error ? error.message : String(error) };
  }
});
const editionsByWorkId = new Map(editionResults.map((result) => [result.workId, result]));

let completeTargetSeries = 0;
let missingMainInstallments = 0;
let suspiciousEditionLanguage = 0;
console.log(`# LumiScore series completeness audit`);
console.log(`catalog works: ${totalWorks}`);
console.log(`reviewed target series: ${REVIEWED_SERIES_CATALOG_PLANS.length}`);

for (const series of REVIEWED_SERIES_CATALOG_PLANS) {
  const currentCount = series.books.filter((book) => worksByOpenLibraryId.has(book.openLibraryWorkId)).length;
  const missing = series.books.length - currentCount;
  missingMainInstallments += missing;
  if (missing === 0) completeTargetSeries += 1;
  const canComplete = series.books.every((book) => (editionsByWorkId.get(book.openLibraryWorkId)?.editions.length ?? 0) > 0);
  console.log(`\n## ${series.name}: ${currentCount}/${series.books.length} present; ${missing} missing; complete after import: ${canComplete ? 'yes' : 'no'}`);
  console.log('| Pos | Title | State | LumiScore work | Open Library work | Author | Languages | Preferred NL edition | Preferred EN edition | Confidence |');
  console.log('|---:|---|---|---:|---|---|---|---|---|---|');
  for (const book of series.books) {
    const existing = worksByOpenLibraryId.get(book.openLibraryWorkId);
    const result = editionsByWorkId.get(book.openLibraryWorkId);
    const editions = result?.editions ?? [];
    const preferredNl = selectRepresentativeEdition(editions, {
      workTitle: book.sourceTitle ?? book.title,
      firstPublishYear: book.firstPublishYear,
      preferredLanguages: ['nld', 'eng'],
    });
    const preferredEn = selectRepresentativeEdition(editions, {
      workTitle: book.sourceTitle ?? book.title,
      firstPublishYear: book.firstPublishYear,
      preferredLanguages: ['eng'],
    });
    const languages = [...new Set(editions.flatMap((edition) =>
      (edition.languageCodes ?? []).map(normalizeEditionLanguage).filter(Boolean),
    ))];
    const storedLanguages = relationRows(existing?.editions).flatMap((edition) => {
      const language = typeof edition.language === 'string'
        ? normalizeEditionLanguage(edition.language)
        : '';
      return language ? [language] : [];
    });
    if (existing && (storedLanguages.length === 0 || storedLanguages.every((language) => language !== 'nld' && language !== 'eng')) && (languages.includes('nld') || languages.includes('eng'))) {
      suspiciousEditionLanguage += 1;
    }
    const confidence = result?.error || editions.length === 0 ? 'REVIEW' : 'HIGH';
    console.log(`| ${book.sequenceNumber} | ${book.title} | ${existing ? 'existing' : 'new'} | ${existing?.id ?? '—'} | ${book.openLibraryWorkId} | ${book.author} | ${languages.filter((language) => language === 'nld' || language === 'eng').join(', ') || 'other/unknown'} | ${formatEdition(preferredNl)} | ${formatEdition(preferredEn)} | ${confidence} |`);
  }
}

let completeSeededCollections = 0;
console.log('\n# Existing reviewed Collections seeds');
for (const seed of REVIEWED_COLLECTION_SEEDS) {
  const present = seed.books.filter(({ workId }) => worksById.has(workId)).length;
  const complete = present === seed.books.length;
  if (complete) completeSeededCollections += 1;
  console.log(`${seed.name}: ${present}/${seed.books.length} catalog works; ${complete ? 'complete' : 'incomplete'}; known missing: ${seed.knownMissing.length ? seed.knownMissing.join('; ') : 'none'}`);
}

console.log('\n# Summary');
console.log(`total audited series/collections: ${REVIEWED_SERIES_CATALOG_PLANS.length + REVIEWED_COLLECTION_SEEDS.length}`);
console.log(`complete current target series: ${completeTargetSeries}/${REVIEWED_SERIES_CATALOG_PLANS.length}`);
console.log(`complete existing seeded collections: ${completeSeededCollections}/${REVIEWED_COLLECTION_SEEDS.length}`);
console.log(`incomplete audited groups: ${(REVIEWED_SERIES_CATALOG_PLANS.length - completeTargetSeries) + (REVIEWED_COLLECTION_SEEDS.length - completeSeededCollections)}`);
console.log(`missing main installments: ${missingMainInstallments}`);
console.log(`suspicious stored edition language: ${suspiciousEditionLanguage}`);
console.log('collection membership completeness after audited import: all seven reviewed target series can be synchronized only after every HIGH-confidence work is present.');

const harry = REVIEWED_SERIES_CATALOG_PLANS.find(({ slug }) => slug === 'harry-potter')!;
const harryPresent = harry.books.filter((book) => worksByOpenLibraryId.has(book.openLibraryWorkId)).length;
console.log(`Harry Potter explicit: before ${harryPresent}/7; projected after audited import 7/7; companions excluded.`);
for (const book of harry.books) {
  const work = worksByOpenLibraryId.get(book.openLibraryWorkId);
  if (!work) continue;
  const stored = relationRows(work.editions).map((edition) => ({
    id: edition.open_library_edition_id ?? edition.id,
    language: edition.language ?? 'und',
    isbn: edition.isbn_13 ?? edition.isbn_10 ?? null,
  }));
  console.log(`Harry Potter stored editions work ${work.id}: ${book.title}: ${JSON.stringify(stored)}`);
}
