import { RatingTasteTest } from '@/app/components/RatingTasteTest';
import { BufferedRatingTasteTest } from '@/app/components/BufferedRatingTasteTest';
import { createLocalizedPageMetadata } from '@/lib/seo/localized-metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata() { return createLocalizedPageMetadata({
  title: 'Taste Test — LumiScore',
  description: 'Choose 10, 15 or 30 books you have read, save your progress and discover your reading taste.',
  canonicalPath: '/taste-test',
  noIndex: false,
  follow: true,
}); }

export default async function TasteTestPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [params, initialAuthState] = await Promise.all([
    searchParams,
    import('@/lib/supabase/auth')
      .then(({ loadHeaderAuthState }) => loadHeaderAuthState())
      .catch(() => ({ authenticated: false })),
  ]);
  return (
    <>
      {params.prototype === 'swipe' && (process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'preview')
        ? <RatingTasteTest authState={initialAuthState} swipePrototype />
        : <BufferedRatingTasteTest authState={initialAuthState} />}
    </>
  );
}
