import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import type { Book } from '../app/data/books.ts';
import { recommendBooks, type RecommendationCandidate } from '../lib/recommendations/engine.ts';
import { getReviewedWorkTraitCorrection } from '../lib/recommendations/reviewed-work-trait-corrections.ts';
import { buildEffectiveWorkTraitVector } from '../lib/recommendations/work-trait-evidence.ts';
import {
  TASTE_TEST_ANCHORS,
  TASTE_TEST_WORK_IDS,
} from '../lib/taste-test/config.ts';
import type { TasteProfile } from '../lib/taste-test/profile.ts';
import {
  emptyTasteVector,
  normalizeTasteVector,
  tasteVector,
  type TasteVector,
} from '../lib/taste-test/traits.ts';
import { loadPublicRatingSummariesBatched } from '../lib/supabase/public-rating-summaries.ts';
import { loadWorkTraitEvidenceBatched } from '../lib/supabase/work-trait-evidence.ts';

type WorkRow = {
  id: number | string;
  title: string;
  authors: { name?: string } | Array<{ name?: string }> | null;
};

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!supabaseUrl || !publishableKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
}

const publicClient = createClient(supabaseUrl, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const tasteTestWorkIds = new Set<string>(TASTE_TEST_WORK_IDS);

const PROFILE_DEFINITIONS = {
  fast_paced_accessible_worldbuilding: {
    fast_paced: 1,
    accessible: 1,
    worldbuilding: 1,
  },
  science_fiction: {
    science_fiction: 1,
    speculative: .8,
    worldbuilding: .65,
    idea_driven: .65,
  },
  thriller: {
    thriller_mystery: 1,
    dark: .6,
    fast_paced: .7,
  },
  romance_contemporary: {
    romance: 1,
    contemporary: 1,
    character_driven: .75,
    uplifting: .4,
  },
  literary_classic: {
    literary: 1,
    classic: 1,
    character_driven: .8,
    slow_burn: .55,
  },
} satisfies Record<string, Partial<TasteVector>>;

function authorName(work: WorkRow): string {
  const author = Array.isArray(work.authors) ? work.authors[0] : work.authors;
  return author?.name?.trim() || 'Unknown author';
}

function auditProfile(vector: Partial<TasteVector>): TasteProfile {
  const normalized = normalizeTasteVector(tasteVector(vector));
  return {
    vector: normalized,
    tasteTestVector: normalized,
    ratingsVector: emptyTasteVector(),
    blend: { tasteTest: 1, ratings: 0 },
    answeredCount: 10,
    selectedCount: 5,
    ratingCount: 12,
    meaningfulRatingCount: 12,
    confidence: 'HIGH',
    summary: 'Deterministic recommendation exclusion audit',
  };
}

async function loadCatalog(): Promise<WorkRow[]> {
  const rows: WorkRow[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await publicClient
      .from('works')
      .select('id,title,authors(name)')
      .order('id')
      .range(from, from + 499);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as WorkRow[]));
    if ((data?.length ?? 0) < 500) break;
  }
  return rows;
}

function compactRecommendation(recommendation: ReturnType<typeof recommendBooks>[number]) {
  return {
    rank: 0,
    work_id: recommendation.book.workId,
    title: recommendation.book.title,
    personal_similarity: Number(recommendation.personalMatch.toFixed(4)),
    ranking_score: Number(recommendation.rankingScore.toFixed(4)),
    match: recommendation.matchScore === null
      ? recommendation.matchLabel
      : `Your Match ${recommendation.matchScore}%`,
  };
}

const catalog = await loadCatalog();
const workIds = catalog.map(({ id }) => String(id));
const [evidenceByWorkId, ratingsByWorkId] = await Promise.all([
  loadWorkTraitEvidenceBatched(publicClient, workIds),
  loadPublicRatingSummariesBatched(publicClient, workIds),
]);
const candidates: RecommendationCandidate[] = catalog.flatMap((work) => {
  const workId = String(work.id);
  const effective = buildEffectiveWorkTraitVector(
    evidenceByWorkId.get(workId) ?? [],
    getReviewedWorkTraitCorrection(workId),
  );
  if (effective.coverageLevel === 'none') return [];
  const rating = ratingsByWorkId.get(workId);
  const book: Book = {
    id: `work-${workId}`,
    source: 'supabase',
    workId,
    title: work.title,
    author: authorName(work),
    score: rating?.lumiscore ?? null,
    ratingsCount: rating?.ratingCount ?? 0,
    match: null,
    cover: 'orbit',
  };
  return [{
    book,
    traits: effective.traits,
    metadataConfidence: effective.metadataConfidence,
    coverageLevel: effective.coverageLevel,
    seriesKey: TASTE_TEST_ANCHORS[workId]?.seriesKey,
  }];
});

const simulations = Object.fromEntries(
  Object.entries(PROFILE_DEFINITIONS).map(([name, vector]) => {
    const profile = auditProfile(vector);
    const before = recommendBooks({
      candidates,
      profile,
      ratedWorkIds: new Set(),
      excludedWorkIds: new Set(),
      limit: 10,
    }).map(compactRecommendation).map((recommendation, index) => ({
      ...recommendation,
      rank: index + 1,
    }));
    const after = recommendBooks({
      candidates,
      profile,
      ratedWorkIds: new Set(),
      excludedWorkIds: tasteTestWorkIds,
      limit: 10,
    }).map(compactRecommendation).map((recommendation, index) => ({
      ...recommendation,
      rank: index + 1,
    }));

    assert.equal(after.length, 10, `${name} did not fill its Top 10`);
    assert.ok(
      after.every(({ work_id }) => work_id && !tasteTestWorkIds.has(work_id)),
      `${name} leaked a Taste Test work`,
    );

    return [name, {
      before,
      after,
      removed_taste_test_works: before.filter(({ work_id }) =>
        Boolean(work_id && tasteTestWorkIds.has(work_id))),
      replacements: after.filter(({ work_id }) =>
        !before.some((beforeItem) => beforeItem.work_id === work_id)),
    }];
  }),
);

console.info(JSON.stringify({
  catalog_works: catalog.length,
  recommendation_candidates: candidates.length,
  excluded_taste_test_work_count: tasteTestWorkIds.size,
  excluded_taste_test_works: TASTE_TEST_WORK_IDS.map((workId) => ({
    work_id: workId,
    title: TASTE_TEST_ANCHORS[workId].title,
  })),
  all_after_lists_are_anchor_free: true,
  simulations,
}, null, 2));
