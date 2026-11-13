'use client';

import { useSyncExternalStore } from 'react';
import type { BookReturnNavigation } from '@/lib/navigation/book-return';
import { bookReturnMemoryKey, resolveLocalBookReturn, safeLocalBookReturn } from '@/lib/navigation/book-return-memory';
import { LocaleLink, useLumiScoreLocale } from './LumiScoreLocale';

function subscribeToNavigation(onChange: () => void) {
  const events = ['popstate', 'pageshow', 'storage'] as const;
  for (const event of events) window.addEventListener(event, onChange);
  return () => { for (const event of events) window.removeEventListener(event, onChange); };
}

function readLocalReturnHref(): string | null {
  let stored: string | null = null;
  try { stored = sessionStorage.getItem(bookReturnMemoryKey(location.pathname)); } catch { /* Optional navigation state. */ }
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  return resolveLocalBookReturn({ currentUrl: location.href, referrer: document.referrer, stored, navigationType: navigation?.type })?.href ?? null;
}
const serverReturnHref = () => null;

export function BookBackLink({ returnNavigation, collection }: {
  returnNavigation: BookReturnNavigation;
  collection?: { slug: string; name: string } | null;
}) {
  const { locale, t } = useLumiScoreLocale();
  // A primitive snapshot is stable between reads. SSR/hydration uses the
  // verified server fallback before consulting this tab's navigation context.
  const localHref = useSyncExternalStore(subscribeToNavigation, readLocalReturnHref, serverReturnHref);
  const localReturn = localHref ? safeLocalBookReturn(localHref) : null;
  const navigation = localReturn ?? returnNavigation;
  const collectionName = 'collectionName' in navigation && typeof navigation.collectionName === 'string' ? navigation.collectionName
    : collection && navigation.href === `/collection/${collection.slug}` ? collection.name : null;
  const label = navigation.kind === 'editorial' ? (locale === 'nl' ? 'Terug naar de selectie' : 'Back to the selection')
    : navigation.kind === 'collection' ? collectionName ? t('detail.backToCollection', { name: collectionName })
      : locale === 'nl' ? 'Terug naar de collectie' : 'Back to the collection'
    : t(navigation.kind === 'search' ? 'detail.backToSearch'
      : navigation.kind === 'collections' ? 'detail.backToCollections' : 'detail.backToBooks');
  return <LocaleLink className="detail-back-link" href={navigation.href}>← {label}</LocaleLink>;
}
