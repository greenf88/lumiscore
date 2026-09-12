import { createClient } from '@supabase/supabase-js';
import { readServerEnvironment } from '@/lib/server-environment';

const supabaseUrl = readServerEnvironment('NEXT_PUBLIC_SUPABASE_URL');
const supabasePublishableKey =
  readServerEnvironment('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
  );
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
