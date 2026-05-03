const API_ORIGIN = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN ?? "";

export function endpoint(path: string): string {
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
