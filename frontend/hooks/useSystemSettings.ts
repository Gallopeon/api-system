import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";

export type SystemSettingItem = {
  key: string;
  value: string;
  description: string | null;
  editable: boolean;
  updated_at: string;
};

export function useSystemSettings(
  accessToken?: string,
  notifyError?: (msg: string) => void,
  notifySucc?: (msg: string) => void,
) {
  const [settings, setSettings] = useState<SystemSettingItem[]>([]);
  const [busy, setBusy] = useState(false);

  const loadSettings = useCallback(async () => {
    setBusy(true);
    try {
      const r = await apiFetch("/api/v1/system/settings", undefined, accessToken);
      if (r.ok) {
        const d = await r.json();
        setSettings(d.items || []);
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }, [accessToken]);

  const updateSetting = useCallback(
    async (key: string, value: string) => {
      setBusy(true);
      try {
        const r = await apiFetch(`/api/v1/system/settings/${key}`, {
          method: "PUT",
          body: JSON.stringify({ value }),
        }, accessToken);
        if (!r.ok) throw new Error((await r.json())?.message || "Update failed");
        notifySucc?.(`${key} updated`);
        await loadSettings();
      } catch (e) {
        notifyError?.((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [accessToken, loadSettings, notifyError, notifySucc],
  );

  return { settings, busy, loadSettings, updateSetting };
}
