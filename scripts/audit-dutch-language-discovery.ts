import { createClient } from '@supabase/supabase-js';
import type { Book } from '../app/data/books.ts';
import { selectDutchDiscoveryBooks } from '../lib/books/dutch-discovery.ts';
import { resolveBookLanguage } from '../lib/books/language.ts';
import { selectRepresentativeEdition } from '../lib/books/edition-ranking.ts';
import { recommendBooks, type RecommendationCandidate } from '../lib/recommendations/engine.ts';
import { resolveLocaleBookLanguagePreference } from '../lib/recommendations/language-preference.ts';
import { getReviewedWorkTraitCorrection } from '../lib/recommendations/reviewed-work-trait-corrections.ts';
import { buildEffectiveWorkTraitVector } from '../lib/recommendations/work-trait-evidence.ts';
import { loadPublicRatingSummariesBatched } from '../lib/supabase/public-rating-summaries.ts';
import { loadWorkTraitEvidenceBatched } from '../lib/supabase/work-trait-evidence.ts';
import { rankHighestRatedWorks } from '../lib/ratings/highest-rated.ts';
import { TASTE_TEST_WORK_IDS } from '../lib/taste-test/config.ts';
import type { TasteProfile } from '../lib/taste-test/profile.ts';
import {
  emptyTasteVector,
  normalizeTasteVector,
  tasteVector,
  type TasteVector,
} from '../lib/taste-test/traits.ts';

type EditionRow = {
  id?: number | string | null;
  open_library_edition_id?: string | null;
  isbn_13?: string | null;
  language?: string | null;
  publisher?: string | null;
  title?: string | null;
};
type WorkRow = {
  id: number | string;
  title: string;
  first_publish_year?: number | null;
  source_type?: string | null;
  work_type?: string | null;
  authors?: { name?: string | null } | Array<{ name?: string | null }> | null;
  editions?: EditionRow[] | null;
};

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!supabaseUrl || !publishableKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
}

const publicClient = createClient(supabaseUrl, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PROFILE_DEFINITIONS = {
  fast_paced_accessible_worldbuilding: { fast_paced: 1, accessible: 1, worldbuilding: 1 },
  science_fiction: { science_fiction: 1, speculative: .8, worldbuilding: .65, idea_driven: .65 },
  thriller: { thriller_mystery: 1, dark: .6, fast_paced: .7 },
  romance_contemporary: { romance: 1, contemporary: 1, character_driven: .75, uplifting: .4 },
  literary_classic: { literary: 1, classic: 1, character_driven: .8, slow_burn: .55 },
} satisfies Record<string, Partial<TasteVector>>;

function auditProfile(vector: Partial<TasteVector>): TasteProfile {
  const normalized = normalizeTasteVector(tasteVector(vector));
  return {
    vector: normalized,
    tasteTestVector: normalized,
    ratingsVector: emptyTasteVector(),
    blend: { tasteTest: 1, ratings: 0 },
    answeredCount: 10,
    selectedCount: 5,
    ratingCount: 0,
    meaningfulRatingCount: 0,
    confidence: 'MEDIUM',
    summary: 'Read-only Dutch-language discovery audit',
  };
}

async function loadCatalogRows(): Promise<WorkRow[]> {
  const rows: WorkRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await publicClient
      .from('works')
      .select([
        'id', 'title', 'first_publish_year', 'open_library_id', 'source_type',
        'work_type', 'author_id', 'cover_id', 'authors(id,name)',
        'editions(id,open_library_edition_id,isbn_13,language,publisher,title)',
      ].join(','))
      .order('id')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as WorkRow[]));
    if ((data?.length ?? 0) < 1000) break;
  }
  return rows;
}

function mapAuditBook(work: WorkRow): Book {
  const editions = work.editions ?? [];
  const representative = selectRepresentativeEdition(
    editions.map((edition) => ({
      ...edition,
      openLibraryEditionId: edition.open_library_edition_id,
      isbn13: edition.isbn_13,
      languageCodes: edition.language ? [edition.language] : [],
      publishers: edition.publisher,
    })),
    {
      workTitle: work.title,
      workType: work.work_type,
      firstPublishYear: work.first_publish_year,
      preferredLanguages: work.source_type === 'lumiscore_native' ? ['nld'] : ['eng'],
    },
  );
  const author = Array.isArray(work.authors) ? work.authors[0] : work.authors;
  const workId = String(work.id);
  return {
    id: `work-${workId}`,
    source: 'supabase',
    workId,
    sourceType: work.source_type,
    title: work.title,
    author: author?.name?.trim() || 'Unknown author',
    firstPublishYear: work.first_publish_year,
    isbn13: representative?.isbn_13 ?? null,
    editionLanguage: representative?.language ?? null,
    score: null,
    ratingsCount: 0,
    match: null,
    cover: 'orbit',
  };
}

