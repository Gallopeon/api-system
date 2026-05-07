import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useSWR, swrFetcher, swrTTL } from "@/lib/swr";

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
  const [busy, setBusy] = useState(false);

  const { data: settings = [], mutate } = useSWR<SystemSettingItem[]>(
    "/admin/v1/system/settings",
    swrFetcher,
    {
      ...swrTTL(60),
      onError: (e) => {
        notifyError?.("Failed to load system settings");
        console.error("loadSettings failed:", e);
      },
    },
  );

  const updateSetting = useCallback(
    async (key: string, value: string) => {
      setBusy(true);
      try {
        const r = await apiFetch(`/admin/v1/system/settings/${key}`, {
          method: "PUT",
          body: JSON.stringify({ value }),
        }, accessToken);
        if (!r.ok) throw new Error((await r.json())?.message || "Update failed");
        notifySucc?.(`${key} updated`);
        await mutate();
      } catch (e) {
        notifyError?.((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [accessToken, mutate, notifyError, notifySucc],
  );

  return { settings, busy, updateSetting, mutate };
}
