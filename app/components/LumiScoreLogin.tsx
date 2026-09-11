'use client';

import { ThemeToggle } from './LumiScoreHome';
import { LumiScoreWordmark } from './LumiScoreWordmark';

type LumiScoreLoginProps = {
  next: string;
  error: string | null;
  message: string | null;
};

export function LumiScoreLogin({ next, error, message }: LumiScoreLoginProps) {
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
        <ThemeToggle onToggle={toggleTheme} labeled />
      </header>

      <section className="auth-card" aria-labelledby="login-heading">
        <span className="eyebrow">READER ACCOUNT</span>
        <h1 id="login-heading">Rate the books you know.</h1>
        <p>Browsing stays open to everyone. Sign in only when you want to rate a book.</p>

        {error && <div className="auth-notice auth-error" role="alert">{error}</div>}
        {message && <div className="auth-notice" role="status">{message}</div>}

        <form className="auth-form" action="/auth/sign-in" method="post">
          <input type="hidden" name="next" value={next} />
          <label>
            <span>Email</span>
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            <span>Password</span>
            <input name="password" type="password" autoComplete="current-password" minLength={8} required />
          </label>
          <button className="primary-cta auth-submit" type="submit">Sign in <span>→</span></button>
          <button className="auth-create" type="submit" formAction="/auth/sign-up">Create account</button>
        </form>
        <a className="detail-back-link auth-back" href={next}>← Continue browsing</a>
      </section>
    </main>
  );
}
