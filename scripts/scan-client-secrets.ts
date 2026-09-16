import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const SECRET_NAMES = [
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GOOGLE_BOOKS_API_KEY',
] as const;

async function filesBelow(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  }))).flat();
}

const environmentText = await readFile(resolve('.env.local'), 'utf8').catch(() => '');
const configuredSecrets = new Map<string, string>();
for (const line of environmentText.split(/\r?\n/)) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (!match || !SECRET_NAMES.includes(match[1] as typeof SECRET_NAMES[number])) continue;
  const value = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  if (value) configuredSecrets.set(match[1], value);
}

const clientFiles = await filesBelow(resolve('dist/client'));
const leakedNames = new Set<string>();
const leakedValues = new Set<string>();
for (const file of clientFiles) {
  const contents = await readFile(file);
  const text = contents.toString('utf8');
  for (const name of SECRET_NAMES) {
    if (text.includes(name)) leakedNames.add(name);
    const value = configuredSecrets.get(name);
    if (value && contents.includes(Buffer.from(value))) leakedValues.add(name);
  }
}

const result = {
  clientFilesScanned: clientFiles.length,
  configuredServerSecrets: Object.fromEntries(
    SECRET_NAMES.map((name) => [name, configuredSecrets.has(name)]),
  ),
  secretIdentifiersBundled: [...leakedNames],
  configuredSecretValuesBundled: [...leakedValues],
  passed: leakedNames.size === 0 && leakedValues.size === 0,
};
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
