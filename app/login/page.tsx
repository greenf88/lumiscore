import type { Metadata } from 'next';
import { LumiScoreLogin } from '@/app/components/LumiScoreLogin';
import { getSafeNextPath } from '@/lib/auth/request';

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

const errorMessages: Record<string, string> = {
  invalid_credentials: 'The email or password was not accepted.',
  signup_failed: 'Your account could not be created. Check your details and try again.',
  confirmation_failed: 'That confirmation link is invalid or has expired.',
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const errorKey = Array.isArray(params.error) ? params.error[0] : params.error;
  const messageKey = Array.isArray(params.message)
    ? params.message[0]
    : params.message;
  const requestedNext = Array.isArray(params.next) ? params.next[0] : params.next;

  return (
    <LumiScoreLogin
      next={getSafeNextPath(requestedNext)}
      error={errorKey ? errorMessages[errorKey] ?? 'Authentication failed.' : null}
      message={
        messageKey === 'check_email'
          ? 'Check your email to confirm your account, then return to LumiScore.'
          : null
      }
    />
  );
}
