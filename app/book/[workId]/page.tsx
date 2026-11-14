import type { Metadata } from 'next';
import { getInitialPublicBookDescription } from '@/lib/books/public-description';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { LumiScoreBookDetail } from '@/app/components/LumiScoreBookDetail';
import { createLocalizedPageMetadata } from '@/lib/seo/localized-metadata';
import { bookLanguageAlternates, bookUrlPolicy } from '@/lib/seo/book-locales';
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
import { suzanneBookGuide } from '@/lib/editorial/landing-guides';
import { bookPageJsonLd } from '@/lib/seo/book-json-ld';
import { bookAuthorByline } from '@/lib/catalog/reviewed-coauthors';

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
    () => loadCatalogBook(workId, locale, true),
  );
});

export async function generateMetadata({
  params,
}: BookPageProps): Promise<Metadata> {
  const { workId } = await params;
  const { locale } = await resolveRequestLocale();
  const book = await getBook(workId, locale);

  const policy = bookUrlPolicy(book ? book.detailLocales ?? [] : null, locale);
  if (!book) notFound();
  const indexable = policy.inSitemap;

  const title = `${book.title} ${locale === 'nl' ? 'van' : 'by'} ${bookAuthorByline(book, locale)} | LumiScore`;
  const description = getBookMetadataDescription(book, locale, getInitialPublicBookDescription(book, locale));
  const guide = suzanneBookGuide(book, locale);
  // A stored, edition-bound cover can be shared immediately. Optional external
  // cover evidence still streams into the page, without blocking its head.
  // Without a stored cover, preserve the existing explicit no-image policy.
  const cover = book.coverUrls?.[0];

  return createLocalizedPageMetadata({
    title: guide?.title ?? title,
    description: guide?.description ?? description,
    canonicalPath: `/book/${book.workId}`,
    noIndex: !indexable,
    includeCanonical: indexable,
    alternatePaths: bookLanguageAlternates(`/book/${book.workId}`, book.detailLocales ?? []),
    image: cover ?? null,
    type: 'article',
  });
}

export default async function BookPage({ params, searchParams }: BookPageProps) {
  const { workId } = await params;
  if (!isCatalogWorkId(workId)) notFound();
  const returnToValue = (await searchParams).returnTo;
  const requestedReturnTo = Array.isArray(returnToValue)
    ? returnToValue[0]
    : returnToValue;
  const { locale } = await resolveRequestLocale();
  const bookPromise = getBook(workId, locale);
  const authorLinksPromise = bookPromise.then(async book => book
    ? (await import('@/lib/supabase/author-discovery')).loadAuthorBookLinks(book, locale)
    : []).catch(() => []);
  const returnNavigationPromise = bookPromise.then(book=>resolveBookReturnNavigation(
    requestedReturnTo,
    workId,
    (requestedWorkId, slug) => import('@/lib/supabase/collections')
      .then(({ loadVerifiedBookCollectionReturnTarget }) => measureServerOperation(
        'book.return_collection',
        'public',
        () => loadVerifiedBookCollectionReturnTarget(requestedWorkId, slug),
      )),
    book?.openLibraryWorkId ?? null,
  )).catch((): BookReturnNavigation => ({ kind: 'browse', href: '/browse' }));
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
      unavailable: true,
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
  const descriptionPromise = bookPromise.then(async book => book
    ? (await import('@/lib/books/public-description')).loadPublicBookDescriptionState(book, locale)
    : {state:'confirmed_missing' as const,description:null})
    // This optional derived promise may outlive a failed core read. The core
    // bookPromise still rejects and produces a temporary server error, not404.
    .catch(() => ({state:'temporary_failure' as const,description:null}));
  const [book, initialRatingState, readingStatus, collectionContext, personalization, authState, returnNavigation] = await Promise.all([
    bookPromise,
    ratingStatePromise,
    readingStatusPromise,
    collectionContextPromise,
    personalizationPromise,
    authStatePromise,
    returnNavigationPromise,
  ]);
  if (!book) notFound();
  const initialDescription = getInitialPublicBookDescription(book, locale);

  return (
    <>
      {bookUrlPolicy(book.detailLocales ?? [], locale).includeBookSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(bookPageJsonLd(book, locale)).replaceAll('<','\\u003c')}}/>
      )}
      <LumiScoreBookDetail
        book={book}
        description={initialDescription}
        descriptionPromise={initialDescription ? undefined : descriptionPromise}
        authorLinksPromise={authorLinksPromise}
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
