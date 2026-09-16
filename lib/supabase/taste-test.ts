import type { Book } from '../../app/data/books.ts';
import type {
  PersonalMatchResult,
  PersonalizedRecommendation,
  RecommendationCandidate,
} from '../recommendations/engine.ts';
import { calculatePersonalMatch, recommendBooks } from '../recommendations/engine.ts';
import { getReviewedWorkTraitCorrection } from '../recommendations/reviewed-work-trait-corrections.ts';
import {
  buildEffectiveWorkTraitVector,
  type EffectiveWorkTraits,
} from '../recommendations/work-trait-evidence.ts';
import {
  TASTE_TEST_ANCHORS,
  TASTE_TEST_QUESTIONS,
  TASTE_TEST_VERSION,
  TASTE_TEST_WORK_IDS,
  type TasteTestAnswers,
  type TasteTestChoice,
  type TasteTestQuestionKey,
} from '../taste-test/config.ts';
import { buildTasteProfile, type RatingEvidence } from '../taste-test/profile.ts';
import { emptyTasteVector } from '../taste-test/traits.ts';
import type { TasteVector } from '../taste-test/traits.ts';
import type { WorkTraitCoverageLevel } from '../recommendations/work-trait-evidence.ts';
import { applyRatingSummaries } from '../ratings/card-summaries.ts';
import { getVerifiedServerUser } from './auth.ts';
import { loadCatalogBooksByIds, mapCatalogWorks } from './books.ts';
import { loadPublicRatingSummariesBatched } from './public-rating-summaries.ts';
import { createServerSupabaseClient } from './server.ts';
import { loadWorkTraitEvidenceBatched } from './work-trait-evidence.ts';
import type { Locale } from '../i18n/config.ts';
import { resolveLocaleBookLanguagePreference } from '../recommendations/language-preference.ts';
import { recommendGuestBooks } from '../recommendations/guest.ts';
import { loadCollaborativeRecommendationSignals } from './collaborative.ts';
import { loadReadWorkIdsForCurrentUser } from './book-status.ts';

type ResponseRow = { question_key: string; choice: string };
type RatingRow = { work_id: number | string; rating: number };
type WorkFeatureRow = { id: number | string };
type RecommendationCatalog = {
  candidates: RecommendationCandidate[];
  traitsById: Map<string, EffectiveWorkTraits>;
};

const RECOMMENDATION_CATALOG_PAGE_SIZE = 1000;
const GUEST_RECOMMENDATION_CATALOG_TTL_MS = 5 * 60 * 1_000;
let guestRecommendationCatalogCache: {
  expiresAt: number;
  result: Promise<RecommendationCatalog>;
} | null = null;
const RECOMMENDATION_CATALOG_SELECT = [
  'id',
  'title',
  'first_publish_year',
  'open_library_id',
  'source_type',
  'work_type',
  'author_id',
  'cover_id',
  'authors(id,name)',
  'editions(id,open_library_edition_id,isbn_13,language)',
].join(',');

export type TasteTestServerState = {
  authenticated: boolean;
  answers: TasteTestAnswers;
  ratingCount: number;
  persistenceAvailable: boolean;
};

export type HomepagePersonalization = {
  authenticated: boolean;
  ratingCount: number;
  tasteTestAnsweredCount: number;
  hasEvidence: boolean;
  recommendations: PersonalizedRecommendation[];
};

export type BookDetailMatchCandidate = {
  traits: TasteVector;
  metadataConfidence: number;
  coverageLevel: WorkTraitCoverageLevel;
};

export type BookDetailPersonalization = {
  authenticated: boolean;
  hasEvidence: boolean;
  candidate: BookDetailMatchCandidate | null;
  match: PersonalMatchResult | null;
};

function rowsToAnswers(rows: readonly ResponseRow[]): TasteTestAnswers {
  const answers: TasteTestAnswers = {};
  for (const row of rows) {
    const question = TASTE_TEST_QUESTIONS.find(({ key }) => key === row.question_key);
    if (!question || !['left', 'right', 'neither'].includes(row.choice)) continue;
    answers[question.key] = row.choice as TasteTestChoice;
  }
  return answers;
}

