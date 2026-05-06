import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type { CircuitBreaker } from "@/lib/types";

export function useCircuitBreakers(
  accessToken: string | undefined,
  notifyError: (msg: string) => void,
  notifySucc: (msg: string) => void,
) {
  const [cbs, setCbs] = useState<CircuitBreaker[]>([]);
  const [busy, setBusy] = useState(false);

  const loadCBs = useCallback(async () => {
    try {
      const r = await apiFetch("/admin/v1/circuit-breakers?limit=50", {}, accessToken);
      if (r.ok) {
        const d = await r.json();
        setCbs((d as { items?: CircuitBreaker[] }).items || []);
      }
    } catch (e) {
      notifyError("Failed to load circuit breakers");
      console.error("loadCBs failed:", e);
    }
  }, [accessToken, notifyError]);

  const createCB = useCallback(
    async (data: Record<string, unknown>) => {
      setBusy(true);
      try {
        const r = await apiFetch(
          "/admin/v1/circuit-breakers",
          { method: "POST", body: JSON.stringify(data) },
          accessToken,
        );
        if (!r.ok) throw new Error((await r.json())?.message || `HTTP ${r.status}`);
        notifySucc("Circuit breaker created!");
        await loadCBs();
      } catch (e) {
        notifyError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [accessToken, loadCBs, notifyError, notifySucc],
  );

  const updateCB = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      setBusy(true);
      try {
        const r = await apiFetch(
          `/admin/v1/circuit-breakers/${id}`,
          { method: "PUT", body: JSON.stringify(data) },
          accessToken,
        );
        if (!r.ok) throw new Error((await r.json())?.message || `HTTP ${r.status}`);
        notifySucc("Circuit breaker updated!");
        await loadCBs();
      } catch (e) {
        notifyError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [accessToken, loadCBs, notifyError, notifySucc],
  );

  const deleteCB = useCallback(
    async (id: string) => {
      if (!confirm("Delete this circuit breaker?")) return;
      setBusy(true);
      try {
        const r = await apiFetch(`/admin/v1/circuit-breakers/${id}`, { method: "DELETE" }, accessToken);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        notifySucc("Circuit breaker deleted");
        await loadCBs();
      } catch (e) {
        notifyError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [accessToken, loadCBs, notifyError, notifySucc],
  );

  return { cbs, busy, loadCBs, createCB, updateCB, deleteCB };
}
