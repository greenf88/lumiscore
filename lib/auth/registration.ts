import type { TranslationKey } from '../i18n/translations.ts';
import { authDestination, getSafeNextPath } from './request.ts';

export const SIGNUP_ERROR_MESSAGES = {
  signup_failed: 'auth.signupFailed',
  invalid_signup_details: 'auth.invalidSignupDetails',
  signup_rate_limited: 'auth.signupRateLimited',
  signup_email_unavailable: 'auth.signupEmailUnavailable',
  signup_disabled: 'auth.signupDisabled',
  signup_password_rejected: 'auth.signupPasswordRejected',
  signup_unavailable: 'auth.signupUnavailable',
} as const satisfies Record<string, TranslationKey>;

export type SignupError = keyof typeof SIGNUP_ERROR_MESSAGES;

export function isSignupError(value: string | undefined): value is SignupError {
  return value !== undefined && Object.hasOwn(SIGNUP_ERROR_MESSAGES, value);
}

/** Whitelisted categories only: never expose a provider message, email or token. */
export function classifySignupError(error: { code?: string; status?: number }): SignupError {
  if (error.status === 429 || error.code === 'over_email_send_rate_limit'
    || error.code === 'over_request_rate_limit') return 'signup_rate_limited';
  if (error.code === 'email_address_not_authorized') return 'signup_email_unavailable';
  if (error.code === 'signup_disabled' || error.code === 'email_provider_disabled') return 'signup_disabled';
  if (error.code === 'weak_password') return 'signup_password_rejected';
  if (error.status !== undefined && error.status >= 500) return 'signup_unavailable';
  // Includes existing-account errors: don't disclose account existence.
  return 'signup_failed';
}

export async function attemptSignup(
  submit: () => PromiseLike<{ data: { session: unknown }; error: { code?: string; status?: number } | null }>,
): Promise<{ error: SignupError | null; hasSession: boolean }> {
  try {
    const result = await submit(); // Exactly one attempt; no automatic retry or resend.
    return { error: result.error ? classifySignupError(result.error) : null,
      hasSession: !result.error && Boolean(result.data.session) };
  } catch {
    return { error: 'signup_unavailable', hasSession: false };
  }
}

/** Confirmation cookies belong to this deployment, not the SEO canonical origin. */
export function registrationCallbackDestination(requestUrl: string, next: string, confirmed: boolean): URL {
  const safeNext = getSafeNextPath(next);
  const destination = confirmed ? safeNext : authDestination(
    `/login?error=confirmation_failed&next=${encodeURIComponent(safeNext)}`, safeNext,
  );
  return new URL(destination, new URL(requestUrl).origin);
}
