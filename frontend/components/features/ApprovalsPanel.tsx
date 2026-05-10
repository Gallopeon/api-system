"use client";

import { useState } from "react";
import { RotateCcw, UserCheck, Trash2, X, AlertTriangle } from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary, btnSecondary } from "@/lib/constants";
import type { RuleSummary } from "@/lib/types";

type ApprovalItem = {
  id: string; rule_id: string; version: number;
  requestor: string; reviewer: string | null;
  status: string; comment: string | null;
  created_at: string; reviewed_at: string | null;
};

interface ApprovalsPanelProps {
  approvals: ApprovalItem[];
  myApprovals: ApprovalItem[];
  myPending: ApprovalItem[];
  approvalFilter: string;
  approvalTab: string;
  apprBusy: boolean;
  approvalRuleId: string;
  approvalComment: string;
  approvalReviewer: string;
  rules: RuleSummary[];
  onSetApprovalFilter: (v: string) => void;
  onSetApprovalTab: (v: string) => void;
  onSetApprovalRuleId: (v: string) => void;
  onSetApprovalComment: (v: string) => void;
  onSetApprovalReviewer: (v: string) => void;
  onCreateApproval: () => void;
  onReviewApproval: (id: string, action: string) => void;
  onDeleteApproval: (id: string) => void;
  onRefresh: () => void;
  onLoadMyRequests: () => void;
  onLoadMyPending: () => void;
  canReview: boolean;
  canDelete: boolean;
  t: <T>(en: T, zh: T) => T;
}

const TABS = [
  { id: "all", en: "All", zh: "全部" },
  { id: "my-requests", en: "My Requests", zh: "我的申请" },
  { id: "my-pending", en: "Pending Review", zh: "待我审批" },
];

