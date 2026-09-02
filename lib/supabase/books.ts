import type { Book } from '@/app/data/books';
import {
  getOpenLibraryCoverIdUrl,
  getOpenLibraryCoverUrl,
  getOpenLibraryOlidCoverUrl,
  normalizeIsbn13,
  normalizeOpenLibraryId,
  uniqueCoverUrls,
} from '@/lib/books/covers';
import { supabase } from './client';

type DatabaseRow = Record<string, unknown>;

const ISBN_13_COLUMNS = ['isbn13', 'isbn_13', 'isbn-13'] as const;
const AUTHOR_ID_COLUMNS = ['author_id', 'primary_author_id', 'author'] as const;
const WORK_ID_COLUMNS = ['work_id', 'workId', 'work'] as const;
const OPEN_LIBRARY_WORK_ID_COLUMNS = [
  'open_library_id',
  'open_library_work_id',
  'open_library_key',
  'openlibrary_id',
  'ol_id',
  'ol_key',
] as const;
const OPEN_LIBRARY_EDITION_ID_COLUMNS = [
  'open_library_edition_id',
  'open_library_id',
  'open_library_key',
  'openlibrary_id',
  'ol_id',
  'ol_key',
] as const;
const COVER_STYLES = ['orbit', 'laurel', 'copper', 'women', 'road', 'matter'] as const;

function asRow(value: unknown): DatabaseRow | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as DatabaseRow)
    : null;
}

function asRows(value: unknown): DatabaseRow[] {
  if (Array.isArray(value)) {
    return value.map(asRow).filter((row): row is DatabaseRow => row !== null);
  }

  const row = asRow(value);
  return row ? [row] : [];
}

function readString(row: DatabaseRow, columns: readonly string[]): string | null {
  for (const column of columns) {
    const value = row[column];

    if (typeof value === 'string' || typeof value === 'number') {
      const text = String(value).trim();
      if (text) return text;
    }
  }

  return null;
}

function readNumber(row: DatabaseRow, columns: readonly string[]): number | null {
  const value = readString(row, columns);
  if (!value) return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function readIsbn13(edition: DatabaseRow): string | null {
  for (const column of ISBN_13_COLUMNS) {
    const value = edition[column];
    const candidates = Array.isArray(value) ? value : [value];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' || typeof candidate === 'number') {
        const isbn13 = normalizeIsbn13(String(candidate));
        if (isbn13) return isbn13;
      }
    }
  }

  return null;
}

function readOpenLibraryId(
  row: DatabaseRow,
  columns: readonly string[],
  type: 'edition' | 'work',
): string | null {
  for (const column of columns) {
    const value = readString(row, [column]);
    const openLibraryId = normalizeOpenLibraryId(value, type);
    if (openLibraryId) return openLibraryId;
  }

  return null;
}

function readCoverIds(row: DatabaseRow): number[] {
  const values = ['cover_id', 'cover_i', 'covers'].flatMap((column) => {
    const value = row[column];
    return Array.isArray(value) ? value : [value];
  });

  return values
    .map((value) => Number(value))
    .filter(
      (value) => Number.isSafeInteger(value) && value > 0,
    );
}

function isEnglishEdition(edition: DatabaseRow): boolean {
  const language = readString(edition, ['language', 'language_code']);
  if (language && /^(eng|en|english)$/i.test(language)) return true;

  return asRows(edition.languages).some((candidate) =>
    /(?:^|\/)eng$/i.test(readString(candidate, ['key', 'code']) ?? ''),
  );
}

function editionPreferenceScore(edition: DatabaseRow): number {
  return (
    (readIsbn13(edition) ? 100 : 0) +
    (isEnglishEdition(edition) ? 20 : 0) +
    (readCoverIds(edition).length > 0 ? 10 : 0)
  );
}

function getStoredCoverCandidates(
  work: DatabaseRow,
  editions: DatabaseRow[],
): string[] {
  const preferredEditions = [...editions].sort(
    (left, right) =>
      editionPreferenceScore(right) - editionPreferenceScore(left),
  );

  return uniqueCoverUrls([
    ...preferredEditions.map((edition) =>
      getOpenLibraryCoverUrl(readIsbn13(edition)),
    ),
    ...preferredEditions.map((edition) =>
      getOpenLibraryOlidCoverUrl(
        readOpenLibraryId(
          edition,
          OPEN_LIBRARY_EDITION_ID_COLUMNS,
          'edition',
        ),
      ),
    ),
    ...preferredEditions.flatMap((edition) =>
      readCoverIds(edition).map(getOpenLibraryCoverIdUrl),
    ),
    ...readCoverIds(work).map(getOpenLibraryCoverIdUrl),
  ]);
}

function getWorkId(work: DatabaseRow): string | null {
  return readString(work, ['id']);
}

