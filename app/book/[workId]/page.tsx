import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { LumiScoreBookDetail } from '@/app/components/LumiScoreBookDetail';
import { LumiScoreMetadata } from '@/app/components/LumiScoreMetadata';
import {
  getBookMetadataDescription,
  isCatalogWorkId,
} from '@/lib/books/book-detail';
import { resolveRequestLocale } from '@/lib/i18n/server';
import type { BookDetailPersonalization } from '@/lib/supabase/taste-test';
import {
  resolveBookReturnNavigation,
  type BookReturnNavigation,
} from '@/lib/navigation/book-return';
import { measureServerOperation } from '@/lib/performance/server-timing';

type BookPageProps = {
  params: Promise<{ workId: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

export const dynamic = 'force-dynamic';

const getBook = cache(async (workId: string, locale: 'en' | 'nl') => {
  if (!isCatalogWorkId(workId)) return null;

  const { loadCatalogBook } = await import('@/lib/supabase/books');
  return measureServerOperation(
    'book.catalog',
    'public',
    () => loadCatalogBook(workId, locale),
  );
});

export async function generateMetadata({
  params,
}: BookPageProps): Promise<Metadata> {
  const { workId } = await params;
  const { locale } = await resolveRequestLocale();
  const book = await getBook(workId, locale);

  if (!book) {
    return {
      title: 'Book not found — LumiScore',
      robots: { index: false, follow: false },
    };
  }

  const title = `${book.title} by ${book.author} | LumiScore`;
  const description = getBookMetadataDescription(book);
  const cover = book.coverUrls?.[0];

  return {
    title,
    description,
    alternates: { canonical: `/book/${workId}` },
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

export default async function BookPage({ params, searchParams }: BookPageProps) {
  const { workId } = await params;
  const returnToValue = (await searchParams).returnTo;
  const requestedReturnTo = Array.isArray(returnToValue)
    ? returnToValue[0]
    : returnToValue;
  const { locale } = await resolveRequestLocale();
  const returnNavigationPromise = resolveBookReturnNavigation(
    requestedReturnTo,
    workId,
    (requestedWorkId, slug) => import('@/lib/supabase/collections')
      .then(({ loadVerifiedBookCollectionReturnTarget }) => measureServerOperation(
        'book.return_collection',
        'public',
        () => loadVerifiedBookCollectionReturnTarget(requestedWorkId, slug),
      )),
  ).catch((): BookReturnNavigation => ({ kind: 'browse', href: '/browse' }));
  const ratingStatePromise = import('@/lib/supabase/ratings').then(
    ({ loadBookRatingState }) => measureServerOperation(
      'book.rating_state',
      'mixed',
      () => loadBookRatingState(workId),
    ),
  );
  const readingStatusPromise = import('@/lib/supabase/book-status')
    .then(({ loadUserBookStatuses }) => measureServerOperation(
      'book.reading_status',
      'private',
      () => loadUserBookStatuses([workId]),
    ))
    .catch(() => ({ authenticated: false, statuses: new Map() }));
  const collectionContextPromise = import('@/lib/supabase/collections')
    .then(({ loadBookCollectionContext }) => measureServerOperation(
      'book.collection_context',
      'mixed',
      () => loadBookCollectionContext(workId),
    ))
    .catch(() => null);
  const personalizationPromise = import('@/lib/supabase/taste-test')
    .then(({ loadBookDetailPersonalization }) =>
      measureServerOperation(
        'book.personalization',
        'private',
        () => loadBookDetailPersonalization(workId, locale),
      ),
    )
    .catch((): BookDetailPersonalization => ({
      authenticated: false,
      hasEvidence: false,
      candidate: null,
      match: null,
    }));
  const authStatePromise = import('@/lib/supabase/auth')
    .then(({ loadHeaderAuthState }) => measureServerOperation(
      'book.auth',
      'private',
      loadHeaderAuthState,
    ))
    .catch(() => ({ authenticated: false }));
  const [book, initialRatingState, readingStatus, collectionContext, personalization, authState, returnNavigation] = await Promise.all([
    getBook(workId, locale),
    ratingStatePromise,
    readingStatusPromise,
    collectionContextPromise,
    personalizationPromise,
    authStatePromise,
    returnNavigationPromise,
  ]);
  if (!book) notFound();

  return (
    <>
      <LumiScoreMetadata
        title={`${book.title} by ${book.author} | LumiScore`}
        description={getBookMetadataDescription(book)}
        canonicalPath={`/book/${book.workId}`}
        image={book.coverUrls?.[0] ?? null}
        type="article"
      />
      <LumiScoreBookDetail
        book={book}
        initialRatingState={initialRatingState}
        initialReadingStatus={readingStatus.statuses.get(workId) ?? null}
        collectionContext={collectionContext}
        personalization={personalization}
        authState={authState}
        returnNavigation={returnNavigation}
      />
    </>
  );
}
