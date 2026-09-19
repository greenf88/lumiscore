import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { LumiScoreMetadata } from '@/app/components/LumiScoreMetadata';
import { LumiScorePasswordRecovery } from '@/app/components/LumiScorePasswordRecovery';
import {
  isValidRecoveryState,
  hasRecentRecoveryAuthentication,
  PASSWORD_RECOVERY_VERIFIED_COOKIE,
} from '@/lib/auth/password-recovery';
import { resolveRequestLocale } from '@/lib/i18n/server';
import { translate, type TranslationKey } from '@/lib/i18n/translations';
import { getVerifiedServerUser } from '@/lib/supabase/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Choose a new password — LumiScore',
  description: 'Securely update your LumiScore password.',
  robots: { index: false, follow: false },
};

const errorMessages: Record<string, TranslationKey> = {
  password_mismatch: 'auth.passwordMismatch',
  password_too_short: 'auth.passwordTooShort',
  update_failed: 'auth.passwordUpdateFailed',
};

type UpdatePasswordPageProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function UpdatePasswordPage({
  searchParams,
}: UpdatePasswordPageProps) {
  const cookieStore = await cookies();
  const recoveryMarker = cookieStore.get(PASSWORD_RECOVERY_VERIFIED_COOKIE)?.value;
  if (!isValidRecoveryState(recoveryMarker)) {
    redirect('/forgot-password?error=invalid_link');
  }

  const { client, user } = await getVerifiedServerUser();
  const { data: claimsData, error: claimsError } = await client.auth.getClaims();
  if (
    !user ||
    claimsError ||
    !hasRecentRecoveryAuthentication(claimsData?.claims)
  ) {
    redirect('/forgot-password?error=invalid_link');
  }

  const [params, { locale }] = await Promise.all([
    searchParams,
    resolveRequestLocale(),
  ]);
  const error = Array.isArray(params.error) ? params.error[0] : params.error;

  return (
    <>
      <LumiScoreMetadata
        title="Choose a new password — LumiScore"
        description="Securely update your LumiScore password."
        noIndex
      />
      <LumiScorePasswordRecovery
        mode="update"
        error={error
          ? translate(locale, errorMessages[error] ?? 'auth.passwordUpdateFailed')
          : null}
        message={null}
      />
    </>
  );
}
