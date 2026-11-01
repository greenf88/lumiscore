import type { Locale } from '../i18n/config.ts';

// This is a conservative quality gate for unreviewed source TEXT, never evidence
// for an edition's language or book identity. Short/ambiguous/mixed copy stays
// unknown. Reviewed stored summaries have a separate explicit language review.
const WORDS = {
  en: new Set('the and of with from to that this these those his her he she they their who which when where while through into about between without after before must becomes finds discovers'.split(' ')),
  nl: new Set('de het een van en met voor naar bij zijn haar hij zij hun wordt worden heeft hebben deze die dat als om door over uit waar ook niet maar tussen zonder nadat voordat moet ontdekt'.split(' ')),
} as const;

export function sourceDescriptionLocale(text: string): Locale | null {
  const words = text.toLocaleLowerCase('en').match(/\p{L}+/gu) ?? [];
  if (words.length < 12) return null;
  const scores = (['nl', 'en'] as const).map(locale => {
    const hits = words.filter(word => WORDS[locale].has(word));
    return { locale, hits: hits.length, distinct: new Set(hits).size };
  }).sort((a, b) => b.hits - a.hits);
  const [best, other] = scores;
  return best.hits >= 6 && best.distinct >= 4 && best.hits / words.length >= 0.12 && best.hits >= 3 * Math.max(1, other.hits)
    ? best.locale : null;
}
