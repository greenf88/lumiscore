import { LumiScoreLogin } from '@/app/components/LumiScoreLogin';
import { createLocalizedPageMetadata } from '@/lib/seo/localized-metadata';
import { getSafeNextPath } from '@/lib/auth/request';
import { resolveRequestLocale } from '@/lib/i18n/server';
import { translate, type TranslationKey } from '@/lib/i18n/translations';
import { isSignupError, SIGNUP_ERROR_MESSAGES } from '@/lib/auth/registration';
import { SIGN_IN_ERROR_MESSAGES } from '@/lib/auth/sign-in';

export const dynamic = 'force-dynamic';

export async function generateMetadata() { return createLocalizedPageMetadata({
  title: 'Sign in — LumiScore',
  description: 'Sign in or create a LumiScore account to rate books.',
  canonicalPath: '/login',
  noIndex: true,
  follow: true,
}); }

type LoginPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    message?: string | string[];
    next?: string | string[];
  }>;
};

const errorMessages: Record<string, TranslationKey> = {
  ...SIGN_IN_ERROR_MESSAGES,
  ...SIGNUP_ERROR_MESSAGES,
  confirmation_failed: 'auth.confirmationFailed',
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [params, { locale }] = await Promise.all([
    searchParams,
    resolveRequestLocale(),
  ]);
  const errorKey = Array.isArray(params.error) ? params.error[0] : params.error;
  const messageKey = Array.isArray(params.message)
    ? params.message[0]
    : params.message;
  const requestedNext = Array.isArray(params.next) ? params.next[0] : params.next;

  return (
    <>
      <LumiScoreLogin
        next={getSafeNextPath(requestedNext)}
        error={errorKey ? translate(locale, errorMessages[errorKey] ?? 'auth.failed') : null}
        message={
          messageKey === 'check_email'
            ? translate(locale, 'auth.checkEmail')
            : messageKey === 'password_updated'
              ? translate(locale, 'auth.passwordUpdated')
              : null
        }
        initialMode={
          isSignupError(errorKey)
            ? 'sign-up'
            : 'sign-in'
        }
      />
    </>
  );
}
