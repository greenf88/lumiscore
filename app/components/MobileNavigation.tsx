'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { LocaleLink, useLumiScoreLocale } from './LumiScoreLocale';

// The same disclosure is used by the overview and compact book-detail headers.
export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = `mobile-navigation-${useId().replaceAll(':', '')}`;
  const { locale, t } = useLumiScoreLocale();

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return <div className="mobile-navigation" ref={root}>
    <button className="mobile-navigation-trigger" type="button" ref={trigger}
      aria-label={t('header.openNavigation')} aria-expanded={open} aria-controls={panelId}
      onClick={() => setOpen(value => !value)}>
      <span className="hamburger-icon" aria-hidden="true"><i /><i /><i /></span>
    </button>
    {open && <div className="mobile-navigation-panel" id={panelId} onClick={event => {
      if ((event.target as HTMLElement).closest('a')) setOpen(false);
    }}>
      <LocaleLink href="/browse">{t('browse.books')}</LocaleLink>
      <LocaleLink href="/collections">{t('browse.collections')}</LocaleLink>
      <LocaleLink href="/categories">{t('home.categories')}</LocaleLink>
      <LocaleLink href="/toplijsten">{locale === 'nl' ? 'Toplijsten' : 'Reading lists'}</LocaleLink>
      <LocaleLink href="/taste-test">{t('header.tasteTest')}</LocaleLink>
      <LocaleLink href="/my-books">{t('header.myBooks')}</LocaleLink>
      <span className="mobile-navigation-divider" aria-hidden="true" />
      <LocaleLink href="/over-ons">{t('footer.about')}</LocaleLink>
      <LocaleLink href="/zo-werkt-het">{t('footer.howItWorks')}</LocaleLink>
      <LocaleLink href="/voor-uitgevers">{t('footer.publishers')}</LocaleLink>
      <LocaleLink href="/contact">{t('footer.contact')}</LocaleLink>
    </div>}
  </div>;
}
