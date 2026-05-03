const API_ORIGIN = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN ?? "";
// Admin plane prefix: separates management APIs from data-plane proxy
const ADMIN_PREFIX = "/admin/v1";

export function endpoint(path: string): string {
  // /admin/v1/ paths are already prefixed, pass through as-is
  if (path.startsWith("/admin/")) return `${API_ORIGIN}${path}`;
  // Auto-upgrade legacy /api/v1/ management calls to /admin/v1/
  if (path.startsWith("/api/v1/")) return `${API_ORIGIN}${path.replace("/api/v1", ADMIN_PREFIX)}`;
  return `${API_ORIGIN}${path}`;
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  } else if (API_TOKEN) {
    headers.set("Authorization", `Bearer ${API_TOKEN}`);
  }
  return fetch(endpoint(path), { ...init, headers });
}

export function getApiToken(session: any): string | undefined {
  return session?.accessToken || undefined;
}
