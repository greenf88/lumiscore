// Actual reviewed PostgreSQL SQL with synthetic data, never a hosted database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fixture } from '../test-support/taste-results/fixture.mjs';
test('bounded homepage ranking matches Browse across 10,134 Works and preserves privacy B', async () => {
  const db = await fixture();
  try {
    await db.exec(await readFile(new URL('../supabase/migrations/20261006173806_public_rating_privacy_b.sql',import.meta.url),'utf8'));
    for (let i=1; i<=5; i++) {
      const id='cccccccc-0000-4000-8000-'+String(i).padStart(12,'0');
      await db.query('insert into auth.users values($1)',[id]);
      for (let work=10120; work<=10134; work++)
        await db.query('insert into public.ratings(user_id,work_id,rating) values($1,$2,$3)',[id,work,work===10134?10:8]);
    }
    await db.exec('set role anon');
    const page=(await db.query("select public.catalog_discovery_page(p_sort=>'highest',p_page_size=>32) as data")).rows[0].data;
    const browse=(await db.query("select public.catalog_discovery_page(p_sort=>'highest',p_page_size=>128) as data")).rows[0].data;
    assert.equal(page.total,10134);
    assert.equal(page.workIds[0],10134);
    assert.deepEqual(page.workIds.slice(0,8),browse.workIds.slice(0,8));
    const summaries=(await db.query('select * from public.get_work_rating_summaries_v2($1::bigint[])',[page.workIds.slice(0,8)])).rows;
    assert.equal(summaries.length,8);
    assert.ok(summaries.every(row=>row.evidence_status==='available' && !('rating_count' in row)));
  } finally { await db.close(); }
});
