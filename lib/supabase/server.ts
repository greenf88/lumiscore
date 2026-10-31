import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import { readServerEnvironment } from '@/lib/server-environment';
import { measurementTarget, METRIC_CONTEXT_HEADER, parseMetricContext } from '@/lib/product-metrics/contract';
import {CHOICE_COOKIE,GRANT_COOKIE,GRANT_HEADER,grantedAnalysisToken} from '@/lib/product-metrics/consent';

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
  const grant=grantedAnalysisToken(cookieStore.get(CHOICE_COOKIE)?.value,cookieStore.get(GRANT_COOKIE)?.value);
  const metricTarget=measurementTarget(url,readServerEnvironment('NEXT_PUBLIC_PRODUCT_ANALYSIS_ENABLED'));
  if (metricTarget) {
    const h = await headers(), raw = h.get(METRIC_CONTEXT_HEADER);
    if (grant && raw && raw.length <= 512 && h.get('sec-gpc') !== '1' && h.get('dnt') !== '1') {
      try { const parsed=parseMetricContext(JSON.parse(raw));context=parsed?.traffic===metricTarget.traffic?parsed:null; } catch { /* Optional metrics never prevent authentication or writes. */ }
    }
  }

  return createServerClient(url, publishableKey, {
    ...(context && grant ? { global: { headers: { [METRIC_CONTEXT_HEADER]: JSON.stringify(context),[GRANT_HEADER]:grant } } } : {}),
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
