import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { PAGE_LIMIT, PAGE_OFFSET } from "@/lib/constants";
import type {
  AuditLogItem,
  AuditLogResponse,
  MetricsOverview,
  ApprovalItem,
  ApprovalListResponse,
  AnalyticsData,
  TopApisResponse,
  ApiKeyStatsResponse,
} from "@/lib/types";

export function useDashboard(notifyError?: (msg: string) => void) {
  const [metrics, setMetrics] = useState<MetricsOverview | null>(null);
  const [liveState, setLiveState] = useState("unknown");
  const [readyState, setReadyState] = useState("unknown");

  const loadHealthStatus = useCallback(async () => {
    try {
      const [live, ready] = await Promise.all([
        fetch("/health/live"),
        fetch("/health/ready"),
      ]);
      setLiveState(live.ok ? "ok" : `err:${live.status}`);
      setReadyState(ready.ok ? "ready" : `degraded:${ready.status}`);
    } catch (e) {
      setLiveState("down");
      setReadyState("down");
      console.error("Health check failed:", e);
    }
  }, []);

  const loadMetrics = useCallback(async () => {
    try {
      const r = await apiFetch("/admin/v1/metrics/overview");
      if (r.ok) setMetrics(await r.json());
    } catch (e) {
      notifyError?.("Failed to load metrics overview");
      console.error("loadMetrics failed:", e);
    }
  }, [notifyError]);

  return { metrics, liveState, readyState, loadHealthStatus, loadMetrics };
}

export function useAuditLog(notifyError?: (msg: string) => void) {
  const [auditItems, setAuditItems] = useState<AuditLogItem[]>([]);

  const loadAuditLogs = useCallback(async () => {
    try {
      const r = await apiFetch(`/admin/v1/audit/logs?limit=${PAGE_LIMIT}&offset=${PAGE_OFFSET}`);
      if (r.ok) {
        const d = (await r.json()) as AuditLogResponse;
        setAuditItems(d.items || []);
      }
    } catch (e) {
      notifyError?.("Failed to load audit logs");
      console.error("loadAuditLogs failed:", e);
    }
  }, [notifyError]);

  return { auditItems, loadAuditLogs };
}

