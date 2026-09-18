'use client';

import { useState } from 'react';
import { DISPLAY_NAME_MAX_LENGTH } from '@/lib/auth/display-name';
import { NEW_ACCOUNT_PASSWORD_MIN_LENGTH } from '@/lib/auth/credentials';
import { ThemeToggle } from './LumiScoreHome';
import { LanguageSwitcher, useLumiScoreLocale } from './LumiScoreLocale';
import { LumiScoreWordmark } from './LumiScoreWordmark';

type LumiScoreLoginProps = {
  next: string;
  error: string | null;
  message: string | null;
  initialMode: 'sign-in' | 'sign-up';
};

export function LumiScoreLogin({
  next,
  error,
  message,
  initialMode,
}: LumiScoreLoginProps) {
  const { t } = useLumiScoreLocale();
  const [mode, setMode] = useState(initialMode);
  const toggleTheme = () => {
    const theme =
      document.documentElement.dataset.theme === 'ink' ? 'paper' : 'ink';
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === 'paper' ? 'light' : 'dark';
    localStorage.setItem('lumiscore-theme', theme);
  };

  return (
    <main className="auth-shell">
      <header className="detail-header">
        <LumiScoreWordmark />
        <div className="detail-header-actions">
          <LanguageSwitcher />
          <ThemeToggle onToggle={toggleTheme} labeled />
        </div>
      </header>

      <section className="auth-card" aria-labelledby="login-heading">
        <span className="eyebrow">{t('auth.readerAccount')}</span>
        <h1 id="login-heading">
          {t(mode === 'sign-up' ? 'auth.createHeading' : 'auth.heading')}
        </h1>
        <p>{t(mode === 'sign-up' ? 'auth.createCopy' : 'auth.copy')}</p>

        {error && <div className="auth-notice auth-error" role="alert">{error}</div>}
        {message && <div className="auth-notice" role="status">{message}</div>}

        <form
          className="auth-form"
          action={mode === 'sign-up' ? '/auth/sign-up' : '/auth/sign-in'}
          method="post"
        >
          <input type="hidden" name="next" value={next} />
          {mode === 'sign-up' && (
            <label>
              <span>{t('auth.name')}</span>
              <input
                name="displayName"
                type="text"
                autoComplete="name"
                maxLength={DISPLAY_NAME_MAX_LENGTH}
                required
              />
            </label>
          )}
          <label>
            <span>{t('auth.email')}</span>
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            <span>{t('auth.password')}</span>
            <input
              name="password"
              type="password"
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              minLength={mode === 'sign-up' ? NEW_ACCOUNT_PASSWORD_MIN_LENGTH : undefined}
              required
            />
          </label>
          {mode === 'sign-up' && (
            <p className="auth-password-hint">
              {t('auth.passwordHint', { count: NEW_ACCOUNT_PASSWORD_MIN_LENGTH })}
            </p>
          )}
          <button className="primary-cta auth-submit" type="submit">
            {t(mode === 'sign-up' ? 'auth.create' : 'auth.signIn')} <span>→</span>
          </button>
          <button
            className="auth-create"
            type="button"
            onClick={() => setMode((current) => current === 'sign-up' ? 'sign-in' : 'sign-up')}
          >
            {t(mode === 'sign-up' ? 'auth.backToSignIn' : 'auth.create')}
          </button>
        </form>
        <a className="detail-back-link auth-back" href={next}>← {t('auth.continue')}</a>
      </section>
    </main>
  );
}