async function loadRecommendationCatalog(
  client: Awaited<ReturnType<typeof createServerSupabaseClient>>,
): Promise<RecommendationCatalog> {
  const firstPage = await client
    .from('works')
    .select(RECOMMENDATION_CATALOG_SELECT, { count: 'exact' })
    .order('id', { ascending: true })
    .range(0, RECOMMENDATION_CATALOG_PAGE_SIZE - 1);
  if (firstPage.error) throw firstPage.error;

  const total = firstPage.count ?? firstPage.data?.length ?? 0;
  const remainingStarts = Array.from(
    { length: Math.max(0, Math.ceil(total / RECOMMENDATION_CATALOG_PAGE_SIZE) - 1) },
    (_, index) => (index + 1) * RECOMMENDATION_CATALOG_PAGE_SIZE,
  );
  const remainingPages = await Promise.all(remainingStarts.map((start) =>
    client
      .from('works')
      .select(RECOMMENDATION_CATALOG_SELECT)
      .order('id', { ascending: true })
      .range(start, start + RECOMMENDATION_CATALOG_PAGE_SIZE - 1),
  ));
  const failedPage = remainingPages.find(({ error }) => error);
  if (failedPage?.error) throw failedPage.error;

  const rows = [
    ...(firstPage.data ?? []),
    ...remainingPages.flatMap(({ data }) => data ?? []),
  ] as unknown as WorkFeatureRow[];
  const books = mapCatalogWorks(rows);
  const workIds = books.flatMap((book) => book.workId ? [book.workId] : []);
  const [summaries, evidenceByWorkId] = await Promise.all([
    loadPublicRatingSummariesBatched(client, workIds),
    loadWorkTraitEvidenceBatched(client, workIds),
  ]);
  const hydrated = applyRatingSummaries(books, summaries);
  const traitsById = new Map(rows.map((row) => {
    const workId = String(row.id);
    return [workId, buildEffectiveWorkTraitVector(
      evidenceByWorkId.get(workId) ?? [],
      getReviewedWorkTraitCorrection(workId),
    )] as const;
  }));
  const candidates = hydrated.flatMap((book) => {
    if (!book.workId) return [];
    const effective = traitsById.get(book.workId);
    if (!effective || effective.coverageLevel === 'none') return [];
    const anchor = TASTE_TEST_ANCHORS[book.workId];
    return [{
      book,
      traits: effective.traits,
      metadataConfidence: effective.metadataConfidence,
      coverageLevel: effective.coverageLevel,
      seriesKey: anchor?.seriesKey,
    }];
  });
  return { candidates, traitsById };
}

function loadGuestRecommendationCatalog(
  client: Awaited<ReturnType<typeof createServerSupabaseClient>>,
): Promise<RecommendationCatalog> {
  if (
    guestRecommendationCatalogCache &&
    guestRecommendationCatalogCache.expiresAt > Date.now()
  ) {
    return guestRecommendationCatalogCache.result;
  }

  const result = loadRecommendationCatalog(client).catch((error: unknown) => {
    guestRecommendationCatalogCache = null;
    throw error;
  });
  guestRecommendationCatalogCache = {
    expiresAt: Date.now() + GUEST_RECOMMENDATION_CATALOG_TTL_MS,
    result,
  };
  return result;
}

