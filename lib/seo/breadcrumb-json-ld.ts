import type { Locale } from '../i18n/config.ts';
import { localizedHref } from '../i18n/paths.ts';
import { absoluteLumiScoreUrl } from './site-origin.ts';
import type { BreadcrumbEntry } from './breadcrumbs.ts';

/** Server route only: canonical origin resolution must never enter a client chunk. */
export function breadcrumbJsonLd(entries: readonly BreadcrumbEntry[], locale: Locale) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: entries.map((entry, index) => ({
    '@type': 'ListItem', position: index + 1, name: entry.name,
    item: absoluteLumiScoreUrl(localizedHref(entry.path, locale)),
  })) };
}
