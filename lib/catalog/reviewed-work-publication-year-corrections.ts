export type ReviewedWorkPublicationYearCorrection = {
  openLibraryWorkId: string;
  firstPublishYear: number;
  reason: string;
  evidence: readonly string[];
  reviewedAt: string;
};

export const REVIEWED_WORK_PUBLICATION_YEAR_CORRECTIONS: readonly ReviewedWorkPublicationYearCorrection[] = [
  {
    openLibraryWorkId: 'OL52114W',
    firstPublishYear: 1898,
    reason: 'Open Library search reports 0 and the Work record omits a date, while the exact Work edition history contains multiple 1898 editions.',
    evidence: [
      'https://openlibrary.org/works/OL52114W/editions.json',
      'OL7003374M',
      'OL6475751M',
      'OL16774671M',
    ],
    reviewedAt: '2026-09-16',
  },
];

const correctionByWorkId = new Map(
  REVIEWED_WORK_PUBLICATION_YEAR_CORRECTIONS.map((correction) => [
    correction.openLibraryWorkId,
    correction,
  ]),
);

export function getReviewedWorkPublicationYear(
  openLibraryWorkId: string | null | undefined,
): number | null {
  if (!openLibraryWorkId) return null;
  return correctionByWorkId.get(openLibraryWorkId)?.firstPublishYear ?? null;
}
