import type {SupabaseClient} from '@supabase/supabase-js';
import {loadReaderRows} from './reader-rows.ts';
import {loadReadingProfileEvidence} from './work-trait-evidence.ts';
import {readingProfileTotals, type ProfileRatingRow, type ProfileStatusRow} from '../collections/reading-profile.ts';
import {buildEffectiveWorkTraitVector} from '../recommendations/work-trait-evidence.ts';
import {getReviewedWorkTraitCorrection} from '../recommendations/reviewed-work-trait-corrections.ts';
import {buildRatingResultProfile} from '../taste-test/rating-result.ts';

// Called only with the existing verified server user. No module/public cache,
// catalog download, recommendations request, book hydration or per-Work queries.
export async function loadReadingProfileForOwner(client: SupabaseClient, userId: string) {
  const [ratings,statuses] = await Promise.all([
    loadReaderRows<ProfileRatingRow>(client,'ratings','work_id,rating',userId),
    loadReaderRows<ProfileStatusRow>(client,'user_book_status','work_id,status',userId),
  ]);
  const totals = readingProfileTotals(ratings,statuses);
  const evidence = await loadReadingProfileEvidence(client,ratings.map(r=>String(r.work_id)));
  const traits = new Map(ratings.map(r=>{
    const id=String(r.work_id);
    return [id,buildEffectiveWorkTraitVector(evidence.get(id) ?? [],getReviewedWorkTraitCorrection(id))] as const;
  }));
  const profile = buildRatingResultProfile(ratings.map(r=>({workId:String(r.work_id),rating:r.rating})),traits);
  return {totals,profile};
}
export type ReadingProfileData = Awaited<ReturnType<typeof loadReadingProfileForOwner>>;
