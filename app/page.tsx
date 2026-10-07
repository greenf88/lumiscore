import { LumiScoreHome } from './components/LumiScoreHome';
import { createPageMetadata } from '@/lib/seo/page-metadata';
import { books } from './data/books';
import {
  logServerEnvironmentPresence,
  readServerEnvironment,
} from '@/lib/server-environment';
import type { HomepagePersonalization } from '@/lib/supabase/taste-test';
import { resolveRequestLocale } from '@/lib/i18n/server';
import { measureServerOperation } from '@/lib/performance/server-timing';
import type { DutchHomepageDiscovery } from '@/lib/supabase/dutch-homepage-discovery';

export const metadata = createPageMetadata({
  title: 'LumiScore — Find your next great read',
  canonicalPath: '/',
});

async function loadHomepageBooks() {
  logServerEnvironmentPresence();

  if (
    !readServerEnvironment('NEXT_PUBLIC_SUPABASE_URL') ||
    !readServerEnvironment('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
  ) {
    return process.env.NODE_ENV === 'production'
      ? { books: [], total: null, unavailable: true }
      : { books: books.slice(0, 8), total: books.length, unavailable: false };
  }

  try {
    const { loadHighestRatedCatalog } = await import('@/lib/supabase/books');
    const catalog = await measureServerOperation(
      'homepage.catalog',
      'public',
      () => loadHighestRatedCatalog(8),
    );
    return { ...catalog, unavailable: false };
  } catch (error) {
    console.error('Homepage catalog load failed.', error);
    return process.env.NODE_ENV === 'production'
      ? { books: [], total: null, unavailable: true }
      : { books: books.slice(0, 8), total: books.length, unavailable: false };
  }
}

// The homepage is a small entry point, not a second complete discovery directory.
// Dutch discovery remains available through the language filters in Browse.
const emptyDutchDiscovery: DutchHomepageDiscovery = {
      popular: {
        books: [], current: false, personalized: false,
        sourceName: 'De Bestseller 60', sourceUrl: 'https://www.debestseller60.nl/',
        year: 0, week: 0,
      },
      classics: { books: [], personalized: false },
};

const emptyPersonalization: HomepagePersonalization = {
  authenticated: false, ratingCount: 0, tasteTestAnsweredCount: 0,
  hasEvidence: false, recommendations: [],
};

export default async function Home() {
  const { locale } = await resolveRequestLocale();
  const authPromise = import('@/lib/supabase/auth')
    .then(({ loadHeaderAuthState }) => measureServerOperation('homepage.auth', 'private', loadHeaderAuthState))
    .catch(() => ({ authenticated: false }));
  const [catalog, dutchDiscovery, personalization, authState, seriesContinuations, categories] = await Promise.all([
    loadHomepageBooks(),
    emptyDutchDiscovery,
    import('@/lib/supabase/taste-test')
      .then(async ({ loadHomepagePersonalization }) => {
        if (!(await authPromise).authenticated) return emptyPersonalization;
        const personal = await measureServerOperation(
          'homepage.personalization',
          'private',
          () => loadHomepagePersonalization(locale, 3),
        );
        // Auth is independently verified; a failed recommendation load must remain visible.
        return { ...personal, authenticated: true };
      })
      .catch(async (): Promise<HomepagePersonalization> => ({
        unavailable: true,
        authenticated: (await authPromise).authenticated,
        ratingCount: 0,
        tasteTestAnsweredCount: 0,
        hasEvidence: false,
        recommendations: [],
      })),
    authPromise,
    import('@/lib/supabase/collections')
      .then(async ({ loadHomepageSeriesContinuations }) => (await authPromise).authenticated ? measureServerOperation(
        'homepage.series_continuations',
        'private',
        () => loadHomepageSeriesContinuations(3),
      ) : [])
      .catch(() => []),
    import('@/lib/supabase/categories').then(({ loadPublicCategories }) => loadPublicCategories()).catch(() => null),
  ]);
  return (
    <>
      <LumiScoreHome
        initialBooks={catalog.books}
        catalogStats={{
          books: catalog.total,
          categories: categories?.length ?? null,
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
