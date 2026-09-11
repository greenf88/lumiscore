import { createClient } from '@supabase/supabase-js';
import {
  createRepresentativeEditionAudit,
  repairPayload,
} from './representative-edition-plan.ts';

if (!process.argv.includes('--apply')) {
  throw new Error(
    'Refusing to write without --apply. Run the read-only audit first: pnpm audit:representative-editions',
  );
}

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error('Missing Supabase URL or secret key in .env.local.');
}

const client = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const audit = await createRepresentativeEditionAudit(client);

let updatedCount = 0;
for (const repair of audit.repairs) {
  let update = client
    .from('editions')
    .update(repairPayload(repair))
    .eq('id', repair.editionRowId);
  update = repair.current.openLibraryEditionId
    ? update.eq(
        'open_library_edition_id',
        repair.current.openLibraryEditionId,
      )
    : update.is('open_library_edition_id', null);
  const result = await update.select('id');
  if (result.error) throw result.error;
  updatedCount += result.data?.length ?? 0;
}

console.log(
  `Updated ${updatedCount} representative edition row${
    updatedCount === 1 ? '' : 's'
  } idempotently.`,
);
