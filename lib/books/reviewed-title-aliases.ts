export type ReviewedWorkTitleAlias = {
  workId: string;
  openLibraryWorkId: string;
  aliases: readonly string[];
  reason: string;
  reviewedAt: string;
};

export const REVIEWED_WORK_TITLE_ALIASES = [
  {
    workId: '124',
    openLibraryWorkId: 'OL20019347W',
    aliases: ['コーヒーが冷めないうちに'],
    reason:
      'The production Work uses the verified English display title, while the reviewed original Japanese title is not stored on its representative edition.',
    reviewedAt: '2026-09-16',
  },
  {
    workId: '1920',
    openLibraryWorkId: 'OL28959223W',
    aliases: ['Heartstopper: Volume Five'],
    reason:
      'The reviewed search wording uses a colon and a spelled-out volume number; the verified production edition stores “Heartstopper, Volume 5”.',
    reviewedAt: '2026-09-16',
  },
  {
    workId: '2193',
    openLibraryWorkId: 'OL36475397W',
    aliases: ['Theo in Golden'],
    reason:
      'The reviewed Dutch-market search phrase uses “in”, while the verified production Work keeps the canonical title “Theo of Golden”.',
    reviewedAt: '2026-09-17',
  },
] as const satisfies readonly ReviewedWorkTitleAlias[];
