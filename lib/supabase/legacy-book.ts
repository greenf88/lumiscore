import type { SupabaseClient } from '@supabase/supabase-js';
import type { StrictEditionRow } from '../books/strict-edition.ts';
import { getBookLocales } from '../seo/book-locales.ts';
import type { LegacyBook } from '../seo/legacy-book-route.ts';
import { EDITION_PRESENTATION_SELECT, loadEditionRows } from './edition-rows.ts';

const EMBEDDED_EDITION_LIMIT = 1_000;
const SELECT = `id,title,editions!editions_work_id_fkey(${EDITION_PRESENTATION_SELECT})`;

export async function loadLegacyBook(client: SupabaseClient, workId: string): Promise<LegacyBook | null> {
  const signal = AbortSignal.timeout(5_000);
  const { data, error } = await client.from('works').select(SELECT).eq('id', workId)
    .limit(EMBEDDED_EDITION_LIMIT, { referencedTable: 'editions' }).abortSignal(signal).maybeSingle();
  if (error) throw error;
  if (data === null) return null;
  if (!data || String(data.id) !== workId || !Array.isArray(data.editions)) {
    throw new Error('Book edition eligibility unavailable.');
  }

  // A full embedded page is not proof that all editions were read.
  const editions = data.editions.length < EMBEDDED_EDITION_LIMIT
    ? data.editions as StrictEditionRow[]
    : await loadEditionRows(client, [workId], signal);
  return { title: data.title, locales: getBookLocales(workId, data.title?.trim() ?? '', editions) };
}
