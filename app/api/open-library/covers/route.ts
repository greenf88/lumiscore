import { resolveOpenLibraryCoverCandidates } from '@/lib/books/open-library-covers';

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const workId = searchParams.get('workId')?.slice(0, 32) ?? '';
  const title = searchParams.get('title')?.slice(0, 240).trim() ?? '';
  const author = searchParams.get('author')?.slice(0, 240).trim() ?? '';
  const year = Number(searchParams.get('year'));

  if (!/^OL\d+W$/i.test(workId) || !title || !author) {
    return Response.json(
      { coverUrls: [] },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const coverUrls = await resolveOpenLibraryCoverCandidates({
    workId,
    title,
    author,
    firstPublishYear: Number.isInteger(year) && year > 0 ? year : null,
  });

  return Response.json(
    { coverUrls },
    {
      headers: {
        'Cache-Control':
          'public, max-age=3600, s-maxage=604800, stale-while-revalidate=2592000',
      },
    },
  );
}
