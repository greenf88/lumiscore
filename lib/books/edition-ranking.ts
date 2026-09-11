export type EditionCandidate = {
  id?: string | number | null;
  openLibraryEditionId?: string | null;
  title?: string | null;
  subtitle?: string | null;
  physicalFormat?: string | null;
  languageCodes?: readonly string[] | null;
  isbn10?: string | readonly string[] | null;
  isbn13?: string | readonly string[] | null;
  publishDate?: string | null;
  publishers?: string | readonly string[] | null;
  coverIds?: readonly number[] | null;
};

export type EditionRankingContext = {
  workTitle: string;
  workType?: string | null;
  firstPublishYear?: number | null;
  preferredLanguages?: readonly string[];
};

export type SuspiciousEditionReason =
  | 'audio'
  | 'large_print'
  | 'box_set'
  | 'omnibus'
  | 'study_guide'
  | 'summary'
  | 'adaptation'
  | 'movie_tie_in';

export function getWorkFirstPublishYear(
  workFirstPublishYear: number | null | undefined,
): number | null {
  return Number.isInteger(workFirstPublishYear) && workFirstPublishYear! > 0
    ? workFirstPublishYear!
    : null;
}

type RepresentativeFormat =
  | 'hardcover'
  | 'paperback'
  | 'ebook'
  | 'audio'
  | 'unknown';

const SUSPICIOUS_PATTERNS: ReadonlyArray<{
  reason: SuspiciousEditionReason;
  pattern: RegExp;
}> = [
  {
    reason: 'audio',
    pattern:
      /\b(?:audio\s*(?:book|books|cd|cassette)?|audiobook|bookcassette|books? on (?:tape|cassette)|cassette|cd-rom|mp3(?:-?cd)?|spoken word|unabridged|abridged|dramatized|recorded books)\b/i,
  },
  { reason: 'large_print', pattern: /\blarge[-\s]?print\b/i },
  { reason: 'box_set', pattern: /\bbox(?:ed)?[-\s]?set\b/i },
  { reason: 'omnibus', pattern: /\bomnibus\b/i },
  { reason: 'study_guide', pattern: /\bstudy guide\b/i },
  { reason: 'summary', pattern: /\b(?:book )?summary\b/i },
  { reason: 'adaptation', pattern: /\badaptation\b/i },
  {
    reason: 'movie_tie_in',
    pattern: /\b(?:movie|film)(?:\s*\/\s*tv)?[-\s]?tie[-\s]?in\b/i,
  },
];

function values(value: string | readonly string[] | null | undefined): string[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  return typeof value === 'string' && value.trim() ? [value] : [];
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLocaleLowerCase('en');
}

export function normalizeEditionLanguage(value: string): string {
  const normalized = value.split('/').filter(Boolean).at(-1)?.toLowerCase() ?? '';
  if (/^(?:en|eng|english)$/.test(normalized)) return 'eng';
  if (/^(?:nl|nld|dut|dutch)$/.test(normalized)) return 'nld';
  return normalized;
}

function editionText(edition: EditionCandidate): string {
  return [
    edition.title,
    edition.subtitle,
    edition.physicalFormat,
    ...values(edition.publishers),
  ]
    .filter(Boolean)
    .join(' ');
}

export function getSuspiciousEditionReasons(
  edition: EditionCandidate,
): SuspiciousEditionReason[] {
  const text = editionText(edition);
  return SUSPICIOUS_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(
    ({ reason }) => reason,
  );
}

export function isSuspiciousRepresentativeEdition(
  edition: EditionCandidate,
  context: Pick<EditionRankingContext, 'workType'> = {},
): boolean {
  const reasons = getSuspiciousEditionReasons(edition);
  return reasons.some(
    (reason) =>
      reason !== 'audio' || context.workType !== 'audiobook_original',
  );
}

export function getRepresentativeEditionFormat(
  edition: EditionCandidate,
): RepresentativeFormat {
  const text = editionText(edition);
  if (getSuspiciousEditionReasons(edition).includes('audio')) return 'audio';
  if (/\b(?:hardcover|hardback|cloth|library binding)\b/i.test(text)) {
    return 'hardcover';
  }
  if (
    /\b(?:paperback|softcover|trade paper|mass market|perfect paperback)\b/i.test(
      text,
    )
  ) {
    return 'paperback';
  }
  if (/\b(?:ebook|e-book|kindle|epub|digital edition)\b/i.test(text)) {
    return 'ebook';
  }
  return 'unknown';
}

