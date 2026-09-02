import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { LumiScoreBookDetail } from '@/app/components/LumiScoreBookDetail';
import { books } from '@/app/data/books';

type BookPageProps = {
  params: Promise<{ workId: string }>;
};

const getBook = cache(async (workId: string) => {
  const demoBook = books.find((book) => book.id === workId) ?? null;

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return demoBook;
  }

  try {
    const { loadCatalogBook } = await import('@/lib/supabase/books');
    return (await loadCatalogBook(workId)) ?? demoBook;
  } catch {
    return demoBook;
  }
});

export async function generateMetadata({ params }: BookPageProps): Promise<Metadata> {
  const { workId } = await params;
  const book = await getBook(decodeURIComponent(workId));

  if (!book) return { title: 'Book not found — LumiScore' };

  let cover = book.coverUrls?.[0];
  if (book.openLibraryWorkId) {
    const { resolveOpenLibraryCoverCandidates } = await import(
      '@/lib/books/open-library-covers'
    );
    const resolvedCovers = await resolveOpenLibraryCoverCandidates({
      workId: book.openLibraryWorkId,
      title: book.title,
      author: book.author,
      firstPublishYear: book.firstPublishYear,
    });
    cover = resolvedCovers[0] ?? cover;
  }
  const description = `${book.title} by ${book.author}${book.firstPublishYear ? `, first published in ${book.firstPublishYear}` : ''}.`;

  return {
    title: `${book.title} — LumiScore`,
    description,
    openGraph: {
      title: `${book.title} — LumiScore`,
      description,
      images: cover ? [{ url: cover }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${book.title} — LumiScore`,
      description,
      images: cover ? [cover] : [],
    },
  };
}

export default async function BookPage({ params }: BookPageProps) {
  const { workId } = await params;
  const book = await getBook(decodeURIComponent(workId));
  if (!book) notFound();

  return <LumiScoreBookDetail book={book} />;
}
