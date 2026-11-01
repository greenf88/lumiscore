import { isCatalogWorkId } from '@/lib/books/book-detail';
import { loadPublicBookDescriptionState } from '@/lib/books/public-description';
import { normalizeVerifiedBookDescription } from '@/lib/books/description-text';
import { publicDescriptionCacheControl } from '@/lib/books/description-cache';
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

  const book = await loadCatalogBook(workId, locale, false, {skipExternalCovers:true});
  if (!book) {
    return Response.json(
      { description: null, state: 'confirmed_missing' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const resolution = await loadPublicBookDescriptionState(book,locale);
  const description = normalizeVerifiedBookDescription(
    resolution.description,
  );
  const normalizedResolution = {
    description,
    state: description
      ? ('resolved' as const)
      : resolution.state === 'temporary_failure'
        ? ('temporary_failure' as const)
        : ('confirmed_missing' as const),
  };
  const cacheControl = publicDescriptionCacheControl(normalizedResolution.state);

  return Response.json(normalizedResolution, {
    headers: { 'Cache-Control': cacheControl },
  });
}
