import { NextResponse, type NextRequest } from 'next/server';
import { isSameOriginRequest, PRIVATE_RESPONSE_HEADERS } from '@/lib/auth/request';
import {
  parseBulkStatusPayload,
  RatedWorkStatusConflictError,
  StatusReconciliationError,
} from '@/lib/collections/status-mutations';
import {
  CollectionMembershipError,
  CollectionNotFoundError,
  serializeStatusResult,
  updateCollectionStatuses,
} from '@/lib/supabase/collection-statuses';

type BulkStatusRouteProps = { params: Promise<{ slug: string }> };
const MAX_BODY_BYTES = 16_384;
const COLLECTION_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_RESPONSE_HEADERS });
}

function logOutcome(
  requestId: string,
  count: number,
  startedAt: number,
  outcome: 'ok' | 'rejected' | 'failed',
  code: string,
) {
  console.info('collection_status_bulk', {
    requestId,
    count,
    durationMs: Date.now() - startedAt,
    outcome,
    code,
  });
}

async function readBoundedBody(request: NextRequest): Promise<{
  text: string;
  tooLarge: boolean;
}> {
  if (!request.body) return { text: '', tooLarge: false };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      return { text: '', tooLarge: true };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder().decode(bytes), tooLarge: false };
}

export async function POST(request: NextRequest, { params }: BulkStatusRouteProps) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  let count = 0;
  if (!isSameOriginRequest(request)) {
    logOutcome(requestId, count, startedAt, 'rejected', 'origin');
    return json({ error: 'Forbidden.' }, 403);
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    logOutcome(requestId, count, startedAt, 'rejected', 'content_type');
    return json({ error: 'JSON content is required.' }, 415);
  }
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    logOutcome(requestId, count, startedAt, 'rejected', 'body_too_large');
    return json({ error: 'Request body is too large.' }, 413);
  }

  const { slug } = await params;
  if (!COLLECTION_SLUG.test(slug)) {
    logOutcome(requestId, count, startedAt, 'rejected', 'slug');
    return json({ error: 'Invalid collection.' }, 400);
  }

  let boundedBody: Awaited<ReturnType<typeof readBoundedBody>>;
  try {
    boundedBody = await readBoundedBody(request);
  } catch {
    logOutcome(requestId, count, startedAt, 'rejected', 'body');
    return json({ error: 'Invalid request.' }, 400);
  }
  if (boundedBody.tooLarge) {
    logOutcome(requestId, count, startedAt, 'rejected', 'body_too_large');
    return json({ error: 'Request body is too large.' }, 413);
  }

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(boundedBody.text);
  } catch {
    logOutcome(requestId, count, startedAt, 'rejected', 'json');
    return json({ error: 'Invalid JSON.' }, 400);
  }
  const payload = parseBulkStatusPayload(rawPayload);
  if (!payload) {
    logOutcome(requestId, count, startedAt, 'rejected', 'payload');
    return json({ error: 'Invalid bulk status request.' }, 400);
  }
  count = payload.workIds.length;

  try {
    const result = await updateCollectionStatuses(slug, payload);
    if (!result) {
      logOutcome(requestId, count, startedAt, 'rejected', 'auth');
      return json({ error: 'Sign in to update reading statuses.' }, 401);
    }
    logOutcome(requestId, count, startedAt, 'ok', result.changed === 0 ? 'unchanged' : 'updated');
    return json(serializeStatusResult(result));
  } catch (error) {
    if (error instanceof RatedWorkStatusConflictError) {
      logOutcome(requestId, count, startedAt, 'rejected', 'rated_conflict');
      return json({
        error: 'Rated books must keep the Read status.',
        code: 'rated_work_conflict',
        conflictingWorkIds: error.conflictingWorkIds,
      }, 409);
    }
    if (error instanceof CollectionNotFoundError) {
      logOutcome(requestId, count, startedAt, 'rejected', 'collection_missing');
      return json({ error: 'Collection not found.' }, 404);
    }
    if (error instanceof CollectionMembershipError) {
      logOutcome(requestId, count, startedAt, 'rejected', 'membership');
      return json({ error: 'One or more books are not in this collection.' }, 400);
    }
    if (error instanceof StatusReconciliationError) {
      logOutcome(requestId, count, startedAt, 'failed', 'reconciliation');
      return json({
        error: 'The update may have been saved. Refreshing the collection is required.',
        code: 'status_reconciliation_failed',
      }, 503);
    }
    logOutcome(requestId, count, startedAt, 'failed', 'database');
    return json({ error: 'Reading statuses could not be updated.' }, 500);
  }
}
