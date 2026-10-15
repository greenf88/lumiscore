import type { Book } from '../../app/data/books.ts';
import type {
  PersonalMatchResult,
  PersonalizedRecommendation,
} from '../recommendations/engine.ts';
import { calculatePersonalMatch, recommendBooks } from '../recommendations/engine.ts';
import { getReviewedWorkTraitCorrection } from '../recommendations/reviewed-work-trait-corrections.ts';
import {
  buildEffectiveWorkTraitVector,
  reliableProfileTraits,
} from '../recommendations/work-trait-evidence.ts';
import {
  TASTE_TEST_VERSION,
  TASTE_TEST_WORK_IDS,
  type TasteTestAnswers,
  type TasteTestChoice,
  type TasteTestQuestionKey,
} from '../taste-test/config.ts';
import type { TasteProfile } from '../taste-test/profile.ts';
import type { TasteVector } from '../taste-test/traits.ts';
import type { WorkTraitCoverageLevel } from '../recommendations/work-trait-evidence.ts';
import { getVerifiedServerUser } from './auth.ts';
import { loadCatalogBooksByIds, mapCatalogWorks } from './books.ts';
import { loadRecommendationCatalog as loadPublicRecommendationCatalog, type RecommendationCatalog } from './recommendation-catalog.ts';
import { createServerSupabaseClient } from './server.ts';
import { loadWorkTraitEvidenceBatched } from './work-trait-evidence.ts';
import type { Locale } from '../i18n/config.ts';
import { resolveLocaleBookLanguagePreference } from '../recommendations/language-preference.ts';
import { recommendGuestBooks } from '../recommendations/guest.ts';
import { loadCollaborativeRecommendationSignals } from './collaborative.ts';
import { loadReaderEraPreferences } from './reading-preferences.ts';
import { loadReaderTasteProfile,type ReaderRatingRow } from './reader-taste-profile.ts';
import type { ReaderEraPreferences } from '../preferences/reading-periods.ts';
import { isReadingStatus, type ReadingStatus } from '../collections/model.ts';
import { cache } from 'react';

const GUEST_RECOMMENDATION_CATALOG_TTL_MS = 5 * 60 * 1_000;
let guestRecommendationCatalogCache: {
  expiresAt: number;
  result: Promise<RecommendationCatalog>;
} | null = null;

export type TasteTestServerState = {
  authenticated: boolean;
  answers: TasteTestAnswers;
  ratingCount: number;
  persistenceAvailable: boolean;
  profile: TasteProfile | null;
};

export type HomepagePersonalization = {
  unavailable?: boolean;
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
  unavailable?: boolean;
  authenticated: boolean;
  hasEvidence: boolean;
  candidate: BookDetailMatchCandidate | null;
  match: PersonalMatchResult | null;
};

export type HomepageReaderContext = {
  authenticated: boolean;
  client: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  answers: TasteTestAnswers;
  ratings: ReaderRatingRow[];
  profile: TasteProfile | null;
  statuses: Map<string, ReadingStatus>;
  readerPreferences: ReaderEraPreferences | null;
};

// React cache keeps these authenticated, explicitly user-scoped reads shared
// within one homepage request. The result is never placed in a public cache or
// returned to the client as raw profile/status data.
export const loadHomepageReaderContext = cache(async (locale:Locale='en'): Promise<HomepageReaderContext> => {
  const { client, user } = await getVerifiedServerUser();
  if (!user) {
    return {
      authenticated: false,
      client,
      answers: {},
      ratings: [],
      profile: null,
      statuses: new Map(),
      readerPreferences: null,
    };
  }

  const [reader, readerPreferences] = await Promise.all([
    loadReaderTasteProfile(client,user.id,locale),
    loadReaderEraPreferences(client, user.id).catch(() => null),
  ]);

  return {
    authenticated: true,
    client,
    answers: reader.answers,
    ratings: reader.ratings,
    profile: reader.profile,
    statuses: new Map(reader.statuses
      .flatMap((row) => isReadingStatus(row.status)
        ? [[String(row.work_id), row.status] as const]
        : [])),
    readerPreferences,
  };
});

