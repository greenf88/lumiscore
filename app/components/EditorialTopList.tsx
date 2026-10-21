'use client';

import { LocaleLink } from './LumiScoreLocale';
import type { Book } from '../data/books';
import { BookCard } from './LumiScoreHome';
import { useWantToRead } from './useWantToRead';
import { getGuestWantedStorageId } from '@/lib/collections/guest-want-to-read';
import { useLumiScoreLocale } from './LumiScoreLocale';
import { editorialTopLists, getEditorialTopBook, topListBookHref } from '@/lib/catalog/top-lists';
export function EditorialTopList({ list, books, unavailable = false, authenticated = false }: { list: typeof editorialTopLists[number]; books: Book[]; unavailable?: boolean; authenticated?: boolean }) {
  const { locale } = useLumiScoreLocale();
  const { wanted, statuses, toggleWanted } = useWantToRead(authenticated, books);
  return <section className="featured-section editorial-lists">
    <LocaleLink href="/toplijsten">{locale === 'nl' ? '← Alle toplijsten' : '← All reading lists'}</LocaleLink>
    <p className="eyebrow">{locale === 'nl' ? 'Redactionele selectie · geen gebruikersranglijst' : 'Editorial selection · not a reader-score ranking'}</p>
    <h1>{list.title[locale]}</h1><p>{list.description[locale]}</p>
    <p>{locale === 'nl' ? 'De volgorde is een leesroute: toegankelijke instappers, contrasterende thema’s en daarna verdieping. Het is geen claim over populariteit of consensus.' : 'The order is a reading route: accessible entry points, contrasting themes, then deeper reading. It makes no claim about popularity or consensus.'}</p>
    {unavailable && <p role="alert">{locale === 'nl' ? 'De catalogus kon niet laden. Vernieuw de pagina om opnieuw te proberen.' : 'The catalogue could not load. Refresh the page to try again.'}</p>}
    <ol className="book-grid editorial-books">{list.workIds.map((id,index)=>{
      const choice = getEditorialTopBook(id);
      const href = topListBookHref(id,list.slug);
      const book = books.find(book => book.workId === id);
      if (!book) return null;
      return <li key={id} className="editorial-book"><BookCard book={book} rank={index+1} href={href}
        wanted={wanted.has(getGuestWantedStorageId(book))} status={statuses.get(id)} onToggle={toggleWanted} resolveMissingCover={false}>
        <details className="card-editorial-note"><summary>{locale === 'nl' ? 'Waarom dit boek?' : 'Why this book?'}</summary>
          <p>{choice.note[locale]}</p><p>{choice.basis[locale]}</p><LocaleLink href={choice.source}>{locale === 'nl' ? 'Bibliografische bron' : 'Bibliographic source'}</LocaleLink>
        </details></BookCard></li>;
    })}</ol>
    <div className="taste-next-steps"><LocaleLink href="/taste-test">{locale === 'nl' ? 'Ontdek je eigen smaak →' : 'Discover your own taste →'}</LocaleLink><LocaleLink href="/toplijsten">{locale === 'nl' ? 'Bekijk de andere selectie' : 'Explore the other selection'}</LocaleLink></div>
  </section>;
}
