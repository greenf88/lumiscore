import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Resolve Metadata API output in the original head for every user agent.
  // Page Suspense boundaries still stream optional content independently.
  htmlLimitedBots: /.*/,
};

export default nextConfig;