async function loadRecommendationCatalog(
  client: Awaited<ReturnType<typeof createServerSupabaseClient>>,
): Promise<RecommendationCatalog> {
  return loadPublicRecommendationCatalog(client, mapCatalogWorks);
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

export async function loadTasteTestServerState(locale:Locale='en'): Promise<TasteTestServerState> {
  const { client, user } = await getVerifiedServerUser();
  if (!user) return { authenticated: false, answers: {}, ratingCount: 0, persistenceAvailable: true,profile:null };
  const reader=await loadReaderTasteProfile(client,user.id,locale);
  return {
    authenticated: true,
    answers: reader.answers,
    ratingCount: reader.profile.ratingCount,
    persistenceAvailable: true,profile:reader.profile,
  };
}

export async function saveTasteTestAnswers(
  answers: ReadonlyArray<{ questionKey: TasteTestQuestionKey; choice: TasteTestChoice }>,
  locale:Locale='en',
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
  return loadTasteTestServerState(locale);
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
  const [candidateEvidence, reader] = await Promise.all([
    loadWorkTraitEvidenceBatched(client, [workId]),
    user ? loadReaderTasteProfile(client,user.id,locale) : null,
  ]);
  const effectiveCandidate = buildEffectiveWorkTraitVector(
    candidateEvidence.get(workId) ?? [],
    getReviewedWorkTraitCorrection(workId),
  );
  const candidate: BookDetailMatchCandidate = {
    traits: reliableProfileTraits(effectiveCandidate),
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

  const profile = reader!.profile;
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

export async function loadHomepagePersonalization(locale: Locale = 'en', limit = 20): Promise<HomepagePersonalization> {
  try {
    const reader = await loadHomepageReaderContext(locale);
    if (!reader.authenticated) return { authenticated: false, ratingCount: 0, tasteTestAnsweredCount: 0, hasEvidence: false, recommendations: [] };

    const [catalog, collaborativeSignals] = await Promise.all([
      loadRecommendationCatalog(reader.client),
      loadCollaborativeRecommendationSignals(reader.client),
    ]);
    const { ratings } = reader;
    const ratedIds = ratings.map(({ work_id }) => String(work_id));
    const profile = reader.profile!;
    const hasEvidence = profile.selectedCount > 0 || profile.meaningfulRatingCount > 0;
    const recommendations = hasEvidence
      ? recommendBooks({
        candidates: catalog.candidates,
        profile,
        ratedWorkIds: new Set(ratedIds),
        excludedWorkIds: new Set([
          ...TASTE_TEST_WORK_IDS,
          ...[...reader.statuses].flatMap(([workId, status]) => status === 'read' ? [workId] : []),
        ]),
        locale,
        languagePreference: resolveLocaleBookLanguagePreference(locale, profile),
        collaborativeSignals,
        readingPeriods: reader.readerPreferences?.readingPeriods ?? null,
        limit,
      })
      : [];
    return {
      authenticated: true,
      ratingCount: profile.ratingCount,
      tasteTestAnsweredCount: profile.answeredCount,
      hasEvidence,
      recommendations: await hydratePublicRecommendations(recommendations),
    };
  } catch {
    return { unavailable:true, authenticated: false, ratingCount: 0, tasteTestAnsweredCount: 0, hasEvidence: false, recommendations: [] };
  }
}

export async function loadGuestHomepagePersonalization(
  answers: TasteTestAnswers,
  locale: Locale = 'en',
  limit = 20,
): Promise<HomepagePersonalization> {
  const client = await createServerSupabaseClient();
  const catalog = await loadGuestRecommendationCatalog(client);
  const { profile, recommendations } = recommendGuestBooks({
    answers,
    candidates: catalog.candidates,
    locale,
    limit,
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
