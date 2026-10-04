import type { SupabaseClient } from '@supabase/supabase-js';
import type { Book } from '../../app/data/books.ts';
import type { RecommendationCandidate } from '../recommendations/engine.ts';
import {
  getReviewedWorkTraitCorrection,
  REVIEWED_WORK_TRAIT_CORRECTIONS,
} from '../recommendations/reviewed-work-trait-corrections.ts';
import {
  buildEffectiveWorkTraitVector,
  type EffectiveWorkTraits,
} from '../recommendations/work-trait-evidence.ts';
import { TASTE_TEST_ANCHORS } from '../taste-test/config.ts';
import { applyRatingSummaries } from '../ratings/card-summaries.ts';
import { loadPublicRatingSummariesBatched } from './public-rating-summaries.ts';
import { loadRecommendationWorkTraitEvidence } from './work-trait-evidence.ts';

export type WorkFeatureRow = { id: number | string };
export type RecommendationCatalog = {
  candidates: RecommendationCandidate[];
  traitsById: Map<string, EffectiveWorkTraits>;
};
export const RECOMMENDATION_CATALOG_SELECT = [
  'id', 'title', 'first_publish_year', 'open_library_id', 'source_type',
  'work_type', 'author_id', 'cover_id', 'authors(id,name)',
  'editions(id,open_library_edition_id,isbn_13,language)',
].join(',');

export async function loadRecommendationCatalog(
  client: SupabaseClient,
  mapWorks: (rows: WorkFeatureRow[]) => Book[],
): Promise<RecommendationCatalog> {
  const evidenceById = await loadRecommendationWorkTraitEvidence(client);
  // Without evidence OR a reviewed correction a Work has coverage="none" and
  // the unchanged ranker excludes it. Include correction-only Works as well.
  const ids = [...new Set([
    ...evidenceById.keys(),
    ...REVIEWED_WORK_TRAIT_CORRECTIONS.map(({ workId }) => workId),
  ])].map(Number).filter((id) => Number.isSafeInteger(id) && id > 0).sort((a, b) => a - b);
  const batches = Array.from({ length: Math.ceil(ids.length / 200) },
    (_, index) => ids.slice(index * 200, (index + 1) * 200));
  const results = await Promise.all(batches.map((batch) => client.from('works')
    .select(RECOMMENDATION_CATALOG_SELECT).in('id', batch).order('id')));
  const failure = results.find(({ error }) => error);
  if (failure?.error) throw failure.error;
  const rows = (results.flatMap(({ data }) => data ?? []) as unknown as WorkFeatureRow[])
    .sort((left, right) => Number(left.id) - Number(right.id));
  const books = mapWorks(rows);
  const summaries = await loadPublicRatingSummariesBatched(client,
    books.flatMap(({ workId }) => workId ? [workId] : []));
  const traitsById = new Map(rows.map(({ id }) => {
    const workId = String(id);
    return [workId, buildEffectiveWorkTraitVector(
      evidenceById.get(workId) ?? [], getReviewedWorkTraitCorrection(workId),
    )] as const;
  }));
  const candidates = applyRatingSummaries(books, summaries).flatMap((book) => {
    if (!book.workId) return [];
    const effective = traitsById.get(book.workId);
    if (!effective || effective.coverageLevel === 'none') return [];
    return [{ book, traits: effective.traits,
      metadataConfidence: effective.metadataConfidence,
      coverageLevel: effective.coverageLevel,
      seriesKey: TASTE_TEST_ANCHORS[book.workId]?.seriesKey }];
  });
  // This is public catalog metadata, not a cached personal recommendation result.
  return { candidates, traitsById };
}
