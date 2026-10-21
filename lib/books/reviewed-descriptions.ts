import type { VerifiedBookDescription } from '../../app/data/books.ts';
import type { Locale } from '../i18n/config.ts';
import { normalizeEditionLanguage } from './edition-ranking.ts';
import { normalizeIsbn13 } from './covers.ts';

/** Own short summaries, reviewed against an exact publisher/edition identity. */
type ReviewedDescription = {
  workId?:string; editionId?:string; title:string; author:string; isbn13:string;
  language:Locale; reviewedAt:string; sourceName:string; sourceUrl:string; text:string;
};
const REVIEWED_DESCRIPTIONS:readonly ReviewedDescription[] = [{
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
}];

export function reviewedDescriptionSource(sourceKey: string): { name: string; href: string } | null {
  const entry = REVIEWED_DESCRIPTIONS.find(row => row.isbn13 === sourceKey);
  return entry ? { name: entry.sourceName, href: entry.sourceUrl } : null;
}

export function getReviewedDescription(input: {
  workId?: string | null; editionId?: string | null; editionTitle?: string | null;
  author?: string | null; isbn13?: string | null; editionLanguage?: string | null;
}, locale: Locale): VerifiedBookDescription | null {
  const normalize = (text?: string | null) => text?.trim().normalize('NFC').toLocaleLowerCase('nl');
  const entry = REVIEWED_DESCRIPTIONS.find(row => (!row.workId || row.workId === input.workId) &&
    (!row.editionId || row.editionId === input.editionId) && row.isbn13 === normalizeIsbn13(input.isbn13) &&
    normalize(row.title) === normalize(input.editionTitle) && normalize(row.author) === normalize(input.author) &&
    row.language === locale && normalizeEditionLanguage(input.editionLanguage ?? '') === 'nld');
  return entry ? { text: entry.text, source: 'official_publisher', sourceKey: entry.isbn13,
    verifiedAt: entry.reviewedAt, language: entry.language } : null;
}
