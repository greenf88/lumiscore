import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readServerEnvironment } from '../server-environment.ts';
import type {
  CoverResolutionState,
  CoverSource,
  CoverSourceResolution,
} from '../books/cover-resolution-result.ts';

export type StoredCoverResolution = {
  workId: string;
  source: CoverSource;
  coverUrl: string | null;
  sourceKey: string;
  state: CoverResolutionState;
  verifiedAt: string | null;
  checkedAt: string;
  retryAfter: string | null;
};

const SUCCESS_FRESH_MS = 90 * 24 * 60 * 60 * 1_000;
const CONFIRMED_MISSING_FRESH_MS = 24 * 60 * 60 * 1_000;
const TEMPORARY_FAILURE_RETRY_MS = 5 * 60 * 1_000;
let client: SupabaseClient | null | undefined;

function getCoverCacheClient(): SupabaseClient | null {
  if (client !== undefined) return client;

  const url = readServerEnvironment('NEXT_PUBLIC_SUPABASE_URL');
  const secret = (
    readServerEnvironment('SUPABASE_SECRET_KEY') ??
    readServerEnvironment('SUPABASE_SERVICE_ROLE_KEY')
  );
  client =
    url && secret
      ? createClient(url, secret, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : null;
  return client;
}

function toStoredCoverResolution(
  row: Record<string, unknown>,
): StoredCoverResolution | null {
  const source = row.source;
  const state = row.state;
  if (
    (source !== 'open_library' && source !== 'google_books') ||
    (state !== 'resolved' &&
      state !== 'confirmed_missing' &&
      state !== 'temporary_failure')
  ) {
    return null;
  }

  return {
    workId: String(row.work_id),
    source,
    coverUrl: typeof row.cover_url === 'string' ? row.cover_url : null,
    sourceKey: String(row.source_key),
    state,
    verifiedAt:
      typeof row.verified_at === 'string' ? row.verified_at : null,
    checkedAt: String(row.checked_at),
    retryAfter: typeof row.retry_after === 'string' ? row.retry_after : null,
  };
}

export function shouldRefreshStoredCover(
  entry: StoredCoverResolution,
  sourceKey: string,
  now = Date.now(),
): boolean {
  if (entry.sourceKey !== sourceKey) return true;
  if (entry.state === 'temporary_failure' && entry.retryAfter) {
    const retryAfter = Date.parse(entry.retryAfter);
    return !Number.isFinite(retryAfter) || now >= retryAfter;
  }
  if (entry.coverUrl && entry.verifiedAt) {
    const verifiedAt = Date.parse(entry.verifiedAt);
    return (
      !Number.isFinite(verifiedAt) || now - verifiedAt >= SUCCESS_FRESH_MS
    );
  }
  const checkedAt = Date.parse(entry.checkedAt);
  return (
    !Number.isFinite(checkedAt) ||
    now - checkedAt >= CONFIRMED_MISSING_FRESH_MS
  );
}

export function mergeStoredCoverResolution(
  workId: string,
  existing: StoredCoverResolution | undefined,
  incoming: CoverSourceResolution,
  now = new Date(),
): StoredCoverResolution {
  const sameLookup = existing?.sourceKey === incoming.sourceKey;
  const keepLastKnownGood =
    incoming.state !== 'resolved' && sameLookup ? existing.coverUrl : null;
  const checkedAt = now.toISOString();

  return {
    workId,
    source: incoming.source,
    sourceKey: incoming.sourceKey,
    state: incoming.state,
    coverUrl: incoming.coverUrl ?? keepLastKnownGood ?? null,
    verifiedAt:
      incoming.state === 'resolved'
        ? checkedAt
        : sameLookup
          ? (existing.verifiedAt ?? null)
          : null,
    checkedAt,
    retryAfter:
      incoming.state === 'temporary_failure'
        ? new Date(now.getTime() + TEMPORARY_FAILURE_RETRY_MS).toISOString()
        : null,
  };
}

export async function loadStoredCoverResolutions(
  workId: string,
): Promise<{ available: boolean; entries: StoredCoverResolution[] }> {
  const coverCacheClient = getCoverCacheClient();
  if (!coverCacheClient) return { available: false, entries: [] };

  const { data, error } = await coverCacheClient
    .from('work_cover_resolutions')
    .select(
      'work_id,source,cover_url,source_key,state,verified_at,checked_at,retry_after',
    )
    .eq('work_id', workId);
  if (error) return { available: false, entries: [] };

  return {
    available: true,
    entries: (data ?? [])
      .map((row) => toStoredCoverResolution(row))
      .filter((row): row is StoredCoverResolution => Boolean(row)),
  };
}

export async function saveStoredCoverResolutions(
  entries: readonly StoredCoverResolution[],
): Promise<boolean> {
  const coverCacheClient = getCoverCacheClient();
  if (!coverCacheClient || entries.length === 0) return false;

  const { error } = await coverCacheClient.from('work_cover_resolutions').upsert(
    entries.map((entry) => ({
      work_id: entry.workId,
      source: entry.source,
      cover_url: entry.coverUrl,
      source_key: entry.sourceKey,
      state: entry.state,
      verified_at: entry.verifiedAt,
      checked_at: entry.checkedAt,
      retry_after: entry.retryAfter,
    })),
    { onConflict: 'work_id,source' },
  );
  return !error;
}

export function clearCoverResolutionClientForTests(): void {
  client = undefined;
}
