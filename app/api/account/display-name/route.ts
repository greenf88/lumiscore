import { NextResponse, type NextRequest } from 'next/server';
import { normalizeDisplayName } from '@/lib/auth/display-name';
import {
  isSameOriginRequest,
  PRIVATE_RESPONSE_HEADERS,
} from '@/lib/auth/request';
import { createServerSupabaseClient } from '@/lib/supabase/server';

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: PRIVATE_RESPONSE_HEADERS,
  });
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return json({ error: 'forbidden' }, 403);

  const body = await request.json().catch(() => null) as {
    displayName?: unknown;
  } | null;
  const displayName = normalizeDisplayName(body?.displayName);
  if (!displayName.ok) {
    return json({ error: `display_name_${displayName.error}` }, 400);
  }

  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401);

  const currentMetadata = userData.user.user_metadata ?? {};
  const { data, error } = await supabase.auth.updateUser({
    data: {
      ...currentMetadata,
      display_name: displayName.value,
    },
  });
  if (error || !data.user) return json({ error: 'update_failed' }, 500);

  return json({ displayName: displayName.value }, 200);
}
