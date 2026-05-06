import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type { PluginConfig } from "@/lib/types";

export function usePlugins(
  accessToken: string | undefined,
  notifyError: (msg: string) => void,
  notifySucc: (msg: string) => void,
) {
  const [plugins, setPlugins] = useState<PluginConfig[]>([]);
  const [busy, setBusy] = useState(false);

  const loadPlugins = useCallback(async () => {
    try {
      const r = await apiFetch("/admin/v1/plugins?limit=50", {}, accessToken);
      if (r.ok) {
        const d = await r.json();
        setPlugins((d as { items?: PluginConfig[] }).items || []);
      }
    } catch (e) {
      notifyError("Failed to load plugins");
      console.error("loadPlugins failed:", e);
    }
  }, [accessToken, notifyError]);

  const createPlugin = useCallback(
    async (data: Record<string, unknown>) => {
      setBusy(true);
      try {
        const r = await apiFetch(
          "/admin/v1/plugins",
          { method: "POST", body: JSON.stringify(data) },
          accessToken,
        );
        if (!r.ok) throw new Error((await r.json())?.message || `HTTP ${r.status}`);
        notifySucc("Plugin created!");
        await loadPlugins();
      } catch (e) {
        notifyError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [accessToken, loadPlugins, notifyError, notifySucc],
  );

  const updatePlugin = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      setBusy(true);
      try {
        const r = await apiFetch(
          `/admin/v1/plugins/${id}`,
          { method: "PUT", body: JSON.stringify(data) },
          accessToken,
        );
        if (!r.ok) throw new Error((await r.json())?.message || `HTTP ${r.status}`);
        notifySucc("Plugin updated!");
        await loadPlugins();
      } catch (e) {
        notifyError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [accessToken, loadPlugins, notifyError, notifySucc],
  );

  const deletePlugin = useCallback(
    async (id: string) => {
      if (!confirm("Delete this plugin?")) return;
      setBusy(true);
      try {
        const r = await apiFetch(`/admin/v1/plugins/${id}`, { method: "DELETE" }, accessToken);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        notifySucc("Plugin deleted");
        await loadPlugins();
      } catch (e) {
        notifyError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [accessToken, loadPlugins, notifyError, notifySucc],
  );

  return { plugins, busy, loadPlugins, createPlugin, updatePlugin, deletePlugin };
}
