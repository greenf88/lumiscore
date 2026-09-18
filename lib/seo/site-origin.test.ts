import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LUMISCORE_FALLBACK_ORIGIN,
  resolveLumiScoreSiteOrigin,
} from './site-origin.ts';

test('uses the public custom domain when no origin is configured', () => {
  assert.equal(resolveLumiScoreSiteOrigin(undefined), LUMISCORE_FALLBACK_ORIGIN);
  assert.equal(LUMISCORE_FALLBACK_ORIGIN, 'https://lumisco.re');
});

test('normalizes a future configured apex origin with one setting', () => {
  assert.equal(resolveLumiScoreSiteOrigin('https://lumisco.re/path?q=1'), 'https://lumisco.re');
});

test('rejects malformed, credentialed and non-http origins', () => {
  assert.equal(resolveLumiScoreSiteOrigin('javascript:alert(1)'), LUMISCORE_FALLBACK_ORIGIN);
  assert.equal(resolveLumiScoreSiteOrigin('https://user:pass@example.com'), LUMISCORE_FALLBACK_ORIGIN);
  assert.equal(resolveLumiScoreSiteOrigin('not a URL'), LUMISCORE_FALLBACK_ORIGIN);
});
