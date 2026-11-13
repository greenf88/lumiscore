'use client';

import { LocaleLink } from './LumiScoreLocale';
import type { Book } from '../data/books';
import { BookCard } from './LumiScoreHome';
import { useWantToRead } from './useWantToRead';
import { getGuestWantedStorageId } from '@/lib/collections/guest-want-to-read';
import { useLumiScoreLocale } from './LumiScoreLocale';
import type { EditorialList } from '@/lib/catalog/top-lists';
import { availableGuideQuestions, getGuideBookNote, getLandingGuide } from '@/lib/editorial/landing-guides';
import { GuideQuestions, GuideSources, ReadingGuideIntro } from './EditorialLandingGuide';
export type EditorialSelection = { sourceId: string; source: string; basis: {nl:string;en:string}; note: {nl:string;en:string}; href: string | null };
export function EditorialTopList({ list, books, selections, relatedLists, unavailable = false, authenticated = false }: { list: EditorialList; books: Book[]; selections: Record<string, EditorialSelection>; relatedLists: Pick<EditorialList,'slug'|'title'>[]; unavailable?: boolean; authenticated?: boolean }) {
  const { locale } = useLumiScoreLocale();
  const { wanted, statuses, toggleWanted } = useWantToRead(authenticated, books);
  const guide = getLandingGuide('/toplijsten/' + list.slug, locale);
  const availableIds = list.workIds.filter(id => selections[id]?.href && books.some(book => book.openLibraryWorkId === selections[id].sourceId && book.editionAvailable !== false));
  const renderedIds = guide ? availableIds : list.workIds;
  const missingCount = list.workIds.length - availableIds.length;
  return <section className="featured-section editorial-lists" data-product-list={list.slug}>
    <LocaleLink className="editorial-back" href="/toplijsten">{locale === 'nl' ? '← Alle toplijsten' : '← All reading lists'}</LocaleLink>
    <p className="eyebrow">{locale === 'nl' ? 'Redactionele selectie · geen gebruikersranglijst' : 'Editorial selection · not a reader-score ranking'}</p>
    <h1>{guide?.h1 ?? list.title[locale]}</h1>{guide ? <ReadingGuideIntro guide={guide} books={books}/> : <p>{list.description[locale]}</p>}
    <details className="editorial-criteria"><summary>{locale === 'nl' ? 'Zo is deze selectie gemaakt' : 'How this selection was made'}</summary><p>{list.criteria?.[locale] ?? (locale === 'nl' ? 'De volgorde is een redactionele leesroute, geen claim over populariteit of consensus.' : 'The order is an editorial reading route, not a claim about popularity or consensus.')}</p></details>
    {unavailable && <p role="alert">{locale === 'nl' ? 'De catalogus kon niet laden. Vernieuw de pagina om opnieuw te proberen.' : 'The catalogue could not load. Refresh the page to try again.'}</p>}
    {guide && !unavailable && missingCount > 0 && <p className="editorial-availability" role="status">{availableIds.length} van de {list.workIds.length} oorspronkelijke keuzes hebben nu een passende Nederlandse editie. De overige {missingCount} keuzes tonen we zodra geschikte editiegegevens beschikbaar zijn. Er wordt geen andere taal als vervanging gebruikt.</p>}
    <ol className="book-grid editorial-books">{renderedIds.map((id,index)=>{
      const choice = selections[id];
      const book = books.find(book => book.openLibraryWorkId === choice.sourceId);
      if (!book || !choice.href || book.editionAvailable === false) return <li key={id} className="reading-list-card editorial-unavailable"><p>{index+1}. {locale === 'nl' ? 'Boek tijdelijk niet beschikbaar' : 'Book temporarily unavailable'}</p><p>{locale === 'nl' ? 'De catalogus heeft hier nog geen aantoonbaar geschikte editie. Er wordt geen andere taal als vervanging getoond.' : 'The catalogue does not currently provide a verified suitable edition here. Another language is not substituted.'}</p></li>;
      const href = choice.href;
      const note = getGuideBookNote(guide, id);
      return <li key={id} id={guide ? 'keuze-' + id : undefined} className="editorial-book"><BookCard book={book} rank={guide ? undefined : index+1} href={href}
        wanted={wanted.has(getGuestWantedStorageId(book))} status={statuses.get(book.workId!)} onToggle={toggleWanted} resolveMissingCover={false}>
        {note && <h2 className="editorial-angle">{note.reader_angle}</h2>}
        <p className="editorial-reason">{note?.text ?? list.notes?.[id]?.[locale] ?? choice.note[locale]}</p>
        {note && <GuideSources sources={note.sources}/>}
        <details className="card-editorial-note"><summary>{locale === 'nl' ? 'Bron en selectie' : 'Source and selection'}</summary>
          <p>{choice.basis[locale]}</p><LocaleLink href={choice.source}>{locale === 'nl' ? 'Bibliografische bron' : 'Bibliographic source'}</LocaleLink>
        </details></BookCard></li>;
    })}</ol>
    {guide && <GuideQuestions items={availableGuideQuestions(guide, books)}/>}
    <div className="reading-list-actions"><LocaleLink className="ui-control ui-action ui-primary" href="/taste-test">{locale === 'nl' ? 'Ontdek je eigen smaak →' : 'Discover your own taste →'}</LocaleLink><LocaleLink className="ui-control ui-action ui-secondary" href="/toplijsten">{locale === 'nl' ? 'Alle leesroutes' : 'All reading routes'}</LocaleLink></div>
    {relatedLists.length > 0 && <nav className="editorial-related" aria-label={locale === 'nl' ? 'Verder lezen' : 'More reading routes'}><h2>{locale === 'nl' ? 'Een andere leesrichting' : 'Another reading direction'}</h2><div className="reading-list-actions">{relatedLists.map(related=><LocaleLink className="ui-control ui-action ui-secondary" key={related.slug} href={'/toplijsten/'+related.slug}>{related.title[locale]}</LocaleLink>)}</div></nav>}
  </section>;
}
