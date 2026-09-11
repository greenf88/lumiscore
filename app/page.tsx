import { LumiScoreHome } from './components/LumiScoreHome';
import { books } from './data/books';

const CATALOG_CATEGORY_COUNT = 7;

async function loadHomepageBooks() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return { books, total: books.length };
  }

  try {
    const { loadHomepageCatalog } = await import('@/lib/supabase/books');
    return await loadHomepageCatalog(18);
  } catch {
    return { books, total: books.length };
  }
}

export default async function Home() {
  const catalog = await loadHomepageBooks();

  return (
    <LumiScoreHome
      initialBooks={catalog.books}
      catalogStats={{
        books: catalog.total,
        categories: CATALOG_CATEGORY_COUNT,
      }}
    />
  );
}
