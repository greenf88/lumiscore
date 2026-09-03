import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  getWorkDisplayTitle,
  matchesExpectedAuthor,
  matchesExpectedWorkId,
  selectBestWorkMatch,
  type OpenLibrarySearchDocument,
} from './open-library-matching.ts';
import { SEED_BOOKS, type SeedBook } from './open-library-seeds.ts';

type Row = Record<string, unknown>;

type OpenLibraryEdition = {
  key?: string;
  title?: string;
  isbn_13?: string[];
  languages?: Array<{ key?: string }>;
  publish_date?: string;
  publishers?: string[];
};

type OpenLibraryWork = {
  key?: string;
  title?: string;
  authors?: Array<{
    key?: string;
    author?: { key?: string };
  }>;
};

type DatabaseColumns = {
  authors: {
    id: string;
    openLibraryId: string;
    name: string;
  };
  works: {
    id: string;
    openLibraryId: string;
    title: string;
    authorId: string;
    firstPublishYear: string;
  };
  editions: {
    id: string;
    openLibraryId: string;
    title: string;
    workId: string;
    isbn13: string;
    publishDate: string | null;
    publisher: string | null;
  };
};

const OPEN_LIBRARY_BASE_URL = 'https://openlibrary.org';
const OPEN_LIBRARY_ID_COLUMNS = [
  'open_library_id',
  'open_library_key',
  'openlibrary_id',
  'ol_id',
  'ol_key',
] as const;

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in .env.local.',
  );
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function normalizeOpenLibraryId(value: string | undefined): string | null {
  const id = value?.split('/').filter(Boolean).at(-1);
  return id && /^OL\d+[AWM]$/.test(id) ? id : null;
}

function normalizeIsbn13(value: string | undefined): string | null {
  const isbn = value?.replace(/[\s-]/g, '') ?? '';
  return /^\d{13}$/.test(isbn) ? isbn : null;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchOpenLibraryJson<T>(path: string): Promise<T> {
  const url = new URL(path, OPEN_LIBRARY_BASE_URL);
  let lastError: unknown;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'LumiScoreSeedImporter/1.0 (https://lumiscore.greenf88.chatgpt.site)',
        },
      });

      if (response.ok) return (await response.json()) as T;

      if (response.status !== 429 && response.status < 500) {
        throw new Error(
          `Open Library returned ${response.status} for ${url.pathname}.`,
        );
      }

      lastError = new Error(
        `Open Library returned ${response.status} for ${url.pathname}.`,
      );
    } catch (error) {
      lastError = error;
    }

    await wait(500 * 2 ** attempt);
  }

  const detail = lastError instanceof Error ? ` ${lastError.message}` : '';
  throw new Error(
    `Open Library did not respond successfully for ${url.pathname}.${detail}`,
  );
}

function selectAuthor(
  seed: SeedBook,
  work: OpenLibrarySearchDocument,
): { id: string; name: string } {
  const names = work.author_name ?? [];
  const ids = work.author_key ?? [];
  const matchingIndex = names.findIndex(
    (name) => matchesExpectedAuthor(name, seed.author),
  );
  const index = matchingIndex >= 0 ? matchingIndex : 0;
  const id = normalizeOpenLibraryId(ids[index]);
  const name = names[index];

  if (!id || !name) {
    throw new Error(`Open Library did not return an author ID for “${seed.title}”.`);
  }

  return { id, name };
}

function editionScore(edition: OpenLibraryEdition): number {
  const hasIsbn13 = edition.isbn_13?.some((isbn) => normalizeIsbn13(isbn));
  const isEnglish = edition.languages?.some(
    (language) => language.key === '/languages/eng',
  );

  return (
    (hasIsbn13 ? 100 : 0) +
    (isEnglish ? 20 : 0) +
    (edition.publish_date ? 5 : 0) +
    (edition.publishers?.length ? 2 : 0)
  );
}

const OPEN_LIBRARY_SEARCH_FIELDS =
  'key,title,subtitle,author_key,author_name,first_publish_year,edition_count';

function hasTrustworthyPinnedDocument(
  seed: SeedBook,
  documents: Iterable<OpenLibrarySearchDocument>,
): boolean {
  if (!seed.expectedOpenLibraryWorkId) return true;

  const pinnedDocuments = [...documents].filter((document) =>
    matchesExpectedWorkId(seed, document),
  );
  if (pinnedDocuments.length === 0) return false;

  try {
    selectBestWorkMatch(seed, pinnedDocuments);
    return true;
  } catch {
    return false;
  }
}

