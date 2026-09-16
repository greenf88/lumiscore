import type { Metadata } from 'next';
import { LumiScoreLogin } from '@/app/components/LumiScoreLogin';
import { LumiScoreMetadata } from '@/app/components/LumiScoreMetadata';
import { getSafeNextPath } from '@/lib/auth/request';
import { resolveRequestLocale } from '@/lib/i18n/server';
import { translate, type TranslationKey } from '@/lib/i18n/translations';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sign in — LumiScore',
  description: 'Sign in or create a LumiScore account to rate books.',
};

type LoginPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    message?: string | string[];
    next?: string | string[];
  }>;
};

const errorMessages: Record<string, TranslationKey> = {
  invalid_credentials: 'auth.invalidCredentials',
  signup_failed: 'auth.signupFailed',
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
      <LumiScoreMetadata
        title="Sign in — LumiScore"
        description="Sign in or create a LumiScore account to rate books."
        noIndex
      />
      <LumiScoreLogin
        next={getSafeNextPath(requestedNext)}
        error={errorKey ? translate(locale, errorMessages[errorKey] ?? 'auth.failed') : null}
        message={
          messageKey === 'check_email'
            ? translate(locale, 'auth.checkEmail')
            : null
        }
      />
    </>
  );
}
