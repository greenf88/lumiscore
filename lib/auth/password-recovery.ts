import { timingSafeEqual } from 'node:crypto';
import { absoluteLumiScoreUrl } from '../seo/site-origin.ts';
import {
  isValidNewAccountPassword,
  NEW_ACCOUNT_PASSWORD_MIN_LENGTH,
} from './credentials.ts';

export const PASSWORD_RECOVERY_PENDING_COOKIE = 'lumiscore-recovery-pending';
export const PASSWORD_RECOVERY_VERIFIED_COOKIE = 'lumiscore-recovery-verified';
export const PASSWORD_RECOVERY_PATH = '/update-password';
export const PASSWORD_RESET_REQUEST_DESTINATION = '/forgot-password?message=check_email';

const RECOVERY_STATE_PATTERN = /^[0-9a-f-]{36}$/u;
const RECOVERY_AUTH_MAX_AGE_SECONDS = 15 * 60;

export type PasswordUpdateValidation =
  | { ok: true; password: string }
  | { ok: false; error: 'password_too_short' | 'password_mismatch' };

export function createPasswordRecoveryCallbackUrl(state: string): string {
  const callback = new URL('/auth/callback', absoluteLumiScoreUrl('/'));
  callback.searchParams.set('flow', 'recovery');
  callback.searchParams.set('next', PASSWORD_RECOVERY_PATH);
  callback.searchParams.set('recovery_state', state);
  return callback.toString();
}

export function isValidRecoveryState(value: string | null | undefined): value is string {
  return typeof value === 'string' && RECOVERY_STATE_PATTERN.test(value);
}

export function recoveryStatesMatch(
  cookieValue: string | null | undefined,
  queryValue: string | null | undefined,
): boolean {
  if (!isValidRecoveryState(cookieValue) || !isValidRecoveryState(queryValue)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(cookieValue), Buffer.from(queryValue));
}

export function hasRecentRecoveryAuthentication(
  claims: unknown,
  nowSeconds = Math.floor(Date.now() / 1_000),
): boolean {
  if (!claims || typeof claims !== 'object') return false;
  const amr = (claims as { amr?: unknown }).amr;
  if (!Array.isArray(amr)) return false;

  return amr.some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const { method, timestamp } = entry as {
      method?: unknown;
      timestamp?: unknown;
    };
    return method === 'recovery' &&
      typeof timestamp === 'number' &&
      timestamp <= nowSeconds + 60 &&
      timestamp >= nowSeconds - RECOVERY_AUTH_MAX_AGE_SECONDS;
  });
}

export function recoveryCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    maxAge,
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  };
}

export function validatePasswordUpdate(
  password: unknown,
  confirmation: unknown,
): PasswordUpdateValidation {
  if (!isValidNewAccountPassword(password)) {
    return { ok: false, error: 'password_too_short' };
  }
  if (typeof confirmation !== 'string' || password !== confirmation) {
    return { ok: false, error: 'password_mismatch' };
  }
  return { ok: true, password };
}

export { NEW_ACCOUNT_PASSWORD_MIN_LENGTH };
