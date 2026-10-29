import { isCatalogWorkId } from '@/lib/books/book-detail';
import { loadPublicBookDescriptionState } from '@/lib/books/public-description';
import { isLocale } from '@/lib/i18n/config';
import { loadCatalogBook } from '@/lib/supabase/books';

type DescriptionRouteProps = {
  params: Promise<{ workId: string }>;
};

export async function GET(request: Request, { params }: DescriptionRouteProps) {
  const { workId } = await params;
  const requestedLocale = new URL(request.url).searchParams.get('locale');
  const locale = isLocale(requestedLocale) ? requestedLocale : 'en';
  if (!isCatalogWorkId(workId)) {
    return Response.json(
      { description: null, state: 'confirmed_missing' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const book = await loadCatalogBook(workId, locale);
  if (!book) {
    return Response.json(
      { description: null, state: 'confirmed_missing' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Same edition, language and four-second budget as SSR; never expose a
  // different synopsis or let direct API requests run an unbounded source chain.
  const resolution = await loadPublicBookDescriptionState(book, locale);
  const {description} = resolution;
  const cacheControl = description
    ? 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
    : resolution.state === 'temporary_failure'
      ? 'public, max-age=0, s-maxage=60'
      : 'public, max-age=300, s-maxage=3600';

  return Response.json(resolution, {
    headers: { 'Cache-Control': cacheControl },
  });
}
