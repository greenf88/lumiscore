import type { Book } from '../../app/data/books.ts';
import {
  DUTCH_BESTSELLER_SNAPSHOT,
  DUTCH_CLASSICS_POOL,
} from '../books/dutch-homepage-sources.ts';
import {
  hasSufficientClassicPersonalization,
  isCurrentBestsellerSnapshot,
  selectDutchClassics,
  selectPopularDutchBooks,
} from '../books/dutch-homepage-discovery.ts';
import { hasUsableInitialBookCover } from '../books/book-cover-state.ts';
import { REVIEWED_DUTCH_LANGUAGE_ISBN13 } from '../books/language.ts';
import { getReviewedWorkTraitCorrection } from '../recommendations/reviewed-work-trait-corrections.ts';
import { buildEffectiveWorkTraitVector } from '../recommendations/work-trait-evidence.ts';
import { cosineTasteSimilarity, emptyTasteVector } from '../taste-test/traits.ts';
import { buildTasteProfile, type RatingEvidence } from '../taste-test/profile.ts';
import type { Locale } from '../i18n/config.ts';
import { loadCatalogBooksByIdsWithStoredCovers } from './books.ts';
import { supabase } from './client.ts';
import { loadHomepageReaderContext } from './taste-test.ts';
import { loadWorkTraitEvidenceBatched } from './work-trait-evidence.ts';

export type DutchHomepageDiscovery = {
  popular: {
    books: Book[];
    current: boolean;
    personalized: boolean;
    sourceName: string;
    sourceUrl: string;
    year: number;
    week: number;
  };
  classics: {
    books: Book[];
    personalized: boolean;
  };
};

type EditionIdentityRow = {
  isbn_13: string | null;
  work_id: string | number | null;
  language: string | null;
};

