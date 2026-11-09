import { boundedCoverResponse } from '@/lib/books/bounded-cover-response';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return boundedCoverResponse(request);
}
