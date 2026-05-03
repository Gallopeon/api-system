import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
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

export function useDashboard() {
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
    } catch {
      setLiveState("down");
      setReadyState("down");
    }
  }, []);

  const loadMetrics = useCallback(async () => {
    try {
      const r = await apiFetch("/admin/v1/metrics/overview");
      if (r.ok) setMetrics(await r.json());
    } catch {
      /* ignore */
    }
  }, []);

  return { metrics, liveState, readyState, loadHealthStatus, loadMetrics };
}

export function useAuditLog() {
  const [auditItems, setAuditItems] = useState<AuditLogItem[]>([]);

  const loadAuditLogs = useCallback(async () => {
    try {
      const r = await apiFetch("/admin/v1/audit/logs?limit=40&offset=0");
      if (r.ok) {
        const d = (await r.json()) as AuditLogResponse;
        setAuditItems(d.items || []);
      }
    } catch {
      /* ignore */
    }
  }, []);

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
  const [approvalTab, setApprovalTab] = useState("all");
  const [apprBusy, setApprBusy] = useState(false);
  const [approvalRuleId, setApprovalRuleId] = useState("");
  const [approvalComment, setApprovalComment] = useState("");
  const [approvalReviewer, setApprovalReviewer] = useState("");

  const loadApprovals = useCallback(async () => {
    try {
      const qs = approvalFilter ? `?status=${approvalFilter}` : "?limit=30&offset=0";
      const r = await apiFetch(`/admin/v1/approvals${qs}`, undefined, accessToken);
      if (r.ok) {
        const d = (await r.json()) as ApprovalListResponse;
        setApprovals(d.items || []);
      }
    } catch {
      /* ignore */
    }
  }, [approvalFilter, accessToken]);

  const loadMyRequests = useCallback(async () => {
    try {
      const r = await apiFetch("/admin/v1/approvals/my-requests", undefined, accessToken);
      if (r.ok) {
        const d = (await r.json()) as ApprovalListResponse;
        setMyApprovals(d.items || []);
      }
    } catch { /* ignore */ }
  }, [accessToken]);

  const loadMyPending = useCallback(async () => {
    try {
      const r = await apiFetch("/admin/v1/approvals/my-pending", undefined, accessToken);
      if (r.ok) {
        const d = (await r.json()) as ApprovalListResponse;
        setMyPending(d.items || []);
      }
    } catch { /* ignore */ }
  }, [accessToken]);

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

  return {
    approvals, myApprovals, myPending,
    approvalFilter, approvalTab,
    apprBusy,
    approvalRuleId, approvalComment, approvalReviewer,
    setApprovalFilter, setApprovalTab,
    setApprovalRuleId, setApprovalComment, setApprovalReviewer,
    loadApprovals, loadMyRequests, loadMyPending,
    createApproval, reviewApproval,
  };
}

export function useAnalytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsHours, setAnalyticsHours] = useState("24");
  const [analyticsBusy, setAnalyticsBusy] = useState(false);
  const [topApis, setTopApis] = useState<TopApisResponse | null>(null);
  const [keyStats, setKeyStats] = useState<ApiKeyStatsResponse | null>(null);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsBusy(true);
    try {
      const [aRes, tRes, kRes] = await Promise.all([
        apiFetch(`/admin/v1/metrics/analytics?hours=${analyticsHours}`),
        apiFetch(`/admin/v1/metrics/top-apis?hours=${analyticsHours}`),
        apiFetch(`/admin/v1/metrics/api-key-stats?hours=${analyticsHours}`),
      ]);
      if (aRes.ok) setAnalytics((await aRes.json()) as AnalyticsData);
      if (tRes.ok) setTopApis((await tRes.json()) as TopApisResponse);
      if (kRes.ok) setKeyStats((await kRes.json()) as ApiKeyStatsResponse);
    } catch {
      /* ignore */
    } finally {
      setAnalyticsBusy(false);
    }
  }, [analyticsHours]);

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
