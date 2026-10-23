import { NextResponse, type NextRequest } from 'next/server';
import {
  PASSWORD_RECOVERY_PATH,
  PASSWORD_RECOVERY_PENDING_COOKIE,
  PASSWORD_RECOVERY_VERIFIED_COOKIE,
  hasRecentRecoveryAuthentication,
  isValidRecoveryState,
  recoveryCookieOptions,
  recoveryStatesMatch,
} from '@/lib/auth/password-recovery';
import { getSafeNextPath, PRIVATE_RESPONSE_HEADERS } from '@/lib/auth/request';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { measureServerOperation } from '@/lib/performance/server-timing';
import { registrationCallbackDestination } from '@/lib/auth/registration';
import { isRecoveryDestination, recoveryLocale } from '@/lib/auth/recovery-link';
import { localizedHref, splitLocalePath } from '@/lib/i18n/paths';

const VERIFIED_RECOVERY_MAX_AGE_SECONDS = 10 * 60;

function privateRedirect(destination: string, requestUrl: string) {
  return NextResponse.redirect(new URL(destination, new URL(requestUrl).origin), {
    status: 303,
    headers: PRIVATE_RESPONSE_HEADERS,
  });
}

function invalidRecoveryRedirect(requestUrl: string, locale: 'nl' | 'en') {
  const response = privateRedirect(localizedHref('/forgot-password?error=invalid_link', locale), requestUrl);
  response.cookies.set(
    PASSWORD_RECOVERY_PENDING_COOKIE,
    '',
    recoveryCookieOptions(0),
  );
  response.cookies.set(
    PASSWORD_RECOVERY_VERIFIED_COOKIE,
    '',
    recoveryCookieOptions(0),
  );
  return response;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const recoveryFlow = request.nextUrl.searchParams.get('flow') === 'recovery';
  const next = getSafeNextPath(
    request.nextUrl.searchParams.get('next'),
    recoveryFlow ? PASSWORD_RECOVERY_PATH : '/',
  );

  if (recoveryFlow) {
    const locale = recoveryLocale(splitLocalePath(next).locale);
    const pendingState = request.cookies.get(
      PASSWORD_RECOVERY_PENDING_COOKIE,
    )?.value;
    const suppliedState = request.nextUrl.searchParams.get('recovery_state');
    if (
      !isRecoveryDestination(next) ||
      !code ||
      !isValidRecoveryState(suppliedState) ||
      !recoveryStatesMatch(pendingState, suppliedState)
    ) {
      return invalidRecoveryRedirect(request.url, locale);
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await measureServerOperation(
      'auth.recovery_callback',
      'private',
      () => supabase.auth.exchangeCodeForSession(code),
    );
    if (error || !data.session?.user) return invalidRecoveryRedirect(request.url, locale);
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    if (
      claimsError ||
      !hasRecentRecoveryAuthentication(claimsData?.claims)
    ) {
      await supabase.auth.signOut({ scope: 'local' });
      return invalidRecoveryRedirect(request.url, locale);
    }

    const response = privateRedirect(localizedHref(PASSWORD_RECOVERY_PATH, locale), request.url);
    response.cookies.set(
      PASSWORD_RECOVERY_PENDING_COOKIE,
      '',
      recoveryCookieOptions(0),
    );
    response.cookies.set(
      PASSWORD_RECOVERY_VERIFIED_COOKIE,
      suppliedState,
      recoveryCookieOptions(VERIFIED_RECOVERY_MAX_AGE_SECONDS),
    );
    return response;
  }

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await measureServerOperation(
      'auth.confirmation_callback',
      'private',
      () => supabase.auth.exchangeCodeForSession(code),
    );
    if (!error) {
      return NextResponse.redirect(registrationCallbackDestination(request.url, next, true), {
        status: 303, headers: PRIVATE_RESPONSE_HEADERS,
      });
    }
  }

  return NextResponse.redirect(registrationCallbackDestination(request.url, next, false), {
    status: 303, headers: PRIVATE_RESPONSE_HEADERS,
  });
}
