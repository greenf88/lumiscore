import { createClient } from '@supabase/supabase-js';
import type { Book } from '../app/data/books.ts';
import {
  getOpenLibraryCoverIdUrl,
  getOpenLibraryCoverUrl,
  getOpenLibraryOlidCoverUrl,
  normalizeOpenLibraryId,
  uniqueCoverUrls,
} from '../lib/books/covers.ts';
import {
  rankEditionsForCover,
  selectRepresentativeEdition,
  type EditionCandidate,
} from '../lib/books/edition-ranking.ts';
import {
  normalizeVerifiedIsbn13,
  resolveGoogleBooksCover,
} from '../lib/books/google-books-covers.ts';
import { resolveOpenLibraryCoverCandidates } from '../lib/books/open-library-covers.ts';
import { NETHERLANDS_SEEDS } from './open-library-seeds-nl.ts';

type WorkRow = {
  id: string | number;
  title: string;
  first_publish_year: number | null;
  source_type: string | null;
  open_library_id: string | null;
  cover_id: number | null;
  authors: { name?: string | null } | Array<{ name?: string | null }> | null;
  editions: Array<{
    id: string | number;
    open_library_edition_id: string | null;
    isbn_10: string | null;
    isbn_13: string | null;
    language: string | null;
    publisher: string | null;
    title: string | null;
  }>;
};

type CoverAuditResult = {
  workId: string;
  title: string;
  author: string;
  sourceType: string | null;
  openLibraryWorkId: string | null;
  isbn13: string | null;
  source: 'open-library' | 'google-books' | 'placeholder';
  coverUrl: string | null;
};

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_SECRET_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase URL or read-capable key.');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const DUTCH_WORK_IDS = new Set(
  NETHERLANDS_SEEDS.map((seed) => seed.expectedOpenLibraryWorkId).filter(
    (workId): workId is string => Boolean(workId),
  ),
);

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function loadCatalogRows(): Promise<WorkRow[]> {
  const rows: WorkRow[] = [];
  const pageSize = 500;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('works')
      .select(
        'id,title,first_publish_year,open_library_id,source_type,work_type,author_id,cover_id,authors(id,name),editions(id,open_library_edition_id,isbn_10,isbn_13,language,publisher,title)',
      )
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;

    const page = (data ?? []) as unknown as WorkRow[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

function authorName(row: WorkRow): string {
  const author = Array.isArray(row.authors) ? row.authors[0] : row.authors;
  return author?.name?.trim() || 'Unknown author';
}

function editionCandidate(row: WorkRow['editions'][number]): EditionCandidate & {
  row: WorkRow['editions'][number];
} {
  return {
    row,
    id: row.id,
    openLibraryEditionId: row.open_library_edition_id,
    title: row.title,
    languageCodes: row.language ? [row.language] : [],
    isbn10: row.isbn_10,
    isbn13: row.isbn_13,
    publishers: row.publisher,
  };
}

function mapAuditBook(row: WorkRow, index: number): Book {
  const context = {
    workTitle: row.title,
    firstPublishYear: row.first_publish_year,
    preferredLanguages:
      row.source_type === 'lumiscore_native' ? ['nld'] : ['eng'],
  };
  const ranked = rankEditionsForCover(
    row.editions.map(editionCandidate),
    context,
  );
  const representative = selectRepresentativeEdition(
    row.editions.map(editionCandidate),
    context,
  )?.row;

  return {
    id: `work-${row.id}`,
    source: 'supabase',
    workId: String(row.id),
    sourceType: row.source_type,
    openLibraryWorkId: normalizeOpenLibraryId(row.open_library_id, 'work'),
    openLibraryEditionId: normalizeOpenLibraryId(
      representative?.open_library_edition_id,
      'edition',
    ),
    title: row.title,
    author: authorName(row),
    firstPublishYear: row.first_publish_year,
    isbn13: representative?.isbn_13 ?? null,
    score: null,
    ratingsCount: null,
    match: null,
    cover: String(index % 6),
    coverUrls: uniqueCoverUrls([
      ...ranked.map((edition) => getOpenLibraryCoverUrl(edition.row.isbn_13)),
      ...ranked.map((edition) =>
        getOpenLibraryOlidCoverUrl(edition.row.open_library_edition_id),
      ),
      getOpenLibraryCoverIdUrl(row.cover_id),
    ]),
  };
}

async function isUsableImage(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        Range: 'bytes=0-1023',
        'User-Agent':
          'LumiScoreCoverAudit/2.0 (https://lumiscore.greenf88.chatgpt.site)',
      },
      signal: AbortSignal.timeout(10_000),
    });
    const usable =
      response.ok &&
      (response.headers.get('content-type') ?? '').startsWith('image/');
    await response.body?.cancel();
    return usable;
  } catch {
    return false;
  }
}

async function firstUsableUrl(urls: readonly string[]): Promise<string | null> {
  for (const url of urls) {
    if (await isUsableImage(url)) return url;
  }
  return null;
}

