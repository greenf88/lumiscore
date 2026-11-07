import type { Locale } from '../i18n/config.ts';

// Reviewed publisher context, not translated edition/availability evidence.
// Bind to the reviewed stored description so later editorial changes win.
const reviewed = [
  {
    slug: 'geef-me-de-ruimte', name: 'Geef me de ruimte',
    original: 'Thea Beckmans historische trilogie over de Honderdjarige Oorlog.',
    en: 'Thea Beckman’s historical trilogy set during the Hundred Years’ War. Check which volumes are available in this language on LumiScore.',
    source: 'https://lemniscaat.nl/boeken/geef-me-de-ruimte',
  },
  {
    slug: 'kinderen-van-moeder-aarde', name: 'Kinderen van Moeder Aarde',
    original: 'Thea Beckmans toekomsttrilogie over Thule.',
    en: 'Thea Beckman’s trilogy set in the future world of Thule. Check which volumes are available in this language on LumiScore.',
    source: 'https://lemniscaat.nl/library/downloads/brochure/id/599/2026-2-Zomer.pdf',
  },
] as const;

export function reviewedCollectionDescription(
  row: { slug: string; name: string; collection_type: string; description: string | null },
  locale?: Locale,
): string | null {
  if (locale !== 'en' || row.collection_type !== 'series') return row.description;
  const match = reviewed.find(item => item.slug === row.slug && item.name === row.name && item.original === row.description);
  return match?.en ?? row.description;
}
