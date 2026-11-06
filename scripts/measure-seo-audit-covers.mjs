// Paired mobile Lighthouse lab. Start from the committed checkout and two
// externally fetched, verified image files; this script only uses loopback.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { resolve as absolutePath } from 'node:path';

const [lighthouse, directory] = process.argv.slice(2);
assert(lighthouse && directory && process.env.CHROME_PATH, 'usage: set CHROME_PATH and run node script <Lighthouse CLI> <evidence directory>');
const external = await readFile(directory + '/project-hail-mary-L.jpg');
const normal = await readFile(directory + '/normal.jpg');
const assetServer = createServer((req, res) => {
  if (req.url === '/external.jpg' || req.url === '/normal.jpg') {
    const bytes = req.url === '/external.jpg' ? external : normal;
    const send = () => res.writeHead(200, { 'content-type': 'image/jpeg', 'content-length': bytes.length }).end(bytes);
    if (req.url === '/external.jpg') setTimeout(send, 250);
    else send();
  } else res.writeHead(404).end();
});
await new Promise(resolve => assetServer.listen(0, '127.0.0.1', resolve));
const assets = 'http://127.0.0.1:' + assetServer.address().port;
const baseline = spawn(process.execPath, ['scripts/seo-critical-local.mjs', '--port=4341', '--audit-cover-lab', '--audit-cover-baseline', '--assets-origin=' + assets], { stdio: 'inherit', windowsHide: true });
const candidate = spawn(process.execPath, ['scripts/seo-critical-local.mjs', '--port=4342', '--audit-cover-lab', '--assets-origin=' + assets], { stdio: 'inherit', windowsHide: true });
try {
  for (const port of [4341, 4342]) for (const path of ['/en/book/1', '/nl/book/3', '/en/book/2']) {
    let response;
    for (let attempt = 0; attempt < 30 && !response; attempt++) {
      try { response = await fetch('http://127.0.0.1:' + port + path); } catch { await new Promise(resolve => setTimeout(resolve, 1000)); }
    }
    assert.equal(response?.status, 200);
    const html = await response.text();
    assert.equal(html.includes('fetchPriority="high"') || html.includes('fetchpriority="high"'), port === 4342 && !path.endsWith('/2'), path);
  }
  await mkdir(directory + '/lighthouse', { recursive: true });
  for (const [scenario, path] of [['external','/en/book/1'], ['normal','/nl/book/3'], ['fallback','/en/book/2']]) {
    for (let repeat = 1; repeat <= 3; repeat++) for (const [arm, port] of (repeat % 2 ? [['base',4341],['candidate',4342]] : [['candidate',4342],['base',4341]])) {
      const out = directory + '/lighthouse/' + scenario + '-' + arm + '-' + repeat + '.json';
      console.log(scenario, arm, repeat);
      const profile = absolutePath(directory, 'lighthouse', 'profile-' + scenario + '-' + arm + '-' + repeat);
      const chrome = spawn(process.env.CHROME_PATH, ['--headless','--disable-gpu','--no-first-run','--remote-debugging-port=9343','--user-data-dir='+profile,'about:blank'], {stdio:'ignore',windowsHide:true});
      try {
        let ready = false;
        for (let attempt = 0; attempt < 25 && !ready; attempt++) {
          try { ready = (await fetch('http://127.0.0.1:9343/json/version')).ok; } catch { await new Promise(resolve => setTimeout(resolve, 400)); }
        }
        assert(ready, 'Headless browser debugging port unavailable');
        const processRun = spawn(process.execPath, [lighthouse, 'http://127.0.0.1:' + port + path, '--port=9343', '--quiet', '--only-categories=performance', '--output=json', '--output-path=' + out], { stdio: 'inherit', windowsHide: true });
        await new Promise((resolve, reject) => { processRun.once('error', reject); processRun.once('exit', code => code === 0 ? resolve() : reject(Error('Lighthouse exit ' + code))); });
      } finally {
        if (chrome.exitCode === null) {
          chrome.kill();
          await new Promise(resolve => chrome.once('exit', resolve));
        }
      }
      const report = JSON.parse(await readFile(out, 'utf8'));
      assert(!report.runtimeError, JSON.stringify(report.runtimeError));
      assert(Number.isFinite(report.audits['largest-contentful-paint']?.numericValue), out);
    }
  }
} finally {
  baseline.kill();
  candidate.kill();
  assetServer.close();
}
