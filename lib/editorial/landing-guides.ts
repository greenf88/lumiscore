import data from './landing-guides.json' with { type: 'json' };
import type { Locale } from '../i18n/config.ts';
import type { Book } from '../../app/data/books.ts';
import { editorialTopLists, getEditorialWorkSourceId } from '../catalog/top-lists.ts';

export type GuideSource = { title: string; url: string; checkedOn: string };
export type GuideQuestion = { question: string; answer: string; sources?: GuideSource[]; requires?: string[] };
export type LandingGuide = {
  path: string; seo_title: string; meta_description: string; h1: string; intro: string[];
  groups?: { heading: string; work_ids: number[] }[];
  cards?: { work_id: string; reader_angle: string; text: string; sources: GuideSource[] }[];
  faq: GuideQuestion[];
};
export const LANDING_GUIDES = data.pages as LandingGuide[];
export const SUZANNE_SOURCES = data.sources;
export function getLandingGuide(path: string, locale: Locale): LandingGuide | null {
  return locale === 'nl' ? LANDING_GUIDES.find(g => g.path === '/nl' + path) ?? null : null;
}
export function getGuideBookNote(guide: LandingGuide | null, candidateId: string) {
  return guide?.cards?.find(c => c.work_id === candidateId) ?? null;
}
export function availableGuideGroups(guide: LandingGuide, books: readonly Book[]) {
  return (guide.groups ?? []).map(group => ({ heading: group.heading, entries: group.work_ids.flatMap(id => {
    const book = books.find(b => b.openLibraryWorkId === getEditorialWorkSourceId(String(id)) && b.editionAvailable !== false);
    return book?.workId ? [{ candidateId: String(id), workId: book.workId, title: book.title }] : [];
  }) })).filter(group => group.entries.length > 0);
}
export function availableGuideQuestions(guide: LandingGuide, books: readonly Book[]) {
  return guide.faq.filter(q => !q.requires || q.requires.every(id => books.some(b => b.openLibraryWorkId === getEditorialWorkSourceId(id) && b.editionAvailable !== false)));
}
/** Only the already loaded, language-selected collection supplies link identities. */
export function findSuzanneGuideBook(books: readonly Book[], title: string): Book | null {
  const normalized = (v: string) => v.normalize('NFKC').toLocaleLowerCase('nl').trim();
  const matches = books.filter(b => normalized(b.author) === 'suzanne vermeer' && normalized(b.title) === normalized(title)
    && b.editionAvailable !== false && b.workId);
  return matches.length === 1 ? matches[0] : null;
}
export function bookReadingRoutes(book: Book, locale: Locale) {
  if (!book.openLibraryWorkId || book.editionAvailable === false
    || (book.strictEditionLanguage && book.strictEditionLanguage !== locale)
    || (book.detailLocales && !book.detailLocales.includes(locale))) return [];
  // Numeric editorial IDs are selection keys, not database Work identities.
  // Preserve the richer Dutch guide heading and order before adding other lists.
  const matches = editorialTopLists.filter(list => list.workIds.some(id => getEditorialWorkSourceId(id) === book.openLibraryWorkId)
    || (list.slug === 'na-project-hail-mary' && book.openLibraryWorkId === getEditorialWorkSourceId('1')));
  const guides = locale === 'nl' ? LANDING_GUIDES.filter(g => matches.some(list => g.path === '/nl/toplijsten/' + list.slug)) : [];
  const routes = [...guides.map(g => ({ title: g.h1, href: g.path.slice(3) })),
    ...matches.map(list => ({ title: list.title[locale], href: '/toplijsten/' + list.slug }))];
  return routes.filter((route, i) => routes.findIndex(other => other.href === route.href) === i).slice(0, 3);
}
export function suzanneBookGuide(book: Book, locale: Locale) {
  if (locale !== 'nl' || book.author !== 'Suzanne Vermeer') return null;
  if (book.title === 'Madonna') return {
    title:'Madonna van Suzanne Vermeer: kort verhaal | LumiScore',
    description:'Madonna van Suzanne Vermeer is een kort verhaal uit De bestemming. Lees over de verhaalaanleiding, bekijk de boekinformatie en geef je eigen beoordeling.',
    heading:'Wat voor verhaal is Madonna?',
    paragraphs:['Madonna is een kort verhaal van Suzanne Vermeer uit De bestemming. Ingrid werkt voor een reclamebureau en probeert een Italiaans modeconcern als klant binnen te halen. Die zakelijke kans neemt een onverwachte wending.',
      'Zoek je een kort verhaal om tussendoor te lezen? Dit is een andere ingang dan een langere thriller. Bekijk de beschikbare editie bij de boekinformatie.'],
    source:SUZANNE_SOURCES.S06,
  };
  if (book.title === 'Noorderlicht') return {
    title:'Noorderlicht van Suzanne Vermeer: boekinformatie | LumiScore',
    description:'Noorderlicht van Suzanne Vermeer speelt tijdens een rondreis door Noorwegen. Ontdek de verhaalaanleiding, bekijk de boekinformatie en geef je beoordeling.',
    heading:'Past Noorderlicht bij jouw leessmaak?',
    paragraphs:['Kim wil haar dertigste verjaardag met vrienden vieren tijdens een rondreis door Noorwegen. Verschillen binnen de groep en twijfels over haar relatie brengen spanning mee op reis. Vertrouwen wordt een steeds belangrijkere vraag.',
      'Deze thriller is een redactionele ingang als je een reisomgeving graag combineert met onderlinge verhoudingen en onzekerheid over de mensen om hen heen. Vergelijk deze ingang met andere boeken in de collectie.'],
    source:SUZANNE_SOURCES.S05,
  };
  return null;
}
