import { createClient } from '@supabase/supabase-js';
import type { Book } from '../app/data/books.ts';
import { applyRatingSummaries } from '../lib/ratings/card-summaries.ts';
import {
  buildCollaborativeSignals,
  type CollaborativeRating,
} from '../lib/recommendations/collaborative.ts';
import { recommendBooks, type RecommendationCandidate } from '../lib/recommendations/engine.ts';
import { getReviewedWorkTraitCorrection } from '../lib/recommendations/reviewed-work-trait-corrections.ts';
import { buildEffectiveWorkTraitVector } from '../lib/recommendations/work-trait-evidence.ts';
import { loadPublicRatingSummariesBatched } from '../lib/supabase/public-rating-summaries.ts';
import { loadWorkTraitEvidenceBatched } from '../lib/supabase/work-trait-evidence.ts';
import { TASTE_TEST_WORK_IDS } from '../lib/taste-test/config.ts';
import { buildTasteProfile, type RatingEvidence } from '../lib/taste-test/profile.ts';
import { emptyTasteVector } from '../lib/taste-test/traits.ts';

type RatingRow = { user_id: string; work_id: number | string; rating: number };
type WorkRow = {
  id: number | string;
  title: string;
  first_publish_year?: number | null;
  source_type?: string | null;
  authors?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serverSecret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serverSecret) {
  throw new Error('The read-only audit needs NEXT_PUBLIC_SUPABASE_URL and a server-side Supabase secret.');
}

const client = createClient(supabaseUrl, serverSecret, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const pageSize = 1000;
const tasteTestWorkIds = new Set<string>(TASTE_TEST_WORK_IDS);

async function loadAllRatings(): Promise<RatingRow[]> {
  const rows: RatingRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from('ratings')
      .select('user_id,work_id,rating')
      .order('user_id')
      .order('work_id')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as RatingRow[]));
    if ((data?.length ?? 0) < pageSize) break;
  }
  return rows;
}

async function loadCandidates(): Promise<{
  candidates: RecommendationCandidate[];
  traitsById: Map<string, ReturnType<typeof buildEffectiveWorkTraitVector>>;
}> {
  const rows: WorkRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from('works')
      .select([
        'id', 'title', 'first_publish_year', 'open_library_id', 'source_type',
        'work_type', 'author_id', 'cover_id', 'authors(id,name)',
        'editions(id,open_library_edition_id,isbn_13,language)',
      ].join(','))
      .order('id')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as WorkRow[]));
    if ((data?.length ?? 0) < pageSize) break;
  }
  const books: Book[] = rows.map((row, index) => {
    const relatedAuthor = Array.isArray(row.authors) ? row.authors[0] : row.authors;
    const workId = String(row.id);
    return {
      id: `work-${workId}`,
      source: 'supabase',
      sourceType: row.source_type,
      workId,
      title: row.title,
      author: relatedAuthor?.name?.trim() || 'Unknown author',
      firstPublishYear: row.first_publish_year,
      score: null,
      ratingsCount: 0,
      match: null,
      cover: ['orbit', 'window', 'spectrum', 'botanical'][index % 4] as Book['cover'],
    };
  });
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
    return [{
      book,
      traits: effective.traits,
      metadataConfidence: effective.metadataConfidence,
      coverageLevel: effective.coverageLevel,
    }];
  });
  return { candidates, traitsById };
}

const rawRatings = await loadAllRatings();
const ratings: CollaborativeRating[] = rawRatings.map((rating) => ({
  userId: rating.user_id,
  workId: String(rating.work_id),
  rating: rating.rating,
}));
const ratingsByUser = new Map<string, CollaborativeRating[]>();
for (const rating of ratings) {
  const userRatings = ratingsByUser.get(rating.userId) ?? [];
  userRatings.push(rating);
  ratingsByUser.set(rating.userId, userRatings);
}
const eligibleUsers = [...ratingsByUser].filter(([, userRatings]) =>
  userRatings.filter(({ rating }) => rating >= 8).length >= 2,
);
let qualifyingSimilarReaderRelationships = 0;
let candidateCollaborativeRelationships = 0;
let sampleTargetId: string | null = null;
let sampleSignals: ReturnType<typeof buildCollaborativeSignals> = new Map();

