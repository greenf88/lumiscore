import { SEED_BOOKS } from './open-library-seeds.ts';
import { NETHERLANDS_SEEDS } from './open-library-seeds-nl.ts';

type SearchDocument = {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  edition_count?: number;
};

type SearchResponse = { docs?: SearchDocument[] };

const normalize = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('nl-NL')
    .replace(/&/g, ' en ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const authorAliases: Readonly<Record<string, readonly string[]>> = {
  'a. den doolaard': ['a den doolaard', 'bob spoor'],
  'annie m.g. schmidt': ['annie m g schmidt', 'annie mg schmidt'],
  'f. bordewijk': ['f bordewijk', 'ferdinand bordewijk'],
  'gerard reve': ['gerard reve', 'gerard kornelis van het reve'],
  'hella s. haasse': ['hella s haasse', 'hella haasse'],
  kluun: ['kluun', 'raymond van de klundert'],
  multatuli: ['multatuli', 'eduard douwes dekker'],
  nescio: ['nescio', 'j h f gronloh', 'jan hendrik frederik gronloh'],
};

const authorMatches = (expected: string, candidates: readonly string[]) => {
  const accepted = new Set([
    normalize(expected),
    ...(authorAliases[expected.toLocaleLowerCase('nl-NL')] ?? []),
  ]);
  return candidates.some((candidate) => {
    const normalizedCandidate = normalize(candidate);
    return [...accepted].some(
      (alias) =>
        normalizedCandidate === alias ||
        normalizedCandidate.includes(alias) ||
        alias.includes(normalizedCandidate),
    );
  });
};

const titleMatches = (expected: string, actual: string) => {
  const normalizedExpected = normalize(expected);
  const normalizedActual = normalize(actual);
  return (
    normalizedActual === normalizedExpected ||
    normalizedActual.replace(/^de |^het |^een /, '') ===
      normalizedExpected.replace(/^de |^het |^een /, '')
  );
};

const existingWorkIds = new Set(
  SEED_BOOKS.flatMap((seed) =>
    seed.expectedOpenLibraryWorkId
      ? [seed.expectedOpenLibraryWorkId.toUpperCase()]
      : [],
  ),
);

const auditSeed = async (seed: (typeof NETHERLANDS_SEEDS)[number]) => {
  const search = async (includeAuthor: boolean) => {
    const query = new URLSearchParams({
      title: seed.title,
      fields: 'key,title,author_name,first_publish_year,edition_count',
      limit: includeAuthor ? '20' : '50',
    });
    if (includeAuthor) query.set('author', seed.author);
    const response = await fetch(`https://openlibrary.org/search.json?${query}`, {
      headers: { 'User-Agent': 'LumiScoreSeedAudit/1.0 (catalog maintenance)' },
    });
    if (!response.ok) throw new Error(`${response.status} ${seed.title}`);
    return ((await response.json()) as SearchResponse).docs ?? [];
  };
  const documents = [...(await search(true)), ...(await search(false))];
  const documentsByKey = new Map(
    documents.flatMap((document) =>
      document.key ? [[document.key, document] as const] : [],
    ),
  );
  const candidates = [...documentsByKey.values()]
    .filter(
      (document) =>
        document.key?.match(/^\/works\/OL\d+W$/) &&
        document.title &&
        titleMatches(seed.title, document.title) &&
        authorMatches(seed.author, document.author_name ?? []),
    )
    .sort((left, right) => {
      const leftYear = Math.abs(
        (left.first_publish_year ?? seed.firstPublishYear ?? 0) -
          (seed.firstPublishYear ?? 0),
      );
      const rightYear = Math.abs(
        (right.first_publish_year ?? seed.firstPublishYear ?? 0) -
          (seed.firstPublishYear ?? 0),
      );
      // Prefer the best populated cluster; year only breaks close calls because
      // Open Library often records the first digitized edition, not publication.
      const leftScore =
        (left.edition_count ?? 0) * 10 + (leftYear <= 1 ? 3 : leftYear <= 3 ? 1 : 0);
      const rightScore =
        (right.edition_count ?? 0) * 10 +
        (rightYear <= 1 ? 3 : rightYear <= 3 ? 1 : 0);
      return rightScore - leftScore;
    })
    .slice(0, 3)
    .map((document) => ({
      id: document.key!.replace('/works/', '').toUpperCase(),
      title: document.title!,
      authors: document.author_name ?? [],
      year: document.first_publish_year ?? null,
      editions: document.edition_count ?? 0,
    }));

  return {
    title: seed.title,
    author: seed.author,
    collection: seed.collection,
    category: seed.netherlandsCategory,
    expectedYear: seed.firstPublishYear,
    candidates: candidates.map((candidate) => ({
      ...candidate,
      collidesWithExistingCatalog: existingWorkIds.has(candidate.id),
    })),
  };
};

const results: Awaited<ReturnType<typeof auditSeed>>[] = [];
const queue = [...NETHERLANDS_SEEDS];

const workers = Array.from({ length: 4 }, async () => {
  for (;;) {
    const seed = queue.shift();
    if (!seed) return;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        results.push(await auditSeed(seed));
        break;
      } catch (error) {
        if (attempt === 3) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
  }
});

await Promise.all(workers);
results.sort((left, right) =>
  NETHERLANDS_SEEDS.findIndex(
    (seed) => seed.title === left.title && seed.author === left.author,
  ) -
  NETHERLANDS_SEEDS.findIndex(
    (seed) => seed.title === right.title && seed.author === right.author,
  ),
);

for (const result of results) {
  console.log(
    [
      result.title,
      result.author,
      result.candidates
        .map(
          (candidate) =>
            `${candidate.id}${candidate.collidesWithExistingCatalog ? '!' : ''}:${candidate.editions}:${candidate.year ?? ''}:${candidate.title}`,
        )
        .join('|'),
    ].join('\t'),
  );
}
console.error(
  JSON.stringify({
    total: results.length,
    withExactCandidates: results.filter((result) => result.candidates.length > 0)
      .length,
    withoutExactCandidates: results.filter(
      (result) => result.candidates.length === 0,
    ).length,
  }),
);