function auditRow(
  recommendation: ReturnType<typeof recommendBooks>[number],
  positionByWorkId: ReadonlyMap<string, number>,
  otherPositionByWorkId: ReadonlyMap<string, number>,
) {
  const workId = recommendation.book.workId!;
  const language = resolveBookLanguage(recommendation.book);
  return {
    title: recommendation.book.title,
    work_id: workId,
    language: language.classification,
    language_code: language.languageCode,
    language_source: language.source,
    raw_personal_similarity: Number(recommendation.personalMatch.toFixed(4)),
    ranking_score: Number(recommendation.rankingScore.toFixed(4)),
    final_position: positionByWorkId.get(workId),
    other_locale_position: otherPositionByWorkId.get(workId) ?? null,
    locale_preference_affected_position:
      positionByWorkId.get(workId) !== otherPositionByWorkId.get(workId),
  };
}

const rows = await loadCatalogRows();
const mappedBooks = rows.map(mapAuditBook);
const workIds = mappedBooks.flatMap((book) => book.workId ? [book.workId] : []);
const [ratingsByWorkId, evidenceByWorkId] = await Promise.all([
  loadPublicRatingSummariesBatched(publicClient, workIds),
  loadWorkTraitEvidenceBatched(publicClient, workIds),
]);
const ratedBooks = mappedBooks.map((book) => {
  const rating = ratingsByWorkId.get(book.workId!);
  return {
    ...book,
    score: rating?.lumiscore ?? null,
    ratingsCount: rating?.ratingCount ?? 0,
  };
});
const candidates: RecommendationCandidate[] = ratedBooks.flatMap((mappedBook) => {
  if (!mappedBook.workId) return [];
  const effective = buildEffectiveWorkTraitVector(
    evidenceByWorkId.get(mappedBook.workId) ?? [],
    getReviewedWorkTraitCorrection(mappedBook.workId),
  );
  if (effective.coverageLevel === 'none') return [];
  return [{
    book: mappedBook,
    traits: effective.traits,
    metadataConfidence: effective.metadataConfidence,
    coverageLevel: effective.coverageLevel,
  }];
});
const languageCounts = mappedBooks.reduce(
  (counts, book) => {
    counts[resolveBookLanguage(book).classification] += 1;
    return counts;
  },
  { dutch: 0, non_dutch: 0, unknown: 0 },
);
const excludedWorkIds = new Set<string>(TASTE_TEST_WORK_IDS);
const highestRatedWorkIds = new Set(rankHighestRatedWorks(
  ratedBooks.map((book) => ({
    workId: book.workId!,
    title: book.title,
    score: book.score,
    ratingCount: book.ratingsCount ?? 0,
  })),
  18,
).map(({ workId }) => workId));
const dutchHomepageBooks = selectDutchDiscoveryBooks(
  ratedBooks,
  highestRatedWorkIds,
  6,
);
const simulations = Object.fromEntries(Object.entries(PROFILE_DEFINITIONS).map(([name, vector]) => {
  const profile = auditProfile(vector);
  const en = recommendBooks({
    candidates,
    profile,
    ratedWorkIds: new Set(),
    excludedWorkIds,
    locale: 'en',
    limit: 10,
  });
  const nl = recommendBooks({
    candidates,
    profile,
    ratedWorkIds: new Set(),
    excludedWorkIds,
    locale: 'nl',
    languagePreference: resolveLocaleBookLanguagePreference('nl', profile),
    limit: 10,
  });
  const enPositions = new Map(en.map(({ book }, index) => [book.workId!, index + 1]));
  const nlPositions = new Map(nl.map(({ book }, index) => [book.workId!, index + 1]));
  return [name, {
    locale_preference_strength: resolveLocaleBookLanguagePreference('nl', profile)?.strength ?? 0,
    en: en.map((recommendation) => auditRow(recommendation, enPositions, nlPositions)),
    nl: nl.map((recommendation) => auditRow(recommendation, nlPositions, enPositions)),
  }];
}));

console.info(JSON.stringify({
  catalog_works: mappedBooks.length,
  recommendation_candidates: candidates.length,
  language_counts: languageCounts,
  dutch_homepage_section: dutchHomepageBooks.map((book, index) => ({
    position: index + 1,
    title: book.title,
    work_id: book.workId,
    score: book.score,
    rating_count: book.ratingsCount,
    language: resolveBookLanguage(book),
  })),
  simulations,
}, null, 2));
