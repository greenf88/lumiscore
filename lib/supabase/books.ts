import type { Book } from '@/app/data/books';
import { normalizeIsbn13 } from '@/lib/books/covers';
import { supabase } from './client';

type DatabaseRow = Record<string, unknown>;

const ISBN_13_COLUMNS = ['isbn13', 'isbn_13', 'isbn-13'] as const;
const WORK_ID_COLUMNS = ['work_id', 'workId', 'work'] as const;

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
      return String(value);
    }
  }

  return null;
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

function normalizeTitle(title: string): string {
  return title.trim().toLocaleLowerCase('en');
}

function findWork(book: Book, works: DatabaseRow[]): DatabaseRow | undefined {
  if (book.workId) {
    const matchingId = works.find(
      (work) => readString(work, ['id']) === book.workId,
    );
    if (matchingId) return matchingId;
  }

  const bookTitle = normalizeTitle(book.title);
  return works.find((work) => {
    const title = readString(work, ['title', 'name']);
    return title ? normalizeTitle(title) === bookTitle : false;
  });
}

function getWorkId(work: DatabaseRow): string | null {
  return readString(work, ['id']);
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

async function loadWorksAndEditions(): Promise<{
  works: DatabaseRow[];
  editions: DatabaseRow[];
}> {
  const joined = await supabase.from('works').select('*, editions(*)');

  if (!joined.error) {
    return { works: asRows(joined.data), editions: [] };
  }

  const [worksResult, editionsResult] = await Promise.all([
    supabase.from('works').select('*'),
    supabase.from('editions').select('*'),
  ]);

  if (worksResult.error) throw worksResult.error;
  if (editionsResult.error) throw editionsResult.error;

  return {
    works: asRows(worksResult.data),
    editions: asRows(editionsResult.data),
  };
}

export async function addEditionIsbns(books: Book[]): Promise<Book[]> {
  const { works, editions } = await loadWorksAndEditions();

  return books.map((book) => {
    const work = findWork(book, works);
    if (!work) return book;

    const isbn13 = getRelatedEditions(work, editions)
      .map(readIsbn13)
      .find((isbn): isbn is string => isbn !== null);

    return isbn13 ? { ...book, workId: getWorkId(work), isbn13 } : book;
  });
}
