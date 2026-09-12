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
  const runtimeBindingConfig = {
    ...localBindingConfig,
    vars: {
      NEXT_PUBLIC_SUPABASE_URL: environmentValue('NEXT_PUBLIC_SUPABASE_URL'),
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: environmentValue(
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      ),
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
    // Nitro/Vercel supplies project environment variables to the server
    // function at runtime. Compiling these two values into the server bundle
    // would permanently bake in an empty string when the custom build cannot
    // see them, even though they are available to the deployed function.
    // Cloudflare Workers still need their public values compiled for client
    // code and receive all server values through runtime bindings below.
    define: isVercelBuild
      ? undefined
      : {
          'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(
            environmentValue('NEXT_PUBLIC_SUPABASE_URL'),
          ),
          'process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(
            environmentValue('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
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
