import type {SupabaseClient} from '@supabase/supabase-js';
import {loadReaderTasteProfile} from './reader-taste-profile.ts';
import {readingProfileTotals} from '../collections/reading-profile.ts';
import type {Locale} from '../i18n/config.ts';

// Called only with the existing verified server user. No module/public cache,
// catalog download, recommendations request, book hydration or per-Work queries.
export async function loadReadingProfileForOwner(client: SupabaseClient, userId: string,locale:Locale='en') {
  const reader=await loadReaderTasteProfile(client,userId,locale);
  return {totals:readingProfileTotals(reader.ratings,reader.statuses),profile:reader.profile};
}
export type ReadingProfileData = Awaited<ReturnType<typeof loadReadingProfileForOwner>>;