function isoWeek(date: Date): { year: number; week: number } {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  return {
    year: value.getUTCFullYear(),
    week: Math.ceil((((value.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7),
  };
}

function orderedBooks(books: readonly Book[], workIds: readonly string[]): Book[] {
  const byWorkId = new Map(books.flatMap((book): Array<[string, Book]> =>
    book.workId ? [[book.workId, book]] : []));
  return workIds.flatMap((workId) => {
    const book = byWorkId.get(workId);
    return book && hasUsableInitialBookCover(book) ? [book] : [];
  });
}

async function loadVerifiedBestsellerWorkIds(): Promise<Set<string>> {
  const isbn13s = DUTCH_BESTSELLER_SNAPSHOT.entries.map(({ isbn13 }) => isbn13);
  const result = await supabase
    .from('editions')
    .select('isbn_13,work_id,language')
    .in('isbn_13', isbn13s);
  if (result.error) throw result.error;

  const exactIdentity = new Map<string, string>(
    DUTCH_BESTSELLER_SNAPSHOT.entries.map((entry) => [entry.isbn13, entry.workId]),
  );
  const reviewedDutchIsbns = new Set<string>(REVIEWED_DUTCH_LANGUAGE_ISBN13);
  return new Set(((result.data ?? []) as EditionIdentityRow[]).flatMap((row) => {
    const isbn13 = row.isbn_13?.replace(/[^0-9]/g, '') ?? '';
    const workId = String(row.work_id ?? '');
    const normalizedLanguage = row.language?.trim().toLowerCase() ?? '';
    const hasVerifiedDutchLanguage = ['dut', 'nld', 'nl'].includes(normalizedLanguage) ||
      reviewedDutchIsbns.has(isbn13);
    return exactIdentity.get(isbn13) === workId && hasVerifiedDutchLanguage ? [workId] : [];
  }));
}

export async function loadDutchHomepageDiscovery(
  locale: Locale,
  now = new Date(),
): Promise<DutchHomepageDiscovery> {
  const week = isoWeek(now);
  const publicCandidateIds = [
    ...DUTCH_BESTSELLER_SNAPSHOT.entries.map(({ workId }) => workId),
    ...DUTCH_CLASSICS_POOL.map(({ workId }) => workId),
  ];
  const [eligiblePopularWorkIds, reader] = await Promise.all([
    loadVerifiedBestsellerWorkIds(),
    loadHomepageReaderContext(),
  ]);
  const excludedWorkIds = new Set<string>();
  const similarityByWorkId = new Map<string, number>();
  let profileConfidence: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

  if (reader.authenticated) {
    for (const { work_id } of reader.ratings) excludedWorkIds.add(String(work_id));
    for (const [workId, status] of reader.statuses) {
      if (status === 'read' || status === 'dnf') excludedWorkIds.add(workId);
    }

    const ratingIds = reader.ratings.map(({ work_id }) => String(work_id));
    const evidenceByWorkId = await loadWorkTraitEvidenceBatched(
      reader.client,
      [...new Set([...publicCandidateIds, ...ratingIds])],
    );
    const effectiveByWorkId = new Map(
      [...new Set([...publicCandidateIds, ...ratingIds])].map((workId) => [
        workId,
        buildEffectiveWorkTraitVector(
          evidenceByWorkId.get(workId) ?? [],
          getReviewedWorkTraitCorrection(workId),
        ),
      ] as const),
    );
    const ratingEvidence: RatingEvidence[] = reader.ratings.map((rating) => ({
      workId: String(rating.work_id),
      rating: rating.rating,
      traits: effectiveByWorkId.get(String(rating.work_id))?.traits ?? emptyTasteVector(),
    }));
    const profile = buildTasteProfile(reader.answers, ratingEvidence, locale);
    profileConfidence = profile.confidence;
    for (const workId of publicCandidateIds) {
      const candidate = effectiveByWorkId.get(workId);
      if (!candidate || candidate.coverageLevel === 'none' || candidate.coverageLevel === 'era_only') continue;
      similarityByWorkId.set(workId, Math.max(0, cosineTasteSimilarity(profile.vector, candidate.traits)));
    }
  }

  const selectionInput = {
    excludedWorkIds,
    similarityByWorkId,
    profileConfidence,
    readingPeriods: reader.readerPreferences?.readingPeriods ?? null,
    ...week,
  };
  const popularEntries = selectPopularDutchBooks(
    DUTCH_BESTSELLER_SNAPSHOT.entries,
    eligiblePopularWorkIds,
    selectionInput,
  );
  const classicEntries = selectDutchClassics(
    DUTCH_CLASSICS_POOL,
    selectionInput,
  );
  const guestPopularIds = selectPopularDutchBooks(
    DUTCH_BESTSELLER_SNAPSHOT.entries,
    eligiblePopularWorkIds,
    { year: week.year, week: week.week },
  ).map(({ workId }) => workId);
  const popularIds = popularEntries.map(({ workId }) => workId);
  const classicIds = classicEntries.map(({ workId }) => workId);
  const books = await loadCatalogBooksByIdsWithStoredCovers(
    [...popularIds, ...classicIds],
    undefined,
    locale,
  );

  return {
    popular: {
      books: orderedBooks(books, popularIds),
      current: isCurrentBestsellerSnapshot(DUTCH_BESTSELLER_SNAPSHOT, now),
      personalized: reader.authenticated && popularIds.join(',') !== guestPopularIds.join(','),
      sourceName: DUTCH_BESTSELLER_SNAPSHOT.sourceName,
      sourceUrl: DUTCH_BESTSELLER_SNAPSHOT.sourceUrl,
      year: DUTCH_BESTSELLER_SNAPSHOT.year,
      week: DUTCH_BESTSELLER_SNAPSHOT.week,
    },
    classics: {
      books: orderedBooks(books, classicIds),
      personalized: reader.authenticated && hasSufficientClassicPersonalization({
        profileConfidence,
        similarityByWorkId,
      }),
    },
  };
}
