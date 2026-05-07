// All API calls go through the Next.js proxy route at /api/proxy/[...path].
// The proxy reads the backend JWT from the server-side NextAuth token, so the
// JWT is never exposed to browser JavaScript (no XSS exfiltration risk).
//
// apiFetch accepts an optional third argument for backward compatibility with
// callers that still pass an accessToken — it is silently ignored since the
// proxy handles authentication server-side.

const inFlight = new Map<string, Promise<Response>>();

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
  const existing = inFlight.get(key);
  if (existing) {
    return existing.then((r) => r.clone());
  }

  const promise = fetch(endpoint(path), { ...init, headers });
  inFlight.set(key, promise);

  promise.finally(() => {
    inFlight.delete(key);
  });

  return promise;
}

/** @deprecated JWT is no longer exposed to the client. Returns undefined. */
export function getApiToken(_session?: any): undefined {
  return undefined;
}
