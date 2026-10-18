import { absoluteLumiScoreUrl } from './site-origin.ts';

export const LUMISCORE_SITE_NAME = 'LumiScore';
export const LUMISCORE_WEBSITE_URL = absoluteLumiScoreUrl('/');
export const LUMISCORE_WEBSITE_ID = `${LUMISCORE_WEBSITE_URL}#website`;

/** One domain-level entity, shared by both language homepages and page refs. */
export function buildWebsiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': LUMISCORE_WEBSITE_ID,
    name: LUMISCORE_SITE_NAME,
    url: LUMISCORE_WEBSITE_URL,
    inLanguage: ['en', 'nl'],
  };
}

export function serializeWebsiteJsonLd(): string {
  return JSON.stringify(buildWebsiteJsonLd()).replaceAll('<', '\\u003c');
}
