import { LumiScoreHome } from './components/LumiScoreHome';
import { books } from './data/books';
import {
  logServerEnvironmentPresence,
  readServerEnvironment,
} from '@/lib/server-environment';
import type { HomepagePersonalization } from '@/lib/supabase/taste-test';

const CATALOG_CATEGORY_COUNT = 7;

async function loadHomepageBooks() {
  logServerEnvironmentPresence();

  if (
    !readServerEnvironment('NEXT_PUBLIC_SUPABASE_URL') ||
    !readServerEnvironment('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
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
  const [catalog, personalization] = await Promise.all([
    loadHomepageBooks(),
    import('@/lib/supabase/taste-test')
      .then(({ loadHomepagePersonalization }) =>
        loadHomepagePersonalization(),
      )
      .catch((): HomepagePersonalization => ({
        authenticated: false,
        ratingCount: 0,
        tasteTestAnsweredCount: 0,
        hasEvidence: false,
        recommendations: [],
      })),
  ]);

  return (
    <LumiScoreHome
      initialBooks={catalog.books}
      catalogStats={{
        books: catalog.total,
        categories: CATALOG_CATEGORY_COUNT,
      }}
      personalization={personalization}
    />
  );
}
