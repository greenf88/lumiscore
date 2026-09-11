import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { LumiScoreBookDetail } from '@/app/components/LumiScoreBookDetail';
import {
  getBookMetadataDescription,
  isCatalogWorkId,
} from '@/lib/books/book-detail';

type BookPageProps = {
  params: Promise<{ workId: string }>;
};

export const dynamic = 'force-dynamic';

const getBook = cache(async (workId: string) => {
  if (!isCatalogWorkId(workId)) return null;

  const { loadCatalogBook } = await import('@/lib/supabase/books');
  return loadCatalogBook(workId);
});

export async function generateMetadata({
  params,
}: BookPageProps): Promise<Metadata> {
  const { workId } = await params;
  const book = await getBook(workId);

  if (!book) {
    return {
      title: 'Book not found — LumiScore',
      robots: { index: false, follow: false },
    };
  }

  const title = `${book.title} — LumiScore`;
  const description = getBookMetadataDescription(book);
  const cover = book.coverUrls?.[0];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: cover ? [{ url: cover }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: cover ? [cover] : [],
    },
  };
}

export default async function BookPage({ params }: BookPageProps) {
  const { workId } = await params;
  const ratingStatePromise = import('@/lib/supabase/ratings').then(
    ({ loadBookRatingState }) => loadBookRatingState(workId),
  );
  const [book, initialRatingState] = await Promise.all([
    getBook(workId),
    ratingStatePromise,
  ]);
  if (!book) notFound();

  return (
    <LumiScoreBookDetail
      book={book}
      initialRatingState={initialRatingState}
    />
  );
}
