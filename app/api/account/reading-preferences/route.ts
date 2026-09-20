import { NextResponse, type NextRequest } from 'next/server';
import {
  isSameOriginRequest,
  PRIVATE_RESPONSE_HEADERS,
} from '@/lib/auth/request';
import { normalizeReadingPeriods } from '@/lib/preferences/reading-periods';
import { getVerifiedServerUser } from '@/lib/supabase/auth';
import {
  clearReaderEraPreferences,
  dismissReaderEraOnboarding,
  loadReaderEraPreferences,
  saveReaderEraPreferences,
} from '@/lib/supabase/reading-preferences';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_RESPONSE_HEADERS });
}

export async function GET() {
  const { client, user } = await getVerifiedServerUser();
  if (!user) return json({ error: 'unauthorized' }, 401);
  try {
    return json(await loadReaderEraPreferences(client, user.id));
  } catch {
    return json({ error: 'preferences_unavailable' }, 503);
  }
}

export async function PUT(request: NextRequest) {
  if (!isSameOriginRequest(request)) return json({ error: 'forbidden' }, 403);
  const { client, user } = await getVerifiedServerUser();
  if (!user) return json({ error: 'unauthorized' }, 401);
  const body = await request.json().catch(() => null) as {
    readingPeriods?: unknown;
    dismiss?: unknown;
  } | null;

  try {
    if (body?.dismiss === true) {
      await dismissReaderEraOnboarding(client, user.id);
      return json({ ok: true });
    }
    const readingPeriods = normalizeReadingPeriods(body?.readingPeriods);
    if (readingPeriods === null) {
      return json({ error: 'invalid_preferences' }, 400);
    }
    await saveReaderEraPreferences(client, user.id, { readingPeriods });
    return json({ ok: true, readingPeriods, onboardingDismissed: true });
  } catch {
    return json({ error: 'preferences_update_failed' }, 503);
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) return json({ error: 'forbidden' }, 403);
  const { client, user } = await getVerifiedServerUser();
  if (!user) return json({ error: 'unauthorized' }, 401);
  try {
    await clearReaderEraPreferences(client, user.id);
    return json({ ok: true });
  } catch {
    return json({ error: 'preferences_delete_failed' }, 503);
  }
}
