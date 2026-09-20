'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  DISPLAY_NAME_MAX_LENGTH,
  normalizeDisplayName,
  type DisplayNameValidationError,
} from '@/lib/auth/display-name';
import {
  getHeaderAuthPresentation,
  type HeaderAuthState,
} from '@/lib/auth/header';
import type { TranslationKey } from '@/lib/i18n/translations';
import { useLumiScoreLocale } from './LumiScoreLocale';

type AccountMenuVariant = 'site' | 'detail';

const DISPLAY_NAME_ERROR_KEYS: Record<
  DisplayNameValidationError,
  TranslationKey
> = {
  required: 'account.nameRequired',
  too_long: 'account.nameTooLong',
  invalid_characters: 'account.nameInvalid',
};

export function LumiScoreAccountMenu({
  authState,
  returnTo,
  variant = 'site',
}: {
  authState: HeaderAuthState;
  returnTo: string;
  variant?: AccountMenuVariant;
}) {
  const { t } = useLumiScoreLocale();
  const auth = getHeaderAuthPresentation(authState, returnTo);
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState(auth.displayName);
  const [draftName, setDraftName] = useState(auth.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const [preferenceInvite, setPreferenceInvite] = useState(false);
  const preferencesChecked = useRef(false);
  const [status, setStatus] = useState<{
    kind: 'success' | 'error';
    message: string;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = `account-panel-${useId().replaceAll(':', '')}`;

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !auth.authenticated || preferencesChecked.current) return;
    preferencesChecked.current = true;
    void fetch('/api/account/reading-preferences', { cache: 'no-store' })
      .then(async (response) => response.ok ? response.json() as Promise<{ onboardingDismissed?: unknown }> : null)
      .then((payload) => setPreferenceInvite(payload?.onboardingDismissed === false))
      .catch(() => undefined);
  }, [auth.authenticated, open]);

  if (!auth.authenticated) {
    return (
      <a
        className={variant === 'detail' ? 'detail-sign-in' : 'header-sign-in'}
        href={auth.signInHref}
      >
        {t('header.signIn')}
      </a>
    );
  }

  const accountLabel = displayName ?? t('header.account');

  const saveDisplayName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = normalizeDisplayName(draftName);
    if (!validation.ok) {
      setStatus({ kind: 'error', message: t(DISPLAY_NAME_ERROR_KEYS[validation.error]) });
      return;
    }

    const previousName = displayName;
    setDisplayName(validation.value);
    setSaving(true);
    setStatus(null);

    try {
      const response = await fetch('/api/account/display-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: validation.value }),
      });
      const payload = (await response.json()) as {
        displayName?: unknown;
      };
      if (!response.ok || typeof payload.displayName !== 'string') {
        throw new Error('display_name_update_failed');
      }

      setDisplayName(payload.displayName);
      setDraftName(payload.displayName);
      setStatus({ kind: 'success', message: t('account.nameSaved') });
    } catch {
      setDisplayName(previousName);
      setStatus({ kind: 'error', message: t('account.nameSaveError') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`header-account${variant === 'detail' ? ' detail-account-menu' : ''}`}
      ref={rootRef}
    >
      <button
        className="header-account-trigger"
        type="button"
        ref={triggerRef}
        aria-label={t('header.openAccountFor', { name: accountLabel })}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="header-account-avatar" aria-hidden="true">
          {auth.avatarLetter}
        </span>
        <span className="header-account-label">{accountLabel}</span>
        <span className="header-account-chevron" aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div
          className="header-account-panel"
          id={panelId}
          role="dialog"
          aria-label={t('header.account')}
        >
          {!displayName && <p className="account-name-prompt">{t('account.addNamePrompt')}</p>}
          <form className="account-name-form" onSubmit={(event) => void saveDisplayName(event)}>
            <label htmlFor={`${panelId}-name`}>{t('account.displayName')}</label>
            <input
              id={`${panelId}-name`}
              name="displayName"
              type="text"
              value={draftName}
              autoComplete="name"
              maxLength={DISPLAY_NAME_MAX_LENGTH}
              onChange={(event) => setDraftName(event.target.value)}
            />
            <button type="submit" disabled={saving}>
              {saving ? t('account.saving') : t('account.saveName')}
            </button>
          </form>
          {status && (
            <p
              className={`account-name-status is-${status.kind}`}
              role={status.kind === 'error' ? 'alert' : 'status'}
            >
              {status.message}
            </p>
          )}
          {preferenceInvite && (
            <div className="account-preference-invite">
              <p>{t('preferences.invite')}</p>
              <a href={`/reading-preferences?next=${encodeURIComponent(auth.returnTo)}`}>{t('preferences.inviteAction')}</a>
              <button type="button" onClick={() => {
                setPreferenceInvite(false);
                void fetch('/api/account/reading-preferences', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ dismiss: true }),
                });
              }}>{t('preferences.notNow')}</button>
            </div>
          )}
          <a className="account-preferences-link" href={`/reading-preferences?next=${encodeURIComponent(auth.returnTo)}`}>
            {t('preferences.menu')}
          </a>
          <form action="/auth/sign-out" method="post">
            <input type="hidden" name="next" value={auth.returnTo} />
            <button type="submit">{t('header.signOut')}</button>
          </form>
        </div>
      )}
    </div>
  );
}
