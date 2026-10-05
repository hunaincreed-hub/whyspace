export class ModelProvider {
  constructor({ model = 'qwen2.5:3b', endpoint = '/api/generate', timeout = 150000 } = {}) {
    this.model = model;
    this.endpoint = endpoint;
    this.timeout = timeout;
  }

  async generateResponse(messages, { signal, searchWeb = false, onResearchStatus } = {}) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), this.timeout);
    const abortRequest = () => controller.abort();
    const researchRequestId = crypto.randomUUID();
    let statusTimer = null;
    signal?.addEventListener('abort', abortRequest, { once: true });

    const lastPrompt = [...messages].reverse().find((message) => message.role === 'user')?.content || '';
    const expectsResearch = searchWeb || /\b(today|tonight|this week|this month|this year|current|currently|latest|newest|recent|recently|breaking|news|announced|announcement|release|released|version|price|pricing|stock|weather|regulation|statistics|right now|up to date|up-to-date|verify|fact.?check|sources?|search the web|look online|find online)\b/i.test(lastPrompt);
    if (onResearchStatus && expectsResearch) {
      statusTimer = window.setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/research-status/${researchRequestId}`, { signal: controller.signal });
          if (!statusResponse.ok) return;
          const statusPayload = await statusResponse.json();
          const statuses = {
            SEARCHING_WEB: 'Searching the web…',
            REVIEWING_SOURCES: 'Reviewing sources…',
            WRITING_ANSWER: 'Writing answer…'
          };
          if (statuses[statusPayload.status]) onResearchStatus(statusPayload.status, statuses[statusPayload.status]);
        } catch {
          // Status polling is advisory; the main chat request remains authoritative.
        }
      }, 400);
    }

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, searchWeb, researchRequestId }),
        signal: controller.signal
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          ok: false,
          error: payload.error || `WHYspace could not complete that request (server returned ${response.status}).`,
          code: payload.code || null
        };
      }

      if (!payload.text) {
        return {
          ok: false,
          error: 'The AI returned an empty response.'
        };
      }

      return {
        ok: true,
        text: payload.text,
        model: payload.model,
        streaming: Boolean(payload.streaming),
        research: payload.research || null,
        sources: Array.isArray(payload.sources) ? payload.sources : [],
        code: payload.code || null
      };
    } catch (error) {
      if (error?.name === 'AbortError') {
        return { ok: false, error: signal?.aborted ? 'The request was cancelled.' : 'The request took too long. Please try again.' };
      }
      return {
        ok: false,
        error: `WHYspace could not reach the local AI server. ${error?.message === 'Failed to fetch' ? 'Make sure npm start is still running.' : 'Check the server and try again.'}`
      };
    } finally {
      window.clearTimeout(timeoutId);
      if (statusTimer) window.clearInterval(statusTimer);
      signal?.removeEventListener('abort', abortRequest);
    }
  }
}
