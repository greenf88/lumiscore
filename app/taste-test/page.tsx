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
  let books: Book[] = [];
  try {
    const { loadCatalogBooksByIds } = await import('@/lib/supabase/books');
    books = await loadCatalogBooksByIds(TASTE_TEST_WORK_IDS);
  } catch (error) {
    console.error('Taste Test catalog load failed.', error);
  }
  return <LumiScoreTasteTest books={books} />;
}
