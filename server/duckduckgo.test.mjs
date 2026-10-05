import test from 'node:test';
import assert from 'node:assert/strict';
import { createDuckDuckGoSearchProvider } from './duckduckgo.mjs';

test('DuckDuckGo provider sends a bounded query to the bridge without credentials', async () => {
  let captured;
  const provider = createDuckDuckGoSearchProvider({ runBridgeImpl: async (payload, options) => {
    captured = { payload, options };
    return [{ title: 'OpenAI', href: 'https://openai.com/', body: 'Official site' }];
  } });
  const results = await provider.search('OpenAI latest news', { maxResults: 20 });
  assert.deepEqual(captured.payload, { action: 'search', query: 'OpenAI latest news', maxResults: 8 });
  assert.equal(captured.options.pythonExecutable, 'python');
  assert.equal(results[0].href, 'https://openai.com/');
  assert.equal(provider.apiKeyRequired, false);
});

test('DuckDuckGo provider queues concurrent requests sequentially', async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const provider = createDuckDuckGoSearchProvider({ runBridgeImpl: async () => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 2));
    inFlight -= 1;
    return [];
  } });
  await Promise.all([provider.search('first'), provider.search('second')]);
  assert.equal(maxInFlight, 1);
});

test('DuckDuckGo health is local-only and preserves the last blocking state', async () => {
  const provider = createDuckDuckGoSearchProvider({ runBridgeImpl: async (payload) => {
    if (payload.action === 'health') return { available: true, version: '9.16.0' };
    const error = new Error('blocked');
    error.code = 'SEARCH_BLOCKED';
    throw error;
  } });
  assert.deepEqual(await provider.healthCheck(), { status: 'ONLINE', version: '9.16.0' });
  await assert.rejects(provider.search('test'), (error) => error.code === 'SEARCH_BLOCKED');
  assert.deepEqual(await provider.healthCheck(), { status: 'OFFLINE', version: '9.16.0', code: 'SEARCH_BLOCKED', error: 'blocked' });
});