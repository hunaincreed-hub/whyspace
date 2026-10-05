import test from 'node:test';
import assert from 'node:assert/strict';
import { createWindowLimiter } from './rateLimit.mjs';

test('window limiter enforces per-key limits and resets after its window', () => {
  let currentTime = 1000;
  const check = createWindowLimiter({ limit: 2, windowMs: 1000, now: () => currentTime });
  assert.equal(check('client-a').allowed, true);
  assert.equal(check('client-a').allowed, true);
  assert.deepEqual(check('client-a'), { allowed: false, retryAfterSeconds: 1 });
  assert.equal(check('client-b').allowed, true);
  currentTime = 2000;
  assert.equal(check('client-a').allowed, true);
});