// Run the existing synthetic SSR adapter and its opt-in tests together.
// Loopback only; the adapter strips remote credentials and never calls production.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../../', import.meta.url));
const server = spawn(process.execPath, ['scripts/home-profile-review-local.mjs'], {
  cwd, stdio: ['ignore', 'pipe', 'inherit'],
});
let tests;
const timeout = setTimeout(() => {
  console.error('Synthetic profile SSR verification timed out.');
  process.exitCode = 1;
  tests?.kill('SIGTERM');
  server.kill('SIGTERM');
}, 90_000);
try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.once('exit', (code) => reject(new Error(`Synthetic SSR adapter exited before verification: ${code}`)));
    let output = '';
    server.stdout.on('data', (chunk) => {
      output = (output + String(chunk)).slice(-4096);
      if (output.includes('LOCAL SYNTHETIC SSR ONLY')) resolve();
    });
  });
  tests = spawn(process.execPath, ['--test', 'scripts/home-profile-server-html.test.mjs'], {
    cwd, stdio: 'inherit',
    env: { ...process.env, HOME_PROFILE_REVIEW_ORIGIN: 'http://127.0.0.1:3126' },
  });
  const code = await new Promise((resolve, reject) => {
    tests.once('error', reject);
    tests.once('exit', (code) => resolve(code ?? 1));
  });
  if (code !== 0) process.exitCode = 1;
} finally {
  clearTimeout(timeout);
  server.kill('SIGTERM');
}
