import type { Metadata } from 'next';
import { absoluteLumiScoreUrl } from './site-origin.ts';

export const LUMISCORE_DEFAULT_DESCRIPTION =
  'Smart book recommendations, trusted reader ratings, and matches made for your taste.';
export const LUMISCORE_DEFAULT_IMAGE = '/og.jpg';

/** One owner: Next/Vinext's Metadata API. Do not also render metadata in JSX. */
export function createPageMetadata({
  title,
  description = LUMISCORE_DEFAULT_DESCRIPTION,
  canonicalPath,
  image = LUMISCORE_DEFAULT_IMAGE,
  noIndex = false,
  follow = true,
  type = 'website',
}: {
  title: string;
  description?: string;
  canonicalPath: string;
  image?: string | null;
  noIndex?: boolean;
  follow?: boolean;
  type?: 'website' | 'article';
}) {
  const url = absoluteLumiScoreUrl(canonicalPath);
  const images = image ? [{ url: absoluteLumiScoreUrl(image),
    ...(image === LUMISCORE_DEFAULT_IMAGE ? { width: 1664, height: 936, alt: title } : {}) }] : [];
  return {
    title, description,
    alternates: { canonical: url },
    robots: { index: !noIndex, follow },
    openGraph: { title, description, url, siteName: 'LumiScore', type, images },
    twitter: { card: 'summary_large_image', title, description, images: images.map(({ url }) => url) },
  } satisfies Metadata;
}

/** Index only the genuinely clean URL, not a normalized navigation return path. */
export function browseHasQuery(searchParams: Record<string, string | string[] | undefined>): boolean {
  return Object.values(searchParams).some((value) => value !== undefined);
}