async function auditBook(book: Book): Promise<CoverAuditResult> {
  const initialOpenLibraryUrls = book.coverUrls ?? [];
  let openLibraryUrl = await firstUsableUrl(initialOpenLibraryUrls);

  if (!openLibraryUrl && book.openLibraryWorkId) {
    const resolved = await resolveOpenLibraryCoverCandidates({
      workId: book.openLibraryWorkId,
      title: book.title,
      author: book.author,
      firstPublishYear: book.firstPublishYear,
      preferredLanguages:
        book.sourceType === 'lumiscore_native' ? ['nld'] : ['eng'],
    });
    openLibraryUrl = await firstUsableUrl(
      uniqueCoverUrls([...initialOpenLibraryUrls, ...resolved]),
    );
  }

  if (openLibraryUrl) {
    return {
      workId: book.workId!,
      title: book.title,
      author: book.author,
      sourceType: book.sourceType ?? null,
      openLibraryWorkId: book.openLibraryWorkId ?? null,
      isbn13: book.isbn13 ?? null,
      source: 'open-library',
      coverUrl: openLibraryUrl,
    };
  }

  const googleBooksUrl = normalizeVerifiedIsbn13(book.isbn13)
    ? await resolveGoogleBooksCover(book.isbn13)
    : null;
  const usableGoogleBooksUrl =
    googleBooksUrl && (await isUsableImage(googleBooksUrl))
      ? googleBooksUrl
      : null;

  return {
    workId: book.workId!,
    title: book.title,
    author: book.author,
    sourceType: book.sourceType ?? null,
    openLibraryWorkId: book.openLibraryWorkId ?? null,
    isbn13: book.isbn13 ?? null,
    source: usableGoogleBooksUrl ? 'google-books' : 'placeholder',
    coverUrl: usableGoogleBooksUrl,
  };
}

function summary(results: readonly CoverAuditResult[]) {
  return {
    total: results.length,
    openLibraryCovers: results.filter(
      (result) => result.source === 'open-library',
    ).length,
    googleBooksFallbacks: results.filter(
      (result) => result.source === 'google-books',
    ).length,
    placeholders: results.filter(
      (result) => result.source === 'placeholder',
    ).length,
  };
}

function percentage(covered: number, total: number): number {
  return total === 0 ? 0 : Math.round((covered / total) * 1_000) / 10;
}

const rows = await loadCatalogRows();
const books = rows.map(mapAuditBook);
const rowById = new Map(
  rows.map((row) => [String(row.id), row]),
);
const results = new Array<CoverAuditResult>(books.length);
let nextIndex = 0;

await Promise.all(
  Array.from({ length: 12 }, async () => {
    while (nextIndex < books.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await auditBook(books[index]);
      const completed = results.filter(Boolean).length;
      if (completed % 100 === 0 || completed === books.length) {
        console.log(`Audited ${completed}/${books.length} works…`);
      }
      await wait(20);
    }
  }),
);

const totals = summary(results);
const dutchFlemish = results.filter((result) => {
  const row = rowById.get(result.workId);
  return (
    row?.source_type === 'lumiscore_native' ||
    Boolean(row?.open_library_id && DUTCH_WORK_IDS.has(row.open_library_id))
  );
});
const suzanneVermeer = results.filter(
  (result) => result.author === 'Suzanne Vermeer',
);
const native = results.filter(
  (result) => result.sourceType === 'lumiscore_native',
);
const examples = new Set(['De scheiding', 'De vallei', 'Dwaalspoor']);

console.log(
  JSON.stringify(
    {
      totalWorks: totals.total,
      worksWithOpenLibraryCover: totals.openLibraryCovers,
      worksRequiringFallback: totals.total - totals.openLibraryCovers,
      googleBooksFallbackSuccesses: totals.googleBooksFallbacks,
      remainingPlaceholders: totals.placeholders,
      coverageBeforePercent: percentage(totals.openLibraryCovers, totals.total),
      coverageAfterPercent: percentage(
        totals.openLibraryCovers + totals.googleBooksFallbacks,
        totals.total,
      ),
      googleBooksApiKeyConfigured: Boolean(
        process.env.GOOGLE_BOOKS_API_KEY?.trim(),
      ),
      focus: {
        dutchFlemish: summary(dutchFlemish),
        suzanneVermeer: summary(suzanneVermeer),
        lumiScoreNative: summary(native),
        requestedExamples: results.filter(
          (result) =>
            examples.has(result.title) && result.author === 'Suzanne Vermeer',
        ),
      },
      placeholderWorks: results
        .filter((result) => result.source === 'placeholder')
        .map(({ workId, title, author, isbn13, sourceType }) => ({
          workId,
          title,
          author,
          isbn13,
          sourceType,
        })),
    },
    null,
    2,
  ),
);

if (results.length !== 1_303) process.exitCode = 1;
