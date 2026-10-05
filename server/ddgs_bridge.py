import json
import sys
from importlib.metadata import PackageNotFoundError, version


def send(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=True))


def main():
    try:
        ddgs_version = version("ddgs")
    except PackageNotFoundError:
        send({"available": False})
        return

    request = json.load(sys.stdin)
    if request.get("action") == "health":
        send({"available": True, "version": ddgs_version})
        return

    from ddgs import DDGS
    from ddgs.exceptions import DDGSException, RatelimitException, TimeoutException

    try:
        with DDGS(timeout=8) as search:
            results = search.text(
                str(request.get("query", ""))[:400],
                max_results=min(max(int(request.get("maxResults", 8)), 1), 8),
                safesearch="moderate",
                backend="duckduckgo",
            )
        send({"results": results})
    except RatelimitException:
        send({"error": {"code": "SEARCH_BLOCKED", "message": "DuckDuckGo temporarily blocked this request. Wait before searching again."}})
    except TimeoutException:
        send({"error": {"code": "SEARCH_TIMEOUT", "message": "DuckDuckGo search timed out. Please try again."}})
    except DDGSException as error:
        message = str(error)
        lowered = message.lower()
        if any(term in lowered for term in ("captcha", "challenge", "rate limit", "ratelimit", "blocked", "403", "429")):
            send({"error": {"code": "SEARCH_BLOCKED", "message": "DuckDuckGo blocked or challenged this request. No access controls were bypassed; wait before trying again."}})
        elif "no results found" in lowered or not message:
            send({"results": []})
        else:
            send({"error": {"code": "SEARCH_PROVIDER_ERROR", "message": "DuckDuckGo search failed. Please try again later."}})
    except Exception:
        send({"error": {"code": "SEARCH_PROVIDER_ERROR", "message": "DuckDuckGo search failed. Please try again later."}})


if __name__ == "__main__":
    try:
        main()
    except Exception:
        send({"error": {"code": "SEARCH_PROVIDER_ERROR", "message": "The DDGS search worker failed. Check the Python installation and DDGS package."}})