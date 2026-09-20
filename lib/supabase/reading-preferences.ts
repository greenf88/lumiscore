import type { SupabaseClient } from '@supabase/supabase-js';
import {
  EMPTY_READER_ERA_PREFERENCES,
  type ReaderEraPreferences,
  type ReadingPeriod,
} from '../preferences/reading-periods.ts';

type Row = {
  reading_periods: ReadingPeriod[] | null;
  onboarding_dismissed: boolean;
};

export async function loadReaderEraPreferences(
  client: SupabaseClient,
  userId: string,
): Promise<ReaderEraPreferences> {
  const { data, error } = await client
    .from('user_reading_preferences')
    .select('reading_periods,onboarding_dismissed')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  const row = data as Row | null;
  return row ? {
    readingPeriods: row.reading_periods ?? [],
    onboardingDismissed: row.onboarding_dismissed,
  } : EMPTY_READER_ERA_PREFERENCES;
}

export async function saveReaderEraPreferences(
  client: SupabaseClient,
  userId: string,
  preferences: Pick<ReaderEraPreferences, 'readingPeriods'>,
): Promise<void> {
  const { error } = await client.from('user_reading_preferences').upsert({
    user_id: userId,
    reading_periods: preferences.readingPeriods,
    onboarding_dismissed: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function dismissReaderEraOnboarding(
  client: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await client.from('user_reading_preferences').upsert({
    user_id: userId,
    onboarding_dismissed: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function clearReaderEraPreferences(
  client: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await client.from('user_reading_preferences').upsert({
    user_id: userId,
    reading_periods: [],
    onboarding_dismissed: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw error;
}
