import { LumiScoreTasteTest } from '@/app/components/LumiScoreTasteTest';
import { TASTE_TEST_WORK_IDS } from '@/lib/taste-test/config';
import { createLocalizedPageMetadata } from '@/lib/seo/localized-metadata';
import { resolveRequestLocale } from '@/lib/i18n/server';
export const dynamic = 'force-dynamic';
export async function generateMetadata() { return createLocalizedPageMetadata({ title: 'Guest taste preferences — LumiScore', canonicalPath: '/taste-test/preferences', noIndex: true }); }
export default async function GuestPreferencesPage() {
  const {locale}=await resolveRequestLocale();
  const [books, authState] = await Promise.all([
    import('@/lib/supabase/books').then(m => m.loadCatalogBooksByIdsWithStoredCovers(TASTE_TEST_WORK_IDS,undefined,locale)).catch(() => []),
    import('@/lib/supabase/auth').then(m => m.loadHeaderAuthState()).catch(() => ({ authenticated: false })),
  ]);
  return <LumiScoreTasteTest key={locale} books={books} initialAuthState={authState} />;
}
