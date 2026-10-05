import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatController } from './chatController.js';

const installStorage = (t) => {
  const original = globalThis.localStorage;
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key)
  };
  t.after(() => {
    if (original === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = original;
  });
};

test('stable prompt uses the existing model path without requesting web search', async (t) => {
  installStorage(t);
  let requestOptions;
  const controller = new ChatController({ modelProvider: {
    model: 'test-model',
    generateResponse: async (_messages, options) => {
      requestOptions = options;
      return { ok: true, text: 'Photosynthesis converts light into chemical energy.', model: 'test-model', sources: [] };
    }
  } });
  const result = await controller.sendMessage('Explain photosynthesis.');
  assert.equal(result.ok, true);
  assert.equal(result.text, 'Photosynthesis converts light into chemical energy.');
  assert.equal(requestOptions.searchWeb, false);
});

test('explicit search passes the preference and retains returned sources with the answer', async (t) => {
  installStorage(t);
  const source = { title: 'Official release', url: 'https://openai.com/index/release', publisher: 'openai.com', publishedAt: null, snippet: 'Release excerpt', relevance: { providerRank: 1 } };
  let requestOptions;
  const controller = new ChatController({ modelProvider: {
    model: 'test-model',
    generateResponse: async (_messages, options) => {
      requestOptions = options;
      return { ok: true, text: 'OpenAI announced a release [1].', model: 'test-model', research: { status: 'SEARCH_SUCCESS', attempted: true, available: true }, sources: [source] };
    }
  } });
  const result = await controller.sendMessage('Explain Newton\'s second law.', { searchWeb: true });
  assert.equal(result.ok, true);
  assert.equal(requestOptions.searchWeb, true);
  assert.deepEqual(result.sources, [source]);
  assert.deepEqual(controller.history.at(-1).sources, [source]);
});