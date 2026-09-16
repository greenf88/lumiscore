import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Vinext's current next/link client chunk cancels navigation before
    // throwing. Native anchors are an intentional runtime compatibility fix.
    rules: { '@next/next/no-html-link-for-pages': 'off' },
  },
  globalIgnores([
    '.next/**',
    '.vercel/**',
    'out/**',
    'build/**',
    'work/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
