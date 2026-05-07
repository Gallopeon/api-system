import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { PAGE_LIMIT, PAGE_OFFSET } from "@/lib/constants";
import type {
  RateLimitItem,
  RateLimitListResponse,
} from "@/lib/types";

export function useRateLimits(
  notifyError: (msg: string) => void,
  notifySucc: (msg: string) => void,
) {
  const [rateLimits, setRateLimits] = useState<RateLimitItem[]>([]);
  const [rlName, setRlName] = useState("");
  const [rlApiPath, setRlApiPath] = useState("");
  const [rlWindow, setRlWindow] = useState("60");
  const [rlMaxReq, setRlMaxReq] = useState("100");
  const [rlBurst, setRlBurst] = useState("50");
  const [rlQuotaDaily, setRlQuotaDaily] = useState("");
  const [rlQuotaMonthly, setRlQuotaMonthly] = useState("");
  const [rlPerKey, setRlPerKey] = useState(false);
  const [rlPerIp, setRlPerIp] = useState(true);
  const [rlBusy, setRlBusy] = useState(false);

  const loadRateLimits = useCallback(async () => {
    try {
      const r = await apiFetch(`/admin/v1/rate-limits?limit=${PAGE_LIMIT}&offset=${PAGE_OFFSET}`);
      if (r.ok) {
        const d = (await r.json()) as RateLimitListResponse;
        setRateLimits(d.items || []);
      }
    } catch (e) {
      notifyError("Failed to load rate limits");
      console.error("loadRateLimits failed:", e);
    }
  }, [notifyError]);

  const createRateLimit = useCallback(async () => {
    if (!rlName.trim() || !rlApiPath.trim()) {
      notifyError("Name and API path required");
      return;
    }
    setRlBusy(true);
    try {
      const body: Record<string, unknown> = {
        name: rlName.trim(),
        api_path: rlApiPath.trim(),
        window_seconds: parseInt(rlWindow) || 60,
        max_requests: parseInt(rlMaxReq) || 100,
        burst_size: parseInt(rlBurst) || 50,
        per_api_key: rlPerKey,
        per_ip: rlPerIp,
        actor: "panel",
      };
      if (rlQuotaDaily.trim()) body.quota_daily = parseInt(rlQuotaDaily);
      if (rlQuotaMonthly.trim()) body.quota_monthly = parseInt(rlQuotaMonthly);
      const r = await apiFetch("/admin/v1/rate-limits", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json())?.message || `HTTP ${r.status}`);
      notifySucc("Rate limit created!");
      setRlName("");
      setRlApiPath("");
      setRlWindow("60");
      setRlMaxReq("100");
      setRlBurst("50");
      setRlQuotaDaily("");
      setRlQuotaMonthly("");
      setRlPerKey(false);
      setRlPerIp(true);
      await loadRateLimits();
    } catch (e) {
      notifyError((e as Error).message);
    } finally {
      setRlBusy(false);
    }
  }, [
    rlName, rlApiPath, rlWindow, rlMaxReq, rlBurst,
    rlQuotaDaily, rlQuotaMonthly, rlPerKey, rlPerIp,
    loadRateLimits, notifyError, notifySucc,
  ]);

  const toggleRateLimit = useCallback(
    async (id: string, currentStatus: string) => {
      const newStatus = currentStatus === "active" ? "disabled" : "active";
      try {
        const r = await apiFetch(`/admin/v1/rate-limits/${id}`, {
          method: "PUT",
          body: JSON.stringify({ status: newStatus, actor: "panel" }),
        });
        if (!r.ok) throw new Error((await r.json())?.message || `HTTP ${r.status}`);
        notifySucc(`Rate limit ${newStatus}`);
        await loadRateLimits();
      } catch (e) {
        notifyError((e as Error).message);
      }
    },
    [loadRateLimits, notifyError, notifySucc],
  );

  const deleteRateLimit = useCallback(
    async (id: string) => {
      if (!confirm("Delete this rate limit?")) return;
      try {
        const r = await apiFetch(`/admin/v1/rate-limits/${id}`, {
          method: "DELETE",
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        notifySucc("Rate limit deleted");
        await loadRateLimits();
      } catch (e) {
        notifyError((e as Error).message);
      }
    },
    [loadRateLimits, notifyError, notifySucc],
  );

  return {
    rateLimits,
    rlName,
    rlApiPath,
    rlWindow,
    rlMaxReq,
    rlBurst,
    rlQuotaDaily,
    rlQuotaMonthly,
    rlPerKey,
    rlPerIp,
    rlBusy,
    setRlName,
    setRlApiPath,
    setRlWindow,
    setRlMaxReq,
    setRlBurst,
    setRlQuotaDaily,
    setRlQuotaMonthly,
    setRlPerKey,
    setRlPerIp,
    loadRateLimits,
    createRateLimit,
    toggleRateLimit,
    deleteRateLimit,
  };
}
