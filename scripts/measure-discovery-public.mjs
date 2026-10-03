// Explicitly public read-only benchmark. No Auth, user records or privileged keys.
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { loadPublicRatingSummariesBatched } from '../lib/supabase/public-rating-summaries.ts';
import { loadWorkTraitEvidenceBatched } from '../lib/supabase/work-trait-evidence.ts';
let text = await readFile(process.argv[2], 'utf8');
const config = {};
for (const line of text.split(/\r?\n/)) {
  const m = /^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)=(.*)$/.exec(line.trim());
  if (m) config[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
}
text = '';
if (!config.NEXT_PUBLIC_SUPABASE_URL || !config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) throw new Error('Public configuration required.');
let requests = 0, bytes = 0, maxResponseBytes = 0, failures = 0;
const client = createClient(config.NEXT_PUBLIC_SUPABASE_URL, config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (init?.method && init.method !== 'GET' && !(init.method === 'POST' && path.endsWith('/rpc/get_work_rating_summaries'))) throw new Error('Write forbidden.');
    requests++;
    const response = await fetch(input, init);
    if (!response.ok) failures++;
    const length = (await response.clone().arrayBuffer()).byteLength;
    bytes += length; maxResponseBytes = Math.max(maxResponseBytes, length);
    return response;
  } },
});
for (const key of Object.keys(config)) delete config[key];
try {
  const start = performance.now();
  const columns = 'id,title,first_publish_year,open_library_id,source_type,work_type,author_id,cover_id,authors(id,name),editions(id,open_library_edition_id,isbn_13,language)';
  const first = await client.from('works').select(columns, { count: 'exact' }).order('id').range(0, 999);
  if (first.error || first.count === null) throw new Error('Public measurement failed.');
  const rest = await Promise.all(Array.from({ length: Math.max(0, Math.ceil(first.count / 1000) - 1) }, (_, i) =>
    client.from('works').select(columns).order('id').range((i + 1) * 1000, (i + 2) * 1000 - 1)));
  if (rest.some(r => r.error)) throw new Error('Public measurement failed.');
  const ids = [...first.data, ...rest.flatMap(r => r.data ?? [])].map(w => String(w.id));
  const [summaries, evidence] = await Promise.all([loadPublicRatingSummariesBatched(client, ids), loadWorkTraitEvidenceBatched(client, ids)]);
  if (failures) throw new Error('Public measurement failed.');
  console.log(JSON.stringify({ method: 'public cold recommendation-catalog loader network shape; no ranking, hydration or cache', works: ids.length,
    requests, responseBodyBytes: bytes, maxResponseBytes, wallMs: Math.round(performance.now() - start), publicSummaryWorks: summaries.size, evidenceWorks: evidence.size }));
} catch { console.error('Public read-only benchmark failed; details withheld.'); process.exitCode = 1; }
