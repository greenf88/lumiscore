'use client';

import { ThemeToggle } from './LumiScoreHome';
import { LanguageSwitcher, useLumiScoreLocale } from './LumiScoreLocale';
import { LumiScoreWordmark } from './LumiScoreWordmark';

type LumiScoreLoginProps = {
  next: string;
  error: string | null;
  message: string | null;
};

export function LumiScoreLogin({ next, error, message }: LumiScoreLoginProps) {
  const { t } = useLumiScoreLocale();
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
        <h1 id="login-heading">{t('auth.heading')}</h1>
        <p>{t('auth.copy')}</p>

        {error && <div className="auth-notice auth-error" role="alert">{error}</div>}
        {message && <div className="auth-notice" role="status">{message}</div>}

        <form className="auth-form" action="/auth/sign-in" method="post">
          <input type="hidden" name="next" value={next} />
          <label>
            <span>{t('auth.email')}</span>
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            <span>{t('auth.password')}</span>
            <input name="password" type="password" autoComplete="current-password" minLength={8} required />
          </label>
          <button className="primary-cta auth-submit" type="submit">{t('auth.signIn')} <span>→</span></button>
          <button className="auth-create" type="submit" formAction="/auth/sign-up">{t('auth.create')}</button>
        </form>
        <a className="detail-back-link auth-back" href={next}>← {t('auth.continue')}</a>
      </section>
    </main>
  );
}
