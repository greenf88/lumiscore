import { NextResponse, type NextRequest } from 'next/server';
import { isSameOriginRequest, PRIVATE_RESPONSE_HEADERS } from '@/lib/auth/request';
import { isCatalogWorkId } from '@/lib/books/book-detail';
import { isReadingStatus } from '@/lib/collections/model';
import {
  RatedWorkStatusConflictError,
  StatusReconciliationError,
} from '@/lib/collections/status-mutations';
import {
  deleteUserBookStatus,
  loadUserBookStatuses,
  saveUserBookStatus,
} from '@/lib/supabase/book-status';

type StatusRouteProps = { params: Promise<{ workId: string }> };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_RESPONSE_HEADERS });
}

export async function GET(_request: NextRequest, { params }: StatusRouteProps) {
  const { workId } = await params;
  if (!isCatalogWorkId(workId)) return json({ error: 'Invalid work.' }, 400);
  try {
    const state = await loadUserBookStatuses([workId]);
    return json({
      authenticated: state.authenticated,
      status: state.statuses.get(workId) ?? null,
    });
  } catch {
    return json({ error: 'Reading status could not be loaded.' }, 500);
  }
}

export async function PUT(request: NextRequest, { params }: StatusRouteProps) {
  if (!isSameOriginRequest(request)) return json({ error: 'Forbidden.' }, 403);
  const { workId } = await params;
  if (!isCatalogWorkId(workId)) return json({ error: 'Invalid work.' }, 400);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }
  const status = typeof body === 'object' && body !== null && 'status' in body
    ? body.status
    : null;
  if (!isReadingStatus(status)) return json({ error: 'Invalid reading status.' }, 400);

  try {
    const saved = await saveUserBookStatus(workId, status);
    return saved
      ? json({ status: saved })
      : json({ error: 'Sign in to save a reading status.' }, 401);
  } catch (error) {
    if (error instanceof RatedWorkStatusConflictError) {
      return json({
        error: 'Rated books must keep the Read status.',
        code: 'rated_work_conflict',
        conflictingWorkIds: error.conflictingWorkIds,
      }, 409);
    }
    if (error instanceof StatusReconciliationError) {
      return json({
        error: 'The status may have been saved. Reload this book to confirm it.',
        code: 'status_reconciliation_failed',
      }, 503);
    }
    return json({ error: 'Reading status could not be saved.' }, 500);
  }
}

export async function DELETE(request: NextRequest, { params }: StatusRouteProps) {
  if (!isSameOriginRequest(request)) return json({ error: 'Forbidden.' }, 403);
  const { workId } = await params;
  if (!isCatalogWorkId(workId)) return json({ error: 'Invalid work.' }, 400);
  try {
    const deleted = await deleteUserBookStatus(workId);
    return deleted === null
      ? json({ error: 'Sign in to change a reading status.' }, 401)
      : json({ status: null });
  } catch (error) {
    if (error instanceof RatedWorkStatusConflictError) {
      return json({
        error: 'Rated books must keep the Read status.',
        code: 'rated_work_conflict',
        conflictingWorkIds: error.conflictingWorkIds,
      }, 409);
    }
    if (error instanceof StatusReconciliationError) {
      return json({
        error: 'The status may have changed. Reload this book to confirm it.',
        code: 'status_reconciliation_failed',
      }, 503);
    }
    return json({ error: 'Reading status could not be removed.' }, 500);
  }
}

