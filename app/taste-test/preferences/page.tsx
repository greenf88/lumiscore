import { LumiScoreTasteTest } from '@/app/components/LumiScoreTasteTest';
import { GuestRatingTasteTest } from '@/app/components/GuestRatingTasteTest';
import { TASTE_TEST_WORK_IDS } from '@/lib/taste-test/config';
import { createLocalizedPageMetadata } from '@/lib/seo/localized-metadata';
import { resolveRequestLocale } from '@/lib/i18n/server';
import type { GuestOffer } from '@/lib/taste-test/guest-round';
export const dynamic = 'force-dynamic';
export async function generateMetadata() { return createLocalizedPageMetadata({ title: 'Guest taste preferences — LumiScore', canonicalPath: '/taste-test/preferences', noIndex: true }); }
export default async function GuestPreferencesPage() {
  const {locale}=await resolveRequestLocale();
  const authState = await import('@/lib/supabase/auth')
    .then(m => m.loadHeaderAuthState()).catch(() => ({ authenticated: false as const }));
  if (authState.authenticated) {
    const books = await import('@/lib/supabase/books')
      .then(m => m.loadCatalogBooksByIdsWithStoredCovers(TASTE_TEST_WORK_IDS, undefined, locale)).catch(() => []);
    return <LumiScoreTasteTest key={locale} books={books} initialAuthState={authState} />;
  }

  let offers: GuestOffer[] | null = null;
  try {
    const { loadGuestTasteInventory } = await import('@/lib/supabase/guest-taste-inventory');
    offers = await loadGuestTasteInventory(locale);
  } catch {
    console.warn('Guest taste inventory unavailable', { locale });
  }
  return <GuestRatingTasteTest key={locale} offers={offers} authState={authState} />;
}
