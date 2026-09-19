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
import { absoluteLumiScoreUrl } from '@/lib/seo/site-origin';

const VERIFIED_RECOVERY_MAX_AGE_SECONDS = 10 * 60;

function privateRedirect(destination: string) {
  return NextResponse.redirect(absoluteLumiScoreUrl(destination), {
    status: 303,
    headers: PRIVATE_RESPONSE_HEADERS,
  });
}

function invalidRecoveryRedirect() {
  const response = privateRedirect('/forgot-password?error=invalid_link');
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
    const pendingState = request.cookies.get(
      PASSWORD_RECOVERY_PENDING_COOKIE,
    )?.value;
    const suppliedState = request.nextUrl.searchParams.get('recovery_state');
    if (
      next !== PASSWORD_RECOVERY_PATH ||
      !code ||
      !isValidRecoveryState(suppliedState) ||
      !recoveryStatesMatch(pendingState, suppliedState)
    ) {
      return invalidRecoveryRedirect();
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await measureServerOperation(
      'auth.recovery_callback',
      'private',
      () => supabase.auth.exchangeCodeForSession(code),
    );
    if (error || !data.session?.user) return invalidRecoveryRedirect();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    if (
      claimsError ||
      !hasRecentRecoveryAuthentication(claimsData?.claims)
    ) {
      await supabase.auth.signOut({ scope: 'local' });
      return invalidRecoveryRedirect();
    }

    const response = privateRedirect(PASSWORD_RECOVERY_PATH);
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
      return privateRedirect(next);
    }
  }

  return privateRedirect(
    `/login?error=confirmation_failed&next=${encodeURIComponent(next)}`,
  );
}
