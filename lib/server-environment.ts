export type LumiScoreServerEnvironmentName =
  | 'NEXT_PUBLIC_SUPABASE_URL'
  | 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
  | 'SUPABASE_SECRET_KEY'
  | 'SUPABASE_SERVICE_ROLE_KEY'
  | 'GOOGLE_BOOKS_API_KEY';

let didLogEnvironmentPresence = false;

/**
 * Read deployment configuration at server runtime.
 *
 * Vinext follows Next.js and statically substitutes direct
 * `process.env.NEXT_PUBLIC_*` access during a production build. Using a
 * dynamic property read keeps Vercel Function environment variables available
 * when the custom Vite build itself cannot see their values.
 */
export function readServerEnvironment(
  name: LumiScoreServerEnvironmentName,
): string | null {
  const value = Reflect.get(process.env, name);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Log configuration presence once without ever including configuration values. */
export function logServerEnvironmentPresence(): void {
  if (didLogEnvironmentPresence || process.env.NODE_ENV !== 'production') return;
  didLogEnvironmentPresence = true;

  console.info('[LumiScore environment]', {
    NEXT_PUBLIC_SUPABASE_URL_configured: Boolean(
      readServerEnvironment('NEXT_PUBLIC_SUPABASE_URL'),
    ),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY_configured: Boolean(
      readServerEnvironment('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    ),
    SUPABASE_SECRET_KEY_configured: Boolean(
      readServerEnvironment('SUPABASE_SECRET_KEY') ??
        readServerEnvironment('SUPABASE_SERVICE_ROLE_KEY'),
    ),
    GOOGLE_BOOKS_API_KEY_configured: Boolean(
      readServerEnvironment('GOOGLE_BOOKS_API_KEY'),
    ),
  });
}
