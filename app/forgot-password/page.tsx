import type { Metadata } from 'next';
import { LumiScoreMetadata } from '@/app/components/LumiScoreMetadata';
import { LumiScorePasswordRecovery } from '@/app/components/LumiScorePasswordRecovery';
import { resolveRequestLocale } from '@/lib/i18n/server';
import { translate } from '@/lib/i18n/translations';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Reset password — LumiScore',
  description: 'Request a secure LumiScore password reset link.',
  robots: { index: false, follow: false },
};

type ForgotPasswordPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    message?: string | string[];
  }>;
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const [params, { locale }] = await Promise.all([
    searchParams,
    resolveRequestLocale(),
  ]);
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const message = Array.isArray(params.message) ? params.message[0] : params.message;

  return (
    <>
      <LumiScoreMetadata
        title="Reset password — LumiScore"
        description="Request a secure LumiScore password reset link."
        noIndex
      />
      <LumiScorePasswordRecovery
        mode="request"
        error={error === 'invalid_link'
          ? translate(locale, 'auth.recoveryInvalid')
          : null}
        message={message === 'check_email'
          ? translate(locale, 'auth.recoveryCheckEmail')
          : null}
      />
    </>
  );
}
