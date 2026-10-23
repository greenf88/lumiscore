'use client';

import { LocaleLink } from './LumiScoreLocale';

import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { NEW_ACCOUNT_PASSWORD_MIN_LENGTH } from '@/lib/auth/credentials';
import { ThemeToggle } from './LumiScoreHome';
import { LanguageSwitcher, useLumiScoreLocale } from './LumiScoreLocale';
import { LumiScoreWordmark } from './LumiScoreWordmark';
import { readRecoveryLink, recoveryLanguageHref } from '@/lib/auth/recovery-link';

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
  needsRecoveryLink = false,
  hasRecoverySession = false,
}: {
  mode: RecoveryMode;
  error: string | null;
  message: string | null;
  needsRecoveryLink?: boolean;
  hasRecoverySession?: boolean;
}) {
  const { t, locale } = useLumiScoreLocale();
  const noticeRef = useRef<HTMLDivElement>(null);
  const [linkProof, setLinkProof] = useState<string | null | undefined>(undefined);
  const processedLink = useRef(false);

  useEffect(() => {
    if (!needsRecoveryLink) return;
    const processLink = () => {
      const hasIncomingProof = !!window.location.hash ||
        [...new URLSearchParams(window.location.search).keys()].some(key => key !== 'error');
      const link = readRecoveryLink(window.location);
      // Remove secrets before rendering a form, following links or making requests.
      window.history.replaceState(null, '', window.location.pathname);
      if (link.kind === 'pkce') {
        window.location.replace(link.callbackPath);
        return;
      }
      // Proof stays in this component only: no local/session storage or replay buffer.
      // Incoming mail proof always wins over a previously verified recovery session.
      setLinkProof(link.kind === 'token' ? link.tokenHash : !hasIncomingProof && hasRecoverySession ? '' : null);
    };
    window.addEventListener('hashchange', processLink);
    // A mail app can reuse an already-open landing tab. StrictMode must not
    // process the scrubbed initial URL twice, but a later hashchange is a new link.
    if (!processedLink.current) {
      processedLink.current = true;
      processLink();
    }
    return () => window.removeEventListener('hashchange', processLink);
  }, [needsRecoveryLink, hasRecoverySession]);
  const checking = needsRecoveryLink && linkProof === undefined;
  const invalidLink = needsRecoveryLink && linkProof === null;
  const visibleError = invalidLink ? t('auth.recoveryInvalid') : error;

  useEffect(() => {
    if (visibleError || message) noticeRef.current?.focus();
  }, [visibleError, message]);

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
          <LanguageSwitcher hrefForLocale={mode === 'update' ? option => recoveryLanguageHref(option, linkProof) : undefined} />
          <ThemeToggle onToggle={toggleTheme} labeled />
        </div>
      </header>

      <section className="auth-card" aria-labelledby="recovery-heading">
        <span className="eyebrow">{t('auth.passwordRecovery')}</span>
        <h1 id="recovery-heading">
          {t(mode === 'request' ? 'auth.forgotHeading' : 'auth.updateHeading')}
        </h1>
        <p>{t(mode === 'request' ? 'auth.forgotCopy' : 'auth.updateCopy')}</p>

        {(visibleError || message) && (
          <div
            className={`auth-notice${visibleError ? ' auth-error' : ''}`}
            role={visibleError ? 'alert' : 'status'}
            aria-live={visibleError ? 'assertive' : 'polite'}
            ref={noticeRef}
            tabIndex={-1}
          >
            {visibleError ?? message}
          </div>
        )}

        {checking && <p role="status">{t('auth.recoveryChecking')}</p>}
        {invalidLink && <LocaleLink className="primary-cta auth-submit" href="/forgot-password">{t('auth.sendResetLink')} →</LocaleLink>}
        {!checking && !invalidLink && <form
          className="auth-form"
          action={mode === 'request'
            ? '/auth/request-password-reset'
            : '/auth/update-password'}
          method="post"
          onSubmit={event => {
            if (mode !== 'update') return;
            const form = event.currentTarget;
            const password = form.elements.namedItem('password');
            const confirmation = form.elements.namedItem('passwordConfirmation');
            if (password instanceof HTMLInputElement && confirmation instanceof HTMLInputElement) {
              confirmation.setCustomValidity(password.value === confirmation.value ? '' : t('auth.passwordMismatch'));
              if (!form.reportValidity()) event.preventDefault();
            }
          }}
          onInput={event => {
            const confirmation = event.currentTarget.elements.namedItem('passwordConfirmation');
            if (confirmation instanceof HTMLInputElement) confirmation.setCustomValidity('');
          }}
        >
          <input type="hidden" name="locale" value={locale} />
          {needsRecoveryLink && linkProof && <input type="hidden" name="recoveryTokenHash" value={linkProof} />}
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
        </form>}
        <LocaleLink className="detail-back-link auth-back" href="/login">
          ← {t('auth.backToSignIn')}
        </LocaleLink>
      </section>
    </main>
  );
}
