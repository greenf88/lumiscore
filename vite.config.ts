import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import { nitro } from 'nitro/vite';
import vinext from 'vinext';
import { defineConfig, loadEnv } from 'vite';
import hostingConfig from './.openai/hosting.json';

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  '00000000-0000-4000-8000-000000000000';

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

const localBindingConfig = {
  main: 'vinext/server/app-router-entry',
  compatibility_flags: ['nodejs_compat'],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: 'site-creator-d1',
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: 'site-creator-r2',
        },
      ]
    : [],
};

export default defineConfig(async ({ mode }) => {
  const fileEnvironment = loadEnv(mode, process.cwd(), '');
  const environmentValue = (name: string) =>
    process.env[name] ?? fileEnvironment[name] ?? '';
  const isVercelBuild =
    process.env.VERCEL === '1' || process.env.NITRO_PRESET === 'vercel';
  const publicSupabaseUrl = environmentValue('NEXT_PUBLIC_SUPABASE_URL');
  const publicSupabasePublishableKey = environmentValue(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  );
  const vercelEnvironmentPresence = {
    NEXT_PUBLIC_SUPABASE_URL_configured: Boolean(publicSupabaseUrl),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY_configured: Boolean(
      publicSupabasePublishableKey,
    ),
    SUPABASE_SECRET_KEY_configured: Boolean(
      environmentValue('SUPABASE_SECRET_KEY') ||
        environmentValue('SUPABASE_SERVICE_ROLE_KEY'),
    ),
    GOOGLE_BOOKS_API_KEY_configured: Boolean(
      environmentValue('GOOGLE_BOOKS_API_KEY'),
    ),
  };

  if (isVercelBuild) {
    console.info(
      '[LumiScore Vercel build environment]',
      vercelEnvironmentPresence,
    );
  }

  if (
    isVercelBuild &&
    process.env.VERCEL_ENV === 'production' &&
    (!publicSupabaseUrl || !publicSupabasePublishableKey)
  ) {
    throw new Error(
      '[LumiScore Vercel build] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Production cannot be built with the demo fallback.',
    );
  }

  const runtimeBindingConfig = {
    ...localBindingConfig,
    vars: {
      NEXT_PUBLIC_SUPABASE_URL: publicSupabaseUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicSupabasePublishableKey,
      SUPABASE_SECRET_KEY: environmentValue('SUPABASE_SECRET_KEY'),
      GOOGLE_BOOKS_API_KEY: environmentValue('GOOGLE_BOOKS_API_KEY'),
    },
  };

  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import('@cloudflare/vite-plugin');

  return {
    // NEXT_PUBLIC_* follows Next/Vinext semantics: public values are embedded
    // at build time. Server secrets are deliberately absent from this block.
    define: {
      'process.env.NEXT_PUBLIC_SUPABASE_URL':
        JSON.stringify(publicSupabaseUrl),
      'process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(
        publicSupabasePublishableKey,
      ),
    },
    css: { postcss: { plugins: [tailwindcss()] } },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: isVercelBuild
      ? [vinext(), nitro()]
      : [
          vinext(),
          sites(),
          cloudflare({
            viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
            config: runtimeBindingConfig,
          }),
        ],
  };
});
