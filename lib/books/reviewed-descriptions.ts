import type { VerifiedBookDescription } from '../../app/data/books.ts';
import type { Locale } from '../i18n/config.ts';
import { normalizeEditionLanguage } from './edition-ranking.ts';
import { normalizeIsbn13 } from './covers.ts';

/** Own short summaries, reviewed against an exact edition and named primary source. */
type ReviewedDescription = {
  workId?:string; editionId?:string; title:string; author:string; isbn13:string;
  openLibraryWorkId?:string; openLibraryEditionId?:string; editionLanguage?:'eng'|'nld';
  language:Locale; reviewedAt:string; sourceName:string; sourceUrl:string; text:string;
  source?:'official_publisher'|'official_catalog';
};
export const REVIEWED_DESCRIPTIONS:readonly ReviewedDescription[] = [{
  workId: '1305', editionId: '1305', title: 'Madonna', author: 'Suzanne Vermeer',
  isbn13: '9789044970791', language: 'nl' as const, reviewedAt: '2026-10-18',
  sourceName: 'A.W. Bruna Uitgevers',
  sourceUrl: 'https://www.awbruna.nl/boek/thrillers/suzanne-vermeer/madonna/',
  text: 'Reclamemanager Ingrid probeert een groot Italiaans modebedrijf als klant te winnen. Tijdens die zakelijke kans krijgt ze met een onaangename verrassing te maken. Dit korte verhaal komt uit de bundel De bestemming.',
}, {
  // Exact ISBN + selected title/author/language bind this public publisher
  // identity in both production and isolated catalogues with different IDs.
  title:'Souvenir',author:'Suzanne Vermeer',isbn13:'9789044978834',language:'nl',reviewedAt:'2026-10-21',
  sourceName:'A.W. Bruna Uitgevers',sourceUrl:'https://www.awbruna.nl/boek/thrillers/suzanne-vermeer/souvenir/',
  text:'Tijdens een vakantie in Umbrië verdwijnt Nienkes moeder Carolien, die alzheimer heeft. Haar spoor leidt naar Florence. Met een medaillon als aanwijzing probeert Nienke te achterhalen wat er is gebeurd.',
}, {
  title:'A \u200bCourt of Silver Flames',author:'Sarah J. Maas',isbn13:'9781526602312',
  openLibraryWorkId:'OL21703979W',openLibraryEditionId:'OL29532409M',editionLanguage:'eng',
  language:'en',reviewedAt:'2026-10-23',sourceName:'Bloomsbury',
  sourceUrl:'https://www.bloomsbury.com/au/court-of-silver-flames-9781526602312/',
  text:'After the war, Nesta Archeron struggles with becoming High Fae and finding her place in the Night Court. Training with Cassian forces her to face old wounds, while a renewed threat puts their court at risk.',
}, {
  title:"The Magician's Nephew (The Chronicles of Narnia)",author:'C. S. Lewis',isbn13:'9780064471107',
  openLibraryWorkId:'OL71042W',openLibraryEditionId:'OL7292690M',editionLanguage:'eng',
  language:'en',reviewedAt:'2026-10-23',source:'official_catalog',sourceName:'NSW Department of Education',
  sourceUrl:'https://online.education.nsw.gov.au/prc/booklist/listBooksByTitle.html?letter=M&levelId=3',
  text:'Polly and Digory unexpectedly reach Narnia. Their adventure explains how travel between Narnia and our world began.',
}, {
  title:'The Amber Spyglass',author:'Philip Pullman',isbn13:'9780440418566',
  openLibraryWorkId:'OL28996W',openLibraryEditionId:'OL7521619M',editionLanguage:'eng',
  language:'en',reviewedAt:'2026-10-23',sourceName:'Penguin Random House',
  sourceUrl:'https://www.penguinrandomhouse.com/books/136441/his-dark-materials-the-amber-spyglass-book-3-by-philip-pullman/9780440418566/',
  text:'Lyra and Will face a dangerous journey as Lord Asriel’s rebellion draws forces from many worlds into conflict. Their choices become central to the fate of the living and the dead.',
}, {
  title:"The Housemaid's Secret",author:'Freida McFadden',isbn13:'9781837901326',
  openLibraryWorkId:'OL34113490W',openLibraryEditionId:'OL46530123M',editionLanguage:'eng',
  language:'en',reviewedAt:'2026-10-23',sourceName:'Bookouture',
  sourceUrl:'https://bookouture.com/books/2903/',
  text:'A housemaid takes a job with the wealthy Garricks, hoping to keep her past hidden. The mysterious absence of Mrs Garrick and signs of distress lead her to investigate what is happening behind a closed bedroom door.',
}];

export function reviewedDescriptionSource(sourceKey: string, source?: VerifiedBookDescription['source']): { name: string; href: string } | null {
  const entry = REVIEWED_DESCRIPTIONS.find(row => row.isbn13 === sourceKey &&
    (!source || (row.source ?? 'official_publisher') === source));
  return entry ? { name: entry.sourceName, href: entry.sourceUrl } : null;
}

export function getReviewedDescription(input: {
  workId?: string | null; editionId?: string | null; editionTitle?: string | null;
  author?: string | null; isbn13?: string | null; editionLanguage?: string | null;
  openLibraryWorkId?: string | null; openLibraryEditionId?: string | null;
}, locale: Locale): VerifiedBookDescription | null {
  const normalize = (text?: string | null) => text?.trim().normalize('NFC').toLocaleLowerCase('nl');
  const entry = REVIEWED_DESCRIPTIONS.find(row => (!row.workId || row.workId === input.workId) &&
    (!row.editionId || row.editionId === input.editionId) && row.isbn13 === normalizeIsbn13(input.isbn13) &&
    (!row.openLibraryWorkId || row.openLibraryWorkId === input.openLibraryWorkId) &&
    (!row.openLibraryEditionId || row.openLibraryEditionId === input.openLibraryEditionId) &&
    normalize(row.title) === normalize(input.editionTitle) && normalize(row.author) === normalize(input.author) &&
    row.language === locale && normalizeEditionLanguage(input.editionLanguage ?? '') ===
      (row.editionLanguage ?? (row.language === 'nl' ? 'nld' : 'eng')));
  return entry ? { text: entry.text, source: entry.source ?? 'official_publisher', sourceKey: entry.isbn13,
    verifiedAt: entry.reviewedAt, language: entry.language } : null;
}
