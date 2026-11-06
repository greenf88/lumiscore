import { PRIVATE_RESPONSE_HEADERS } from '@/lib/auth/request';
import { loadHeaderAuthState } from '@/lib/supabase/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(await loadHeaderAuthState(), { headers: PRIVATE_RESPONSE_HEADERS });
}