export function useApprovals(
  notifyError: (msg: string) => void,
  notifySucc: (msg: string) => void,
  accessToken?: string,
) {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [myApprovals, setMyApprovals] = useState<ApprovalItem[]>([]);
  const [myPending, setMyPending] = useState<ApprovalItem[]>([]);
  const [approvalFilter, setApprovalFilter] = useState("");
  const [approvalTab, setApprovalTab] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("approvals_tab") || "all";
    }
    return "all";
  });
  const [apprBusy, setApprBusy] = useState(false);
  const [approvalRuleId, setApprovalRuleId] = useState("");
  const [approvalComment, setApprovalComment] = useState("");
  const [approvalReviewer, setApprovalReviewer] = useState("");

  const loadApprovals = useCallback(async () => {
    try {
      const qs = approvalFilter ? `?status=${approvalFilter}` : `?limit=${PAGE_LIMIT}&offset=${PAGE_OFFSET}`;
      const r = await apiFetch(`/admin/v1/approvals${qs}`, undefined, accessToken);
      if (r.ok) {
        const d = (await r.json()) as ApprovalListResponse;
        setApprovals(d.items || []);
      }
    } catch (e) {
      notifyError("Failed to load approvals");
      console.error("loadApprovals failed:", e);
    }
  }, [approvalFilter, accessToken, notifyError]);

  const loadMyRequests = useCallback(async () => {
    try {
      const r = await apiFetch("/admin/v1/approvals/my-requests", undefined, accessToken);
      if (r.ok) {
        const d = (await r.json()) as ApprovalListResponse;
        setMyApprovals(d.items || []);
      }
    } catch (e) {
      notifyError("Failed to load my approval requests");
      console.error("loadMyRequests failed:", e);
    }
  }, [accessToken, notifyError]);

  const loadMyPending = useCallback(async () => {
    try {
      const r = await apiFetch("/admin/v1/approvals/my-pending", undefined, accessToken);
      if (r.ok) {
        const d = (await r.json()) as ApprovalListResponse;
        setMyPending(d.items || []);
      }
    } catch (e) {
      notifyError("Failed to load pending approvals");
      console.error("loadMyPending failed:", e);
    }
  }, [accessToken, notifyError]);

  const createApproval = useCallback(
    async (selectedRuleId: string, rules: Array<{ id: string; current_version: number }>) => {
      const targetRuleId = approvalRuleId || selectedRuleId;
      if (!targetRuleId) {
        notifyError("Select a rule first");
        return;
      }
      const rule = rules.find((r) => r.id === targetRuleId);
      setApprBusy(true);
      try {
        const body: Record<string, unknown> = {
          rule_id: targetRuleId,
          version: rule?.current_version || 1,
          comment: approvalComment.trim() || "Requesting publish approval",
        };
        if (approvalReviewer.trim()) body.reviewer = approvalReviewer.trim();
        const r = await apiFetch("/admin/v1/approvals", {
          method: "POST",
          body: JSON.stringify(body),
        }, accessToken);
        if (!r.ok) throw new Error((await r.json())?.message || `HTTP ${r.status}`);
        notifySucc("Approval request submitted!");
        setApprovalRuleId("");
        setApprovalComment("");
        setApprovalReviewer("");
        await loadApprovals();
      } catch (e) {
        notifyError((e as Error).message);
      } finally {
        setApprBusy(false);
      }
    },
    [approvalRuleId, approvalComment, approvalReviewer, loadApprovals, notifyError, notifySucc, accessToken],
  );

  const reviewApproval = useCallback(
    async (id: string, action: string) => {
      setApprBusy(true);
      try {
        const r = await apiFetch(`/admin/v1/approvals/${id}/review`, {
          method: "POST",
          body: JSON.stringify({ action }),
        }, accessToken);
        if (!r.ok) throw new Error((await r.json())?.message || `HTTP ${r.status}`);
        notifySucc(`Approval ${action}d!`);
        await loadApprovals();
        await loadMyPending();
      } catch (e) {
        notifyError((e as Error).message);
      } finally {
        setApprBusy(false);
      }
    },
    [loadApprovals, loadMyPending, notifyError, notifySucc, accessToken],
  );

  const deleteApproval = useCallback(
    async (id: string) => {
      setApprBusy(true);
      try {
        const r = await apiFetch(`/admin/v1/approvals/${id}`, {
          method: "DELETE",
        }, accessToken);
        if (!r.ok) throw new Error((await r.json())?.message || `HTTP ${r.status}`);
        notifySucc("Approval deleted");
        await loadApprovals();
        await loadMyRequests();
        await loadMyPending();
      } catch (e) {
        notifyError((e as Error).message);
      } finally {
        setApprBusy(false);
      }
    },
    [loadApprovals, loadMyRequests, loadMyPending, notifyError, notifySucc, accessToken],
  );

  const setApprovalTabPersisted = useCallback((tab: string) => {
    setApprovalTab(tab);
    if (typeof window !== "undefined") localStorage.setItem("approvals_tab", tab);
  }, []);

  // loadApprovals is called explicitly from page.tsx when the session is ready.
  // Do NOT auto-fetch here to avoid 401s when no valid session exists.

  return {
    approvals, myApprovals, myPending,
    approvalFilter, approvalTab,
    apprBusy,
    approvalRuleId, approvalComment, approvalReviewer,
    setApprovalFilter, setApprovalTab: setApprovalTabPersisted,
    setApprovalRuleId, setApprovalComment, setApprovalReviewer,
    loadApprovals, loadMyRequests, loadMyPending,
    createApproval, reviewApproval, deleteApproval,
  };
}

export function useAnalytics(notifyError?: (msg: string) => void) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsHours, setAnalyticsHours] = useState("24");
  const [analyticsBusy, setAnalyticsBusy] = useState(false);
  const [topApis, setTopApis] = useState<TopApisResponse | null>(null);
  const [keyStats, setKeyStats] = useState<ApiKeyStatsResponse | null>(null);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsBusy(true);
    try {
      const res = await apiFetch(`/admin/v1/metrics/dashboard?hours=${analyticsHours}`);
      if (res.ok) {
        const data = await res.json() as {
          analytics: AnalyticsData;
          top_apis: TopApisResponse;
          api_key_stats: ApiKeyStatsResponse;
        };
        setAnalytics(data.analytics);
        setTopApis(data.top_apis);
        setKeyStats(data.api_key_stats);
      }
    } catch (e) {
      notifyError?.("Failed to load analytics");
      console.error("loadAnalytics failed:", e);
    } finally {
      setAnalyticsBusy(false);
    }
  }, [analyticsHours, notifyError]);

  return {
    analytics,
    analyticsHours,
    analyticsBusy,
    topApis,
    keyStats,
    setAnalyticsHours,
    loadAnalytics,
  };
}
