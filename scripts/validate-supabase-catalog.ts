import { createClient } from '@supabase/supabase-js';
import { SEED_BOOKS } from './open-library-seeds.ts';

type Row = Record<string, unknown>;

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error('Missing Supabase URL or server-side secret key.');
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function asRows(value: unknown): Row[] {
  if (Array.isArray(value)) return value as Row[];
  return value && typeof value === 'object' ? [value as Row] : [];
}

function readText(row: Row, column: string): string | null {
  const value = row[column];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

const expectedWorkIds = SEED_BOOKS.map(
  (seed) => seed.expectedOpenLibraryWorkId!,
);
const expectedWorkIdSet = new Set(expectedWorkIds);
const rows: Row[] = [];

for (let index = 0; index < expectedWorkIds.length; index += 100) {
  const { data, error } = await supabase
    .from('works')
    .select(
      'id, open_library_id, title, author_id, authors(name), editions(id, open_library_edition_id, isbn_13, title)',
    )
    .in('open_library_id', expectedWorkIds.slice(index, index + 100));

  if (error) throw error;
  rows.push(...((data ?? []) as unknown as Row[]));
}

const rowsByWorkId = new Map<string, Row[]>();
for (const row of rows) {
  const workId = readText(row, 'open_library_id')?.toUpperCase();
  if (!workId) continue;
  const matchingRows = rowsByWorkId.get(workId) ?? [];
  matchingRows.push(row);
  rowsByWorkId.set(workId, matchingRows);
}

const missingWorkIds = expectedWorkIds.filter(
  (workId) => !rowsByWorkId.has(workId),
);
const duplicateWorkIds = [...rowsByWorkId]
  .filter(([, matchingRows]) => matchingRows.length > 1)
  .map(([workId, matchingRows]) => ({ workId, count: matchingRows.length }));

const allWorkRows: Row[] = [];
for (let start = 0; ; start += 1000) {
  const { data, error } = await supabase
    .from('works')
    .select('id, open_library_id, title, authors(name)')
    .range(start, start + 999);
  if (error) throw error;

  const page = (data ?? []) as unknown as Row[];
  allWorkRows.push(...page);
  if (page.length < 1000) break;
}

const allRowsByWorkId = new Map<string, Row[]>();
for (const row of allWorkRows) {
  const workId = readText(row, 'open_library_id')?.toUpperCase();
  if (!workId) continue;
  const matchingRows = allRowsByWorkId.get(workId) ?? [];
  matchingRows.push(row);
  allRowsByWorkId.set(workId, matchingRows);
}
const allDuplicateWorkIds = [...allRowsByWorkId]
  .filter(([, matchingRows]) => matchingRows.length > 1)
  .map(([workId, matchingRows]) => ({ workId, count: matchingRows.length }));
const unexpectedRows = allWorkRows
  .filter((row) => {
    const workId = readText(row, 'open_library_id')?.toUpperCase();
    return !workId || !expectedWorkIdSet.has(workId);
  })
  .map((row) => ({
    workId: readText(row, 'open_library_id'),
    title: readText(row, 'title'),
    author: readText(asRows(row.authors)[0] ?? {}, 'name'),
  }));
const incompleteRows = rows
  .filter((row) => {
    const author = asRows(row.authors)[0];
    return (
      !readText(row, 'open_library_id') ||
      !readText(row, 'title') ||
      !author ||
      !readText(author, 'name')
    );
  })
  .map((row) => ({
    workId: readText(row, 'open_library_id'),
    title: readText(row, 'title'),
  }));
const rowsWithoutIsbn13 = rows
  .filter((row) =>
    asRows(row.editions).every((edition) => !readText(edition, 'isbn_13')),
  )
  .map((row) => ({
    workId: readText(row, 'open_library_id'),
    title: readText(row, 'title'),
    editionIds: asRows(row.editions)
      .map((edition) => readText(edition, 'open_library_edition_id'))
      .filter(Boolean),
  }));

const sampleTitles = [
  'The Hobbit',
  'Dune',
  'The Lord of the Rings',
  'War and Peace',
  'The Count of Monte Cristo',
  'The Alchemist',
  'Before the Coffee Gets Cold',
  'The Hunger Games',
  "Harry Potter and the Philosopher's Stone",
  'Sapiens',
  'The Remains of the Day',
  'Native Son',
  'The Girl Who Drank the Moon',
] as const;

const samples = sampleTitles.map((title) => {
  const seed = SEED_BOOKS.find(
    (candidate) =>
      (candidate.preferredDisplayTitle ?? candidate.title) === title ||
      candidate.title === title,
  );
  const row = seed
    ? rowsByWorkId.get(seed.expectedOpenLibraryWorkId!)?.[0]
    : null;
  const author = row ? asRows(row.authors)[0] : null;
  const editions = row ? asRows(row.editions) : [];

  return {
    requestedTitle: title,
    expectedWorkId: seed?.expectedOpenLibraryWorkId ?? null,
    present: Boolean(row),
    storedTitle: row ? readText(row, 'title') : null,
    storedAuthor: author ? readText(author, 'name') : null,
    isbn13: editions
      .map((edition) => readText(edition, 'isbn_13'))
      .find(Boolean) ?? null,
  };
});

const { count: totalWorks, error: countError } = await supabase
  .from('works')
  .select('*', { count: 'exact', head: true });
if (countError) throw countError;

const result = {
  expectedWorks: expectedWorkIds.length,
  totalWorks,
  foundExpectedRows: rows.length,
  uniqueExpectedWorkIdsFound: rowsByWorkId.size,
  missingWorkIds,
  duplicateWorkIds,
  allDuplicateWorkIds,
  unexpectedRows,
  incompleteRows,
  rowsWithoutIsbn13,
  samples,
};

console.log(JSON.stringify(result, null, 2));

if (
  rows.length !== 1000 ||
  rowsByWorkId.size !== 1000 ||
  missingWorkIds.length > 0 ||
  duplicateWorkIds.length > 0 ||
  allDuplicateWorkIds.length > 0 ||
  incompleteRows.length > 0
) {
  process.exitCode = 1;
}
