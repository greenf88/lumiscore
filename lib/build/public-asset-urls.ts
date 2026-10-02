import type { Plugin } from 'vite';

// Vinext's deployment-ID URL renderer prefixes public files as if they were
// bundled assets. Nitro serves public/ from the origin root, not _next/static.
// Preserve Vinext's hashed-asset/skew-protection behavior for everything else.
export function publicAssetUrls(): Plugin {
  return {
    name: 'lumiscore-public-asset-urls',
    enforce: 'post',
    configResolved(config) {
      const original = config.experimental.renderBuiltUrl;
      config.experimental.renderBuiltUrl = (filename, context) =>
        context.type === 'public'
          ? `/${filename}`
          : original?.(filename, context);
    },
  };
}