async function searchOpenLibraryWorks(
  seed: SeedBook,
): Promise<OpenLibrarySearchDocument[]> {
  const primarySearch = new URLSearchParams({
    q: `${seed.title} ${seed.author}`,
    fields: OPEN_LIBRARY_SEARCH_FIELDS,
    limit: '20',
  });
  const primaryResult = await fetchOpenLibraryJson<{
    docs?: OpenLibrarySearchDocument[];
  }>(`/search.json?${primarySearch}`);
  const documents = new Map(
    (primaryResult.docs ?? [])
      .filter((document) => document.key)
      .map((document) => [document.key!, document]),
  );

  if (
    !seed.expectedOpenLibraryWorkId ||
    hasTrustworthyPinnedDocument(seed, documents.values())
  ) {
    return [...documents.values()];
  }

  for (const title of [seed.title, ...(seed.alternateTitles ?? [])]) {
    const aliasSearch = new URLSearchParams({
      title,
      fields: OPEN_LIBRARY_SEARCH_FIELDS,
      limit: '20',
    });
    const aliasResult = await fetchOpenLibraryJson<{
      docs?: OpenLibrarySearchDocument[];
    }>(`/search.json?${aliasSearch}`);

    for (const document of aliasResult.docs ?? []) {
      if (document.key) documents.set(document.key, document);
    }
    if (hasTrustworthyPinnedDocument(seed, documents.values())) {
      break;
    }
  }

  if (
    seed.expectedOpenLibraryWorkId &&
    !hasTrustworthyPinnedDocument(seed, documents.values())
  ) {
    const pinnedWork = await fetchOpenLibraryJson<OpenLibraryWork>(
      `/works/${seed.expectedOpenLibraryWorkId}.json`,
    );
    const authorKeys = (pinnedWork.authors ?? [])
      .map((entry) => entry.author?.key ?? entry.key)
      .filter((key): key is string => Boolean(key));

    if (!pinnedWork.key || !pinnedWork.title || authorKeys.length === 0) {
      throw new Error(
        `Pinned Open Library work ${seed.expectedOpenLibraryWorkId} is incomplete.`,
      );
    }

    documents.set(pinnedWork.key, {
      key: pinnedWork.key,
      title: seed.title,
      author_key: authorKeys.map(
        (key) => normalizeOpenLibraryId(key) ?? key,
      ),
      author_name: authorKeys.map(() => seed.author),
      first_publish_year: seed.firstPublishYear,
      edition_count: 0,
    });
  }

  return [...documents.values()];
}

async function loadOpenLibraryBook(seed: SeedBook) {
  const work = selectBestWorkMatch(seed, await searchOpenLibraryWorks(seed));
  const workId = normalizeOpenLibraryId(work.key);
  const author = selectAuthor(seed, work);

  if (!workId || !work.title || !work.first_publish_year) {
    throw new Error(`Open Library returned incomplete work data for “${seed.title}”.`);
  }

  const editionResult = await fetchOpenLibraryJson<{
    entries?: OpenLibraryEdition[];
  }>(`/works/${workId}/editions.json?limit=100`);
  const edition = [...(editionResult.entries ?? [])].sort((left, right) => {
    const scoreDifference = editionScore(right) - editionScore(left);
    if (scoreDifference !== 0) return scoreDifference;

    return (left.key ?? '').localeCompare(right.key ?? '');
  })[0];
  const editionId = normalizeOpenLibraryId(edition?.key);

  if (!edition || !editionId) {
    throw new Error(`Open Library returned no suitable edition for “${seed.title}”.`);
  }

  return {
    author,
    work: {
      id: workId,
      openLibraryTitle: work.title,
      title: getWorkDisplayTitle(seed, work),
      firstPublishYear: work.first_publish_year,
    },
    edition: {
      id: editionId,
      title: edition.title ?? work.title,
      isbn13: edition.isbn_13
        ?.map(normalizeIsbn13)
        .find((isbn): isbn is string => isbn !== null) ?? null,
      publishDate: edition.publish_date ?? null,
      publisher: edition.publishers?.[0] ?? null,
    },
  };
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const { error } = await supabase.from(table).select(column).limit(1);
  return error === null;
}

async function resolveColumn(
  table: string,
  purpose: string,
  candidates: readonly string[],
  required = true,
): Promise<string | null> {
  for (const candidate of candidates) {
    if (await columnExists(table, candidate)) return candidate;
  }

  if (!required) return null;
  throw new Error(
    `Table “${table}” needs a ${purpose} column. Tried: ${candidates.join(', ')}.`,
  );
}

