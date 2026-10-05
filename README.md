# WHYspace

WHYspace is a lightweight, responsive writing assistant. Normal text generation uses a local Ollama model; current-information requests can separately use DuckDuckGo through the maintained `ddgs` Python package.

## Run locally

1. Install Node.js 18 or newer, Python 3.10 or newer, and [Ollama](https://ollama.com/download).
2. Run `npm install` and `python -m pip install -r requirements.txt`.
3. Make sure Ollama is running. Install the default model once with `ollama pull qwen2.5:3b` if it is not already listed by `ollama list`.
4. Copy `.env.example` to `.env`. The default settings use `AI_PROVIDER=ollama`, `OLLAMA_BASE_URL=http://127.0.0.1:11434`, and `OLLAMA_MODEL=qwen2.5:3b`; no cloud AI key is needed.
5. Run `npm start` and open `http://localhost:3000`.

Check local AI status at `/api/ai/health` and search-provider/package status at `/api/web-search/health`. At startup, WHYspace reports both provider statuses and gives the one-time model pull command when the configured Ollama model is missing. Startup does not download models automatically.

WHYspace uses a locally running open-source model through Ollama, so normal generation does not require a paid AI API or cloud API quota. Generation speed and capacity depend on local hardware and the selected model.

## Providers

`AI_PROVIDER=ollama` is the default. Ollama uses its local `/api/chat` API with streaming disabled and bounds each request to a 4096-token context and 512 generated tokens by default. Adjust `OLLAMA_NUM_CTX`, `OLLAMA_NUM_PREDICT`, and `OLLAMA_TIMEOUT_MS` if your machine needs different limits.

Groq, OpenAI, and OpenRouter remain optional. They are used only when explicitly selected with `AI_PROVIDER` and their matching key is configured. A cloud provider failure does not affect the default Ollama path.

## Web research

The backend uses `ddgs==9.16.0` with the current `from ddgs import DDGS` API and the `DDGS().text(..., backend="duckduckgo")` web-text search method. It needs Python 3.10+ and no search API key, paid search plan, or credit card. Searches are limited to eight results per query and run sequentially; multipart questions may issue at most two queries.

Likely current-information questions are searched automatically. Stable questions are not searched unless **Search the web** is enabled. Retrieved `title`, URL, body/snippet, optional source, and optional date are normalized into source cards. Missing dates are not invented. When a recognizable organization or product is in the question, matching official domains are ranked first when returned; domains are never labeled official merely because of rank.

Search results are passed to the model in a separate untrusted evidence message. Webpage instructions cannot override the WHYspace system prompt. If search is blocked, times out, fails, or returns no usable sources, the request fails with a distinct search status; WHYspace does not generate a supposedly current answer without evidence. CAPTCHA or access controls are not bypassed. DuckDuckGo/DDGS may rate-limit or block automated queries, so search availability is not guaranteed. The health endpoint checks the local package and remembers a recent search block; it does not make a probe query.

WHYspace uses result excerpts only and does not fetch arbitrary result URLs. If excerpts do not provide enough evidence, the assistant should say so. Search queries go to DuckDuckGo; returned excerpts are sent to the configured AI provider. Queries and excerpts are not written to server logs or backend storage. Chat history continues to use browser-local storage.

## Verify

- Run `npm test` for the AI adapter, DDGS bridge contract, search normalization, current-information decisions, official-domain ordering, error states, source evidence, and rate limits.
- With Ollama running, `GET /api/ai/health` should report `ONLINE` and `qwen2.5:3b`.
- `GET /api/web-search/health` checks the installed `ddgs` package without contacting DuckDuckGo. Run an explicit **Search the web** query to test remote search availability.
- Ollama chat is non-streaming in the current app. WHYspace does not pretend it has streaming support.

Never commit `.env`. To explicitly use an optional cloud model, select its provider and configure its key; this is not required for ordinary local chat.