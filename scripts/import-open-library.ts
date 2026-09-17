import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
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
import type { CatalogExpansionPlan } from './catalog-expansion-types.ts';
import { getReviewedWorkPublicationYear } from '../lib/catalog/reviewed-work-publication-year-corrections.ts';
import {
  decideOpenLibraryAuthorIdentity,
  normalizeOpenLibraryAuthorId,
  type StoredOpenLibraryAuthor,
} from '../lib/catalog/open-library-author-identity.ts';

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
  const firstPublishYear = seed.firstPublishYear ?? work.first_publish_year;

  if (!workId || !work.title || !firstPublishYear) {
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
      firstPublishYear,
      preferredLanguages: [language],
    });
    return selected ? [selected] : [];
  });
  const primaryEdition = selectRepresentativeEdition(rankedEditions, {
    workTitle,
    firstPublishYear,
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
      firstPublishYear,
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
  additionalColumns: readonly string[] = [],
): Promise<Row | null> {
  const { data, error } = await client
    .from(table)
    .select([idColumn, ...additionalColumns].join(','))
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
  preserveExistingColumns?: string[];
}): Promise<{ id: string; created: boolean }> {
  const {
    table,
    idColumn,
    openLibraryIdColumn,
    openLibraryId,
    payload,
    fallbackFilters,
    preserveExistingColumns = [],
  } = options;
  const idVariants = [
    openLibraryId,
    `/authors/${openLibraryId}`,
    `/works/${openLibraryId}`,
    `/books/${openLibraryId}`,
  ];
  const { data: byOpenLibraryId, error: lookupError } = await supabase
    .from(table)
    .select([idColumn, ...preserveExistingColumns].join(','))
    .in(openLibraryIdColumn, idVariants)
    .limit(1)
    .maybeSingle();

  if (lookupError) throw lookupError;

  let existing = byOpenLibraryId as Row | null;
  for (const filters of fallbackFilters) {
    if (existing) break;
    existing = await findExistingRow(
      supabase,
      table,
      idColumn,
      filters,
      preserveExistingColumns,
    );
  }

  if (existing) {
    const updatePayload = { ...payload };
    for (const column of preserveExistingColumns) delete updatePayload[column];
    if (Object.keys(updatePayload).length === 0) {
      return { id: String(existing[idColumn]), created: false };
    }
    const { data, error } = await supabase
      .from(table)
      .update(updatePayload)
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

type AuthorIdentityConflict = {
  authorId: string;
  authorName: string;
  storedOpenLibraryId: string;
  incomingOpenLibraryId: string;
};

async function saveAuthorWithoutIdentityOverwrite(options: {
  columns: DatabaseColumns['authors'];
  incomingOpenLibraryId: string;
  incomingName: string;
  fallbackNames: readonly string[];
}): Promise<{
  id: string;
  created: boolean;
  enriched: boolean;
  identityConflict: AuthorIdentityConflict | null;
}> {
  const { columns, incomingOpenLibraryId, incomingName } = options;
  const selectedColumns = [columns.id, columns.openLibraryId, columns.name].join(',');
  const normalizedIncomingId = normalizeOpenLibraryAuthorId(incomingOpenLibraryId);
  if (!normalizedIncomingId) throw new Error(`Invalid Open Library Author ID: ${incomingOpenLibraryId}`);
  const idVariants = [normalizedIncomingId, `/authors/${normalizedIncomingId}`];
  const { data: identityData, error: identityError } = await supabase
    .from('authors')
    .select(selectedColumns)
    .in(columns.openLibraryId, idVariants)
    .limit(1)
    .maybeSingle();
  if (identityError) throw identityError;

  let nameRow: Row | null = null;
  if (!identityData) {
    for (const name of [...new Set(options.fallbackNames.map((value) => value.trim()).filter(Boolean))]) {
      nameRow = await findExistingRow(
        supabase,
        'authors',
        columns.id,
        { [columns.name]: name },
        [columns.openLibraryId, columns.name],
      );
      if (nameRow) break;
    }
  }

  const toStoredAuthor = (row: Row | null): StoredOpenLibraryAuthor | null => row
    ? {
        id: String(row[columns.id]),
        name: String(row[columns.name] ?? ''),
        openLibraryId: typeof row[columns.openLibraryId] === 'string'
          ? String(row[columns.openLibraryId])
          : null,
      }
    : null;
  const decision = decideOpenLibraryAuthorIdentity({
    incomingOpenLibraryId: normalizedIncomingId,
    existingByIncomingId: toStoredAuthor(identityData as Row | null),
    existingByName: toStoredAuthor(nameRow),
  });

  if (decision.action === 'create') {
    const authorPayload: Row = {
      [columns.openLibraryId]: normalizedIncomingId,
      [columns.name]: incomingName,
    };
    const { data, error } = await supabase
      .from('authors')
      .insert(authorPayload)
      .select(columns.id)
      .single();
    if (error) throw error;
    return {
      id: String((data as unknown as Row)[columns.id]),
      created: true,
      enriched: false,
      identityConflict: null,
    };
  }

  if (decision.action === 'enrich') {
    const identityPayload: Row = {
      [columns.openLibraryId]: normalizedIncomingId,
    };
    const { error } = await supabase
      .from('authors')
      .update(identityPayload)
      .eq(columns.id, decision.author.id);
    if (error) throw error;
    return {
      id: decision.author.id,
      created: false,
      enriched: true,
      identityConflict: null,
    };
  }

  const identityConflict = decision.action === 'preserve_conflict'
    ? {
        authorId: decision.author.id,
        authorName: decision.author.name || incomingName,
        storedOpenLibraryId: decision.conflict.storedOpenLibraryId,
        incomingOpenLibraryId: decision.conflict.incomingOpenLibraryId,
      }
    : null;
  return {
    id: decision.author.id,
    created: false,
    enriched: false,
    identityConflict,
  };
}

async function importBook(
  seed: SeedBook,
  columns: DatabaseColumns,
): Promise<{ summary: string; authorIdentityConflict: AuthorIdentityConflict | null }> {
  const book = await loadOpenLibraryBook(seed);
  const legacyAuthor = await findExistingRow(
    supabase,
    'authors',
    columns.authors.id,
    { [columns.authors.name]: seed.author },
  );
  const author = await saveAuthorWithoutIdentityOverwrite({
    columns: columns.authors,
    incomingOpenLibraryId: book.author.id,
    incomingName: book.author.name,
    fallbackNames: [book.author.name, seed.author ?? ''],
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
    preserveExistingColumns: [columns.works.authorId],
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
  return {
    summary: `${book.work.title} — ${book.author.name} (${actions} new row${actions === 1 ? '' : 's'}${author.enriched ? ', author identity enriched' : ''})`,
    authorIdentityConflict: author.identityConflict,
  };
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
  const catalogExpansionBatchArgument = process.argv.find((argument) =>
    argument.startsWith('--batch='),
  );
  const catalogExpansionBatch = catalogExpansionBatchArgument?.slice('--batch='.length) ?? 'A';
  if (!['A', 'B', 'B2'].includes(catalogExpansionBatch)) {
    throw new Error('Unsupported catalog-expansion batch. Use --batch=A, --batch=B or --batch=B2.');
  }
  if (scope !== 'all' && scope !== 'netherlands' && scope !== 'series' && scope !== 'catalog-expansion') {
    throw new Error(
      `Unsupported import scope “${scope}”. Use “all”, “netherlands”, “series” or “catalog-expansion”.`,
    );
  }

  const catalogExpansionPlan = scope === 'catalog-expansion'
    ? JSON.parse(await readFile(join(
        process.cwd(),
        'catalog',
        catalogExpansionBatch === 'B2'
          ? 'catalog-expansion-batch-b2-plan.json'
          : catalogExpansionBatch === 'B'
          ? 'catalog-expansion-batch-b-plan.json'
          : 'catalog-expansion-plan.json',
      ), 'utf8')) as CatalogExpansionPlan
    : null;
  const expectedCatalogExpansionPlanVersion = catalogExpansionBatch === 'B2'
    ? 'catalog_expansion_batch_b2_v1'
    : catalogExpansionBatch === 'B' ? 'catalog_expansion_batch_b_v1' : 'catalog_expansion_batch_a_xl_v2';
  if (catalogExpansionPlan && catalogExpansionPlan.version !== expectedCatalogExpansionPlanVersion) {
    throw new Error(`Unsupported catalog expansion plan version: ${catalogExpansionPlan.version}`);
  }
  const catalogCategory = (categories: readonly string[]): SeedBook['category'] => {
    if (categories.some((category) => ['Fantasy', 'Science Fiction', 'Horror'].includes(category))) return 'fantasy-science-fiction';
    if (categories.includes('Thriller & Mystery')) return 'thriller-crime';
    if (categories.includes('Romance')) return 'romance';
    if (categories.some((category) => ['Non-fiction', 'Biography & Memoir', 'Psychology & Self-development', 'Business & Economics', 'History', 'Science & Nature'].includes(category))) return 'non-fiction';
    if (categories.some((category) => ['Young Adult', 'Children'].includes(category))) return 'young-adult-children';
    if (categories.includes('Classics')) return 'classics';
    return 'contemporary-general-fiction';
  };
  const catalogExpansionCandidates = catalogExpansionPlan
    ? catalogExpansionPlan.batches[catalogExpansionBatch as 'A' | 'B' | 'B2']
    : [];
  const catalogExpansionSeeds: SeedBook[] = catalogExpansionCandidates.map((candidate) => ({
    title: candidate.canonicalTitle,
    author: candidate.author,
    firstPublishYear: getReviewedWorkPublicationYear(candidate.openLibraryWorkId)
      ?? candidate.firstPublishYear
      ?? undefined,
    expectedOpenLibraryWorkId: candidate.openLibraryWorkId!,
    category: catalogCategory(candidate.categories),
    preferredEditionLanguages: candidate.preferredDutchEdition ? ['nld', 'eng'] : ['eng'],
    editionLanguagesToImport: candidate.preferredDutchEdition ? ['nld', 'eng'] : ['eng'],
  }));

  const scopedSeeds = scope === 'catalog-expansion'
    ? catalogExpansionSeeds
    : scope === 'netherlands'
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
  if (scope === 'catalog-expansion' && (catalogExpansionBatch === 'B' || catalogExpansionBatch === 'B2') && !dryRun) {
    const expectedConfirmation = catalogExpansionBatch === 'B2' ? 'batch-b2-approved' : 'batch-b-approved';
    const confirmed = process.argv.includes('--write')
      && process.argv.includes(`--confirm=${expectedConfirmation}`);
    if (!confirmed) {
      throw new Error(`Batch ${catalogExpansionBatch} writes require --write --confirm=${expectedConfirmation}.`);
    }
  }
  if (scope === 'catalog-expansion' && dryRun) {
    const candidates = catalogExpansionCandidates;
    const seenWorkIds = new Set<string>();
    const seenIsbns = new Set<string>();
    for (const candidate of candidates) {
      if (candidate.confidence !== 'HIGH') throw new Error(`${candidate.canonicalTitle}: non-HIGH candidate in write batch.`);
      if (!candidate.openLibraryWorkId || seenWorkIds.has(candidate.openLibraryWorkId)) throw new Error(`${candidate.canonicalTitle}: duplicate or missing Work ID.`);
      if (!candidate.isbn13 || seenIsbns.has(candidate.isbn13)) throw new Error(`${candidate.canonicalTitle}: duplicate or missing ISBN-13.`);
      if (!candidate.preferredDutchEdition && !candidate.preferredEnglishEdition && !candidate.representativeFallbackEdition) throw new Error(`${candidate.canonicalTitle}: no verified edition.`);
      seenWorkIds.add(candidate.openLibraryWorkId);
      seenIsbns.add(candidate.isbn13);
    }
    const existingWorks: Row[] = [];
    const existingEditions: Row[] = [];
    const ids = [...seenWorkIds];
    const isbns = [...seenIsbns];
    for (let index = 0; index < ids.length; index += 100) {
      const { data, error } = await supabase.from('works').select('id,open_library_id').in('open_library_id', ids.slice(index, index + 100));
      if (error) throw error;
      existingWorks.push(...((data ?? []) as Row[]));
    }
    for (let index = 0; index < isbns.length; index += 100) {
      const { data, error } = await supabase.from('editions').select('id,work_id,isbn_13').in('isbn_13', isbns.slice(index, index + 100));
      if (error) throw error;
      existingEditions.push(...((data ?? []) as Row[]));
    }
    const workIdByOpenLibraryId = new Map(existingWorks.flatMap((row) => {
      const openLibraryId = typeof row.open_library_id === 'string'
        ? row.open_library_id.replace(/^\/works\//, '').toUpperCase()
        : null;
      const workId = typeof row.id === 'number' ? row.id : Number(row.id);
      return openLibraryId && Number.isInteger(workId)
        ? [[openLibraryId, workId] as const]
        : [];
    }));
    const candidateByIsbn = new Map(candidates.map((candidate) => [candidate.isbn13!, candidate]));
    const identityConflicts = existingEditions.flatMap((row) => {
      const isbn13 = typeof row.isbn_13 === 'string' ? row.isbn_13.replace(/[^0-9]/g, '') : '';
      const candidate = candidateByIsbn.get(isbn13);
      if (!candidate?.openLibraryWorkId) return [];
      const expectedWorkId = workIdByOpenLibraryId.get(candidate.openLibraryWorkId.toUpperCase());
      const editionWorkId = typeof row.work_id === 'number' ? row.work_id : Number(row.work_id);
      return expectedWorkId === editionWorkId
        ? []
        : [`${isbn13}: expected ${expectedWorkId ?? 'missing work'}, found ${editionWorkId}`];
    });
    if (identityConflicts.length > 0) {
      throw new Error(`Live ISBN identity conflicts: ${identityConflicts.join('; ')}`);
    }
    const alreadyPresent = candidates.filter((candidate) =>
      workIdByOpenLibraryId.has(candidate.openLibraryWorkId!.toUpperCase()),
    ).length;
    const netNewWorks = candidates.length - alreadyPresent;
    if (alreadyPresent > 0 && netNewWorks > 0) {
      throw new Error(`Partial import state detected: ${alreadyPresent} present and ${netNewWorks} missing.`);
    }
    console.log(JSON.stringify({
      mode: 'CATALOG_EXPANSION_DRY_RUN',
      batch: catalogExpansionBatch,
      candidates: candidates.length,
      alreadyPresent,
      netNewWorks,
      matchingPlannedIsbns: existingEditions.length,
      duplicateOpenLibraryWorkIds: 0,
      duplicateIsbn13: 0,
      invalidAuthors: candidates.filter((candidate) => !candidate.author.trim()).length,
      invalidWorkEditionRelationships: candidates.filter((candidate) => !candidate.isbn13).length,
      ratingsTouched: 0,
      userStatusesTouched: 0,
      collectionsTouched: 0,
      rejectedCandidatesWritten: 0,
      productionWrites: 0,
    }, null, 2));
    console.log(`Done. Batch ${catalogExpansionBatch} passed the live metadata/import idempotency preflight. No Supabase writes were performed.`);
    return;
  }
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
  const authorIdentityConflicts: AuthorIdentityConflict[] = [];
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
        if (result.authorIdentityConflict) {
          authorIdentityConflicts.push(result.authorIdentityConflict);
          console.warn(
            `[AUTHOR IDENTITY CONFLICT] ${result.authorIdentityConflict.authorName} `
            + `(LumiScore author ${result.authorIdentityConflict.authorId}): preserved `
            + `${result.authorIdentityConflict.storedOpenLibraryId}; incoming `
            + `${result.authorIdentityConflict.incomingOpenLibraryId} requires review.`,
          );
        }
        console.log(`[OPEN LIBRARY] [${index + 1}/${seeds.length}] Imported ${result.summary}`);
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
    `Summary: ${processed} Open Library processed, ${nativeProcessed} LumiScore native processed, ${skipped} skipped for review, ${rejected} rejected, ${failures.length} failed, ${authorIdentityConflicts.length} author identity conflict${authorIdentityConflicts.length === 1 ? '' : 's'} preserved for review.`,
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
