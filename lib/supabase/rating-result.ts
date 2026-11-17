import { createServerSupabaseClient } from './server.ts';
import { loadRecommendationCatalog } from './recommendation-catalog.ts';
import { mapCatalogWorks, loadCatalogBooksByIdsWithStoredCovers } from './books.ts';
import { recommendRatingResult } from '../taste-test/rating-result.ts';
import { loadReaderTasteProfile } from './reader-taste-profile.ts';
import type { Locale } from '../i18n/config.ts';
import { TASTE_TEST_WORK_IDS } from '../taste-test/config.ts';

export async function loadRatingResult(locale: Locale) {
  const client = await createServerSupabaseClient();
  const {data:{user},error:authError} = await client.auth.getUser();
  if (authError && ((authError.status ?? 0)>=500 || authError.name==='AuthRetryableFetchError')) throw authError;
  if (!user) return { kind:'signed-out' as const };
  const [reader,roundResult,catalog] = await Promise.all([
    loadReaderTasteProfile(client,user.id,locale),
    client.rpc('taste_rating_state'), loadRecommendationCatalog(client,rows=>mapCatalogWorks(rows,locale)),
  ]);
  const {ratings,statuses,profile}=reader;
  if (roundResult.error) throw roundResult.error;
  const round = roundResult.data?.round;
  const language: Locale = round?.language === 'nl' ? 'nl' : round?.language === 'en' ? 'en' : locale;
  // The shared edition mapper already excludes unavailable languages, without
  // changing evidence thresholds, scoring or the stored round language.
  const availableIds = new Set(catalog.candidates.flatMap(x => x.book.workId ? [x.book.workId] : []));
  const recommendations = recommendRatingResult({profile,candidates:catalog.candidates,evidence:catalog.traitsById,
    excludedIds:new Set([...TASTE_TEST_WORK_IDS,...ratings.map(x=>String(x.work_id)),...statuses.filter(x=>x.status==='read').map(x=>String(x.work_id))]),
    availableIds,locale});
  const anchorRatings = [...ratings].filter(x=>x.rating>=7).sort((a,b)=>b.rating-a.rating||Number(a.work_id)-Number(b.work_id)).slice(0,3);
  const hydrated = await loadCatalogBooksByIdsWithStoredCovers([...new Set([...recommendations.map(x=>x.book.workId!),...anchorRatings.map(x=>String(x.work_id))])],undefined,locale);
  const books = new Map(hydrated.map(book=>[book.workId,book]));
  return { kind:'result' as const, profile, roundRatedCount:round?.ratedCount ?? 0, language,
    anchors:anchorRatings.flatMap(row=>{const book=books.get(String(row.work_id));return book?[{workId:String(row.work_id),title:book.title,rating:row.rating}]:[];}),
    partial:round?.ratedCount < (round?.goal ?? 20), exhausted:roundResult.data?.exhausted === true,
    recommendations:recommendations.map(x=>({...x,book:books.get(x.book.workId) ?? x.book})) };
}
export type RatingResult = Awaited<ReturnType<typeof loadRatingResult>>;
