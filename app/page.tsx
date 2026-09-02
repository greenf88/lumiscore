import { LumiScoreHome } from './components/LumiScoreHome';
import { books } from './data/books';
import { SEED_BOOKS, SEED_CATEGORIES } from '@/scripts/open-library-seeds';

async function loadHomepageBooks() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return books;
  }

  try {
    const { loadCatalogBooks } = await import('@/lib/supabase/books');
    return await loadCatalogBooks(50);
  } catch {
    return books;
  }
}

export default async function Home() {
  return (
    <LumiScoreHome
      initialBooks={await loadHomepageBooks()}
      catalogStats={{
        books: SEED_BOOKS.length,
        categories: SEED_CATEGORIES.length,
      }}
    />
  );
}