async function resolveDatabaseColumns(): Promise<DatabaseColumns> {
  for (const table of ['authors', 'works', 'editions']) {
    const { error } = await supabase.from(table).select('*').limit(1);
    if (error) throw new Error(`Cannot read table “${table}”: ${error.message}`);
  }

  return {
    authors: {
      id: (await resolveColumn('authors', 'primary key', ['id']))!,
      openLibraryId: (await resolveColumn('authors', 'Open Library ID', [
        ...OPEN_LIBRARY_ID_COLUMNS,
        'open_library_author_id',
      ]))!,
      name: (await resolveColumn('authors', 'name', ['name', 'author_name']))!,
    },
    works: {
      id: (await resolveColumn('works', 'primary key', ['id']))!,
      openLibraryId: (await resolveColumn('works', 'Open Library ID', [
        ...OPEN_LIBRARY_ID_COLUMNS,
        'open_library_work_id',
      ]))!,
      title: (await resolveColumn('works', 'title', ['title', 'name']))!,
      authorId: (await resolveColumn('works', 'author relation', [
        'author_id',
        'primary_author_id',
      ]))!,
      firstPublishYear: (await resolveColumn('works', 'first publish year', [
        'first_publish_year',
        'first_published_year',
      ]))!,
    },
    editions: {
      id: (await resolveColumn('editions', 'primary key', ['id']))!,
      openLibraryId: (await resolveColumn('editions', 'Open Library ID', [
        ...OPEN_LIBRARY_ID_COLUMNS,
        'open_library_edition_id',
      ]))!,
      title: (await resolveColumn('editions', 'title', ['title', 'name']))!,
      workId: (await resolveColumn('editions', 'work relation', ['work_id']))!,
      isbn13: (await resolveColumn('editions', 'ISBN-13', [
        'isbn13',
        'isbn_13',
      ]))!,
      publishDate: await resolveColumn(
        'editions',
        'publish date',
        ['publish_date', 'published_at'],
        false,
      ),
      publisher: await resolveColumn(
        'editions',
        'publisher',
        ['publisher'],
        false,
      ),
    },
  };
}

async function findExistingRow(
  client: SupabaseClient,
  table: string,
  idColumn: string,
  filters: Row,
): Promise<Row | null> {
  const { data, error } = await client
    .from(table)
    .select(idColumn)
    .match(filters)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as Row | null;
}

async function saveWithoutDuplicates(options: {
  table: string;
  idColumn: string;
  openLibraryIdColumn: string;
  openLibraryId: string;
  payload: Row;
  fallbackFilters: Row[];
}): Promise<{ id: string; created: boolean }> {
  const {
    table,
    idColumn,
    openLibraryIdColumn,
    openLibraryId,
    payload,
    fallbackFilters,
  } = options;
  const idVariants = [
    openLibraryId,
    `/authors/${openLibraryId}`,
    `/works/${openLibraryId}`,
    `/books/${openLibraryId}`,
  ];
  const { data: byOpenLibraryId, error: lookupError } = await supabase
    .from(table)
    .select(idColumn)
    .in(openLibraryIdColumn, idVariants)
    .limit(1)
    .maybeSingle();

  if (lookupError) throw lookupError;

  let existing = byOpenLibraryId as Row | null;
  for (const filters of fallbackFilters) {
    if (existing) break;
    existing = await findExistingRow(supabase, table, idColumn, filters);
  }

  if (existing) {
    const { data, error } = await supabase
      .from(table)
      .update(payload)
      .eq(idColumn, existing[idColumn])
      .select(idColumn)
      .single();
    if (error) throw error;
    return { id: String((data as unknown as Row)[idColumn]), created: false };
  }

  const { data, error } = await supabase
    .from(table)
    .insert(payload)
    .select(idColumn)
    .single();
  if (error) throw error;
  return { id: String((data as unknown as Row)[idColumn]), created: true };
}

