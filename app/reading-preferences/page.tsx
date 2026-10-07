import { redirect } from 'next/navigation';
import { createLocalizedPageMetadata } from '@/lib/seo/localized-metadata';
import { LumiScoreReadingPreferences } from '@/app/components/LumiScoreReadingPreferences';
import { getSafeNextPath } from '@/lib/auth/request';
import { getVerifiedServerUser } from '@/lib/supabase/auth';
import { loadReaderEraPreferences } from '@/lib/supabase/reading-preferences';
import { resolveRequestLocale } from '@/lib/i18n/server';
import { localizedHref } from '@/lib/i18n/paths';

export const dynamic = 'force-dynamic';
export async function generateMetadata() { return createLocalizedPageMetadata({
  title: 'Reading preferences — LumiScore', canonicalPath: '/reading-preferences', noIndex: true,
}); }

export default async function ReadingPreferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const value = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = getSafeNextPath(value, '/');
  const { client, user } = await getVerifiedServerUser();
  const { locale } = await resolveRequestLocale();
  if (!user) redirect(localizedHref(`/login?next=${encodeURIComponent(localizedHref(`/reading-preferences?next=${encodeURIComponent(localizedHref(next, locale))}`, locale))}`, locale));
  const initial = await loadReaderEraPreferences(client, user.id);

  return <>
    <LumiScoreReadingPreferences initial={initial} next={next} />
  </>;
}
