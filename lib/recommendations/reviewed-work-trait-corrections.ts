import type { ReviewedWorkTraitCorrection } from './work-trait-evidence.ts';

export const REVIEWED_WORK_TRAIT_CORRECTIONS = [
  {
    workId: '6',
    removeTraits: ['science_fiction'],
    addTraits: [],
    reason: 'The Hobbit is fantasy; the science_fiction trait comes only from an Open Library umbrella label combining science fiction, fantasy, and horror.',
    reviewedAt: '2026-09-14T00:00:00.000Z',
  },
  {
    workId: '17',
    removeTraits: ['fantasy'],
    addTraits: [],
    reason: 'The Martian is science fiction; the fantasy trait comes from broad “Science Fiction & Fantasy” and incidental “Fantasy fiction” catalog labels.',
    reviewedAt: '2026-09-14T00:00:00.000Z',
  },
  {
    workId: '42',
    removeTraits: ['nonfiction'],
    addTraits: [],
    reason: 'Anna Karenina is a novel; a bibliographic literary-collections label must not turn it into LumiScore nonfiction.',
    reviewedAt: '2026-09-14T00:00:00.000Z',
  },
  {
    workId: '91',
    removeTraits: ['science_fiction', 'speculative'],
    addTraits: [],
    reason: 'The Glass Castle is memoir/nonfiction; an isolated Open Library science-fiction label is a clear catalog contradiction.',
    reviewedAt: '2026-09-14T00:00:00.000Z',
  },
  {
    workId: '104',
    removeTraits: ['nonfiction'],
    addTraits: [],
    reason: 'The Seven Husbands of Evelyn Hugo is fiction; lower-priority source metadata must not add nonfiction to its reviewed anchor profile.',
    reviewedAt: '2026-09-14T00:00:00.000Z',
  },
  {
    workId: '257',
    removeTraits: ['science_fiction', 'speculative'],
    addTraits: [],
    reason: 'Fight Club is transgressive contemporary fiction. The broad fantasy-science-fiction seed bucket and incidental Open Library science-fiction labels do not justify science_fiction or speculative traits for LumiScore V1.',
    reviewedAt: '2026-09-14T00:00:00.000Z',
  },
  {
    workId: '165',
    removeTraits: ['science_fiction'],
    addTraits: [],
    reason: 'Krew elfów (Blood of Elves) is fantasy. Open Library\'s compound “Science fiction, fantasy, horror” label is an umbrella classification, not reliable work-specific science-fiction evidence; fantasy and speculative remain.',
    reviewedAt: '2026-09-14T00:00:00.000Z',
  },
  {
    workId: '168',
    removeTraits: ['science_fiction'],
    addTraits: [],
    reason: 'Harry Potter and the Prisoner of Azkaban is fantasy; its science-fiction signal comes from a generic compound source label.',
    reviewedAt: '2026-09-14T00:00:00.000Z',
  },
  {
    workId: '525',
    removeTraits: ['nonfiction'],
    addTraits: [],
    reason: 'Chicka Chicka Boom Boom is a fictional children’s alphabet picture book; a generic nonfiction classification is not suitable recommendation evidence.',
    reviewedAt: '2026-09-14T00:00:00.000Z',
  },
] as const satisfies readonly ReviewedWorkTraitCorrection[];

const CORRECTION_BY_WORK_ID = new Map<string, ReviewedWorkTraitCorrection>(
  REVIEWED_WORK_TRAIT_CORRECTIONS.map((correction) => [correction.workId, correction]),
);

export function getReviewedWorkTraitCorrection(
  workId: string,
): ReviewedWorkTraitCorrection | undefined {
  return CORRECTION_BY_WORK_ID.get(workId);
}
