import type { Book } from '../../app/data/books.ts';

export type BookLanguageClassification = 'dutch' | 'non_dutch' | 'unknown';
export type BookLanguageSource = 'representative_edition' | 'reviewed_catalog_seed' | 'unknown';

export type BookLanguageResolution = {
  classification: BookLanguageClassification;
  languageCode: string | null;
  source: BookLanguageSource;
};

const DUTCH_LANGUAGE_CODES = new Set([
  'nl', 'nl-be', 'nl-nl', 'nld', 'dut', 'dutch', 'nederlands',
]);

const KNOWN_NON_DUTCH_LANGUAGE_CODES = new Set([
  'en', 'en-gb', 'en-us', 'eng', 'english',
  'de', 'deu', 'ger', 'german',
  'fr', 'fra', 'fre', 'french',
  'es', 'spa', 'spanish',
  'it', 'ita', 'italian',
  'pt', 'por', 'portuguese',
  'pl', 'pol', 'polish',
  'sv', 'swe', 'swedish',
  'no', 'nor', 'norwegian',
  'da', 'dan', 'danish',
  'fi', 'fin', 'finnish',
  'cs', 'ces', 'cze', 'czech',
  'hu', 'hun', 'hungarian',
  'ro', 'ron', 'rum', 'romanian',
  'ru', 'rus', 'russian',
  'uk', 'ukr', 'ukrainian',
  'tr', 'tur', 'turkish',
  'ar', 'ara', 'arabic',
  'he', 'heb', 'hebrew',
  'ja', 'jpn', 'japanese',
  'ko', 'kor', 'korean',
  'zh', 'zho', 'chi', 'chinese',
  'la', 'lat', 'latin',
]);

// These ISBNs already carry reviewed `language: nld` metadata in
// scripts/lumiscore-native-seeds-nl.ts. Keeping the fallback ISBN-based avoids
// treating every future LumiScore-native work as Dutch when its edition language
// is missing.
export const REVIEWED_DUTCH_LANGUAGE_ISBN13 = [
  '9789044622805', '9789044652901', '9789041416841', '9789059652040',
  '9789021049236', '9789048854943', '9789021480954', '9789047750567',
  '9789048857685', '9789047509899', '9789463821742', '9789403194806',
  '9789044336481', '9789044344868', '9789024578252', '9789047211310',
  '9789047211327', '9789402762112', '9789402705454', '9789059901643',
  '9789022590393', '9789026346934', '9789044977257', '9789044978445',
  '9789044978834', '9789400512498', '9789046173695', '9789400515178',
  '9789044932577', '9789044934489', '9789044934632', '9789400516267',
  '9789044936117', '9789044934649', '9789044936278', '9789400517738',
  '9789400517134', '9789400517721', '9789400519664', '9789044932560',
  '9789400517813', '9789400517905', '9789044933192', '9789046176368',
  '9789044970814', '9789044970777',
  '9789044970784', '9789044970791', '9789044970807',
] as const;

export const DUTCH_LANGUAGE_DATABASE_CODES = ['nl', 'nld', 'dut'] as const;

const REVIEWED_DUTCH_ISBNS = new Set<string>(REVIEWED_DUTCH_LANGUAGE_ISBN13);

function normalizeLanguageCode(value: string | null | undefined): string | null {
  const normalized = value
    ?.trim()
    .toLowerCase()
    .replaceAll('_', '-')
    .split('/')
    .filter(Boolean)
    .at(-1);
  return normalized || null;
}

function normalizeIsbn13(value: string | null | undefined): string | null {
  const normalized = value?.replace(/[^0-9]/g, '') ?? '';
  return /^97[89][0-9]{10}$/.test(normalized) ? normalized : null;
}

export function classifyStructuredLanguage(
  value: string | null | undefined,
): BookLanguageClassification {
  const language = normalizeLanguageCode(value);
  if (!language || language === 'und' || language === 'unknown') return 'unknown';
  if (DUTCH_LANGUAGE_CODES.has(language)) return 'dutch';
  return KNOWN_NON_DUTCH_LANGUAGE_CODES.has(language) ? 'non_dutch' : 'unknown';
}

export function resolveBookLanguage(
  book: Pick<Book, 'editionLanguage' | 'isbn13'>,
): BookLanguageResolution {
  const languageCode = normalizeLanguageCode(book.editionLanguage);
  const structured = classifyStructuredLanguage(languageCode);
  if (structured !== 'unknown') {
    return {
      classification: structured,
      languageCode,
      source: 'representative_edition',
    };
  }

  const isbn13 = normalizeIsbn13(book.isbn13);
  if (isbn13 && REVIEWED_DUTCH_ISBNS.has(isbn13)) {
    return {
      classification: 'dutch',
      languageCode: 'nld',
      source: 'reviewed_catalog_seed',
    };
  }

  return { classification: 'unknown', languageCode: null, source: 'unknown' };
}

export function isDutchLanguageBook(
  book: Pick<Book, 'editionLanguage' | 'isbn13'>,
): boolean {
  return resolveBookLanguage(book).classification === 'dutch';
}
