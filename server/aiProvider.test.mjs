import test from 'node:test';
import assert from 'node:assert/strict';
import { createOllamaProvider } from './aiProvider.mjs';

const jsonResponse = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => payload });

test('Ollama sends non-streaming chat with bounded context and output', async () => {
  let captured;
  const provider = createOllamaProvider({ fetchImpl: async (url, options) => {
    captured = { url: new URL(url), options, body: JSON.parse(options.body) };
    return jsonResponse({ message: { role: 'assistant', content: 'Hello from local Ollama.' }, done: true });
  } });
  const result = await provider.generate([{ role: 'user', content: 'Hello WHYspace.' }]);
  assert.equal(captured.url.href, 'http://127.0.0.1:11434/api/chat');
  assert.equal(captured.body.model, 'qwen2.5:3b');
  assert.equal(captured.body.stream, false);
  assert.deepEqual(captured.body.options, { num_ctx: 4096, num_predict: 512 });
  assert.equal(result.text, 'Hello from local Ollama.');
  assert.equal(result.provider, 'Ollama');
});

test('Ollama health distinguishes online and missing model states', async () => {
  const online = createOllamaProvider({ fetchImpl: async () => jsonResponse({ models: [{ name: 'qwen2.5:3b', model: 'qwen2.5:3b' }] }) });
  assert.deepEqual(await online.healthCheck(), { provider: 'Ollama', model: 'qwen2.5:3b', status: 'ONLINE' });
  const missing = createOllamaProvider({ fetchImpl: async () => jsonResponse({ models: [{ name: 'other:latest' }] }) });
  const health = await missing.healthCheck();
  assert.equal(health.code, 'OLLAMA_MODEL_NOT_FOUND');
  assert.match(health.message, /ollama pull qwen2\.5:3b/);
});

test('Ollama classifies missing models and generation errors', async () => {
  const missing = createOllamaProvider({ fetchImpl: async () => jsonResponse({ error: "model 'qwen2.5:3b' not found" }, 404) });
  await assert.rejects(missing.generate([{ role: 'user', content: 'Hello' }]), (error) => error.code === 'OLLAMA_MODEL_NOT_FOUND');
  const failed = createOllamaProvider({ fetchImpl: async () => jsonResponse({ error: 'internal failure' }, 500) });
  await assert.rejects(failed.generate([{ role: 'user', content: 'Hello' }]), (error) => error.code === 'OLLAMA_GENERATION_ERROR');
});

test('Ollama classifies unavailable and timed out requests', async () => {
  const offline = createOllamaProvider({ fetchImpl: async () => { throw new TypeError('fetch failed'); } });
  await assert.rejects(offline.generate([{ role: 'user', content: 'Hello' }]), (error) => error.code === 'OLLAMA_OFFLINE');
  const timeout = createOllamaProvider({ timeout: 1, fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))) });
  await assert.rejects(timeout.generate([{ role: 'user', content: 'Hello' }]), (error) => error.code === 'OLLAMA_TIMEOUT');
});