function hasValue(value: string | readonly string[] | null | undefined): boolean {
  return values(value).length > 0;
}

function languageScore(
  edition: EditionCandidate,
  preferredLanguages: readonly string[],
): number {
  const languages = (edition.languageCodes ?? [])
    .map(normalizeEditionLanguage)
    .filter(Boolean);
  if (languages.length === 0) return 0;

  const preferred = preferredLanguages.map(normalizeEditionLanguage);
  return languages.some((language) => preferred.includes(language)) ? 100 : -100;
}

function titleScore(edition: EditionCandidate, workTitle: string): number {
  const title = normalizeText(edition.title);
  const work = normalizeText(workTitle);
  if (!title || !work) return 0;
  if (title === work) return 80;
  if (title.startsWith(`${work} `)) return 35;
  return 0;
}

function secondaryBindingPenalty(edition: EditionCandidate): number {
  return /\b(?:tandem library|rebound by sagebrush|perfection learning|school (?:and|&) library binding|library binding)\b/i.test(
    editionText(edition),
  )
    ? -150
    : 0;
}

function representativeScore(
  edition: EditionCandidate,
  context: EditionRankingContext,
): number {
  const format = getRepresentativeEditionFormat(edition);
  const formatScore =
    context.workType === 'audiobook_original'
      ? { hardcover: 800, paperback: 700, ebook: 600, audio: 1_000, unknown: 500 }[
          format
        ]
      : { hardcover: 1_000, paperback: 800, ebook: 600, unknown: 500, audio: -1_000 }[
          format
        ];
  const suspiciousPenalty = getSuspiciousEditionReasons(edition).reduce(
    (penalty, reason) => {
      if (reason === 'audio' && context.workType === 'audiobook_original') {
        return penalty;
      }
      return penalty - 2_000;
    },
    0,
  );
  return (
    formatScore +
    suspiciousPenalty +
    languageScore(edition, context.preferredLanguages ?? ['eng']) +
    titleScore(edition, context.workTitle) +
    secondaryBindingPenalty(edition) +
    (hasValue(edition.isbn13) ? 150 : 0) +
    (hasValue(edition.isbn10) ? 15 : 0) +
    (values(edition.publishers).length > 0 ? 10 : 0)
  );
}

function stableEditionKey(edition: EditionCandidate): string {
  const id = String(edition.openLibraryEditionId ?? edition.id ?? '');
  const numericId = Number(id.match(/\d+/)?.[0]);
  return `${Number.isFinite(numericId) ? String(numericId).padStart(12, '0') : id}\u0000${normalizeText(edition.title)}`;
}

export function rankRepresentativeEditions<T extends EditionCandidate>(
  editions: readonly T[],
  context: EditionRankingContext,
): T[] {
  return [...editions].sort((left, right) => {
    const scoreDifference =
      representativeScore(right, context) - representativeScore(left, context);
    return scoreDifference || stableEditionKey(left).localeCompare(stableEditionKey(right));
  });
}

export function selectRepresentativeEdition<T extends EditionCandidate>(
  editions: readonly T[],
  context: EditionRankingContext,
): T | null {
  return rankRepresentativeEditions(editions, context)[0] ?? null;
}

function coverScore(edition: EditionCandidate, context: EditionRankingContext): number {
  return (
    (edition.coverIds?.length ? 1_000 : 0) +
    (hasValue(edition.isbn13) ? 300 : 0) +
    (hasValue(edition.isbn10) ? 100 : 0) +
    (edition.openLibraryEditionId ? 80 : 0) +
    languageScore(edition, context.preferredLanguages ?? ['eng']) +
    titleScore(edition, context.workTitle) -
    getSuspiciousEditionReasons(edition).filter((reason) => reason !== 'audio').length *
      100
  );
}

export function rankEditionsForCover<T extends EditionCandidate>(
  editions: readonly T[],
  context: EditionRankingContext,
): T[] {
  return [...editions].sort((left, right) => {
    const scoreDifference = coverScore(right, context) - coverScore(left, context);
    return scoreDifference || stableEditionKey(left).localeCompare(stableEditionKey(right));
  });
}

export function selectCoverEdition<T extends EditionCandidate>(
  editions: readonly T[],
  context: EditionRankingContext,
): T | null {
  return rankEditionsForCover(editions, context)[0] ?? null;
}
