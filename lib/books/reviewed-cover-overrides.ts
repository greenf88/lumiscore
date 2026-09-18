import { normalizeIsbn13 } from './covers.ts';

export type ReviewedCoverOverride = {
  workId: string;
  title: string;
  author: string;
  isbn13: string;
  coverUrl: string;
  source: 'official_publisher';
  evidenceUrl: string;
  reviewedAt: string;
};

export const REVIEWED_COVER_OVERRIDES: readonly ReviewedCoverOverride[] = [
  {
    workId: '1296',
    title: 'Festival',
    author: 'Suzanne Vermeer',
    isbn13: '9789400517134',
    coverUrl:
      'https://www.awbruna.nl/wp-content/uploads/sites/51/external/62510b609380bc360781803c36fd546a-364x0-c-default.png?t=1741336886',
    source: 'official_publisher',
    evidenceUrl:
      'https://www.awbruna.nl/boek/thrillers/suzanne-vermeer/festival/',
    reviewedAt: '2026-09-18',
  },
] as const;

function normalizeIdentityText(value: string | null | undefined): string {
  return value?.trim().normalize('NFC').toLocaleLowerCase('nl') ?? '';
}

export function getReviewedCoverOverride(input: {
  workId?: string | null;
  title?: string | null;
  author?: string | null;
  isbn13?: string | null;
}): ReviewedCoverOverride | null {
  const isbn13 = normalizeIsbn13(input.isbn13);
  return REVIEWED_COVER_OVERRIDES.find((entry) =>
    entry.workId === input.workId?.trim() &&
    entry.isbn13 === isbn13 &&
    normalizeIdentityText(entry.title) === normalizeIdentityText(input.title) &&
    normalizeIdentityText(entry.author) === normalizeIdentityText(input.author)
  ) ?? null;
}
