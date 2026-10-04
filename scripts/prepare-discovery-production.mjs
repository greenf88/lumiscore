// OFFLINE preparation only: original migration bytes and a commit-bound manifest.
// No credentials, network, database connection, seed or deployment.
import { readFile, readdir, mkdir, copyFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
export const discoveryMigration = '20261003183631_discovery_taste_rounds.sql';
export const discoveryMigrationHash = '6bad8c98bddf86b6e4e6476e092d2cbe6080132234717410c113bf97ae0de089';
export const permissionsMigration = '20261004120823_discovery_taste_state_permissions.sql';
export const permissionsMigrationHash = 'f92e248e4034a8a0325fcfc30f6b82cafc74cef66db7483d44dd1d40f183a22e';
export const releaseMigrations = [discoveryMigration, permissionsMigration];
export function validateProductionDelta(localFiles, hashes, remoteVersions) {
  const expected = Object.keys(hashes).sort();
  if (JSON.stringify([...localFiles].sort()) !== JSON.stringify(expected) || hashes[discoveryMigration] !== discoveryMigrationHash || hashes[permissionsMigration] !== permissionsMigrationHash)
    throw new Error('Reviewed migration set/hash changed.');
  const previous = expected.filter(n => !releaseMigrations.includes(n)).map(n => n.slice(0, 14));
  if (JSON.stringify(remoteVersions) !== JSON.stringify(previous)) throw new Error('Production migration baseline differs; no blind push.');
  return [...releaseMigrations];
}
export async function prepareProductionArtifacts() {
  const hashes = JSON.parse(await readFile(new URL('../test-support/discovery/migration-hashes.json', import.meta.url), 'utf8'));
  const source = new URL('../supabase/migrations/', import.meta.url);
  const files = (await readdir(source)).filter(n => n.endsWith('.sql')).sort();
  const baselineVersions = Object.keys(hashes).sort().filter(n => !releaseMigrations.includes(n)).map(n => n.slice(0, 14));
  validateProductionDelta(files, hashes, baselineVersions);
  for (const name of files) {
    const bytes = await readFile(new URL(name, source));
    if (createHash('sha256').update(bytes).digest('hex') !== hashes[name]) throw new Error('Migration bytes changed.');
    if (releaseMigrations.includes(name) && (bytes.includes(13) || bytes.subarray(0, 3).equals(Buffer.from([239, 187, 191])))) throw new Error('New migration must be UTF-8 without BOM and LF.');
  }
  const output = new URL('../outputs/discovery-production-plan/', import.meta.url);
  await mkdir(new URL('supabase/migrations/', output), { recursive: true });
  const oldFiles = await readdir(new URL('supabase/migrations/', output));
  if (oldFiles.some(n => !files.includes(n))) throw new Error('Unexpected staged file; inspect before retrying.');
  for (const name of files) await copyFile(new URL(name, source), new URL('supabase/migrations/' + name, output));
  await writeFile(new URL('supabase/config.toml', output), 'project_id = "lumiscore-pr8-production-plan"\n[db.seed]\nenabled = false\n', 'utf8');
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
  const releaseSha = git(['rev-parse', 'HEAD']);
  const manifest = { releaseSha, baseSha: '5ce044cb07eb0a5ceb3d8eceb0ed3f7f5e730aae',
    reviewedImplementationSha: '9917a7115bfc5937b6d8331da0dc8c0ae8f34dee',
    projectRef: 'qvplwejffhjvxaypmjut', baselineVersions, migrationHashes: hashes,
    expectedPending: [...releaseMigrations], seeds: [], roles: [],
    planSha256: createHash('sha256').update(await readFile(new URL('../docs/discovery-production-release-plan.md', import.meta.url))).digest('hex') };
  const bytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(new URL('release-manifest.json', output), bytes);
  return { offlineOnly: true, releaseSha, migrationFiles: files.length, expectedPending: manifest.expectedPending,
    manifestSha256: createHash('sha256').update(bytes).digest('hex'), worktreeClean: git(['status', '--porcelain']) === '', productionWrites: false };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { if (process.argv.length !== 2) throw new Error('No flags or targets accepted.'); console.log(JSON.stringify(await prepareProductionArtifacts())); }
  catch { console.error('OFFLINE PRODUCTION PLAN BLOCKED — bytes/set/plan must be reviewed.'); process.exitCode = 1; }
}
