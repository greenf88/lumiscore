import { LumiScoreTasteTest } from '@/app/components/LumiScoreTasteTest';
import { TASTE_TEST_WORK_IDS } from '@/lib/taste-test/config';
import { createPageMetadata } from '@/lib/seo/page-metadata';
export const dynamic = 'force-dynamic';
export const metadata = createPageMetadata({ title: 'Guest taste preferences — LumiScore', canonicalPath: '/taste-test/preferences', noIndex: true });
export default async function GuestPreferencesPage() {
  const [books, authState] = await Promise.all([
    import('@/lib/supabase/books').then(m => m.loadCatalogBooksByIds(TASTE_TEST_WORK_IDS)).catch(() => []),
    import('@/lib/supabase/auth').then(m => m.loadHeaderAuthState()).catch(() => ({ authenticated: false })),
  ]);
  return <LumiScoreTasteTest books={books} initialAuthState={authState} />;
}
