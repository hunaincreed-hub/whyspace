export class AIProviderError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.name = 'AIProviderError';
    this.code = code;
    this.status = status;
  }
}

const createTimedRequest = async (fetchImpl, url, options, timeout) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const abortRequest = () => controller.abort();
  options.signal?.addEventListener('abort', abortRequest, { once: true });
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted && !options.signal?.aborted) {
      throw new AIProviderError('OLLAMA_TIMEOUT', 'Local AI took too long to respond. Try again or reduce the prompt length.', 504);
    }
    if (options.signal?.aborted) {
      throw new AIProviderError('OLLAMA_GENERATION_ERROR', 'The local AI request was cancelled.', 499);
    }
    throw new AIProviderError('OLLAMA_OFFLINE', 'Local AI is unavailable. Start Ollama and make sure it is listening on the configured endpoint.', 503);
  } finally {
    clearTimeout(timeoutId);
    options.signal?.removeEventListener('abort', abortRequest);
  }
};

const readJson = async (response) => {
  try {
    return await response.json();
  } catch {
    throw new AIProviderError('OLLAMA_GENERATION_ERROR', 'Ollama returned an invalid response. Check the local Ollama service.', 502);
  }
};

const isModelMissing = (response, payload) => response.status === 404 || /model.+not found|pull model/i.test(String(payload?.error || ''));

const modelMissingError = (model) => new AIProviderError(
  'OLLAMA_MODEL_NOT_FOUND',
  `Model ${model} is not installed. Run: ollama pull ${model}`,
  503
);

export const createOllamaProvider = ({
  baseUrl = 'http://127.0.0.1:11434',
  model = 'qwen2.5:3b',
  fetchImpl = fetch,
  timeout = 120_000,
  healthTimeout = 4_000,
  numCtx = 4096,
  numPredict = 512
} = {}) => {
  const endpoint = new URL(baseUrl);
  endpoint.pathname = endpoint.pathname.replace(/\/$/, '');
  const apiUrl = (path) => new URL(path, `${endpoint.href.replace(/\/$/, '')}/`);

  const healthCheck = async () => {
    try {
      const response = await createTimedRequest(fetchImpl, apiUrl('/api/tags'), { method: 'GET' }, healthTimeout);
      if (!response.ok) return { provider: 'Ollama', model, status: 'OFFLINE', code: 'OLLAMA_OFFLINE', message: 'Start Ollama and make sure it is listening on the configured endpoint.' };
      const payload = await readJson(response);
      const installed = Array.isArray(payload?.models) && payload.models.some((entry) => entry?.name === model || entry?.model === model);
      if (!installed) return { provider: 'Ollama', model, status: 'OFFLINE', code: 'OLLAMA_MODEL_NOT_FOUND', message: `Model ${model} is not installed. Run: ollama pull ${model}` };
      return { provider: 'Ollama', model, status: 'ONLINE' };
    } catch (error) {
      return { provider: 'Ollama', model, status: 'OFFLINE', code: error.code || 'OLLAMA_OFFLINE', message: error.message };
    }
  };

  const generate = async (messages, { signal } = {}) => {
    const response = await createTimedRequest(fetchImpl, apiUrl('/api/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: { num_ctx: numCtx, num_predict: numPredict }
      }),
      signal
    }, timeout);
    const payload = await readJson(response);
    if (isModelMissing(response, payload)) throw modelMissingError(model);
    if (!response.ok || payload?.error) {
      throw new AIProviderError('OLLAMA_GENERATION_ERROR', 'Ollama could not generate a response. Check the local model and Ollama logs.', 502);
    }
    const text = payload?.message?.content?.trim();
    if (!text) throw new AIProviderError('OLLAMA_GENERATION_ERROR', 'Ollama returned an empty response.', 502);
    return { text, model, provider: 'Ollama', streaming: false };
  };

  return { name: 'Ollama', model, baseUrl: endpoint.origin, generate, healthCheck };
};