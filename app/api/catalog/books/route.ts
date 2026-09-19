import { NextResponse } from 'next/server';
import { isCatalogWorkId } from '@/lib/books/book-detail';
import { createGuestWantToReadItems } from '@/lib/collections/my-books';
import { loadCatalogBooksByIdsWithStoredCovers } from '@/lib/supabase/books';
import { measureServerOperation } from '@/lib/performance/server-timing';

function requestedWorkIds(request: Request): string[] {
  return [...new Set(
    (new URL(request.url).searchParams.get('workIds') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(isCatalogWorkId),
  )].slice(0, 100);
}

export async function GET(request: Request) {
  const workIds = requestedWorkIds(request);
  if (workIds.length === 0) {
    return NextResponse.json({ books: [] }, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600' },
    });
  }

  try {
    const books = await measureServerOperation(
      'catalog.books_api',
      'public',
      () => loadCatalogBooksByIdsWithStoredCovers(workIds),
    );
    const orderedBooks = createGuestWantToReadItems(books, workIds)
      .map((item) => item.book);
    return NextResponse.json({ books: orderedBooks }, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600' },
    });
  } catch (error) {
    console.error('Guest catalog books could not be loaded.', error);
    return NextResponse.json(
      { error: 'Saved books are temporarily unavailable.', books: [] },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}
