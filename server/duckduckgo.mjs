import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SearchProviderError } from './research.mjs';

const bridgePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ddgs_bridge.py');

const runBridge = (payload, { pythonExecutable, timeout, signal }) => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(new SearchProviderError('SEARCH_PROVIDER_ERROR', 'The search request was cancelled.', 499));
    return;
  }

  const child = spawn(pythonExecutable, [bridgePath], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
  let stdout = '';
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    child.kill();
  }, timeout);
  const abortRequest = () => child.kill();
  signal?.addEventListener('abort', abortRequest, { once: true });

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
    if (stdout.length > 300_000) child.kill();
  });
  child.on('error', (error) => {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortRequest);
    reject(error.code === 'ENOENT'
      ? new SearchProviderError('SEARCH_PROVIDER_ERROR', 'Python 3.10+ is required for web search. Install dependencies with pip install -r requirements.txt.', 503)
      : new SearchProviderError('SEARCH_PROVIDER_ERROR', 'The DuckDuckGo search worker could not start.', 502));
  });
  child.on('close', (exitCode) => {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortRequest);
    if (signal?.aborted) {
      reject(new SearchProviderError('SEARCH_PROVIDER_ERROR', 'The search request was cancelled.', 499));
      return;
    }
    if (timedOut) {
      reject(new SearchProviderError('SEARCH_TIMEOUT', 'DuckDuckGo search timed out. Please try again.', 504));
      return;
    }
    let response;
    try {
      response = JSON.parse(stdout);
    } catch {
      reject(new SearchProviderError('SEARCH_PROVIDER_ERROR', 'The DDGS search worker returned an invalid response.', 502));
      return;
    }
    if (response.error) {
      const status = response.error.code === 'SEARCH_BLOCKED' ? 429 : response.error.code === 'SEARCH_TIMEOUT' ? 504 : 502;
      reject(new SearchProviderError(response.error.code || 'SEARCH_PROVIDER_ERROR', response.error.message || 'DuckDuckGo search failed.', status));
      return;
    }
    if (exitCode !== 0 || (payload.action === 'search' && !Array.isArray(response.results))) {
      reject(new SearchProviderError('SEARCH_PROVIDER_ERROR', 'The DDGS search worker returned an unexpected response.', 502));
      return;
    }
    resolve(payload.action === 'health' ? response : response.results);
  });

  child.stdin.on('error', () => {});
  child.stdin.end(JSON.stringify(payload));
});

export const createDuckDuckGoSearchProvider = ({
  pythonExecutable = process.env.PYTHON || 'python',
  timeout = 12_000,
  runBridgeImpl = runBridge
} = {}) => {
  let queue = Promise.resolve();
  let lastFailure = null;

  const enqueue = (payload, options = {}) => {
    const result = queue.then(() => runBridgeImpl(payload, { pythonExecutable, timeout, ...options }));
    queue = result.then(() => undefined, () => undefined);
    return result;
  };

  return {
    name: 'DuckDuckGo (DDGS)',
    authenticationRequired: false,
    paymentRequired: false,
    apiKeyRequired: false,
    async search(query, { signal, maxResults = 8 } = {}) {
      try {
        const boundedMaxResults = Math.min(8, Math.max(1, Math.floor(Number(maxResults) || 8)));
        const results = await enqueue({ action: 'search', query: String(query).slice(0, 400), maxResults: boundedMaxResults }, { signal });
        lastFailure = null;
        return results;
      } catch (error) {
        lastFailure = error;
        throw error;
      }
    },
    async healthCheck() {
      try {
        const health = await enqueue({ action: 'health' });
        if (!health.available) throw new Error('The ddgs package is unavailable. Install it with pip install -r requirements.txt.');
        return {
          status: lastFailure ? 'OFFLINE' : 'ONLINE',
          version: health.version,
          ...(lastFailure ? { code: lastFailure.code, error: lastFailure.message } : {})
        };
      } catch (error) {
        return { status: 'OFFLINE', code: error.code || 'SEARCH_PROVIDER_ERROR', error: error.message };
      }
    }
  };
};