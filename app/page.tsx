import { LumiScoreHome } from './components/LumiScoreHome';
import { LumiScoreMetadata } from './components/LumiScoreMetadata';
import { books } from './data/books';
import {
  logServerEnvironmentPresence,
  readServerEnvironment,
} from '@/lib/server-environment';
import type { HomepagePersonalization } from '@/lib/supabase/taste-test';
import { resolveRequestLocale } from '@/lib/i18n/server';
import { measureServerOperation } from '@/lib/performance/server-timing';
import type { DutchHomepageDiscovery } from '@/lib/supabase/dutch-homepage-discovery';

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
    const catalog = await measureServerOperation(
      'homepage.catalog',
      'public',
      () => loadHighestRatedCatalog(18),
    );
    return { ...catalog, unavailable: false };
  } catch (error) {
    console.error('Homepage catalog load failed.', error);
    return process.env.NODE_ENV === 'production'
      ? { books: [], total: null, unavailable: true }
      : { books, total: books.length, unavailable: false };
  }
}

async function loadDutchDiscovery(locale: 'en' | 'nl'): Promise<DutchHomepageDiscovery> {
  try {
    const { loadDutchHomepageDiscovery } = await import('@/lib/supabase/dutch-homepage-discovery');
    return await measureServerOperation(
      'homepage.dutch_discovery',
      'mixed',
      () => loadDutchHomepageDiscovery(locale),
    );
  } catch {
    return {
      popular: {
        books: [], current: false, personalized: false,
        sourceName: 'De Bestseller 60', sourceUrl: 'https://www.debestseller60.nl/',
        year: 0, week: 0,
      },
      classics: { books: [], personalized: false },
    };
  }
}

export default async function Home() {
  const { locale } = await resolveRequestLocale();
  const [catalog, dutchDiscovery, personalization, authState, seriesContinuations] = await Promise.all([
    loadHomepageBooks(),
    loadDutchDiscovery(locale),
    import('@/lib/supabase/taste-test')
      .then(({ loadHomepagePersonalization }) =>
        measureServerOperation(
          'homepage.personalization',
          'private',
          () => loadHomepagePersonalization(locale),
        ),
      )
      .catch((): HomepagePersonalization => ({
        authenticated: false,
        ratingCount: 0,
        tasteTestAnsweredCount: 0,
        hasEvidence: false,
        recommendations: [],
      })),
    import('@/lib/supabase/auth')
      .then(({ loadHeaderAuthState }) => measureServerOperation(
        'homepage.auth',
        'private',
        loadHeaderAuthState,
      ))
      .catch(() => ({ authenticated: false })),
    import('@/lib/supabase/collections')
      .then(({ loadHomepageSeriesContinuations }) => measureServerOperation(
        'homepage.series_continuations',
        'private',
        () => loadHomepageSeriesContinuations(3),
      ))
      .catch(() => []),
  ]);
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
        dutchDiscovery={dutchDiscovery}
        catalogUnavailable={catalog.unavailable}
        seriesContinuations={seriesContinuations}
      />
    </>
  );
}
