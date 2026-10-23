import { NextResponse, type NextRequest } from 'next/server';
import {
  PASSWORD_RECOVERY_VERIFIED_COOKIE,
  PASSWORD_RECOVERY_PENDING_COOKIE,
  hasRecentRecoveryAuthentication,
  isValidRecoveryState,
  recoveryCookieOptions,
  validatePasswordUpdate,
} from '@/lib/auth/password-recovery';
import {
  isSameOriginRequest,
  PRIVATE_RESPONSE_HEADERS,
} from '@/lib/auth/request';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { measureServerOperation } from '@/lib/performance/server-timing';
import { localizedHref } from '@/lib/i18n/paths';
import { recoveryLocale } from '@/lib/auth/recovery-link';
import { updateWithRecoveryToken } from '@/lib/auth/recovery-token-update';

function privateRedirect(destination: string, requestUrl: string, locale: 'nl' | 'en') {
  return NextResponse.redirect(new URL(localizedHref(destination, locale), new URL(requestUrl).origin), {
    status: 303,
    headers: PRIVATE_RESPONSE_HEADERS,
  });
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return new NextResponse('Forbidden.', {
      status: 403,
      headers: PRIVATE_RESPONSE_HEADERS,
    });
  }

  const formData = await request.formData();
  const locale = recoveryLocale(formData.get('locale'));
  const validation = validatePasswordUpdate(formData.get('password'), formData.get('passwordConfirmation'));
  const tokenHash = formData.get('recoveryTokenHash');
  if (!validation.ok) {
    // Keep a fragment proof out of URLs/cookies; return a safe error, never echo it.
    return privateRedirect(tokenHash !== null ? '/forgot-password?error=update_failed'
      : `/update-password?error=${validation.error}`, request.url, locale);
  }
  if (tokenHash !== null) {
    const supabase = await createServerSupabaseClient();
    const outcome = typeof tokenHash === 'string'
      ? await updateWithRecoveryToken(supabase.auth, tokenHash, validation.password) : 'invalid_link';
    const response = privateRedirect(outcome === 'updated' ? '/login?message=password_updated'
      : `/forgot-password?error=${outcome}`, request.url, locale);
    for (const name of [PASSWORD_RECOVERY_PENDING_COOKIE, PASSWORD_RECOVERY_VERIFIED_COOKIE]) {
      response.cookies.set(name, '', recoveryCookieOptions(0));
    }
    return response;
  }

  const verifiedRecovery = request.cookies.get(
    PASSWORD_RECOVERY_VERIFIED_COOKIE,
  )?.value;
  const supabase = await createServerSupabaseClient();
  const [userResult, claimsResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getClaims(),
  ]);
  if (
    !isValidRecoveryState(verifiedRecovery) ||
    userResult.error ||
    !userResult.data.user ||
    claimsResult.error ||
    !hasRecentRecoveryAuthentication(claimsResult.data?.claims)
  ) {
    const response = privateRedirect('/forgot-password?error=invalid_link', request.url, locale);
    response.cookies.set(
      PASSWORD_RECOVERY_VERIFIED_COOKIE,
      '',
      recoveryCookieOptions(0),
    );
    return response;
  }

  const { error } = await measureServerOperation(
    'auth.password_update',
    'private',
    () => supabase.auth.updateUser({ password: validation.password }),
  );
  if (error) {
    return privateRedirect('/update-password?error=update_failed', request.url, locale);
  }

  await supabase.auth.signOut({ scope: 'local' });
  const response = privateRedirect('/login?message=password_updated', request.url, locale);
  response.cookies.set(
    PASSWORD_RECOVERY_VERIFIED_COOKIE,
    '',
    recoveryCookieOptions(0),
  );
  return response;
}
