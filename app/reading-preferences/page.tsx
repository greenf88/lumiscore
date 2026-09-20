import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LumiScoreMetadata } from '@/app/components/LumiScoreMetadata';
import { LumiScoreReadingPreferences } from '@/app/components/LumiScoreReadingPreferences';
import { getSafeNextPath } from '@/lib/auth/request';
import { getVerifiedServerUser } from '@/lib/supabase/auth';
import { loadReaderEraPreferences } from '@/lib/supabase/reading-preferences';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Reading preferences — LumiScore' };

export default async function ReadingPreferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const value = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = getSafeNextPath(value, '/');
  const { client, user } = await getVerifiedServerUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/reading-preferences?next=${encodeURIComponent(next)}`)}`);
  const initial = await loadReaderEraPreferences(client, user.id);

  return <>
    <LumiScoreMetadata title="Reading preferences — LumiScore" noIndex />
    <LumiScoreReadingPreferences initial={initial} next={next} />
  </>;
}
