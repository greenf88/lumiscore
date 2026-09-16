import {
  absoluteLumiScoreUrl,
  LUMISCORE_SITE_ORIGIN,
} from '@/lib/seo/site-origin';

export const LUMISCORE_PRODUCTION_ORIGIN = LUMISCORE_SITE_ORIGIN;
export const LUMISCORE_DEFAULT_DESCRIPTION =
  'Smart book recommendations, trusted reader ratings, and matches made for your taste.';
export const LUMISCORE_DEFAULT_IMAGE = '/og.png';

type LumiScoreMetadataProps = {
  title: string;
  description?: string;
  canonicalPath?: string;
  image?: string | null;
  noIndex?: boolean;
  type?: 'website' | 'article';
};

function absoluteUrl(value: string): string {
  return absoluteLumiScoreUrl(value);
}

/**
 * React 19 hoists these document metadata elements into <head>.
 * Vinext currently renders page titles from Next metadata but omits the other
 * fields in its production output, so this keeps the deployed HTML share-ready.
 */
export function LumiScoreMetadata({
  title,
  description = LUMISCORE_DEFAULT_DESCRIPTION,
  canonicalPath,
  image = LUMISCORE_DEFAULT_IMAGE,
  noIndex = false,
  type = 'website',
}: LumiScoreMetadataProps) {
  const canonicalUrl = canonicalPath ? absoluteUrl(canonicalPath) : null;
  const imageUrl = image ? absoluteUrl(image) : null;

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={noIndex ? 'noindex, follow' : 'index, follow'} />
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:site_name" content="LumiScore" />
      <meta property="og:type" content={type} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      {imageUrl && <meta property="og:image" content={imageUrl} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {imageUrl && <meta name="twitter:image" content={imageUrl} />}
    </>
  );
}
