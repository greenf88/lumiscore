export type LumiScoreServerEnvironmentName =
  | 'NEXT_PUBLIC_SUPABASE_URL'
  | 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
  | 'SUPABASE_SECRET_KEY'
  | 'SUPABASE_SERVICE_ROLE_KEY'
  | 'GOOGLE_BOOKS_API_KEY';

let didLogEnvironmentPresence = false;

/**
 * Read deployment configuration without exposing server secrets to clients.
 *
 * Vinext follows Next.js and statically substitutes direct NEXT_PUBLIC_* access
 * during a production build. Vercel server values retain direct, literal
 * process.env access so the Function runtime can inject them normally.
 */
export function readServerEnvironment(
  name: LumiScoreServerEnvironmentName,
): string | null {
  const value =
    name === 'NEXT_PUBLIC_SUPABASE_URL'
      ? process.env.NEXT_PUBLIC_SUPABASE_URL
      : name === 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
        ? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        : name === 'SUPABASE_SECRET_KEY'
          ? process.env.SUPABASE_SECRET_KEY
          : name === 'SUPABASE_SERVICE_ROLE_KEY'
            ? process.env.SUPABASE_SERVICE_ROLE_KEY
            : process.env.GOOGLE_BOOKS_API_KEY;
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
