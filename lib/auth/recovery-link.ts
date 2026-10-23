import { isLocale, type Locale } from '../i18n/config.ts';
import { localizedHref, splitLocalePath } from '../i18n/paths.ts';

const STATE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
export function isRecoveryState(value: unknown): value is string {
  return typeof value === 'string' && STATE.test(value);
}
export function isRecoveryTokenHash(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{32,256}$/u.test(value);
}
export function recoveryLocale(value: unknown): Locale {
  return isLocale(value) ? value : 'en';
}
export function isRecoveryDestination(path: string): boolean {
  return /^\/(?:en\/|nl\/)?update-password$/u.test(path);
}

/** Retain a not-yet-consumed proof only as a same-origin fragment during a language switch. */
export function recoveryLanguageHref(locale: Locale, tokenHash?: string | null): string {
  const path = localizedHref('/update-password', locale);
  return isRecoveryTokenHash(tokenHash) ? `${path}#token_hash=${encodeURIComponent(tokenHash)}&type=recovery` : path;
}

export type RecoveryLink =
  | { kind: 'token'; tokenHash: string }
  | { kind: 'pkce'; callbackPath: string }
  | { kind: 'invalid' };

/** Parse only the current recovery landing page. Never persist or log the result. */
export function readRecoveryLink(location: { pathname: string; search: string; hash: string }): RecoveryLink {
  if (!isRecoveryDestination(location.pathname) || location.search.length > 2048 || location.hash.length > 1024) {
    return { kind: 'invalid' };
  }
  const query = new URLSearchParams(location.search);
  const fragment = new URLSearchParams(location.hash.replace(/^#/u, ''));
  // The cross-browser email proof lives in the fragment, not an HTTP URL/query.
  if (fragment.has('token_hash')) {
    if (fragment.getAll('token_hash').length !== 1 || fragment.getAll('type').length !== 1 ||
      fragment.get('type') !== 'recovery' || !isRecoveryTokenHash(fragment.get('token_hash')) ||
      [...fragment.keys()].some(key => !['token_hash', 'type'].includes(key)) ||
      query.has('code') || query.has('token_hash')) return { kind: 'invalid' };
    return { kind: 'token', tokenHash: fragment.get('token_hash')! };
  }
  // Existing ConfirmationURL emails retain PKCE + the original browser-bound state.
  if (query.getAll('code').length === 1 && query.getAll('recovery_state').length === 1 &&
    !query.has('token_hash') && !query.has('error') && !location.hash &&
    isRecoveryState(query.get('code')) && isRecoveryState(query.get('recovery_state'))) {
    const locale = recoveryLocale(splitLocalePath(location.pathname).locale);
    const callback = new URLSearchParams({ flow: 'recovery', next: localizedHref('/update-password', locale),
      recovery_state: query.get('recovery_state')!, code: query.get('code')! });
    return { kind: 'pkce', callbackPath: `/auth/callback?${callback}` };
  }
  return { kind: 'invalid' };
}
