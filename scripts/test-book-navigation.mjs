// Run against a fresh production build, not vinext dev (the regression is production-only).
// NAVIGATION_TEST_URL=http://localhost:3003; node scripts/test-book-navigation.mjs
// Optionally set NAVIGATION_BROWSER to a Chromium/Edge executable.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = process.env.NAVIGATION_TEST_URL || 'http://localhost:3003';
const executable = process.env.NAVIGATION_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const profile = await mkdtemp(join(tmpdir(), 'lumiscore-navigation-'));
const browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let launchError;
browser.on('error', error => { launchError = error; });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(check, label, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (launchError) throw launchError;
    const value = await check();
    if (value) return value;
    await pause(100);
  }
  throw new Error(`Timed out: ${label}`);
}
let socket;
let send;
try {
  const port = await waitFor(async () => {
    try { return (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; }
    catch { return null; }
  }, 'browser startup');
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
  socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  const errors = [];
  const clicks = [];
  const documents = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (pending.has(message.id)) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) request.reject(new Error(JSON.stringify(message.error))); else request.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') {
      errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    } else if (message.method === 'Runtime.bindingCalled' && message.params.name === 'reportNavigationClick') {
      clicks.push(JSON.parse(message.params.payload));
    } else if (message.method === 'Network.requestWillBeSent' && message.params.type === 'Document') {
      documents.push(message.params.request.url);
    }
  });
  send = (method, params = {}) => new Promise((resolve, reject) => {
    const messageId = ++id;
    pending.set(messageId, { resolve, reject });
    socket.send(JSON.stringify({ id: messageId, method, params }));
  });
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Runtime.addBinding', { name: 'reportNavigationClick' });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    document.addEventListener('click', event => {
      const href = event.target.closest?.('a')?.getAttribute('href');
      queueMicrotask(() => window.reportNavigationClick(JSON.stringify({href, prevented:event.defaultPrevented, trusted:event.isTrusted})));
    }, true);
  ` });
  async function home() {
    await send('Page.navigate', { url: origin });
    await waitFor(() => evaluate(`location.pathname === '/' && !!document.querySelector('.book-card-main-link')`), 'homepage catalog');
    // Wait for hydration using the actual search/button behavior in subsequent tests.
    await pause(500);
    assert.equal(await evaluate(`document.querySelectorAll('.book-card a a, .book-card a button').length`), 0);
  }
  async function pointFor(selector, empty = false) {
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);
    const measure = () => evaluate(`(() => {const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.left+${empty ? '5' : 'r.width/2'},y:r.top+${empty ? '5' : 'r.height/2'}}})()`);
    let point = await measure();
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    // Let the existing hover translation settle before mouse down/up.
    await pause(250);
    point = await measure();
    const hit = await evaluate(`document.elementFromPoint(${point.x},${point.y})?.closest('a')?.getAttribute('href') || null`);
    return { point, hit };
  }
  async function activate(selector, { empty = false, touch = false } = {}) {
    const { point, hit } = await pointFor(selector, empty);
    if (touch) {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, radiusX: 1, radiusY: 1 }] });
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1, ...point });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', buttons: 0, clickCount: 1, ...point });
    }
    return hit;
  }
  async function detail(href, title) {
    await waitFor(() => evaluate(`location.pathname === ${JSON.stringify(href)} && document.querySelector('h1')?.textContent === ${JSON.stringify(title)}`), `${href} rendered detail`);
    assert.ok(documents.some(url => new URL(url).pathname === href), 'real document navigation requested');
    assert.deepEqual(errors, [], 'no client runtime exceptions');
  }
  async function searchHeretics() {
    const mobile = await evaluate(`getComputedStyle(document.querySelector('.header-search')).display === 'none'`);
    if (mobile) await activate('.mobile-search-button');
    const input = mobile ? '.mobile-search-drawer input' : '.header-search input';
    await evaluate(`document.querySelector(${JSON.stringify(input)}).focus()`);
    await send('Input.insertText', { text: 'Heretics of Dune' });
    await waitFor(() => evaluate(`!!document.querySelector('.book-card-main-link[href="/book/311"]')`), 'real Supabase search for Heretics');
  }
  async function key(key, code, keyCode) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode });
  }
  for (const theme of ['ink', 'paper']) {
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await home();
    await evaluate(`localStorage.setItem('lumiscore-theme',${JSON.stringify(theme)})`);
    await home();
    assert.equal(await evaluate('document.documentElement.dataset.theme'), theme);
    const cards = await evaluate(`[...document.querySelectorAll('.book-card-main-link')].slice(0,2).map(a=>({href:a.getAttribute('href'),title:a.querySelector('h3').textContent}))`);
    for (const [index, card] of cards.entries()) {
      if (index) await home();
      const hit = await activate(`.book-card-main-link[href="${card.href}"] ${index ? '.book-card-body > p' : 'h3'}`);
      assert.equal(hit, card.href);
      await detail(card.href, card.title);
      console.log(`PASS ${theme}: ${index ? 'author' : 'title'} mouse click -> ${card.href} (${card.title})`);
    }
    await home();
    await searchHeretics();
    await activate('.book-card-main-link[href="/book/311"] .card-cover-wrap');
    await detail('/book/311', 'Heretics of Dune');
    console.log(`PASS ${theme}: real search + cover mouse click -> /book/311`);
    await home();
    await activate('.book-card', { empty: true });
    await detail(cards[0].href, cards[0].title);
    console.log(`PASS ${theme}: empty card margin -> ${cards[0].href}`);
    await home();
    const before = await evaluate(`document.querySelector('.want-button').getAttribute('aria-pressed')`);
    assert.equal(await activate('.want-button'), null, 'button is outside link hit area');
    await waitFor(() => evaluate(`document.querySelector('.want-button')?.getAttribute('aria-pressed') !== ${JSON.stringify(before)}`), 'Want to Read toggle');
    assert.equal(await evaluate('location.pathname'), '/');
    await evaluate(`document.querySelector('.book-card-main-link').focus()`);
    await key('Tab', 'Tab', 9);
    assert.equal(await evaluate(`document.activeElement.classList.contains('want-button')`), true);
    await evaluate(`document.querySelector('.book-card-main-link').focus()`);
    await key('Enter', 'Enter', 13);
    await detail(cards[0].href, cards[0].title);
    console.log(`PASS ${theme}: independent Want to Read, separate Tab stop, Enter navigation`);
    await home();
    await activate('.hero .primary-cta');
    await waitFor(() => evaluate(`location.hash === '#discover'`), 'Find your next book');
    console.log(`PASS ${theme}: Find your next book -> #discover`);
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true });
    await home();
    await activate('.book-card-main-link h3', { touch: true });
    await detail(cards[0].href, cards[0].title);
    await home();
    await searchHeretics();
    await activate('.book-card-main-link[href="/book/311"] .card-cover-wrap', { touch: true });
    await detail('/book/311', 'Heretics of Dune');
    console.log(`PASS ${theme}: mobile touch homepage + search cover -> detail, including /book/311`);
    await send('Emulation.setTouchEmulationEnabled', { enabled: false });
  }
  const bookClicks = clicks.filter(click => click.href?.startsWith('/book/'));
  assert.ok(bookClicks.length >= 14);
  assert.ok(bookClicks.every(click => click.trusted && !click.prevented), 'all real book clicks retain native navigation');
  assert.deepEqual(errors, []);
  console.log(`PASS ${bookClicks.length} trusted book-link clicks; none cancelled; no runtime exceptions.`);
} finally {
  if (socket?.readyState === WebSocket.OPEN && send) {
    await send('Browser.close').catch(() => {});
    socket.close();
  }
  browser.kill();
  await pause(500);
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
