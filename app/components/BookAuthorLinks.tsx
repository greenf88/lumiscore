'use client';

import { Suspense, use } from 'react';
import type { AuthorBookLink } from '@/lib/books/author-discovery';
import { LocaleLink, useLumiScoreLocale } from './LumiScoreLocale';

export function BookAuthorLinks({ author, links }: { author: string; links: readonly AuthorBookLink[] }) {
  const { locale } = useLumiScoreLocale();
  if (!links.length) return null;
  const heading = locale === 'nl' ? `Meer van ${author}` : `More by ${author}`;
  return <nav className="landing-guide book-author-links" aria-label={heading}>
    <h2>{heading}</h2>
    <ul>{links.map(link => <li key={link.workId}><LocaleLink href={'/book/' + link.workId}>{link.title}</LocaleLink>
      {' '}{locale === 'nl' ? 'van' : 'by'} {link.author}</li>)}</ul>
  </nav>;
}

function ResolvedAuthorLinks({ author, links }: { author: string; links: Promise<AuthorBookLink[]> }) {
  return <BookAuthorLinks author={author} links={use(links)} />;
}

export function StreamedBookAuthorLinks(props: { author: string; links: Promise<AuthorBookLink[]> }) {
  return <Suspense fallback={null}><ResolvedAuthorLinks {...props}/></Suspense>;
}
