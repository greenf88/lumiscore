import {withRecommendationEditionCovers} from '../books/edition-cover-evidence.ts';
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
import { mapCatalogWorks } from './books.ts';
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
import { loadStrictRecommendationBooks } from './taste-safety.ts';
import { loadSeriesPriorities } from './series-priority.ts';
import { prioritizeSeriesRecommendations } from '../recommendations/series-priority.ts';

const GUEST_RECOMMENDATION_CATALOG_TTL_MS = 5 * 60 * 1_000;
const guestRecommendationCatalogCache = new Map<Locale,{
  expiresAt: number;
  result: Promise<RecommendationCatalog>;
}>();

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
  locale:Locale='en',
): Promise<RecommendationCatalog> {
  return loadPublicRecommendationCatalog(client, rows=>mapCatalogWorks(rows,locale));
}

function loadGuestRecommendationCatalog(
  client: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  locale:Locale,
): Promise<RecommendationCatalog> {
  const cached=guestRecommendationCatalogCache.get(locale);
  if(cached && cached.expiresAt>Date.now())return cached.result;

  const result = loadRecommendationCatalog(client,locale).catch((error: unknown) => {
    guestRecommendationCatalogCache.delete(locale);
    throw error;
  });
  guestRecommendationCatalogCache.set(locale,{
    expiresAt: Date.now() + GUEST_RECOMMENDATION_CATALOG_TTL_MS,
    result,
  });
  return result;
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
      loadRecommendationCatalog(reader.client,locale),
      loadCollaborativeRecommendationSignals(reader.client),
    ]);
    const { ratings } = reader;
    const [strictBooks, series] = await Promise.all([
      loadStrictRecommendationBooks(reader.client,catalog.candidates.map(c=>c.book),locale),
      loadSeriesPriorities(reader.client,ratings,[...reader.statuses].map(([work_id,status])=>({work_id,status})),locale),
    ]);
    const strictById = new Map(strictBooks.map(book=>[book.workId,book]));
    const strictCandidates = catalog.candidates.flatMap(c=>strictById.has(c.book.workId)?[{...c,book:strictById.get(c.book.workId)!}]:[]);
    const ratedIds = ratings.map(({ work_id }) => String(work_id));
    const profile = reader.profile!;
    const hasEvidence = profile.selectedCount > 0 || profile.meaningfulRatingCount > 0;
    const recommendations = hasEvidence
      ? recommendBooks({
        candidates: strictCandidates,
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
      recommendations: await withRecommendationEditionCovers(prioritizeSeriesRecommendations(recommendations,series,locale,limit)),
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
  const catalog = await loadGuestRecommendationCatalog(client,locale);
  const strictBooks=await loadStrictRecommendationBooks(client,catalog.candidates.map(c=>c.book),locale);
  const byId=new Map(strictBooks.map(book=>[book.workId,book]));
  const { profile, recommendations } = recommendGuestBooks({
    answers,
    candidates: catalog.candidates.flatMap(c=>byId.has(c.book.workId)?[{...c,book:byId.get(c.book.workId)!}]:[]),
    locale,
    limit,
  });
  const hasEvidence = profile.selectedCount > 0;

  return {
    authenticated: false,
    ratingCount: 0,
    tasteTestAnsweredCount: profile.answeredCount,
    hasEvidence,
    recommendations:await withRecommendationEditionCovers(recommendations),
  };
}