async function hydratePublicRecommendations(
  recommendations: readonly PersonalizedRecommendation[],
): Promise<PersonalizedRecommendation[]> {
  const recommendationBooks = recommendations.length
    ? await loadCatalogBooksByIds(recommendations.flatMap(({ book }) =>
        book.workId ? [book.workId] : []))
    : [];
  const recommendationBooksById = new Map(
    recommendationBooks.flatMap((book): Array<[string, Book]> =>
      book.workId ? [[book.workId, book]] : []),
  );

  return recommendations.map((recommendation) => ({
    book: recommendation.book.workId
      ? recommendationBooksById.get(recommendation.book.workId) ?? recommendation.book
      : recommendation.book,
    matchScore: recommendation.matchScore,
    matchLabel: recommendation.matchLabel,
    matchConfidence: recommendation.matchConfidence,
    explanation: recommendation.explanation,
    coverageLevel: recommendation.coverageLevel,
    metadataConfidence: recommendation.metadataConfidence,
    collaborativeExplanation: recommendation.collaborativeExplanation,
  }));
}

export async function loadTasteTestServerState(): Promise<TasteTestServerState> {
  const { client, user } = await getVerifiedServerUser();
  if (!user) return { authenticated: false, answers: {}, ratingCount: 0, persistenceAvailable: true };

  const [responses, ratings] = await Promise.all([
    client.from('taste_test_responses').select('question_key,choice')
      .eq('quiz_version', TASTE_TEST_VERSION).eq('user_id', user.id),
    client.from('ratings').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
  ]);
  return {
    authenticated: true,
    answers: responses.error ? {} : rowsToAnswers((responses.data ?? []) as ResponseRow[]),
    ratingCount: ratings.error ? 0 : ratings.count ?? 0,
    persistenceAvailable: !responses.error,
  };
}

export async function saveTasteTestAnswers(
  answers: ReadonlyArray<{ questionKey: TasteTestQuestionKey; choice: TasteTestChoice }>,
): Promise<TasteTestServerState | null> {
  const { client, user } = await getVerifiedServerUser();
  if (!user) return null;
  const now = new Date().toISOString();
  const { error } = await client.from('taste_test_responses').upsert(
    answers.map(({ questionKey, choice }) => ({
      user_id: user.id,
      quiz_version: TASTE_TEST_VERSION,
      question_key: questionKey,
      choice,
      updated_at: now,
    })),
    { onConflict: 'user_id,quiz_version,question_key' },
  );
  if (error) throw error;
  return loadTasteTestServerState();
}

