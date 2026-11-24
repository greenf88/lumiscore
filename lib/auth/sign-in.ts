import type { TranslationKey } from '../i18n/translations.ts';

export const SIGN_IN_ERROR_MESSAGES = {
  invalid_credentials: 'auth.invalidCredentials',
  email_not_confirmed: 'auth.emailNotConfirmed',
  sign_in_rate_limited: 'auth.signInRateLimited',
  sign_in_unavailable: 'auth.signInUnavailable',
} as const satisfies Record<string, TranslationKey>;

type SignInError = keyof typeof SIGN_IN_ERROR_MESSAGES;
type AuthFailure = { code?: string; status?: number };

export function classifySignInError(error: AuthFailure): SignInError {
  if (error.status === 429 || error.code === 'over_request_rate_limit') return 'sign_in_rate_limited';
  if (error.code === 'email_not_confirmed') return 'email_not_confirmed';
  if (error.status === 0 || (error.status !== undefined && error.status >= 500) || error.code === 'unexpected_failure') {
    return 'sign_in_unavailable';
  }
  // Never reveal whether an account exists or echo provider details.
  return 'invalid_credentials';
}

export async function attemptSignIn<T extends { access_token: string }>(
  submit: () => PromiseLike<{ data: { session: T | null }; error: AuthFailure | null }>,
): Promise<{ error: SignInError | null; session: T | null }> {
  try {
    const { data, error } = await submit();
    if (error) return { error: classifySignInError(error), session: null };
    if (!data.session) return { error: 'sign_in_unavailable', session: null };
    return { error: null, session: data.session };
  } catch {
    return { error: 'sign_in_unavailable', session: null };
  }
}
