import { NextResponse, type NextRequest } from 'next/server';
import { isSameOriginRequest, PRIVATE_RESPONSE_HEADERS } from '@/lib/auth/request';
import { isCatalogWorkId } from '@/lib/books/book-detail';
import { parseRating } from '@/lib/ratings/model';
import {
  deleteBookRating,
  saveBookRating,
} from '@/lib/supabase/ratings';

type RatingRouteProps = {
  params: Promise<{ workId: string }>;
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_RESPONSE_HEADERS });
}

export async function PUT(request: NextRequest, { params }: RatingRouteProps) {
  if (!isSameOriginRequest(request)) return json({ error: 'Forbidden.' }, 403);

  const { workId } = await params;
  if (!isCatalogWorkId(workId)) return json({ error: 'Invalid work.' }, 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const rating = parseRating(
    typeof body === 'object' && body !== null && 'rating' in body
      ? body.rating
      : null,
  );
  if (rating === null) {
    return json({ error: 'Choose a whole-number rating from 1 to 10.' }, 400);
  }

  try {
    const state = await saveBookRating(workId, rating);
    return state
      ? json({ state })
      : json({ error: 'Sign in to rate this book.' }, 401);
  } catch {
    return json({ error: 'Your rating could not be saved.' }, 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RatingRouteProps,
) {
  if (!isSameOriginRequest(request)) return json({ error: 'Forbidden.' }, 403);

  const { workId } = await params;
  if (!isCatalogWorkId(workId)) return json({ error: 'Invalid work.' }, 400);

  try {
    const state = await deleteBookRating(workId);
    return state
      ? json({ state })
      : json({ error: 'Sign in to change this rating.' }, 401);
  } catch {
    return json({ error: 'Your rating could not be removed.' }, 500);
  }
}
