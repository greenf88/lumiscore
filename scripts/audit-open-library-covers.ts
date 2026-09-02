import { createClient } from '@supabase/supabase-js';
import { resolveOpenLibraryCoverCandidates } from '../lib/books/open-library-covers.ts';
import { SEED_BOOKS } from './open-library-seeds.ts';

type WorkRow = {
  open_library_id: string | null;
  title: string | null;
  first_publish_year: number | null;
  authors: { name?: string | null } | Array<{ name?: string | null }> | null;
};

type AuditResult = {
  workId: string;
  title: string;
  author: string;
  status: 'real-cover' | 'placeholder';
  usableUrl: string | null;
  candidateCount: number;
};

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error('Missing Supabase URL or server-side secret key.');
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function getAuthorName(row: WorkRow): string | null {
  const author = Array.isArray(row.authors) ? row.authors[0] : row.authors;
  return author?.name?.trim() || null;
}

async function isUsableCover(url: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(10_000),
        headers: {
          'User-Agent':
            'LumiScoreCoverAudit/1.0 (https://lumiscore.greenf88.chatgpt.site)',
        },
      });
      const contentType = response.headers.get('content-type') ?? '';
      if (response.ok && contentType.startsWith('image/')) return true;
      if (response.status !== 429 && response.status < 500) return false;
    } catch {
      // Retry transient cover-host failures below.
    }

    await wait(300 * 2 ** attempt);
  }

  return false;
}

async function auditWork(row: WorkRow): Promise<AuditResult> {
  const workId = row.open_library_id!;
  const title = row.title!;
  const author = getAuthorName(row)!;
  let candidates = await resolveOpenLibraryCoverCandidates({
    workId,
    title,
    author,
    firstPublishYear: row.first_publish_year,
  });

  if (candidates.length === 0) {
    await wait(500);
    candidates = await resolveOpenLibraryCoverCandidates({
      workId,
      title,
      author,
      firstPublishYear: row.first_publish_year,
    });
  }

  for (const candidate of candidates) {
    if (await isUsableCover(candidate)) {
      return {
        workId,
        title,
        author,
        status: 'real-cover',
        usableUrl: candidate,
        candidateCount: candidates.length,
      };
    }
  }

  return {
    workId,
    title,
    author,
    status: 'placeholder',
    usableUrl: null,
    candidateCount: candidates.length,
  };
}

const expectedWorkIds = SEED_BOOKS.map(
  (seed) => seed.expectedOpenLibraryWorkId!,
);
const rows: WorkRow[] = [];

for (let index = 0; index < expectedWorkIds.length; index += 100) {
  const { data, error } = await supabase
    .from('works')
    .select('open_library_id,title,first_publish_year,authors(name)')
    .in('open_library_id', expectedWorkIds.slice(index, index + 100));
  if (error) throw error;
  rows.push(...((data ?? []) as unknown as WorkRow[]));
}

const rowsByWorkId = new Map(
  rows.map((row) => [row.open_library_id?.toUpperCase(), row]),
);
const orderedRows = expectedWorkIds.map((workId) => rowsByWorkId.get(workId));
if (orderedRows.some((row) => !row)) {
  throw new Error('The Supabase catalog is missing one or more expected works.');
}
if (
  orderedRows.some(
    (row) => !row?.open_library_id || !row.title || !getAuthorName(row),
  )
) {
  throw new Error('One or more imported works lacks a title, author, or Work ID.');
}

const results: AuditResult[] = [];
let nextIndex = 0;
const workerCount = 3;

await Promise.all(
  Array.from({ length: workerCount }, async () => {
    while (nextIndex < orderedRows.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await auditWork(orderedRows[index]!);

      const completed = results.filter(Boolean).length;
      if (completed % 25 === 0 || completed === orderedRows.length) {
        console.log(`Audited ${completed}/${orderedRows.length} works…`);
      }
      await wait(125);
    }
  }),
);

const realCovers = results.filter((result) => result.status === 'real-cover');
const placeholders = results.filter((result) => result.status === 'placeholder');
const briefHistory = results.find(
  (result) => result.title === 'A Brief History of Time',
);

console.log(
  JSON.stringify(
    {
      auditedWorks: results.length,
      realOpenLibraryCovers: realCovers.length,
      lumiScorePlaceholders: placeholders.length,
      withoutUsableCover: placeholders.length,
      placeholderWorks: placeholders.map(({ workId, title, author, candidateCount }) => ({
        workId,
        title,
        author,
        candidateCount,
      })),
      aBriefHistoryOfTime: briefHistory,
    },
    null,
    2,
  ),
);

if (results.length !== 1000) process.exitCode = 1;
