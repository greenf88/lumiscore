import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  normalizeEditionLanguage,
  selectRepresentativeEdition,
} from '../lib/books/edition-ranking.ts';
import {
  completePinnedWorkMetadata,
  getWorkDisplayTitle,
  matchesExpectedAuthor,
  matchesExpectedWorkId,
  selectBestWorkMatch,
  type OpenLibrarySearchDocument,
} from './open-library-matching.ts';
import { createOpenLibraryImportPlan } from './open-library-import-plan.ts';
import {
  REVIEWED_SERIES_SEED_BOOKS,
  SEED_BOOKS,
  type SeedBook,
} from './open-library-seeds.ts';
import { NETHERLANDS_SEEDS } from './open-library-seeds-nl.ts';
import {
  assertNativeSeedIsSafe,
  getNativeWorkIdentityKey,
  normalizeNativeIdentityPart,
  normalizeNativeIsbn13,
} from './lumiscore-native-import.ts';
import type { NativeSeedMetadata } from './lumiscore-native-seeds-nl.ts';

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
    sourceType: string;
    workType: string;
    nativeIdentityKey: string;
  };
  editions: {
    id: string;
    openLibraryId: string;
    title: string;
    workId: string;
    isbn10: string | null;
    isbn13: string;
    publishDate: string | null;
    publisher: string | null;
    language: string | null;
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

type RankedOpenLibraryEdition = OpenLibraryEdition & {
  openLibraryEditionId: string | null;
  physicalFormat: string | null;
  languageCodes: string[];
  isbn10: string[];
  isbn13: string[];
  publishDate: string | null;
  publishers: string[];
  coverIds: number[];
};

function toRankedOpenLibraryEdition(
  edition: OpenLibraryEdition,
): RankedOpenLibraryEdition {
  return {
    ...edition,
    openLibraryEditionId: normalizeOpenLibraryId(edition.key),
    physicalFormat: edition.physical_format ?? null,
    languageCodes: (edition.languages ?? [])
      .map((language) => language.key ?? '')
      .filter(Boolean),
    isbn10: edition.isbn_10 ?? [],
    isbn13: edition.isbn_13 ?? [],
    publishDate: edition.publish_date ?? null,
    publishers: edition.publishers ?? [],
    coverIds: edition.covers ?? [],
  };
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

    const pinnedDocument = completePinnedWorkMetadata(seed, {
      key: pinnedWork.key ?? `/works/${seed.expectedOpenLibraryWorkId}`,
      title: pinnedWork.title,
      author_key: authorKeys.map(
        (key) => normalizeOpenLibraryId(key) ?? key,
      ),
      author_name: authorKeys.map(() => seed.author),
      first_publish_year: undefined,
      edition_count: 0,
    });

    if (
      !pinnedDocument.key ||
      !pinnedDocument.title ||
      !pinnedDocument.author_key?.length
    ) {
      throw new Error(
        `Pinned Open Library work ${seed.expectedOpenLibraryWorkId} is incomplete.`,
      );
    }

    documents.set(pinnedDocument.key, pinnedDocument);
  }

  return [...documents.values()];
}

