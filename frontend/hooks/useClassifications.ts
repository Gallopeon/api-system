import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type { DataClassification } from "@/lib/types";

export function useClassifications(
  accessToken: string | undefined,
  notifyError: (msg: string) => void,
  notifySucc: (msg: string) => void,
) {
  const [classifications, setClassifications] = useState<DataClassification[]>([]);
  const [busy, setBusy] = useState(false);

  const loadClassifications = useCallback(async () => {
    try {
      const r = await apiFetch("/admin/v1/data-classifications?limit=50", {}, accessToken);
      if (r.ok) {
        const d = await r.json();
        setClassifications((d as { items?: DataClassification[] }).items || []);
      }
    } catch (e) {
      notifyError("Failed to load data classifications");
      console.error("loadClassifications failed:", e);
    }
  }, [accessToken, notifyError]);

  const createClassification = useCallback(
    async (data: Record<string, unknown>) => {
      setBusy(true);
      try {
        const r = await apiFetch(
          "/admin/v1/data-classifications",
          { method: "POST", body: JSON.stringify(data) },
          accessToken,
        );
        if (!r.ok) throw new Error((await r.json())?.message || `HTTP ${r.status}`);
        notifySucc("Data classification created!");
        await loadClassifications();
      } catch (e) {
        notifyError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [accessToken, loadClassifications, notifyError, notifySucc],
  );

  const updateClassification = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      setBusy(true);
      try {
        const r = await apiFetch(
          `/admin/v1/data-classifications/${id}`,
          { method: "PUT", body: JSON.stringify(data) },
          accessToken,
        );
        if (!r.ok) throw new Error((await r.json())?.message || `HTTP ${r.status}`);
        notifySucc("Data classification updated!");
        await loadClassifications();
      } catch (e) {
        notifyError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [accessToken, loadClassifications, notifyError, notifySucc],
  );

  const deleteClassification = useCallback(
    async (id: string) => {
      if (!confirm("Delete this data classification?")) return;
      setBusy(true);
      try {
        const r = await apiFetch(`/admin/v1/data-classifications/${id}`, { method: "DELETE" }, accessToken);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        notifySucc("Data classification deleted");
        await loadClassifications();
      } catch (e) {
        notifyError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [accessToken, loadClassifications, notifyError, notifySucc],
  );

  return {
    classifications,
    busy,
    loadClassifications,
    createClassification,
    updateClassification,
    deleteClassification,
  };
}
