export type GoogleBooksFailureCategory =
  | 'daily_quota_exceeded'
  | 'rate_limited'
  | 'api_disabled'
  | 'invalid_api_key'
  | 'key_restriction'
  | 'authorization_denied'
  | 'upstream_unavailable'
  | 'upstream_error';

/** Only fixed categories escape this boundary; provider messages can contain secrets. */
export async function classifyGoogleBooksFailure(
  response: Response,
): Promise<GoogleBooksFailureCategory> {
  let payload: unknown;
  try { payload = await response.json(); } catch { /* Empty/non-JSON failures are valid. */ }
  const error = payload && typeof payload === 'object' && 'error' in payload
    ? payload.error : null;
  const fields = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const details = Array.isArray(fields.details) ? fields.details : [];
  const errors = Array.isArray(fields.errors) ? fields.errors : [];
  const reasons = [...details, ...errors].flatMap((value: unknown) =>
    value && typeof value === 'object' && 'reason' in value && typeof value.reason === 'string'
      ? [value.reason] : []);
  const rateLimited = response.status === 429
    || reasons.some(reason => ['RATE_LIMIT_EXCEEDED', 'RESOURCE_QUOTA_EXCEEDED',
      'rateLimitExceeded', 'dailyLimitExceeded', 'quotaExceeded'].includes(reason));
  const dailyQuota = reasons.includes('dailyLimitExceeded') || details.some((value: unknown) => {
    if (!value || typeof value !== 'object' || !('metadata' in value)) return false;
    const metadata = value.metadata;
    return metadata && typeof metadata === 'object' && 'quota_limit' in metadata
      && typeof metadata.quota_limit === 'string' && /perday/i.test(metadata.quota_limit);
  });
  if (rateLimited) return dailyQuota ? 'daily_quota_exceeded' : 'rate_limited';
  if (reasons.some(reason => ['SERVICE_DISABLED', 'accessNotConfigured'].includes(reason))) return 'api_disabled';
  if (reasons.some(reason => ['API_KEY_INVALID', 'API_KEY_EXPIRED', 'API_KEY_NOT_FOUND', 'keyInvalid'].includes(reason))) return 'invalid_api_key';
  if (reasons.some(reason => /^API_KEY_(SERVICE|HTTP_REFERRER|IP_ADDRESS|ANDROID_APP|IOS_APP)_BLOCKED$/.test(reason))) return 'key_restriction';
  if (response.status === 401 || response.status === 403) return 'authorization_denied';
  return response.status >= 500 ? 'upstream_unavailable' : 'upstream_error';
}

/** Honor provider delays, bounded to one day; never retry throttling sooner than five minutes. */
export function googleBooksBackoffMs(retryAfter: string | null, now = Date.now()): number {
  const minimum = 5 * 60 * 1_000;
  if (!retryAfter?.trim()) return minimum;
  const value = retryAfter.trim();
  const delay = /^\d+$/.test(value) ? Number(value) * 1_000 : Date.parse(value) - now;
  return Number.isFinite(delay) ? Math.min(24 * 60 * 60 * 1_000, Math.max(minimum, delay)) : minimum;
}
