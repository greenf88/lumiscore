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
    client.rpc('taste_rating_state'), loadRecommendationCatalog(client,mapCatalogWorks),
  ]);
  const {ratings,statuses,profile}=reader;
  if (roundResult.error) throw roundResult.error;
  const round = roundResult.data?.round;
  const language: Locale = round?.language === 'nl' ? 'nl' : round?.language === 'en' ? 'en' : locale;
  const ids = catalog.candidates.flatMap(x => x.book.workId ? [Number(x.book.workId)] : []);
  const availableIds = new Set<string>();
  // An Edition must really exist in the selected language. Do not infer from ISBN.
  for (let start=0; start<ids.length; start+=200) {
    for (let offset=0; ; offset+=1000) {
      const { data,error } = await client.from('editions').select('id,work_id')
        .in('work_id',ids.slice(start,start+200)).or(language==='nl' ? 'language.ilike.nl,language.ilike.nld,language.ilike.dut' : 'language.ilike.en,language.ilike.eng')
        .order('id').range(offset,offset+999);
      if (error) throw error;
      for (const row of data ?? []) availableIds.add(String(row.work_id));
      if ((data?.length ?? 0)<1000) break;
    }
  }
  const recommendations = recommendRatingResult({profile,candidates:catalog.candidates,evidence:catalog.traitsById,
    excludedIds:new Set([...TASTE_TEST_WORK_IDS,...ratings.map(x=>String(x.work_id)),...statuses.filter(x=>x.status==='read').map(x=>String(x.work_id))]),
    availableIds,locale});
  const hydrated = await loadCatalogBooksByIdsWithStoredCovers(recommendations.map(x=>x.book.workId!),undefined,language);
  const books = new Map(hydrated.map(book=>[book.workId,book]));
  return { kind:'result' as const, profile, roundRatedCount:round?.ratedCount ?? 0, language,
    partial:round?.ratedCount < (round?.goal ?? 20), exhausted:roundResult.data?.exhausted === true,
    recommendations:recommendations.map(x=>({...x,book:books.get(x.book.workId) ?? x.book})) };
}
export type RatingResult = Awaited<ReturnType<typeof loadRatingResult>>;
