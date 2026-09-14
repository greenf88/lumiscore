import type { Metadata } from 'next';
import { LumiScoreTasteTest } from '@/app/components/LumiScoreTasteTest';
import type { Book } from '@/app/data/books';
import { TASTE_TEST_WORK_IDS } from '@/lib/taste-test/config';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Taste Test — LumiScore',
  description: 'Choose between ten pairs of books to shape your LumiScore reading taste.',
};

export default async function TasteTestPage() {
  const [books, initialAuthState] = await Promise.all([
    import('@/lib/supabase/books')
      .then(({ loadCatalogBooksByIds }) =>
        loadCatalogBooksByIds(TASTE_TEST_WORK_IDS),
      )
      .catch((error): Book[] => {
        console.error('Taste Test catalog load failed.', error);
        return [];
      }),
    import('@/lib/supabase/auth')
      .then(({ loadHeaderAuthState }) => loadHeaderAuthState())
      .catch(() => ({ authenticated: false })),
  ]);
  return <LumiScoreTasteTest books={books} initialAuthState={initialAuthState} />;
}