async function loadOpenLibraryBook(seed: SeedBook) {
  const work = completePinnedWorkMetadata(
    seed,
    selectBestWorkMatch(seed, await searchOpenLibraryWorks(seed)),
  );
  const workId = normalizeOpenLibraryId(work.key);
  const author = selectAuthor(seed, work);

  if (!workId || !work.title || !work.first_publish_year) {
    throw new Error(`Open Library returned incomplete work data for “${seed.title}”.`);
  }
  const workTitle = work.title;

  const editionResult = await fetchOpenLibraryJson<{
    entries?: OpenLibraryEdition[];
  }>(`/works/${workId}/editions.json?limit=500`);
  const rankedEditions = (editionResult.entries ?? []).map(
    toRankedOpenLibraryEdition,
  );
  const requestedLanguages = seed.editionLanguagesToImport ?? [];
  const localizedEditions = requestedLanguages.flatMap((language) => {
    const candidates = rankedEditions.filter((edition) =>
      edition.languageCodes.some((code) =>
        normalizeEditionLanguage(code) === normalizeEditionLanguage(language),
      ),
    );
    const selected = selectRepresentativeEdition(candidates, {
      workTitle,
      firstPublishYear: seed.firstPublishYear ?? work.first_publish_year,
      preferredLanguages: [language],
    });
    return selected ? [selected] : [];
  });
  const primaryEdition = selectRepresentativeEdition(rankedEditions, {
    workTitle,
    firstPublishYear: seed.firstPublishYear ?? work.first_publish_year,
    preferredLanguages: seed.preferredEditionLanguages ?? ['eng'],
  });
  const editions = [...new Map(
    [primaryEdition, ...localizedEditions]
      .filter((edition): edition is RankedOpenLibraryEdition => Boolean(edition))
      .flatMap((edition) => {
        const editionId = normalizeOpenLibraryId(edition.key);
        return editionId ? [[editionId, edition] as const] : [];
      }),
  ).entries()].map(([editionId, edition]) => ({ editionId, edition }));

  if (editions.length === 0) {
    throw new Error(`Open Library returned no suitable edition for “${seed.title}”.`);
  }

  return {
    author,
    work: {
      id: workId,
      openLibraryTitle: workTitle,
      title: getWorkDisplayTitle(seed, work),
      firstPublishYear: seed.firstPublishYear ?? work.first_publish_year,
    },
    editions: editions.map(({ editionId, edition }) => ({
      id: editionId,
      title: edition.title ?? workTitle,
      isbn10: edition.isbn_10?.find((isbn) => /^\d{9}[\dX]$/i.test(isbn.replace(/[\s-]/g, '')))?.replace(/[\s-]/g, '') ?? null,
      isbn13: edition.isbn_13
        ?.map(normalizeIsbn13)
        .find((isbn): isbn is string => isbn !== null) ?? null,
      publishDate: edition.publish_date ?? null,
      publisher: edition.publishers?.[0] ?? null,
      language: edition.languages?.[0]?.key?.split('/').filter(Boolean).at(-1) ?? null,
    })),
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
      sourceType: (await resolveColumn('works', 'source type', ['source_type']))!,
      workType: (await resolveColumn('works', 'work type', ['work_type']))!,
      nativeIdentityKey: (await resolveColumn('works', 'native identity key', [
        'native_identity_key',
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
      isbn10: await resolveColumn('editions', 'ISBN-10', ['isbn_10', 'isbn10'], false),
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
      language: await resolveColumn(
        'editions',
        'language',
        ['language', 'language_code'],
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
    [columns.works.sourceType]: 'open_library',
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

  let createdEditions = 0;
  for (const edition of book.editions) {
    const editionPayload: Row = {
      [columns.editions.openLibraryId]: edition.id,
      [columns.editions.title]: edition.title,
      [columns.editions.workId]: work.id,
      [columns.editions.isbn13]: edition.isbn13,
    };
    if (columns.editions.isbn10 && edition.isbn10) {
      editionPayload[columns.editions.isbn10] = edition.isbn10;
    }
    if (columns.editions.publishDate && edition.publishDate) {
      editionPayload[columns.editions.publishDate] = edition.publishDate;
    }
    if (columns.editions.publisher && edition.publisher) {
      editionPayload[columns.editions.publisher] = edition.publisher;
    }
    if (columns.editions.language && edition.language) {
      editionPayload[columns.editions.language] = edition.language;
    }

    const editionFallbacks: Row[] = [];
    if (edition.isbn13) {
      editionFallbacks.push({ [columns.editions.isbn13]: edition.isbn13 });
    }
    editionFallbacks.push({
      [columns.editions.workId]: work.id,
      [columns.editions.openLibraryId]: edition.id,
    });
    const savedEdition = await saveWithoutDuplicates({
      table: 'editions',
      idColumn: columns.editions.id,
      openLibraryIdColumn: columns.editions.openLibraryId,
      openLibraryId: edition.id,
      payload: editionPayload,
      fallbackFilters: editionFallbacks,
    });
    if (savedEdition.created) createdEditions += 1;
  }

  const actions = Number(author.created) + Number(work.created) + createdEditions;
  return `${book.work.title} — ${book.author.name} (${actions} new row${actions === 1 ? '' : 's'})`;
}

type NativeSeed = SeedBook & { nativeMetadata: NativeSeedMetadata };

async function findNativeAuthorByNormalizedName(
  name: string,
  columns: DatabaseColumns,
): Promise<Row | null> {
  const { data, error } = await supabase
    .from('authors')
    .select(`${columns.authors.id},${columns.authors.name}`);
  if (error) throw error;
  const normalizedName = normalizeNativeIdentityPart(name);
  return (
    ((data ?? []) as unknown as Row[]).find(
      (row) =>
        normalizeNativeIdentityPart(String(row[columns.authors.name] ?? '')) ===
        normalizedName,
    ) ?? null
  );
}

async function importNativeBook(
  seed: NativeSeed,
  columns: DatabaseColumns,
): Promise<string> {
  assertNativeSeedIsSafe(seed);
  const metadata = seed.nativeMetadata;
  const isbn13 = normalizeNativeIsbn13(metadata.isbn13)!;
  const identityKey = getNativeWorkIdentityKey(seed.title, seed.author!);

  let author = await findNativeAuthorByNormalizedName(seed.author!, columns);
  let authorCreated = false;
  if (!author) {
    const { data, error } = await supabase
      .from('authors')
      .insert({
        [columns.authors.openLibraryId]: null,
        [columns.authors.name]: seed.author,
      } as Row)
      .select(columns.authors.id)
      .single();
    if (error) throw error;
    author = data as unknown as Row;
    authorCreated = true;
  }
  const authorId = String(author[columns.authors.id]);

  const nativeWorkPayload: Row = {
    [columns.works.openLibraryId]: null,
    [columns.works.title]: seed.preferredDisplayTitle ?? seed.title,
    [columns.works.authorId]: authorId,
    [columns.works.firstPublishYear]: metadata.publicationYear,
    [columns.works.sourceType]: 'lumiscore_native',
    [columns.works.workType]: metadata.workType,
    [columns.works.nativeIdentityKey]: identityKey,
  };
  let work = await findExistingRow(supabase, 'works', columns.works.id, {
    [columns.works.nativeIdentityKey]: identityKey,
  });
  let workCreated = false;
  if (work) {
    const { error } = await supabase
      .from('works')
      .update(nativeWorkPayload)
      .eq(columns.works.id, work[columns.works.id]);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from('works')
      .insert(nativeWorkPayload)
      .select(columns.works.id)
      .single();
    if (error) throw error;
    work = data as unknown as Row;
    workCreated = true;
  }
  const workId = String(work[columns.works.id]);

  const existingEdition = await findExistingRow(
    supabase,
    'editions',
    columns.editions.id,
    { [columns.editions.isbn13]: isbn13 },
  );
  let editionCreated = false;
  if (existingEdition) {
    const { data, error } = await supabase
      .from('editions')
      .select(columns.editions.workId)
      .eq(columns.editions.id, existingEdition[columns.editions.id])
      .single();
    if (error) throw error;
    if (String((data as unknown as Row)[columns.editions.workId]) !== workId) {
      throw new Error(`ISBN-13 ${isbn13} already belongs to another work.`);
    }
  } else {
    const editionPayload: Row = {
      [columns.editions.openLibraryId]: null,
      [columns.editions.title]: seed.preferredDisplayTitle ?? seed.title,
      [columns.editions.workId]: workId,
      [columns.editions.isbn13]: isbn13,
    };
    if (columns.editions.publishDate) {
      editionPayload[columns.editions.publishDate] = String(metadata.publicationYear);
    }
    if (columns.editions.publisher) {
      editionPayload[columns.editions.publisher] = metadata.publisher;
    }
    if (columns.editions.language) {
      editionPayload[columns.editions.language] = metadata.language;
    }
    const { error } = await supabase.from('editions').insert(editionPayload);
    if (error) throw error;
    editionCreated = true;
  }

  const actions = [authorCreated, workCreated, editionCreated].filter(Boolean).length;
  return `${seed.title} — ${seed.author} (${actions} new row${actions === 1 ? '' : 's'})`;
}

async function main(): Promise<void> {
  const scopeArgument = process.argv.find((argument) =>
    argument.startsWith('--scope='),
  );
  const scope = scopeArgument?.slice('--scope='.length) ?? 'all';
  if (scope !== 'all' && scope !== 'netherlands' && scope !== 'series') {
    throw new Error(
      `Unsupported import scope “${scope}”. Use “all”, “netherlands” or “series”.`,
    );
  }

  const scopedSeeds = scope === 'netherlands'
    ? NETHERLANDS_SEEDS
    : scope === 'series'
      ? REVIEWED_SERIES_SEED_BOOKS
      : SEED_BOOKS;
  const plan = createOpenLibraryImportPlan(scopedSeeds);
  if (plan.invalidUnpinnedSeeds.length > 0) {
    throw new Error(
      `Refusing to import ${plan.invalidUnpinnedSeeds.length} unpinned seed(s) without a manual-review marker: ${plan.invalidUnpinnedSeeds
        .map((seed) => `“${seed.title}”`)
        .join(', ')}. Pin or explicitly mark them for manual review first.`,
    );
  }

  const dryRun = process.env.OPEN_LIBRARY_IMPORT_DRY_RUN === 'true' ||
    process.argv.includes('--dry-run');
  const requestedWorkIds = new Set(
    (process.env.OPEN_LIBRARY_IMPORT_WORK_IDS ?? '')
      .split(',')
      .map((workId) => workId.trim().toUpperCase())
      .filter(Boolean),
  );
  const seeds =
    requestedWorkIds.size === 0
      ? plan.verifiedSeeds
      : plan.verifiedSeeds.filter((seed) =>
          requestedWorkIds.has(seed.expectedOpenLibraryWorkId!.toUpperCase()),
        );

  if (requestedWorkIds.size > 0 && seeds.length !== requestedWorkIds.size) {
    throw new Error('One or more requested recovery Work IDs are not configured.');
  }

  if (requestedWorkIds.size === 0) {
    for (const seed of plan.skippedManualReviewSeeds) {
      console.log(`[SKIPPED REVIEW] ${seed.title} — ${seed.author}`);
    }
    for (const seed of plan.rejectedSeeds) {
      console.log(`[REJECTED] ${seed.title} — ${seed.author}`);
    }
  }

  console.log('Checking the existing Supabase schema…');
  const columns = await resolveDatabaseColumns();
  const failures: string[] = [];
  let processed = 0;

  for (const [index, seed] of seeds.entries()) {
    try {
      if (dryRun) {
        const book = await loadOpenLibraryBook(seed);
        console.log(
          `[OPEN LIBRARY] [${index + 1}/${seeds.length}] Verified ${book.work.title} — ${book.author.name}; editions: ${book.editions.map((edition) => edition.language ?? 'und').join(', ')}`,
        );
      } else {
        const result = await importBook(seed, columns);
        console.log(`[OPEN LIBRARY] [${index + 1}/${seeds.length}] Imported ${result}`);
      }
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${seed.title}: ${message}`);
      console.error(`[${index + 1}/${seeds.length}] Failed ${seed.title}: ${message}`);
    }

    await wait(150);
  }

  let nativeProcessed = 0;
  if (requestedWorkIds.size === 0) {
    for (const [index, seed] of plan.nativeSeeds.entries()) {
      try {
        const nativeSeed = seed as NativeSeed;
        assertNativeSeedIsSafe(nativeSeed);
        if (dryRun) {
          console.log(`[LUMISCORE NATIVE] [${index + 1}/${plan.nativeSeeds.length}] Verified ${seed.title} — ${seed.author}`);
        } else {
          const result = await importNativeBook(nativeSeed, columns);
          console.log(`[LUMISCORE NATIVE] [${index + 1}/${plan.nativeSeeds.length}] Imported ${result}`);
        }
        nativeProcessed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${seed.title}: ${message}`);
        console.error(`[LUMISCORE NATIVE] Failed ${seed.title}: ${message}`);
      }
    }
  }

  const skipped = requestedWorkIds.size === 0
    ? plan.skippedManualReviewSeeds.length
    : 0;
  const rejected = requestedWorkIds.size === 0 ? plan.rejectedSeeds.length : 0;
  console.log(
    `Summary: ${processed} Open Library processed, ${nativeProcessed} LumiScore native processed, ${skipped} skipped for review, ${rejected} rejected, ${failures.length} failed.`,
  );

  if (failures.length > 0) {
    throw new Error(`${failures.length} import(s) failed. Rerun after fixing the errors above.`);
  }

  console.log(
    dryRun
      ? `Done. ${processed + nativeProcessed} seed books passed the metadata preflight.`
      : `Done. ${processed + nativeProcessed} seed books are present without duplicates.`,
  );
}

await main();
