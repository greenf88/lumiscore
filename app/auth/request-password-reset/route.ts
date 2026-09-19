import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import {
  createPasswordRecoveryCallbackUrl,
  PASSWORD_RECOVERY_PENDING_COOKIE,
  PASSWORD_RESET_REQUEST_DESTINATION,
  recoveryCookieOptions,
} from '@/lib/auth/password-recovery';
import {
  isSameOriginRequest,
  PRIVATE_RESPONSE_HEADERS,
} from '@/lib/auth/request';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { measureServerOperation } from '@/lib/performance/server-timing';
import { absoluteLumiScoreUrl } from '@/lib/seo/site-origin';

const PENDING_RECOVERY_MAX_AGE_SECONDS = 60 * 60;

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return new NextResponse('Forbidden.', {
      status: 403,
      headers: PRIVATE_RESPONSE_HEADERS,
    });
  }

  const formData = await request.formData();
  const email = String(formData.get('email') ?? '').trim();
  const recoveryState = randomUUID();

  if (email) {
    try {
      const supabase = await createServerSupabaseClient();
      await measureServerOperation(
        'auth.password_reset_request',
        'private',
        () => supabase.auth.resetPasswordForEmail(email, {
          redirectTo: createPasswordRecoveryCallbackUrl(recoveryState),
        }),
      );
    } catch {
      // The response stays generic to avoid account enumeration.
    }
  }

  const response = NextResponse.redirect(
    absoluteLumiScoreUrl(PASSWORD_RESET_REQUEST_DESTINATION),
    { status: 303, headers: PRIVATE_RESPONSE_HEADERS },
  );
  response.cookies.set(
    PASSWORD_RECOVERY_PENDING_COOKIE,
    recoveryState,
    recoveryCookieOptions(PENDING_RECOVERY_MAX_AGE_SECONDS),
  );
  return response;
}
