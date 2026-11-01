'use client';

import { LocaleLink } from './LumiScoreLocale';
import type { Book } from '../data/books';
import { BookCard } from './LumiScoreHome';
import { useWantToRead } from './useWantToRead';
import { getGuestWantedStorageId } from '@/lib/collections/guest-want-to-read';
import { useLumiScoreLocale } from './LumiScoreLocale';
import type { EditorialList } from '@/lib/catalog/top-lists';
export type EditorialSelection = { sourceId: string; source: string; basis: {nl:string;en:string}; note: {nl:string;en:string}; href: string | null };
export function EditorialTopList({ list, books, selections, relatedLists, unavailable = false, authenticated = false }: { list: EditorialList; books: Book[]; selections: Record<string, EditorialSelection>; relatedLists: Pick<EditorialList,'slug'|'title'>[]; unavailable?: boolean; authenticated?: boolean }) {
  const { locale } = useLumiScoreLocale();
  const { wanted, statuses, toggleWanted } = useWantToRead(authenticated, books);
  return <section className="featured-section editorial-lists" data-product-list={list.slug}>
    <LocaleLink className="editorial-back" href="/toplijsten">{locale === 'nl' ? '← Alle toplijsten' : '← All reading lists'}</LocaleLink>
    <p className="eyebrow">{locale === 'nl' ? 'Redactionele selectie · geen gebruikersranglijst' : 'Editorial selection · not a reader-score ranking'}</p>
    <h1>{list.title[locale]}</h1><p>{list.description[locale]}</p>
    <details className="editorial-criteria"><summary>{locale === 'nl' ? 'Zo is deze selectie gemaakt' : 'How this selection was made'}</summary><p>{list.criteria?.[locale] ?? (locale === 'nl' ? 'De volgorde is een redactionele leesroute, geen claim over populariteit of consensus.' : 'The order is an editorial reading route, not a claim about popularity or consensus.')}</p></details>
    {unavailable && <p role="alert">{locale === 'nl' ? 'De catalogus kon niet laden. Vernieuw de pagina om opnieuw te proberen.' : 'The catalogue could not load. Refresh the page to try again.'}</p>}
    <ol className="book-grid editorial-books">{list.workIds.map((id,index)=>{
      const choice = selections[id];
      const book = books.find(book => book.openLibraryWorkId === choice.sourceId);
      if (!book || !choice.href || book.editionAvailable === false) return <li key={id} className="reading-list-card editorial-unavailable"><p>{index+1}. {locale === 'nl' ? 'Boek tijdelijk niet beschikbaar' : 'Book temporarily unavailable'}</p><p>{locale === 'nl' ? 'De catalogus heeft hier nog geen aantoonbaar geschikte editie. Er wordt geen andere taal als vervanging getoond.' : 'The catalogue does not currently provide a verified suitable edition here. Another language is not substituted.'}</p></li>;
      const href = choice.href;
      return <li key={id} className="editorial-book"><BookCard book={book} rank={index+1} href={href}
        wanted={wanted.has(getGuestWantedStorageId(book))} status={statuses.get(book.workId!)} onToggle={toggleWanted} resolveMissingCover={false}>
        <p className="editorial-reason">{list.notes?.[id]?.[locale] ?? choice.note[locale]}</p>
        <details className="card-editorial-note"><summary>{locale === 'nl' ? 'Bron en selectie' : 'Source and selection'}</summary>
          <p>{choice.basis[locale]}</p><LocaleLink href={choice.source}>{locale === 'nl' ? 'Bibliografische bron' : 'Bibliographic source'}</LocaleLink>
        </details></BookCard></li>;
    })}</ol>
    <div className="reading-list-actions"><LocaleLink className="ui-control ui-action ui-primary" href="/taste-test">{locale === 'nl' ? 'Ontdek je eigen smaak →' : 'Discover your own taste →'}</LocaleLink><LocaleLink className="ui-control ui-action ui-secondary" href="/toplijsten">{locale === 'nl' ? 'Alle leesroutes' : 'All reading routes'}</LocaleLink></div>
    {relatedLists.length > 0 && <nav className="editorial-related" aria-label={locale === 'nl' ? 'Verder lezen' : 'More reading routes'}><h2>{locale === 'nl' ? 'Een andere leesrichting' : 'Another reading direction'}</h2><div className="reading-list-actions">{relatedLists.map(related=><LocaleLink className="ui-control ui-action ui-secondary" key={related.slug} href={'/toplijsten/'+related.slug}>{related.title[locale]}</LocaleLink>)}</div></nav>}
  </section>;
}
