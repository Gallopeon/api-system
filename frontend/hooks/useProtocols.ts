import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type { ProtocolConfig } from "@/lib/types";

export function useProtocols(
  accessToken: string | undefined,
  notifyError: (msg: string) => void,
  notifySucc: (msg: string) => void,
) {
  const [protocols, setProtocols] = useState<ProtocolConfig[]>([]);
  const [busy, setBusy] = useState(false);

  const loadProtocols = useCallback(async () => {
    try {
      const r = await apiFetch("/admin/v1/protocols?limit=50", {}, accessToken);
      if (r.ok) {
        const d = await r.json();
        setProtocols((d as { items?: ProtocolConfig[] }).items || []);
      }
    } catch (e) {
      notifyError("Failed to load protocols");
      console.error("loadProtocols failed:", e);
    }
  }, [accessToken, notifyError]);

  const createProtocol = useCallback(
    async (data: Record<string, unknown>) => {
      setBusy(true);
      try {
        const r = await apiFetch(
          "/admin/v1/protocols",
          { method: "POST", body: JSON.stringify(data) },
          accessToken,
        );
        if (!r.ok) throw new Error((await r.json())?.message || `HTTP ${r.status}`);
        notifySucc("Protocol created!");
        await loadProtocols();
      } catch (e) {
        notifyError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [accessToken, loadProtocols, notifyError, notifySucc],
  );

  const updateProtocol = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      setBusy(true);
      try {
        const r = await apiFetch(
          `/admin/v1/protocols/${id}`,
          { method: "PUT", body: JSON.stringify(data) },
          accessToken,
        );
        if (!r.ok) throw new Error((await r.json())?.message || `HTTP ${r.status}`);
        notifySucc("Protocol updated!");
        await loadProtocols();
      } catch (e) {
        notifyError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [accessToken, loadProtocols, notifyError, notifySucc],
  );

  const deleteProtocol = useCallback(
    async (id: string) => {
      if (!confirm("Delete this protocol?")) return;
      setBusy(true);
      try {
        const r = await apiFetch(`/admin/v1/protocols/${id}`, { method: "DELETE" }, accessToken);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        notifySucc("Protocol deleted");
        await loadProtocols();
      } catch (e) {
        notifyError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [accessToken, loadProtocols, notifyError, notifySucc],
  );

  return { protocols, busy, loadProtocols, createProtocol, updateProtocol, deleteProtocol };
}
