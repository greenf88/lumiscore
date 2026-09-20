import { NextResponse, type NextRequest } from 'next/server';
import { isSameOriginRequest, PRIVATE_RESPONSE_HEADERS } from '@/lib/auth/request';
import { isCatalogWorkId } from '@/lib/books/book-detail';
import {
  loadUserBookStatuses,
  migrateGuestWantToRead,
} from '@/lib/supabase/book-status';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_RESPONSE_HEADERS });
}

function requestedWorkIds(request: NextRequest): string[] {
  return (request.nextUrl.searchParams.get('workIds') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(isCatalogWorkId)
    .slice(0, 128);
}

export async function GET(request: NextRequest) {
  try {
    const state = await loadUserBookStatuses(requestedWorkIds(request));
    return json({
      authenticated: state.authenticated,
      statuses: Object.fromEntries(state.statuses),
    });
  } catch {
    return json({ error: 'Reading statuses could not be loaded.' }, 500);
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return json({ error: 'Forbidden.' }, 403);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }
  const workIds = typeof body === 'object' && body !== null && 'workIds' in body &&
    Array.isArray(body.workIds)
    ? body.workIds.filter((value): value is string =>
      typeof value === 'string' && isCatalogWorkId(value)).slice(0, 100)
    : [];

  try {
    const statuses = await migrateGuestWantToRead(workIds);
    return statuses
      ? json({ statuses: Object.fromEntries(statuses) })
      : json({ error: 'Sign in to save reading statuses.' }, 401);
  } catch {
    return json({ error: 'Guest reading list could not be migrated.' }, 500);
  }
}

