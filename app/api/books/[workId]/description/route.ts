import { isCatalogWorkId } from '@/lib/books/book-detail';
import { resolveBookDescription } from '@/lib/books/description-resolution';
import { normalizeVerifiedBookDescription } from '@/lib/books/description-text';
import { loadCatalogBook } from '@/lib/supabase/books';

type DescriptionRouteProps = {
  params: Promise<{ workId: string }>;
};

export async function GET(_: Request, { params }: DescriptionRouteProps) {
  const { workId } = await params;
  if (!isCatalogWorkId(workId)) {
    return Response.json(
      { description: null, state: 'confirmed_missing' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const book = await loadCatalogBook(workId);
  if (!book) {
    return Response.json(
      { description: null, state: 'confirmed_missing' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const resolution = await resolveBookDescription({
    openLibraryWorkId: book.openLibraryWorkId,
    isbn13: book.isbn13,
  });
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
  const cacheControl = description
    ? 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
    : resolution.state === 'temporary_failure'
      ? 'public, max-age=0, s-maxage=60'
      : 'public, max-age=300, s-maxage=3600';

  return Response.json(normalizedResolution, {
    headers: { 'Cache-Control': cacheControl },
  });
}
