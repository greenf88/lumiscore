import { LumiScoreHome } from './components/LumiScoreHome';
import { LumiScoreMetadata } from './components/LumiScoreMetadata';
import { books } from './data/books';
import {
  logServerEnvironmentPresence,
  readServerEnvironment,
} from '@/lib/server-environment';
import type { HomepagePersonalization } from '@/lib/supabase/taste-test';
import { resolveRequestLocale } from '@/lib/i18n/server';
import { selectDutchDiscoveryBooks } from '@/lib/books/dutch-discovery';

const CATALOG_CATEGORY_COUNT = 7;

async function loadHomepageBooks() {
  logServerEnvironmentPresence();

  if (
    !readServerEnvironment('NEXT_PUBLIC_SUPABASE_URL') ||
    !readServerEnvironment('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
  ) {
    return process.env.NODE_ENV === 'production'
      ? { books: [], total: null, unavailable: true }
      : { books, total: books.length, unavailable: false };
  }

  try {
    const { loadHighestRatedCatalog } = await import('@/lib/supabase/books');
    const catalog = await loadHighestRatedCatalog(18);
    return { ...catalog, unavailable: false };
  } catch (error) {
    console.error('Homepage catalog load failed.', error);
    return process.env.NODE_ENV === 'production'
      ? { books: [], total: null, unavailable: true }
      : { books, total: books.length, unavailable: false };
  }
}

async function loadDutchHomepageCandidates(locale: 'en' | 'nl') {
  if (locale !== 'nl') return [];
  try {
    const { loadDutchDiscoveryCatalogCandidates } = await import('@/lib/supabase/books');
    return await loadDutchDiscoveryCatalogCandidates();
  } catch {
    return [];
  }
}

export default async function Home() {
  const { locale } = await resolveRequestLocale();
  const [catalog, dutchCandidates, personalization, authState, seriesContinuations] = await Promise.all([
    loadHomepageBooks(),
    loadDutchHomepageCandidates(locale),
    import('@/lib/supabase/taste-test')
      .then(({ loadHomepagePersonalization }) =>
        loadHomepagePersonalization(locale),
      )
      .catch((): HomepagePersonalization => ({
        authenticated: false,
        ratingCount: 0,
        tasteTestAnsweredCount: 0,
        hasEvidence: false,
        recommendations: [],
      })),
    import('@/lib/supabase/auth')
      .then(({ loadHeaderAuthState }) => loadHeaderAuthState())
      .catch(() => ({ authenticated: false })),
    import('@/lib/supabase/collections')
      .then(({ loadHomepageSeriesContinuations }) => loadHomepageSeriesContinuations(3))
      .catch(() => []),
  ]);
  const highestRatedWorkIds = new Set(
    catalog.books.flatMap((book) => book.workId ? [book.workId] : []),
  );
  const dutchDiscoveryBooks = selectDutchDiscoveryBooks(
    dutchCandidates,
    highestRatedWorkIds,
    6,
  );

  return (
    <>
      <LumiScoreMetadata
        title="LumiScore — Find your next great read"
        canonicalPath="/"
      />
      <LumiScoreHome
        initialBooks={catalog.books}
        catalogStats={{
          books: catalog.total,
          categories: CATALOG_CATEGORY_COUNT,
        }}
        personalization={personalization}
        authState={authState}
        dutchDiscoveryBooks={dutchDiscoveryBooks}
        catalogUnavailable={catalog.unavailable}
        seriesContinuations={seriesContinuations}
      />
    </>
  );
}