for (const [targetUserId, targetRatings] of eligibleUsers) {
  const targetRated = new Set(targetRatings.map(({ workId }) => workId));
  const targetLikes = new Set(targetRatings.filter(({ rating }) => rating >= 8).map(({ workId }) => workId));
  for (const [otherUserId, otherRatings] of ratingsByUser) {
    if (otherUserId === targetUserId) continue;
    const sharedLikes = otherRatings.filter(({ rating, workId }) => rating >= 8 && targetLikes.has(workId)).length;
    if (sharedLikes < 2) continue;
    qualifyingSimilarReaderRelationships += 1;
    candidateCollaborativeRelationships += otherRatings.filter(({ rating, workId }) =>
      rating >= 8 && !targetRated.has(workId) && !tasteTestWorkIds.has(workId),
    ).length;
  }
  const signals = buildCollaborativeSignals(ratings, targetUserId);
  if (signals.size > sampleSignals.size) {
    sampleTargetId = targetUserId;
    sampleSignals = signals;
  }
}

let exampleCandidateBoosts: Array<Record<string, string | number | null>> = [];
if (sampleTargetId && sampleSignals.size > 0) {
  const catalog = await loadCandidates();
  const targetRatings = ratingsByUser.get(sampleTargetId) ?? [];
  const ratingEvidence: RatingEvidence[] = targetRatings.map(({ workId, rating }) => ({
    workId,
    rating,
    traits: catalog.traitsById.get(workId)?.traits ?? emptyTasteVector(),
  }));
  const profile = buildTasteProfile({}, ratingEvidence);
  const ratedWorkIds = new Set(targetRatings.map(({ workId }) => workId));
  const excludedWorkIds = tasteTestWorkIds;
  const baseline = recommendBooks({
    candidates: catalog.candidates,
    profile,
    ratedWorkIds,
    excludedWorkIds,
    limit: 100,
  });
  const collaborative = recommendBooks({
    candidates: catalog.candidates,
    profile,
    ratedWorkIds,
    excludedWorkIds,
    collaborativeSignals: sampleSignals,
    limit: 100,
  });
  const beforePositions = new Map(baseline.map(({ book }, index) => [book.workId!, index + 1]));
  const afterPositions = new Map(collaborative.map(({ book }, index) => [book.workId!, index + 1]));
  const booksById = new Map(catalog.candidates.map(({ book }) => [book.workId!, book]));
  exampleCandidateBoosts = [...sampleSignals]
    .filter(([workId]) => !ratedWorkIds.has(workId) && !excludedWorkIds.has(workId) && booksById.has(workId))
    .sort((left, right) => right[1].weight - left[1].weight || right[1].score - left[1].score)
    .slice(0, 5)
    .map(([workId, signal]) => ({
      work_id: workId,
      title: (booksById.get(workId) as Book).title,
      before_position: beforePositions.get(workId) ?? null,
      after_position: afterPositions.get(workId) ?? null,
      collaborative_score: Number(signal.score.toFixed(4)),
      collaborative_weight: Number(signal.weight.toFixed(4)),
    }));
}

console.info(JSON.stringify({
  users_with_two_or_more_strong_likes: eligibleUsers.length,
  qualifying_similar_reader_relationships: qualifyingSimilarReaderRelationships,
  candidate_collaborative_relationships: candidateCollaborativeRelationships,
  sample_profile_basis: sampleTargetId ? 'anonymous ratings-only profile' : null,
  example_candidate_boosts: exampleCandidateBoosts,
  note: eligibleUsers.length === 0 || candidateCollaborativeRelationships === 0
    ? 'The current dataset is too sparse for collaborative recommendations; thresholds were not weakened.'
    : 'Only anonymous aggregate counts and book-level effects are shown.',
}, null, 2));
