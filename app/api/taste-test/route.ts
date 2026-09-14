import { NextResponse, type NextRequest } from 'next/server';
import { isSameOriginRequest, PRIVATE_RESPONSE_HEADERS } from '@/lib/auth/request';
import {
  isTasteTestChoice,
  isTasteTestQuestionKey,
  type TasteTestChoice,
  type TasteTestQuestionKey,
} from '@/lib/taste-test/config';
import {
  loadTasteTestServerState,
  saveTasteTestAnswers,
} from '@/lib/supabase/taste-test';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_RESPONSE_HEADERS });
}

export async function GET() {
  try {
    return json(await loadTasteTestServerState());
  } catch {
    return json({ error: 'Taste Test data is temporarily unavailable.' }, 500);
  }
}

export async function PUT(request: NextRequest) {
  if (!isSameOriginRequest(request)) return json({ error: 'Forbidden.' }, 403);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }
  const rawAnswers = typeof body === 'object' && body !== null && 'answers' in body
    ? body.answers : null;
  if (!Array.isArray(rawAnswers) || rawAnswers.length === 0 || rawAnswers.length > 10) {
    return json({ error: 'Submit between 1 and 10 answers.' }, 400);
  }
  const answers: Array<{ questionKey: TasteTestQuestionKey; choice: TasteTestChoice }> = [];
  const keys = new Set<string>();
  for (const value of rawAnswers) {
    if (typeof value !== 'object' || value === null || !('questionKey' in value) || !('choice' in value)
      || !isTasteTestQuestionKey(value.questionKey) || !isTasteTestChoice(value.choice)
      || keys.has(value.questionKey)) {
      return json({ error: 'Invalid Taste Test answer.' }, 400);
    }
    keys.add(value.questionKey);
    answers.push({ questionKey: value.questionKey, choice: value.choice });
  }
  try {
    const state = await saveTasteTestAnswers(answers);
    return state ? json(state) : json({ error: 'Sign in to save your Taste Test.' }, 401);
  } catch {
    return json({ error: 'Your Taste Test could not be saved.' }, 500);
  }
}