async function importBook(
  seed: SeedBook,
  columns: DatabaseColumns,
): Promise<string> {
  const book = await loadOpenLibraryBook(seed);
  const legacyAuthor = await findExistingRow(
    supabase,
    'authors',
    columns.authors.id,
    { [columns.authors.name]: seed.author },
  );
  const authorPayload: Row = {
    [columns.authors.openLibraryId]: book.author.id,
    [columns.authors.name]: book.author.name,
  };
  const author = await saveWithoutDuplicates({
    table: 'authors',
    idColumn: columns.authors.id,
    openLibraryIdColumn: columns.authors.openLibraryId,
    openLibraryId: book.author.id,
    payload: authorPayload,
    fallbackFilters: [{ [columns.authors.name]: book.author.name }],
  });

  const workPayload: Row = {
    [columns.works.openLibraryId]: book.work.id,
    [columns.works.title]: book.work.title,
    [columns.works.authorId]: author.id,
    [columns.works.firstPublishYear]: book.work.firstPublishYear,
  };
  const work = await saveWithoutDuplicates({
    table: 'works',
    idColumn: columns.works.id,
    openLibraryIdColumn: columns.works.openLibraryId,
    openLibraryId: book.work.id,
    payload: workPayload,
    fallbackFilters: [
      {
        [columns.works.title]: book.work.title,
        [columns.works.authorId]: author.id,
      },
      {
        [columns.works.title]: book.work.openLibraryTitle,
        [columns.works.authorId]: author.id,
      },
      ...(legacyAuthor && String(legacyAuthor[columns.authors.id]) !== author.id
        ? [
            {
              [columns.works.title]: book.work.title,
              [columns.works.authorId]: legacyAuthor[columns.authors.id],
            },
            {
              [columns.works.title]: book.work.openLibraryTitle,
              [columns.works.authorId]: legacyAuthor[columns.authors.id],
            },
          ]
        : []),
    ],
  });

  const editionPayload: Row = {
    [columns.editions.openLibraryId]: book.edition.id,
    [columns.editions.title]: book.edition.title,
    [columns.editions.workId]: work.id,
    [columns.editions.isbn13]: book.edition.isbn13,
  };
  if (columns.editions.publishDate && book.edition.publishDate) {
    editionPayload[columns.editions.publishDate] = book.edition.publishDate;
  }
  if (columns.editions.publisher && book.edition.publisher) {
    editionPayload[columns.editions.publisher] = book.edition.publisher;
  }

  const editionFallbacks: Row[] = [];
  if (book.edition.isbn13) {
    editionFallbacks.push({
      [columns.editions.isbn13]: book.edition.isbn13,
    });
  }
  editionFallbacks.push({
    [columns.editions.workId]: work.id,
    [columns.editions.title]: book.edition.title,
  });
  editionFallbacks.push({ [columns.editions.workId]: work.id });
  const edition = await saveWithoutDuplicates({
    table: 'editions',
    idColumn: columns.editions.id,
    openLibraryIdColumn: columns.editions.openLibraryId,
    openLibraryId: book.edition.id,
    payload: editionPayload,
    fallbackFilters: editionFallbacks,
  });

  const actions = [author.created, work.created, edition.created].filter(Boolean)
    .length;
  return `${book.work.title} — ${book.author.name} (${actions} new row${actions === 1 ? '' : 's'})`;
}

async function main(): Promise<void> {
  const unpinnedSeeds = SEED_BOOKS.filter(
    (seed) => !seed.expectedOpenLibraryWorkId,
  );
  if (unpinnedSeeds.length > 0) {
    throw new Error(
      `Refusing to import ${unpinnedSeeds.length} unpinned seed(s): ${unpinnedSeeds
        .map((seed) => `“${seed.title}”`)
        .join(', ')}. Resolve their exact Open Library Work IDs first.`,
    );
  }

  console.log('Checking the existing Supabase schema…');
  const columns = await resolveDatabaseColumns();
  const failures: string[] = [];
  const dryRun = process.env.OPEN_LIBRARY_IMPORT_DRY_RUN === 'true';
  const requestedWorkIds = new Set(
    (process.env.OPEN_LIBRARY_IMPORT_WORK_IDS ?? '')
      .split(',')
      .map((workId) => workId.trim().toUpperCase())
      .filter(Boolean),
  );
  const seeds =
    requestedWorkIds.size === 0
      ? SEED_BOOKS
      : SEED_BOOKS.filter((seed) =>
          requestedWorkIds.has(seed.expectedOpenLibraryWorkId!.toUpperCase()),
        );

  if (requestedWorkIds.size > 0 && seeds.length !== requestedWorkIds.size) {
    throw new Error('One or more requested recovery Work IDs are not configured.');
  }

  for (const [index, seed] of seeds.entries()) {
    try {
      if (dryRun) {
        const book = await loadOpenLibraryBook(seed);
        console.log(
          `[${index + 1}/${seeds.length}] Verified ${book.work.title} — ${book.author.name}`,
        );
      } else {
        const result = await importBook(seed, columns);
        console.log(`[${index + 1}/${seeds.length}] Imported ${result}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${seed.title}: ${message}`);
      console.error(`[${index + 1}/${seeds.length}] Failed ${seed.title}: ${message}`);
    }

    await wait(150);
  }

  if (failures.length > 0) {
    throw new Error(`${failures.length} import(s) failed. Rerun after fixing the errors above.`);
  }

  console.log(
    dryRun
      ? `Done. ${seeds.length} seed books passed the metadata preflight.`
      : `Done. ${seeds.length} seed books are present without duplicates.`,
  );
}

await main();
