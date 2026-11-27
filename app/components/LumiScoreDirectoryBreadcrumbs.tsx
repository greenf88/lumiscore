import type { Locale } from '@/lib/i18n/config';
import { directoryBreadcrumbs, type DiscoveryDirectoryPath } from '@/lib/seo/breadcrumbs';
import { breadcrumbJsonLd } from '@/lib/seo/breadcrumb-json-ld';
import { LumiScoreBreadcrumbs } from './LumiScoreBreadcrumbs';

/** Server-rendered navigation and schema share the same canonical hierarchy. */
export function LumiScoreDirectoryBreadcrumbs({ path, locale }: { path: DiscoveryDirectoryPath; locale: Locale }) {
  const entries = directoryBreadcrumbs(path, locale);
  return <>
    <LumiScoreBreadcrumbs entries={entries} locale={locale} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{
      __html: JSON.stringify(breadcrumbJsonLd(entries, locale)).replaceAll('<', '\\u003c'),
    }} />
  </>;
}
