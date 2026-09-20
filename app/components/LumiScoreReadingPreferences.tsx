'use client';

import { useState } from 'react';
import {
  READING_PERIODS,
  toggleReadingPeriod,
  type ReaderEraPreferences,
  type ReadingPeriod,
} from '@/lib/preferences/reading-periods';
import type { TranslationKey } from '@/lib/i18n/translations';
import { LanguageSwitcher, useLumiScoreLocale } from './LumiScoreLocale';
import { LumiScoreWordmark } from './LumiScoreWordmark';
import { ThemeToggle } from './LumiScoreHome';

const readingLabels: Record<ReadingPeriod, TranslationKey> = {
  before_1950: 'preferences.before1950',
  '1950_1979': 'preferences.1950to1979',
  '1980_1999': 'preferences.1980to1999',
  '2000_2014': 'preferences.2000to2014',
  '2015_present': 'preferences.2015present',
  all_periods: 'preferences.allPeriods',
  no_preference: 'preferences.noPreference',
};

export function LumiScoreReadingPreferences({
  initial,
  next,
}: {
  initial: ReaderEraPreferences;
  next: string;
}) {
  const { t } = useLumiScoreLocale();
  const [readingPeriods, setReadingPeriods] = useState<ReadingPeriod[]>(initial.readingPeriods);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const toggleTheme = () => {
    const theme = document.documentElement.dataset.theme === 'ink' ? 'paper' : 'ink';
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === 'paper' ? 'light' : 'dark';
    localStorage.setItem('lumiscore-theme', theme);
  };

  const request = async (method: 'PUT' | 'DELETE', body?: unknown): Promise<boolean> => {
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch('/api/account/reading-preferences', {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) throw new Error('preferences_request_failed');
      setStatus({ kind: 'success', message: t(method === 'DELETE' ? 'preferences.cleared' : 'preferences.saved') });
      return true;
    } catch {
      setStatus({ kind: 'error', message: t('preferences.saveError') });
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="auth-shell preferences-shell">
      <header className="detail-header">
        <LumiScoreWordmark />
        <div className="detail-header-actions"><LanguageSwitcher /><ThemeToggle onToggle={toggleTheme} labeled /></div>
      </header>
      <section className="auth-card preferences-card" aria-labelledby="preferences-heading">
        <span className="eyebrow">{t('preferences.eyebrow')}</span>
        <h1 id="preferences-heading">{t('preferences.heading')}</h1>
        <p>{t('preferences.copy')}</p>

        <fieldset className="preference-fieldset">
          <legend>{t('preferences.readingLegend')}</legend>
          <div className="preference-options">
            {READING_PERIODS.map((period) => (
              <label key={period} className="preference-option">
                <input
                  type="checkbox"
                  checked={readingPeriods.includes(period)}
                  onChange={() => setReadingPeriods((current) => toggleReadingPeriod(current, period))}
                />
                <span>{t(readingLabels[period])}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <p className="preference-privacy">{t('preferences.privacy')}</p>
        {status && <p className={`auth-notice${status.kind === 'error' ? ' auth-error' : ''}`} role={status.kind === 'error' ? 'alert' : 'status'}>{status.message}</p>}
        <div className="preference-actions">
          <button className="primary-cta" type="button" disabled={saving} onClick={() => {
            void request('PUT', { readingPeriods }).then((saved) => {
              if (saved) window.location.assign(next);
            });
          }}>
            {t(saving ? 'preferences.saving' : 'preferences.save')}
          </button>
          <button type="button" className="auth-create" disabled={saving} onClick={() => {
            void request('DELETE').then((cleared) => {
              if (cleared) setReadingPeriods([]);
            });
          }}>{t('preferences.clear')}</button>
          <button type="button" className="auth-create" disabled={saving} onClick={() => {
            setSaving(true);
            void fetch('/api/account/reading-preferences', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ dismiss: true }),
            }).finally(() => { window.location.assign(next); });
          }}>{t('preferences.skip')}</button>
        </div>
        <a className="detail-back-link auth-back" href={next}>← {t('preferences.back')}</a>
      </section>
    </main>
  );
}
