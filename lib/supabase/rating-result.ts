import { createServerSupabaseClient } from './server.ts';
import { loadRecommendationCatalog } from './recommendation-catalog.ts';
import { mapCatalogWorks } from './books.ts';
import { recommendRatingResult } from '../taste-test/rating-result.ts';
import { loadReaderTasteProfile } from './reader-taste-profile.ts';
import type { Locale } from '../i18n/config.ts';
import { TASTE_TEST_WORK_IDS } from '../taste-test/config.ts';
import { loadStrictRecommendationBooks } from './taste-safety.ts';
import { loadSeriesPriorities } from './series-priority.ts';
import { prioritizeSeriesRecommendations } from '../recommendations/series-priority.ts';

export async function loadRatingResult(locale: Locale) {
  const client = await createServerSupabaseClient();
  const {data:{user},error:authError} = await client.auth.getUser();
  if (authError && ((authError.status ?? 0)>=500 || authError.name==='AuthRetryableFetchError')) throw authError;
  if (!user) return { kind:'signed-out' as const };
  const [reader,roundResult,catalog] = await Promise.all([
    loadReaderTasteProfile(client,user.id,locale),
    client.rpc('taste_rating_state'), loadRecommendationCatalog(client,mapCatalogWorks),
  ]);
  const {ratings,statuses,profile}=reader;
  if (roundResult.error) throw roundResult.error;
  const round = roundResult.data?.round;
  const language: Locale = round?.language === 'nl' ? 'nl' : round?.language === 'en' ? 'en' : locale;
  const [strictBooks,series] = await Promise.all([
    loadStrictRecommendationBooks(client,catalog.candidates.map(c=>c.book),language),
    loadSeriesPriorities(client,ratings,statuses,language),
  ]);
  const availableIds = new Set(strictBooks.flatMap(book => book.workId ? [book.workId] : []));
  const strictById=new Map(strictBooks.map(book=>[book.workId,book]));
  const candidates=catalog.candidates.flatMap(c=>strictById.has(c.book.workId)?[{...c,book:strictById.get(c.book.workId)!}]:[]);
  const recommendations = recommendRatingResult({profile,candidates,evidence:catalog.traitsById,
    excludedIds:new Set([...TASTE_TEST_WORK_IDS,...ratings.map(x=>String(x.work_id)),...statuses.filter(x=>x.status==='read').map(x=>String(x.work_id))]),
    availableIds,locale});
  return { kind:'result' as const, profile, roundRatedCount:round?.ratedCount ?? 0, language,
    partial:round?.ratedCount < (round?.goal ?? 20), exhausted:roundResult.data?.exhausted === true,
    recommendations:prioritizeSeriesRecommendations(recommendations,series,locale) };
}
export type RatingResult = Awaited<ReturnType<typeof loadRatingResult>>;
