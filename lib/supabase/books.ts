import type { Book } from '@/app/data/books';
import { normalizeIsbn13 } from '@/lib/books/covers';
import { supabase } from './client';

type DatabaseRow = Record<string, unknown>;

const ISBN_13_COLUMNS = ['isbn13', 'isbn_13', 'isbn-13'] as const;
const AUTHOR_ID_COLUMNS = ['author_id', 'primary_author_id', 'author'] as const;
const WORK_ID_COLUMNS = ['work_id', 'workId', 'work'] as const;
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
  const edition =
    relatedEditions.find((candidate) => readIsbn13(candidate) !== null) ??
    relatedEditions[0] ??
    null;

  return {
    id: `work-${workId}`,
    source: 'supabase',
    workId,
    editionId: edition ? readString(edition, ['id']) : null,
    title,
    author: author
      ? readString(author, ['name', 'author_name']) ?? 'Unknown author'
      : 'Unknown author',
    firstPublishYear: readNumber(work, [
      'first_publish_year',
      'first_published_year',
    ]),
    isbn13: edition ? readIsbn13(edition) : null,
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
