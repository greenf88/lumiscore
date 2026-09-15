import type { Metadata } from 'next';
import { LumiScoreWordmark } from '@/app/components/LumiScoreWordmark';
import { LanguageSwitcher } from '@/app/components/LumiScoreLocale';
import { resolveRequestLocale } from '@/lib/i18n/server';
import { translate } from '@/lib/i18n/translations';

export const metadata: Metadata = {
  title: 'Book not found — LumiScore',
  robots: { index: false, follow: false },
};

export default async function BookNotFound() {
  const { locale } = await resolveRequestLocale();
  return (
    <main className="book-detail-shell book-not-found-shell">
      <header className="detail-header">
        <LumiScoreWordmark />
        <LanguageSwitcher />
      </header>
      <section className="book-not-found" aria-labelledby="book-not-found-title">
        <span className="eyebrow">{translate(locale, 'notFound.eyebrow')}</span>
        <h1 id="book-not-found-title">{translate(locale, 'notFound.heading')}</h1>
        <p>{translate(locale, 'notFound.copy')}</p>
        <a className="primary-cta" href="/#discover">{translate(locale, 'notFound.browse')} <span>→</span></a>
      </section>
    </main>
  );
}
