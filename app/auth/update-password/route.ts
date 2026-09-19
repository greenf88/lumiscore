import { NextResponse, type NextRequest } from 'next/server';
import {
  PASSWORD_RECOVERY_VERIFIED_COOKIE,
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
import { absoluteLumiScoreUrl } from '@/lib/seo/site-origin';

function privateRedirect(destination: string) {
  return NextResponse.redirect(absoluteLumiScoreUrl(destination), {
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
    const response = privateRedirect('/forgot-password?error=invalid_link');
    response.cookies.set(
      PASSWORD_RECOVERY_VERIFIED_COOKIE,
      '',
      recoveryCookieOptions(0),
    );
    return response;
  }

  const formData = await request.formData();
  const validation = validatePasswordUpdate(
    formData.get('password'),
    formData.get('passwordConfirmation'),
  );
  if (!validation.ok) {
    return privateRedirect(`/update-password?error=${validation.error}`);
  }

  const { error } = await measureServerOperation(
    'auth.password_update',
    'private',
    () => supabase.auth.updateUser({ password: validation.password }),
  );
  if (error) {
    return privateRedirect('/update-password?error=update_failed');
  }

  await supabase.auth.signOut({ scope: 'local' });
  const response = privateRedirect('/login?message=password_updated');
  response.cookies.set(
    PASSWORD_RECOVERY_VERIFIED_COOKIE,
    '',
    recoveryCookieOptions(0),
  );
  return response;
}
