import { createClient } from '@supabase/supabase-js';
import { createRepresentativeEditionAudit } from './representative-edition-plan.ts';

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseReadKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseReadKey) {
  throw new Error('Missing Supabase URL or publishable key in .env.local.');
}

const audit = await createRepresentativeEditionAudit(
  createClient(supabaseUrl, supabaseReadKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }),
);

const dune = audit.repairs.find(
  (repair) =>
    repair.workTitle === 'Dune' && repair.author === 'Frank Herbert',
);
const verbose = process.argv.includes('--verbose');

console.log(
  JSON.stringify(
    {
      catalogWorkCount: audit.catalogWorkCount,
      suspiciousRepresentativeCount: audit.suspiciousRepresentativeCount,
      repairableCount: audit.repairableCount,
      unrepairableWorkIds: audit.unrepairableWorkIds,
      dune,
      ...(verbose
        ? {
            repairs: audit.repairs.map((repair) => ({
              workId: repair.workId,
              workTitle: repair.workTitle,
              current: repair.current,
              replacement: repair.replacement,
            })),
          }
        : {}),
    },
    null,
    2,
  ),
);
