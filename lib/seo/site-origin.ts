import { readServerEnvironment } from '../server-environment.ts';

export const LUMISCORE_FALLBACK_ORIGIN = 'https://lumiscore-gamma.vercel.app';

export function resolveLumiScoreSiteOrigin(value: string | null | undefined): string {
  if (!value?.trim()) return LUMISCORE_FALLBACK_ORIGIN;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return LUMISCORE_FALLBACK_ORIGIN;
    }
    if (parsed.username || parsed.password) return LUMISCORE_FALLBACK_ORIGIN;
    return parsed.origin;
  } catch {
    return LUMISCORE_FALLBACK_ORIGIN;
  }
}

export const LUMISCORE_SITE_ORIGIN = resolveLumiScoreSiteOrigin(
  readServerEnvironment('NEXT_PUBLIC_SITE_ORIGIN'),
);

export function absoluteLumiScoreUrl(path: string): string {
  return new URL(path, LUMISCORE_SITE_ORIGIN).toString();
}
