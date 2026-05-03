import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { getDefaultExpiry, fmtRelativeExpiry } from "@/lib/utils";
import type { ApiKeyItem, ApiKeyListResponse } from "@/lib/types";

export function useApiKeys(
  notifyError: (msg: string) => void,
  notifySucc: (msg: string) => void,
) {
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [akName, setAkName] = useState("");
  const [akScopes, setAkScopes] = useState("");
  const [akExpires, setAkExpires] = useState(getDefaultExpiry());
  const [akMaxCalls, setAkMaxCalls] = useState("");
  const [akCreatedKey, setAkCreatedKey] = useState("");
  const [akBusy, setAkBusy] = useState(false);

  const loadApiKeys = useCallback(async () => {
    try {
      const r = await apiFetch("/admin/v1/api-keys?limit=50&offset=0");
      if (r.ok) {
        const d = (await r.json()) as ApiKeyListResponse;
        setApiKeys(d.items || []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const createApiKey = useCallback(async () => {
    if (!akName.trim()) {
      notifyError("Key name is required");
      return;
    }
    setAkBusy(true);
    try {
      const body: Record<string, unknown> = { name: akName.trim(), actor: "panel" };
      if (akScopes.trim()) {
        body.scopes = akScopes.split(",").map((s) => s.trim()).filter(Boolean);
      }
      if (akExpires.trim()) body.expires_at = akExpires;
      if (akMaxCalls.trim()) body.max_calls = parseInt(akMaxCalls);
      const r = await apiFetch("/admin/v1/api-keys", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json())?.message || `HTTP ${r.status}`);
      const d = (await r.json()) as ApiKeyItem;
      setAkCreatedKey(d.key || "");
      notifySucc("API Key created! Copy it now — it won't be shown again.");
      setAkName("");
      setAkScopes("");
      setAkExpires(getDefaultExpiry());
      setAkMaxCalls("");
      await loadApiKeys();
    } catch (e) {
      notifyError((e as Error).message);
    } finally {
      setAkBusy(false);
    }
  }, [akName, akScopes, akExpires, akMaxCalls, loadApiKeys, notifyError, notifySucc]);

  const toggleApiKey = useCallback(
    async (id: string, currentStatus: string) => {
      const newStatus = currentStatus === "active" ? "disabled" : "active";
      try {
        const r = await apiFetch(`/admin/v1/api-keys/${id}`, {
          method: "PUT",
          body: JSON.stringify({ status: newStatus, actor: "panel" }),
        });
        if (!r.ok) throw new Error((await r.json())?.message || `HTTP ${r.status}`);
        notifySucc(`Key ${newStatus}`);
        await loadApiKeys();
      } catch (e) {
        notifyError((e as Error).message);
      }
    },
    [loadApiKeys, notifyError, notifySucc],
  );

  const deleteApiKey = useCallback(
    async (id: string) => {
      if (!confirm("Delete this API key?")) return;
      try {
        const r = await apiFetch(`/admin/v1/api-keys/${id}`, {
          method: "DELETE",
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        notifySucc("API Key deleted");
        await loadApiKeys();
      } catch (e) {
        notifyError((e as Error).message);
      }
    },
    [loadApiKeys, notifyError, notifySucc],
  );

  return {
    apiKeys,
    akName,
    akScopes,
    akExpires,
    akMaxCalls,
    akCreatedKey,
    akBusy,
    setAkName,
    setAkScopes,
    setAkExpires,
    setAkMaxCalls,
    setAkCreatedKey,
    loadApiKeys,
    createApiKey,
    toggleApiKey,
    deleteApiKey,
    fmtRelativeExpiry,
  };
}