function getRelatedAuthor(
  work: DatabaseRow,
  authors: DatabaseRow[],
): DatabaseRow | null {
  const embedded = [...asRows(work.author), ...asRows(work.authors)][0];
  if (embedded) return embedded;

  const authorId = readString(work, AUTHOR_ID_COLUMNS);
  return (
    authors.find((author) => readString(author, ['id']) === authorId) ?? null
  );
}

function getRelatedEditions(
  work: DatabaseRow,
  editions: DatabaseRow[],
): DatabaseRow[] {
  const embeddedEditions = asRows(work.editions);
  if (embeddedEditions.length > 0) return embeddedEditions;

  const workId = getWorkId(work);
  if (!workId) return [];

  return editions.filter(
    (edition) => readString(edition, WORK_ID_COLUMNS) === workId,
  );
}

async function loadCatalogRows(limit: number): Promise<{
  works: DatabaseRow[];
  authors: DatabaseRow[];
  editions: DatabaseRow[];
}> {
  const joined = await supabase
    .from('works')
    .select('*, authors(*), editions(*)')
    .order('title', { ascending: true })
    .limit(limit);

  if (!joined.error) {
    return { works: asRows(joined.data), authors: [], editions: [] };
  }

  const [worksResult, authorsResult, editionsResult] = await Promise.all([
    supabase
      .from('works')
      .select('*')
      .order('title', { ascending: true })
      .limit(limit),
    supabase.from('authors').select('*'),
    supabase.from('editions').select('*'),
  ]);

  if (worksResult.error) throw worksResult.error;
  if (authorsResult.error) throw authorsResult.error;
  if (editionsResult.error) throw editionsResult.error;

  return {
    works: asRows(worksResult.data),
    authors: asRows(authorsResult.data),
    editions: asRows(editionsResult.data),
  };
}

function mapCatalogBook(
  work: DatabaseRow,
  authors: DatabaseRow[],
  editions: DatabaseRow[],
  index: number,
): Book | null {
  const workId = getWorkId(work);
  const title = readString(work, ['title', 'name']);
  if (!workId || !title) return null;

  const author = getRelatedAuthor(work, authors);
  const relatedEditions = getRelatedEditions(work, editions);
  const preferredEditions = [...relatedEditions].sort(
    (left, right) =>
      editionPreferenceScore(right) - editionPreferenceScore(left),
  );
  const edition = preferredEditions[0] ?? null;
  const openLibraryWorkId = readOpenLibraryId(
    work,
    OPEN_LIBRARY_WORK_ID_COLUMNS,
    'work',
  );
  const openLibraryEditionId = edition
    ? readOpenLibraryId(
        edition,
        OPEN_LIBRARY_EDITION_ID_COLUMNS,
        'edition',
      )
    : null;

  return {
    id: `work-${workId}`,
    source: 'supabase',
    workId,
    editionId: edition ? readString(edition, ['id']) : null,
    openLibraryWorkId,
    openLibraryEditionId,
    title,
    author: author
      ? readString(author, ['name', 'author_name']) ?? 'Unknown author'
      : 'Unknown author',
    firstPublishYear: readNumber(work, [
      'first_publish_year',
      'first_published_year',
    ]),
    isbn13: edition ? readIsbn13(edition) : null,
    coverUrls: getStoredCoverCandidates(work, preferredEditions),
    score: null,
    ratingsCount: null,
    match: null,
    cover: COVER_STYLES[index % COVER_STYLES.length],
  };
}

export async function loadCatalogBooks(limit = 50): Promise<Book[]> {
  const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit)));
  const { works, authors, editions } = await loadCatalogRows(safeLimit);

  return works
    .map((work, index) => mapCatalogBook(work, authors, editions, index))
    .filter((book): book is Book => book !== null)
    .sort((left, right) =>
      left.title.localeCompare(right.title, 'en', { sensitivity: 'base' }),
    );
}

export async function loadCatalogBook(workId: string): Promise<Book | null> {
  const joined = await supabase
    .from('works')
    .select('*, authors(*), editions(*)')
    .eq('id', workId)
    .maybeSingle();

  if (!joined.error && joined.data) {
    return mapCatalogBook(asRow(joined.data)!, [], [], 0);
  }

  const workResult = await supabase
    .from('works')
    .select('*')
    .eq('id', workId)
    .maybeSingle();

  if (workResult.error) throw workResult.error;
  const work = asRow(workResult.data);
  if (!work) return null;

  const authorId = readString(work, AUTHOR_ID_COLUMNS);
  const [authorResult, editionsResult] = await Promise.all([
    authorId
      ? supabase.from('authors').select('*').eq('id', authorId)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('editions').select('*').eq('work_id', workId),
  ]);

  if (authorResult.error) throw authorResult.error;
  if (editionsResult.error) throw editionsResult.error;

  return mapCatalogBook(
    work,
    asRows(authorResult.data),
    asRows(editionsResult.data),
    0,
  );
}
