'use client';

import { useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { NEW_ACCOUNT_PASSWORD_MIN_LENGTH } from '@/lib/auth/credentials';
import { ThemeToggle } from './LumiScoreHome';
import { LanguageSwitcher, useLumiScoreLocale } from './LumiScoreLocale';
import { LumiScoreWordmark } from './LumiScoreWordmark';

type RecoveryMode = 'request' | 'update';

function SubmitButton({ mode }: { mode: RecoveryMode }) {
  const { pending } = useFormStatus();
  const { t } = useLumiScoreLocale();
  return (
    <button
      className="primary-cta auth-submit"
      type="submit"
      disabled={pending}
      aria-disabled={pending}
    >
      <span aria-live="polite">
        {pending
          ? t('auth.recoverySubmitting')
          : t(mode === 'request' ? 'auth.sendResetLink' : 'auth.updatePassword')}
      </span>
      <span aria-hidden="true">→</span>
    </button>
  );
}

export function LumiScorePasswordRecovery({
  mode,
  error,
  message,
}: {
  mode: RecoveryMode;
  error: string | null;
  message: string | null;
}) {
  const { t } = useLumiScoreLocale();
  const noticeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error || message) noticeRef.current?.focus();
  }, [error, message]);

  const toggleTheme = () => {
    const theme = document.documentElement.dataset.theme === 'ink' ? 'paper' : 'ink';
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

      <section className="auth-card" aria-labelledby="recovery-heading">
        <span className="eyebrow">{t('auth.passwordRecovery')}</span>
        <h1 id="recovery-heading">
          {t(mode === 'request' ? 'auth.forgotHeading' : 'auth.updateHeading')}
        </h1>
        <p>{t(mode === 'request' ? 'auth.forgotCopy' : 'auth.updateCopy')}</p>

        {(error || message) && (
          <div
            className={`auth-notice${error ? ' auth-error' : ''}`}
            role={error ? 'alert' : 'status'}
            aria-live={error ? 'assertive' : 'polite'}
            ref={noticeRef}
            tabIndex={-1}
          >
            {error ?? message}
          </div>
        )}

        <form
          className="auth-form"
          action={mode === 'request'
            ? '/auth/request-password-reset'
            : '/auth/update-password'}
          method="post"
        >
          {mode === 'request' ? (
            <label>
              <span>{t('auth.email')}</span>
              <input name="email" type="email" autoComplete="email" required />
            </label>
          ) : (
            <>
              <label>
                <span>{t('auth.newPassword')}</span>
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={NEW_ACCOUNT_PASSWORD_MIN_LENGTH}
                  required
                />
              </label>
              <label>
                <span>{t('auth.confirmPassword')}</span>
                <input
                  name="passwordConfirmation"
                  type="password"
                  autoComplete="new-password"
                  minLength={NEW_ACCOUNT_PASSWORD_MIN_LENGTH}
                  required
                />
              </label>
              <p className="auth-password-hint">
                {t('auth.passwordHint', { count: NEW_ACCOUNT_PASSWORD_MIN_LENGTH })}
              </p>
            </>
          )}
          <SubmitButton mode={mode} />
        </form>
        <a className="detail-back-link auth-back" href="/login">
          ← {t('auth.backToSignIn')}
        </a>
      </section>
    </main>
  );
}
