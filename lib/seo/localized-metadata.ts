import 'server-only';
import { resolveRequestLocale } from '../i18n/server';
import { createPageMetadata } from './page-metadata';
import { HOME_POSITIONING } from './home-positioning';

const dutchPages: Record<string, [string, string]> = {
  '/': [HOME_POSITIONING.nl.title, HOME_POSITIONING.nl.description],
  '/browse': ['Boeken ontdekken — LumiScore', 'Verken de LumiScore-catalogus en vind je volgende boek.'],
  '/collections': ['Collecties ontdekken — LumiScore', 'Ontdek series, universums en auteurscollecties op LumiScore.'],
  '/categories': ['Categorieën — LumiScore', 'Ontdek boeken per categorie in de LumiScore-catalogus.'],
  '/taste-test': ['Ontdek je leessmaak — LumiScore', 'Ontdek je leessmaak met expliciete boekbeoordelingen.'],
  '/search': ['Boeken zoeken — LumiScore', 'Zoek boeken en auteurs in de LumiScore-catalogus.'],
  '/recommendations': ['Aanbevelingen — LumiScore', 'Boeken die bij jouw leessmaak passen.'],
  '/my-books': ['Mijn boeken — LumiScore', 'Je eigen leeslijst en boekbeoordelingen.'],
  '/account': ['Mijn leesprofiel — LumiScore', 'Je eigen leesprofiel en leesvoorkeuren.'],
  '/login': ['Inloggen — LumiScore', 'Log in op LumiScore.'],
  '/forgot-password': ['Wachtwoord vergeten — LumiScore', 'Herstel je LumiScore-wachtwoord.'],
  '/update-password': ['Wachtwoord wijzigen — LumiScore', 'Kies een nieuw LumiScore-wachtwoord.'],
  '/reading-preferences': ['Leesvoorkeuren — LumiScore', 'Beheer je persoonlijke leesvoorkeuren.'],
  '/taste-test/result': ['Jouw leessmaak — LumiScore', 'Je persoonlijke leessmaak en boekaanbevelingen.'],
  '/taste-test/preferences': ['Leesvoorkeuren — LumiScore', 'Ontdek je leesvoorkeuren.'],
};

export async function createLocalizedPageMetadata(options: Parameters<typeof createPageMetadata>[0]) {
  const { locale } = await resolveRequestLocale();
  const localized = locale === 'nl' ? dutchPages[options.canonicalPath] : undefined;
  return createPageMetadata({ ...options, ...(localized ? { title: localized[0], description: localized[1] } : {}), locale });
}