export async function loadBookDetailPersonalization(
  workId: string,
  locale: Locale = 'en',
): Promise<BookDetailPersonalization> {
  const numericWorkId = Number(workId);
  if (!Number.isSafeInteger(numericWorkId) || numericWorkId < 1) {
    return {
      authenticated: false,
      hasEvidence: false,
      candidate: null,
      match: null,
    };
  }

  const { client, user } = await getVerifiedServerUser();
  const [candidateEvidence, responsesResult, ratingsResult] = await Promise.all([
    loadWorkTraitEvidenceBatched(client, [workId]),
    user
      ? client.from('taste_test_responses').select('question_key,choice')
        .eq('quiz_version', TASTE_TEST_VERSION).eq('user_id', user.id)
      : Promise.resolve({ data: [], error: null }),
    user
      ? client.from('ratings').select('work_id,rating').eq('user_id', user.id)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const effectiveCandidate = buildEffectiveWorkTraitVector(
    candidateEvidence.get(workId) ?? [],
    getReviewedWorkTraitCorrection(workId),
  );
  const candidate: BookDetailMatchCandidate = {
    traits: effectiveCandidate.traits,
    metadataConfidence: effectiveCandidate.metadataConfidence,
    coverageLevel: effectiveCandidate.coverageLevel,
  };

  if (!user) {
    return {
      authenticated: false,
      hasEvidence: false,
      candidate,
      match: null,
    };
  }

  const answers = responsesResult.error
    ? {}
    : rowsToAnswers((responsesResult.data ?? []) as ResponseRow[]);
  const ratings = ratingsResult.error
    ? []
    : (ratingsResult.data ?? []) as RatingRow[];
  const ratedWorkIds = ratings.map(({ work_id }) => String(work_id));
  const ratingEvidenceRows = ratedWorkIds.length
    ? await loadWorkTraitEvidenceBatched(client, ratedWorkIds)
    : new Map<string, never[]>();
  const ratingEvidence: RatingEvidence[] = ratings.map((rating) => {
    const ratingWorkId = String(rating.work_id);
    const effective = buildEffectiveWorkTraitVector(
      ratingEvidenceRows.get(ratingWorkId) ?? [],
      getReviewedWorkTraitCorrection(ratingWorkId),
    );
    return {
      workId: ratingWorkId,
      rating: rating.rating,
      traits: effective.traits,
    };
  });
  const profile = buildTasteProfile(answers, ratingEvidence, locale);
  const hasEvidence = profile.selectedCount > 0 || profile.meaningfulRatingCount > 0;

  return {
    authenticated: true,
    hasEvidence,
    candidate,
    match: hasEvidence
      ? calculatePersonalMatch({ profile, candidate, workId, locale })
      : null,
  };
}

export async function loadHomepagePersonalization(locale: Locale = 'en'): Promise<HomepagePersonalization> {
  try {
    const { client, user } = await getVerifiedServerUser();
    if (!user) return { authenticated: false, ratingCount: 0, tasteTestAnsweredCount: 0, hasEvidence: false, recommendations: [] };

    const [responsesResult, ratingsResult, catalog, collaborativeSignals, readState] = await Promise.all([
      client.from('taste_test_responses').select('question_key,choice')
        .eq('quiz_version', TASTE_TEST_VERSION).eq('user_id', user.id),
      client.from('ratings').select('work_id,rating').eq('user_id', user.id),
      loadRecommendationCatalog(client),
      loadCollaborativeRecommendationSignals(client),
      loadReadWorkIdsForCurrentUser().catch(() => ({ authenticated: true, workIds: [] })),
    ]);
    const answers = responsesResult.error ? {} : rowsToAnswers((responsesResult.data ?? []) as ResponseRow[]);
    const ratings = ratingsResult.error ? [] : (ratingsResult.data ?? []) as RatingRow[];
    const ratedIds = ratings.map(({ work_id }) => String(work_id));
    const ratingEvidence: RatingEvidence[] = ratings.map((rating) => {
      const workId = String(rating.work_id);
      const effective = catalog.traitsById.get(workId);
      return {
        workId,
        rating: rating.rating,
        traits: effective?.traits ?? emptyTasteVector(),
      };
    });
    const profile = buildTasteProfile(answers, ratingEvidence);
    const hasEvidence = profile.selectedCount > 0 || profile.meaningfulRatingCount > 0;
    const recommendations = hasEvidence
      ? recommendBooks({
        candidates: catalog.candidates,
        profile,
        ratedWorkIds: new Set(ratedIds),
        excludedWorkIds: new Set([...TASTE_TEST_WORK_IDS, ...readState.workIds]),
        locale,
        languagePreference: resolveLocaleBookLanguagePreference(locale, profile),
        collaborativeSignals,
        limit: 10,
      })
      : [];
    return {
      authenticated: true,
      ratingCount: ratings.length,
      tasteTestAnsweredCount: profile.answeredCount,
      hasEvidence,
      recommendations: await hydratePublicRecommendations(recommendations),
    };
  } catch {
    return { authenticated: false, ratingCount: 0, tasteTestAnsweredCount: 0, hasEvidence: false, recommendations: [] };
  }
}

export async function loadGuestHomepagePersonalization(
  answers: TasteTestAnswers,
  locale: Locale = 'en',
): Promise<HomepagePersonalization> {
  const client = await createServerSupabaseClient();
  const catalog = await loadGuestRecommendationCatalog(client);
  const { profile, recommendations } = recommendGuestBooks({
    answers,
    candidates: catalog.candidates,
    locale,
    limit: 10,
  });
  const hasEvidence = profile.selectedCount > 0;

  return {
    authenticated: false,
    ratingCount: 0,
    tasteTestAnsweredCount: profile.answeredCount,
    hasEvidence,
    recommendations: await hydratePublicRecommendations(recommendations),
  };
}
