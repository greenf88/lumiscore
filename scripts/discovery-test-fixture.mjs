// No credentials or environment access. Caller must enforce a disposable target.
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const support = new URL('../test-support/discovery/', import.meta.url);
const migrations = new URL('../supabase/migrations/', import.meta.url);
export const FIXTURE_ID = 'lumiscore-pr8-synthetic-v1';
export async function reviewedFixtureInputs() {
  const hashes = JSON.parse(await readFile(new URL('migration-hashes.json', support), 'utf8'));
  const names = (await readdir(migrations)).filter(x => x.endsWith('.sql')).sort();
  if (JSON.stringify(names) !== JSON.stringify(Object.keys(hashes).sort())) throw new Error('Migration set changed; review required.');
  const files = [];
  for (const name of names) {
    const bytes = await readFile(new URL(name, migrations));
    if (createHash('sha256').update(bytes).digest('hex') !== hashes[name]) throw new Error('Migration bytes changed; review required.');
    files.push({ name, sql: bytes.toString('utf8') });
  }
  const categories = JSON.parse(await readFile(new URL('../lib/catalog/categories.json', import.meta.url), 'utf8')).categories;
  const inputs={files,categories,bootstrap:await readFile(new URL('bootstrap.sql', support),'utf8'),seed:await readFile(new URL('seed.sql', support),'utf8')};
  const prerequisites=fixturePrerequisites(inputs);
  assertReviewedArtifacts({
    '00-bootstrap.sql':inputs.bootstrap,'02-placeholder-works.sql':prerequisites.placeholders,
    '04-collection-prerequisites.sql':prerequisites.collections,'06-categories-and-seed.sql':prerequisites.categories+'\n'+inputs.seed,
  },JSON.parse(await readFile(new URL('artifact-hashes.json',support),'utf8')));
  return inputs;
}
export function assertReviewedArtifacts(artifacts, hashes) {
  if(JSON.stringify(Object.keys(artifacts).sort())!==JSON.stringify(Object.keys(hashes).sort())) throw new Error('Synthetic artifact set changed; review required.');
  for(const [name,sql] of Object.entries(artifacts)) if(createHash('sha256').update(sql).digest('hex')!==hashes[name]) throw new Error('Synthetic artifact bytes changed; review required.');
}
export function fixturePrerequisites(inputs) {
  const membership = inputs.files.find(f => f.name === '20260916071439_collections_v1.sql').sql;
  const members = membership.match(/with seed_membership[\s\S]*?values([\s\S]*?)\)\s*insert/)[1];
  const ids = [...new Set([...members.matchAll(/\('[^']+', (\d+),/g)].map(r => Number(r[1])))];
  if (ids.length !== 84) throw new Error('Reviewed collection membership prerequisite changed.');
  const totals = inputs.files.find(f => f.name === '20260917180127_add_collection_expected_main_series_total.sql').sql;
  const values = totals.match(/\nvalues\n([\s\S]*?);/)[1];
  const rows = [...values.matchAll(/\('((?:[^']|'')*)', '((?:[^']|'')*)', (\d+)\)/g)];
  if (rows.length !== 43) throw new Error('Reviewed collection prerequisite changed.');
  const literal = value => "'"+value.replaceAll("'","''")+"'";
  return {
    placeholders: `insert into public.works(id,title,source_type,work_type,native_identity_key) values ${ids.map(id => `(${id},'Synthetic migration placeholder ${id}','lumiscore_native','novel','pr8-migration-placeholder-${id}')`).join(',')};`,
    collections: `insert into public.collections(slug,name,collection_type) values ${rows.map(r => `('${r[1]}','${r[2]}','series')`).join(',')} on conflict(slug) do nothing;`,
    categories: `insert into public.catalog_categories(id,label_nl,label_en) values ${inputs.categories.map(c=>`(${literal(c.id)},${literal(c.nl)},${literal(c.en)})`).join(',')};`,
  };
}
export async function setupDiscoveryFixture(db) {
  const inputs = await reviewedFixtureInputs(); // Validate everything BEFORE any writes.
  const prerequisites = fixturePrerequisites(inputs);
  if ((await db.query("select to_regclass('public.works') is not null as exists")).rows[0].exists) throw new Error('Fresh empty test schema required; use isolated local reset.');
  if (Number((await db.query('select count(*) as n from auth.users')).rows[0].n)) throw new Error('Fresh empty test Auth required.');
  await db.exec(inputs.bootstrap);
  for (const file of inputs.files) {
    if (file.name === '20260916071439_collections_v1.sql') {
      // Synthetic placeholders satisfy historical FK IDs, not real book identities.
      // No Editions/evidence: they cannot enter NL/EN taste rounds or recommendations.
      await db.exec(prerequisites.placeholders);
    }
    if (file.name === '20260917180127_add_collection_expected_main_series_total.sql') {
      // This baseline migration intentionally requires 43 existing public series.
      // Reuse only its reviewed public definitions, not a production database export.
      await db.exec(prerequisites.collections);
    }
    await db.exec(file.sql);
  }
  await db.exec(prerequisites.categories);
  await db.exec(inputs.seed);
}
export function assertLocalTarget(status) {
  const api = new URL(status.API_URL), db = new URL(status.DB_URL);
  if (api.href !== 'http://127.0.0.1:55431/' || api.username || api.password || api.search || api.hash ||
    !['postgres:','postgresql:'].includes(db.protocol) || db.hostname !== '127.0.0.1' || db.port !== '55432' || db.pathname !== '/postgres' || db.search || db.hash ||
    !status.ANON_KEY || !status.SERVICE_ROLE_KEY) throw new Error('Exact isolated loopback test target required.');
  for (const [key, role] of [['ANON_KEY','anon'],['SERVICE_ROLE_KEY','service_role']]) {
    const claims = JSON.parse(Buffer.from(status[key].split('.')[1], 'base64url').toString());
    if (claims.role !== role || (claims.ref && claims.ref !== 'lumiscore-pr8-discovery') || claims.iss !== 'supabase-demo') throw new Error('Local key identity mismatch.');
  }
  return true;
}
