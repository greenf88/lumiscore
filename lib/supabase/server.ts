import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import { readServerEnvironment } from '@/lib/server-environment';
import { measurementTestTarget, METRIC_CONTEXT_HEADER, parseMetricContext } from '@/lib/product-metrics/contract';

function getSupabaseEnvironment() {
  const url = readServerEnvironment('NEXT_PUBLIC_SUPABASE_URL');
  const publishableKey = readServerEnvironment(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  );

  if (!url || !publishableKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    );
  }

  return { url, publishableKey };
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseEnvironment();
  let context = null;
  if (measurementTestTarget(url)) {
    const h = await headers(), raw = h.get(METRIC_CONTEXT_HEADER);
    if (raw && raw.length <= 512 && h.get('sec-gpc') !== '1' && h.get('dnt') !== '1') {
      try { context = parseMetricContext(JSON.parse(raw)); } catch { /* Optional metrics never prevent authentication or writes. */ }
    }
  }

  return createServerClient(url, publishableKey, {
    ...(context ? { global: { headers: { [METRIC_CONTEXT_HEADER]: JSON.stringify(context) } } } : {}),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies. proxy.ts refreshes them.
        }
      },
    },
  });
}
