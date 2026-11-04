import { LocaleLink } from './LumiScoreLocale';
import type { Book } from '../data/books';
import { availableGuideGroups, bookReadingRoutes, findSuzanneGuideBook, LANDING_GUIDES, SUZANNE_SOURCES, suzanneBookGuide, type GuideQuestion, type GuideSource, type LandingGuide } from '@/lib/editorial/landing-guides';
import { getBookHref } from '@/lib/books/book-navigation';
import type { Locale } from '@/lib/i18n/config';

export function GuideSources({ sources }: { sources?: GuideSource[] }) {
  return sources?.length ? <p className="guide-sources">Bron: {sources.map((source, i) => <span key={source.url}>{i > 0 ? ' · ' : ''}<a href={source.url}>{source.title}</a></span>)}</p> : null;
}
export function GuideQuestions({ items }: { items: GuideQuestion[] }) {
  return <section className="landing-guide guide-questions"><h2>Vragen bij je keuze</h2>{items.map(q => <details key={q.question}>
    <summary>{q.question}</summary><p>{q.answer}</p><GuideSources sources={q.sources}/>
  </details>)}</section>;
}
export function ReadingGuideIntro({ guide, books }: { guide: LandingGuide; books: Book[] }) {
  const groups = availableGuideGroups(guide, books);
  return <div className="landing-guide reading-guide-intro">{guide.intro.map(p => <p key={p}>{p}</p>)}
    {groups.length > 0 && <nav aria-label="Kies je leesrichting"><h2>Waar wil je beginnen?</h2><ul>{groups.map(group => <li key={group.heading}>
      <strong>{group.heading}: </strong>{group.entries.map((entry, i) => <span key={entry.workId}>{i > 0 ? ' · ' : ''}<a href={'#keuze-' + entry.candidateId}>{entry.title}</a></span>)}
    </li>)}</ul></nav>}
  </div>;
}
const starts = [
  { title: 'All-inclusive', heading: 'Een vakantie die ontspoort', text: 'Een gezinsvakantie naar Turkije krijgt een dreigende wending. Een redactionele ingang als het contrast tussen een zonnige bestemming en gevaar je aanspreekt.', source: SUZANNE_SOURCES.S04 },
  { title: 'Noorderlicht', heading: 'Spanning tijdens een rondreis', text: 'Een vriendengroep trekt door Noorwegen. Kies deze ingang als onderlinge verhoudingen en de vraag wie je kunt vertrouwen je aanspreken.', source: SUZANNE_SOURCES.S05 },
  { title: 'Madonna', heading: 'Een kort verhaal tussendoor', text: 'Ingrid krijgt een zakelijke kans bij een Italiaans modeconcern. Madonna is een kort verhaal uit De bestemming, geen volledige roman.', source: SUZANNE_SOURCES.S06 },
];
export function SuzanneGuideEntries({ books }: { books: Book[] }) {
  const entries = starts.flatMap(entry => { const book = findSuzanneGuideBook(books, entry.title); const href = book && getBookHref(book, { kind:'collection',slug:'suzanne-vermeer' }); return href ? [{ ...entry, href }] : []; });
  return <section className="landing-guide collection-guide-intro"><h2>Waar kun je beginnen?</h2>
    <ul>{entries.map(e => <li key={e.title}><LocaleLink href={e.href}>{e.title}</LocaleLink> — {e.heading}. <span>{e.text}</span><GuideSources sources={[e.source]}/></li>)}</ul>
    <a href="#leesvolgorde">Bekijk de bevestigde verhaalverbanden en leesvragen</a>
  </section>;
}
export function SuzanneGuideAfter({ books }: { books: Book[] }) {
  const guide = LANDING_GUIDES[0];
  const pairs = [
    { titles:['Zomeravond','Dwaalspoor'], text:'Wil je het doorlopende verhaal volgen, begin dan met Zomeravond en lees daarna Dwaalspoor. De officiële boekpagina vermeldt dat Dwaalspoor ook los leesbaar is.',source:SUZANNE_SOURCES.S02 },
    { titles:['Roadtrip','Koraalrif'],text:'Koraalrif gaat verder met het avontuur uit Roadtrip. Lees Roadtrip eerst als je dat verhaal vanaf het begin wilt volgen. Dit is geen vaste volgorde voor de hele auteurscollectie.',source:SUZANNE_SOURCES.S03 },
  ];
  return <div className="landing-guide collection-guide-after"><section id="leesvolgorde"><h2>Leesvolgorde en boeken die op elkaar aansluiten</h2>
    <p>Dit overzicht is geen doorlopende reeks en geen volledige bibliografie. Bij deze twee combinaties is wel een verhaalverband bevestigd.</p>
    {pairs.map(pair => <section key={pair.titles[0]}><h3>{pair.titles.join(' en ')}</h3><p>{pair.text}</p><p>{pair.titles.map((title, i) => {
      const book=findSuzanneGuideBook(books,title);const href=book&&getBookHref(book,{kind:'collection',slug:'suzanne-vermeer'});
      return <span key={title}>{i>0?' → ':''}{href ? <LocaleLink href={href}>{title}</LocaleLink> : title}</span>;
    })}</p><GuideSources sources={[pair.source]}/></section>)}
  </section><GuideQuestions items={guide.faq}/><p>Andere spanning ontdekken? <LocaleLink href="/toplijsten/thrillers-met-een-twist">Bekijk thrillers die je op het verkeerde been zetten</LocaleLink>.</p></div>;
}
export function BookEditorialGuide({ book, locale, hasSuzanneCollectionLink }: { book: Book; locale: Locale; hasSuzanneCollectionLink: boolean }) {
  const copy=suzanneBookGuide(book,locale), routes=bookReadingRoutes(book,locale);
  if (!copy && routes.length===0) return null;
  return <aside className="landing-guide book-editorial-guide" aria-label="Verder lezen">
    {copy && <section><h2>{copy.heading}</h2>{copy.paragraphs.map(p=><p key={p}>{p}</p>)}<GuideSources sources={[copy.source]}/>
      {!hasSuzanneCollectionLink && <p><LocaleLink href="/collection/suzanne-vermeer">Vergelijk de boeken van Suzanne Vermeer</LocaleLink></p>}
    </section>}
    {routes.length>0 && <nav aria-label="Leesroutes bij dit boek"><h2>Een volgende leesrichting</h2><ul>{routes.map(route=><li key={route.href}><LocaleLink href={route.href}>{route.title}</LocaleLink></li>)}</ul></nav>}
  </aside>;
}
