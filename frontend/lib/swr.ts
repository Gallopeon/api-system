import useSWR, { type SWRConfiguration } from "swr";
import { apiFetch } from "./api";

/** JSON fetcher for SWR — uses apiFetch which goes through the Next.js proxy. */
export async function swrFetcher<T = unknown>(path: string): Promise<T> {
  const r = await apiFetch(path);
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error((body as any).message || `HTTP ${r.status}`);
  }
  return r.json() as Promise<T>;
}

/** Default SWR config applied to all data hooks. */
export const swrConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 2000,
  errorRetryCount: 2,
};

/** Suggests a refresh interval based on data volatility. */
export function swrTTL(seconds: number): Partial<SWRConfiguration> {
  return {
    refreshInterval: seconds * 1000,
    dedupingInterval: Math.max(2000, seconds * 500),
  };
}

export { useSWR };
