import { LocaleLink } from './LumiScoreLocale';
import type { BreadcrumbEntry } from '@/lib/seo/breadcrumbs';
import type { Locale } from '@/lib/i18n/config';

export function LumiScoreBreadcrumbs({ entries, locale }: { entries: BreadcrumbEntry[]; locale: Locale }) {
  return <nav className="catalog-breadcrumbs" aria-label={locale === 'nl' ? 'Broodkruimels' : 'Breadcrumb'}><ol>
      {entries.map((entry, index) => <li key={entry.path}>{index === entries.length - 1
        ? <span aria-current="page">{entry.name}</span> : <LocaleLink href={entry.path}>{entry.name}</LocaleLink>}</li>)}
    </ol></nav>;
}