export default function ApprovalsPanel({
  approvals, myApprovals, myPending, approvalFilter, approvalTab, apprBusy,
  approvalRuleId, approvalComment, approvalReviewer, rules,
  onSetApprovalFilter, onSetApprovalTab,
  onSetApprovalRuleId, onSetApprovalComment, onSetApprovalReviewer,
  onCreateApproval, onReviewApproval, onDeleteApproval, onRefresh,
  onLoadMyRequests, onLoadMyPending, canReview, canDelete, t,
}: ApprovalsPanelProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const displayData = approvalTab === "my-requests" ? myApprovals : approvalTab === "my-pending" ? myPending : approvals;

  const handleTabSwitch = (tab: string) => {
    onSetApprovalTab(tab);
    if (tab === "my-requests") onLoadMyRequests();
    else if (tab === "my-pending") onLoadMyPending();
    else onRefresh();
  };

  const handleDelete = (id: string) => {
    setDeleteConfirm(id);
  };

  const confirmDelete = async () => {
    if (deleteConfirm) {
      await onDeleteApproval(deleteConfirm);
      setDeleteConfirm(null);
    }
  };

  const statusBadge = (status: string) => (
    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold ${
      status === "approved" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
      status === "rejected" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        status === "approved" ? "bg-green-500" : status === "rejected" ? "bg-red-500" : "bg-yellow-500"
      }`} />
      {status === "approved" ? t("Approved", "已通过") : status === "rejected" ? t("Rejected", "已拒绝") : t("Pending", "待审批")}
    </span>
  );

  const pendingCount = displayData.filter((a) => a.status === "pending").length;
  const approvedCount = displayData.filter((a) => a.status === "approved").length;
  const rejectedCount = displayData.filter((a) => a.status === "rejected").length;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("Approval Workflow", "审批工作流")}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">{t("Manage rule publishing approvals, review and gate releases.", "管理规则发布审批、审查和发布门禁。")}</p>
        </div>
        <button onClick={onRefresh} className={`${btnSecondary} shrink-0`}>
          <RotateCcw className="w-4 h-4 mr-2" />{t("Refresh", "刷新")}
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 space-x-1">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => handleTabSwitch(tab.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              approvalTab === tab.id
                ? "border-blue-600 text-blue-700 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}>
            {t(tab.en, tab.zh)}
            {tab.id === "my-pending" && myPending.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold">{myPending.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Create approval form */}
      <div className={`${cardClass} border-l-4 border-l-emerald-500`}>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-emerald-500" /> {t("Create Approval Request", "创建审批申请")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className={labelClass}>{t("Target Rule", "目标规则")} <span className="text-red-500">*</span></label>
            <select className={inputClass} value={approvalRuleId} onChange={(e) => onSetApprovalRuleId(e.target.value)}>
              <option value="">{t("Select a rule...", "请选择规则...")}</option>
              {rules.filter((r) => r.status === "published" || r.status === "draft").map((r) => (
                <option key={r.id} value={r.id}>{r.name} ({r.api_path})</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>{t("Assign Reviewer", "指派审批人")}</label>
            <input className={inputClass} value={approvalReviewer} onChange={(e) => onSetApprovalReviewer(e.target.value)}
              placeholder={t("username (leave empty for any)", "用户名（留空则任意审批人）")} />
          </div>
          <div>
            <label className={labelClass}>{t("Comment", "备注说明")}</label>
            <input className={inputClass} value={approvalComment} onChange={(e) => onSetApprovalComment(e.target.value)}
              placeholder={t("e.g. Ready for production", "如：准备发布上线")} />
          </div>
          <div className="flex items-end">
            <button onClick={onCreateApproval} disabled={apprBusy || !approvalRuleId} className={`${btnPrimary} px-6 w-full`}>
              {apprBusy ? t("Submitting...", "提交中...") : t("Submit Approval", "提交审批")}
            </button>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className={`${cardClass} text-center py-4 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-zinc-900 border border-blue-100 dark:border-blue-900/30`}>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{displayData.length}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t("Total", "全部记录")}</div>
        </div>
        <div className={`${cardClass} text-center py-4 bg-gradient-to-br from-yellow-50 to-white dark:from-yellow-950/30 dark:to-zinc-900 border border-yellow-100 dark:border-yellow-900/30`}>
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{pendingCount}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t("Pending", "待审批")}</div>
        </div>
        <div className={`${cardClass} text-center py-4 bg-gradient-to-br from-green-50 to-white dark:from-green-950/30 dark:to-zinc-900 border border-green-100 dark:border-green-900/30`}>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{approvedCount}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t("Approved", "已通过")}</div>
        </div>
        <div className={`${cardClass} text-center py-4 bg-gradient-to-br from-red-50 to-white dark:from-red-950/30 dark:to-zinc-900 border border-red-100 dark:border-red-900/30`}>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{rejectedCount}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t("Rejected", "已拒绝")}</div>
        </div>
      </div>

      {/* Filter bar */}
      {approvalTab === "all" && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <select
              className={`${inputClass} w-36`}
              value={approvalFilter}
              onChange={(e) => { onSetApprovalFilter(e.target.value); setTimeout(onRefresh, 50); }}
            >
              <option value="">{t("All Status", "全部状态")}</option>
              <option value="pending">{t("Pending", "待审批")}</option>
              <option value="approved">{t("Approved", "已通过")}</option>
              <option value="rejected">{t("Rejected", "已拒绝")}</option>
            </select>
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full">
            {t(`Showing ${displayData.length} records`, `显示 ${displayData.length} 条记录`)}
          </span>
        </div>
      )}

      {/* Not all tabs */}
      {approvalTab !== "all" && (
        <div className="flex justify-end">
          <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full">
            {t(`Showing ${displayData.length} records`, `显示 ${displayData.length} 条记录`)}
          </span>
        </div>
      )}

      {/* Table */}
      <div className={`${cardClass} p-0 overflow-hidden rounded-xl shadow-sm`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 font-medium">{t("Rule", "规则")}</th>
                <th className="px-5 py-3 font-medium">{t("Version", "版本")}</th>
                <th className="px-5 py-3 font-medium">{t("Requestor", "申请人")}</th>
                <th className="px-5 py-3 font-medium">{t("Reviewer", "审批人")}</th>
                <th className="px-5 py-3 font-medium">{t("Status", "状态")}</th>
                <th className="px-5 py-3 font-medium">{t("Comment", "备注")}</th>
                <th className="px-5 py-3 text-right font-medium">{t("Actions", "操作")}</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-800">
              {displayData.map((a) => {
                const ruleName = rules.find((r) => r.id === a.rule_id)?.name;
                return (
                  <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition group">
                    <td className="px-5 py-3.5">
                      <div className="font-mono text-xs text-gray-700 dark:text-gray-300">{a.rule_id.substring(0, 8)}...</div>
                      <div className="text-xs text-gray-400 mt-0.5">{ruleName || "—"}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 font-mono text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-md">v{a.version}</span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-700 dark:text-gray-300">{a.requestor}</td>
                    <td className="px-5 py-3.5 text-gray-500">{a.reviewer || <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                    <td className="px-5 py-3.5">{statusBadge(a.status)}</td>
                    <td className="px-5 py-3.5 text-xs text-gray-500 max-w-xs truncate">{a.comment || "—"}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {a.status === "pending" && canReview ? (
                          <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition">
                            <button onClick={() => onReviewApproval(a.id, "approve")} disabled={apprBusy}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                              title={t("Approve", "通过")}>{t("Approve", "通过")}</button>
                            <button onClick={() => onReviewApproval(a.id, "reject")} disabled={apprBusy}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                              title={t("Reject", "拒绝")}>{t("Reject", "拒绝")}</button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">{new Date(a.reviewed_at || a.created_at).toLocaleDateString()}</span>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete(a.id)} disabled={apprBusy}
                            className="ml-1 p-1.5 rounded-lg text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition"
                            title={t("Delete", "删除")}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {displayData.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-16 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <UserCheck className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                  </div>
                  <div className="text-gray-500 font-medium">{t("No approvals yet", "暂无审批记录")}</div>
                  <div className="text-gray-400 text-xs mt-1">{t("Create a request or switch tabs.", "创建审批申请或切换标签页。")}</div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-bold">{t("Delete Approval", "删除审批记录")}</h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              {t("Are you sure you want to delete this approval record? This action cannot be undone.", "确定要删除此审批记录吗？此操作不可撤销。")}
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className={btnSecondary} disabled={apprBusy}>
                {t("Cancel", "取消")}
              </button>
              <button onClick={confirmDelete} disabled={apprBusy}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50">
                {apprBusy ? t("Deleting...", "删除中...") : t("Delete", "确认删除")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
