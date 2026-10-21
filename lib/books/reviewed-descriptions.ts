import type { VerifiedBookDescription } from '../../app/data/books.ts';
import type { Locale } from '../i18n/config.ts';
import { normalizeEditionLanguage } from './edition-ranking.ts';
import { normalizeIsbn13 } from './covers.ts';

/** Own short summaries, reviewed against an exact publisher/edition identity. */
const REVIEWED_DESCRIPTIONS = [{
  workId: '1305', editionId: '1305', title: 'Madonna', author: 'Suzanne Vermeer',
  isbn13: '9789044970791', language: 'nl' as const, reviewedAt: '2026-10-18',
  sourceName: 'A.W. Bruna Uitgevers',
  sourceUrl: 'https://www.awbruna.nl/boek/thrillers/suzanne-vermeer/madonna/',
  text: 'Reclamemanager Ingrid probeert een groot Italiaans modebedrijf als klant te winnen. Tijdens die zakelijke kans krijgt ze met een onaangename verrassing te maken. Dit korte verhaal komt uit de bundel De bestemming.',
}] as const;

const MIRROR_SOURCE = {
  name: 'Macmillan / Flatiron Books',
  href: 'https://us.macmillan.com/books/9781250462039/themirrorofinfiniteendings/',
};
const MIRROR_ISBNS = ['9781250462039', '9781399641777'];
const MIRROR_SUMMARIES = {
  nl: 'In deze geïllustreerde companion keren Jacks en Evangeline terug naar het Magnifieke Noorden. Hun gelukkige einde lijkt veilig, maar een geheim kan hun verhaal alsnog veranderen. Met illustraties van Lotusbubble; een aanvulling op Once Upon a Broken Heart, geen vierde hoofdroman.',
  en: 'This illustrated companion returns to Jacks and Evangeline in the Magnificent North. Their happy ending appears secure, but a secret could change their story. Illustrated by Lotusbubble, it accompanies Once Upon a Broken Heart rather than adding a fourth main novel.',
};

export function reviewedDescriptionSource(sourceKey: string): { name: string; href: string } | null {
  if (MIRROR_ISBNS.includes(sourceKey)) return MIRROR_SOURCE;
  const entry = REVIEWED_DESCRIPTIONS.find(row => row.isbn13 === sourceKey);
  return entry ? { name: entry.sourceName, href: entry.sourceUrl } : null;
}

export function getReviewedDescription(input: {
  workId?: string | null; editionId?: string | null; editionTitle?: string | null;
  author?: string | null; isbn13?: string | null; editionLanguage?: string | null;
}, locale: Locale): VerifiedBookDescription | null {
  const normalize = (text?: string | null) => text?.trim().normalize('NFC').toLocaleLowerCase('nl');
  // Description language is independent from edition language. Never certify an NL edition.
  if (input.workId === '10138' && MIRROR_ISBNS.includes(normalizeIsbn13(input.isbn13) ?? '') &&
      normalize(input.editionTitle) === 'the mirror of infinite endings' &&
      normalize(input.author) === 'stephanie garber' &&
      normalizeEditionLanguage(input.editionLanguage ?? '') === 'eng') {
    return { text: MIRROR_SUMMARIES[locale], language: locale, source: 'official_publisher',
      sourceKey: normalizeIsbn13(input.isbn13)!, verifiedAt: '2026-10-21' };
  }
  const entry = REVIEWED_DESCRIPTIONS.find(row => row.workId === input.workId &&
    row.editionId === input.editionId && row.isbn13 === normalizeIsbn13(input.isbn13) &&
    normalize(row.title) === normalize(input.editionTitle) && normalize(row.author) === normalize(input.author) &&
    row.language === locale && normalizeEditionLanguage(input.editionLanguage ?? '') === 'nld');
  return entry ? { text: entry.text, source: 'official_publisher', sourceKey: entry.isbn13,
    verifiedAt: entry.reviewedAt, language: entry.language } : null;
}
