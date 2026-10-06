'use client';
import { BookCover } from './LumiScoreHome';
import { useLumiScoreLocale } from './LumiScoreLocale';
import { editorialTopLists, getEditorialTopBook, topListBook, topListBookHref } from '@/lib/catalog/top-lists';
export function EditorialTopList({ list }: { list: typeof editorialTopLists[number] }) {
  const { locale } = useLumiScoreLocale();
  return <section className="featured-section editorial-lists">
    <a href="/toplijsten">{locale === 'nl' ? '← Alle toplijsten' : '← All reading lists'}</a>
    <p className="eyebrow">{locale === 'nl' ? 'Redactionele selectie · geen gebruikersranglijst' : 'Editorial selection · not a reader-score ranking'}</p>
    <h1>{list.title[locale]}</h1><p>{list.description[locale]}</p>
    <p>{locale === 'nl' ? 'De volgorde is een leesroute: toegankelijke instappers, contrasterende thema’s en daarna verdieping. Het is geen claim over populariteit of consensus.' : 'The order is a reading route: accessible entry points, contrasting themes, then deeper reading. It makes no claim about popularity or consensus.'}</p>
    <ol className="editorial-books">{list.workIds.map((id,index)=>{
      const choice = getEditorialTopBook(id);
      const href = topListBookHref(id,list.slug);
      return <li key={id} className="editorial-book"><a className="editorial-cover" href={href} aria-label={choice.title}><BookCover book={topListBook(choice)} resolveMissing={false} /></a><div>
        <p className="eyebrow">#{index+1} · {choice.originalYear} · {choice.genre === 'dystopia' ? locale === 'nl' ? 'Dystopie' : 'Dystopia' : choice.genre === 'fantasy' ? 'Fantasy' : locale === 'nl' ? 'Sciencefiction' : 'Science fiction'}</p>
        <h2><a href={href}>{choice.title}</a></h2><p className="editorial-author">{choice.author}</p>
        <p>{choice.note[locale]}</p><details><summary>{locale === 'nl' ? 'Waarom in deze selectie?' : 'Why this selection?'}</summary><p>{choice.basis[locale]}</p><a href={choice.source}>{locale === 'nl' ? 'Bibliografische bron' : 'Bibliographic source'}</a></details>
        <a className="editorial-book-link" href={href}>{locale === 'nl' ? 'Bekijk het boek en geef je eigen beoordeling →' : 'Explore the book and give your own rating →'}</a>
      </div></li>;
    })}</ol>
    <div className="taste-next-steps"><a href="/taste-test">{locale === 'nl' ? 'Ontdek je eigen smaak →' : 'Discover your own taste →'}</a><a href="/toplijsten">{locale === 'nl' ? 'Bekijk de andere selectie' : 'Explore the other selection'}</a></div>
  </section>;
}
