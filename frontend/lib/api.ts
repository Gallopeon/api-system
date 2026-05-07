// All API calls go through the Next.js proxy route at /api/proxy/[...path].
// The proxy reads the backend JWT from the server-side NextAuth token, so the
// JWT is never exposed to browser JavaScript (no XSS exfiltration risk).
//
// apiFetch accepts an optional third argument for backward compatibility with
// callers that still pass an accessToken — it is silently ignored since the
// proxy handles authentication server-side.

const inFlight = new Map<string, Promise<Response>>();

/** GET response cache with TTL (default 30s). Invalidated on mutation. */
const cache = new Map<string, { response: Response; ts: number }>();
const CACHE_TTL_MS = 30_000;

function dedupKey(path: string, init: RequestInit): string {
  const method = init.method || "GET";
  const body = typeof init.body === "string" ? init.body : "";
  return `${method}:${path}:${body}`;
}

export function endpoint(path: string): string {
  return `/api/proxy${path}`;
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  _accessToken?: string,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const key = dedupKey(path, init);
  const method = init.method || "GET";

  // Invalidate cache entries for this path on mutations
  if (method !== "GET") {
    for (const [k, v] of cache) {
      if (k.includes(path.split("?")[0])) {
        cache.delete(k);
      }
    }
  }

  // Serve from cache for GET requests
  if (method === "GET") {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return cached.response.clone();
    }
  }

  // In-flight dedup (all methods)
  const existing = inFlight.get(key);
  if (existing) {
    return existing.then((r) => r.clone());
  }

  const promise = fetch(endpoint(path), { ...init, headers });
  inFlight.set(key, promise);

  promise.then((r) => {
    inFlight.delete(key);
    // Cache successful GET responses
    if (method === "GET" && r.ok) {
      // Only cache if the response is cloneable (not consumed)
      try {
        cache.set(key, { response: r.clone(), ts: Date.now() });
      } catch { /* some responses can't be cloned */ }
    }
  }).catch(() => {
    inFlight.delete(key);
  });

  return promise;
}

/** Clear all cached GET responses. Call after mutations for aggressive invalidation. */
export function clearApiCache(): void {
  cache.clear();
}

/** @deprecated JWT is no longer exposed to the client. Returns undefined. */
export function getApiToken(_session?: any): undefined {
  return undefined;
}
