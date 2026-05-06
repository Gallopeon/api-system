import useSWR, { mutate as globalMutate } from "swr";
import { apiFetch } from "@/lib/api";

// Stale-while-revalidate fetcher for useSWR.
// Caches API responses and revalidates in background after TTL.
async function fetcher(path: string): Promise<any> {
  const res = await apiFetch(path);
  if (!res.ok) {
    const msg = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error((msg.message as string) || `HTTP ${res.status}`);
  }
  return res.json();
}

/** SWR wrapper with sensible defaults for this project. */
export function useApiData(path: string | null) {
  return useSWR(path, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 30000, // 30s dedup
    errorRetryCount: 2,
  });
}

/** Invalidate the SWR cache for a given path. */
export function invalidateApiData(path: string) {
  globalMutate(path);
}

/** Invalidate all SWR caches matching a prefix. */
export function invalidateApiPrefix(prefix: string) {
  const c = (globalMutate as any as (fn: (key: string) => boolean) => void);
  c((key: string) => key.startsWith(prefix));
}
