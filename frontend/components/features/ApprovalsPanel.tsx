"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary, btnSecondary } from "@/lib/constants";
import { apiFetch } from "@/lib/api";
import type { RuleSummary } from "@/lib/types";

interface ApprovalsPanelProps {
  approvals: Array<{
    id: string; rule_id: string; version: number;
    requestor: string; reviewer: string | null;
    status: string; comment: string | null;
    created_at: string; reviewed_at: string | null;
  }>;
  approvalFilter: string;
  apprBusy: boolean;
  approvalRuleId: string;
  approvalComment: string;
  rules: RuleSummary[];
  onSetApprovalFilter: (v: string) => void;
  onSetApprovalRuleId: (v: string) => void;
  onSetApprovalComment: (v: string) => void;
  onCreateApproval: () => void;
  onReviewApproval: (id: string, action: string) => void;
  onRefresh: () => void;
  t: <T>(en: T, zh: T) => T;
}

export default function ApprovalsPanel({
  approvals, approvalFilter, apprBusy, approvalRuleId, approvalComment,
  rules, onSetApprovalFilter, onSetApprovalRuleId, onSetApprovalComment,
  onCreateApproval, onReviewApproval, onRefresh, t,
}: ApprovalsPanelProps) {
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("Approval Workflow", "审批工作流")}</h1>
          <p className="text-gray-500 mt-1">{t("Manage rule publishing approvals, review and gate releases.", "管理规则发布审批、审查和发布门禁。")}</p>
        </div>
        <button onClick={onRefresh} className={`${btnSecondary} shrink-0`}>
          <RotateCcw className="w-4 h-4 mr-2" />{t("Refresh", "刷新")}
        </button>
      </div>

      <div className={`${cardClass} border-l-4 border-l-emerald-500`}>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          {t("Create Approval Request", "创建审批申请")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="space-y-1.5">
            <label className={labelClass}>
              {t("Target Rule", "目标规则")} <span className="text-red-500">*</span>
            </label>
            <select className={inputClass} value={approvalRuleId} onChange={(e) => onSetApprovalRuleId(e.target.value)}>
              <option value="">{t("Select a rule...", "请选择规则...")}</option>
              {rules.filter((r) => r.status === "published" || r.status === "draft").map((r) => (
                <option key={r.id} value={r.id}>{r.name} ({r.api_path})</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>{t("Comment", "备注说明")}</label>
            <input className={inputClass} value={approvalComment} onChange={(e) => onSetApprovalComment(e.target.value)} placeholder={t("e.g. Ready for production release", "如：准备发布上线")} />
          </div>
          <div className="flex items-end">
            <button onClick={onCreateApproval} disabled={apprBusy || !approvalRuleId} className={`${btnPrimary} px-6 w-full`}>
              {apprBusy ? t("Submitting...", "提交中...") : t("Submit Approval", "提交审批")}
            </button>
          </div>
        </div>
      </div>

      {approvals.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { n: approvals.length, l: t("Total", "全部"), c: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" },
            { n: approvals.filter((a) => a.status === "pending").length, l: t("Pending", "待审批"), c: "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20" },
            { n: approvals.filter((a) => a.status === "approved").length, l: t("Approved", "已通过"), c: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20" },
          ].map((s, i) => (
            <div key={i} className={`${cardClass} text-center py-4`}>
              <div className={`text-2xl font-bold ${s.c.split(" ")[0]}`}>{s.n}</div>
              <div className="text-xs text-gray-500 mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <select className={`${inputClass} w-36`} value={approvalFilter} onChange={(e) => { onSetApprovalFilter(e.target.value); setTimeout(onRefresh, 50); }}>
          <option value="">{t("All Status", "全部状态")}</option>
          <option value="pending">{t("Pending", "待审批")}</option>
          <option value="approved">{t("Approved", "已通过")}</option>
          <option value="rejected">{t("Rejected", "已拒绝")}</option>
        </select>
        <span className="text-xs text-gray-400">{approvals.length} {t("records", "条记录")}</span>
      </div>

      <div className={`${cardClass} p-0 overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 font-medium">{t("Rule ID", "规则 ID")}</th>
                <th className="px-5 py-3 font-medium">{t("Version", "版本")}</th>
                <th className="px-5 py-3 font-medium">{t("Requestor", "申请人")}</th>
                <th className="px-5 py-3 font-medium">{t("Reviewer", "审批人")}</th>
                <th className="px-5 py-3 font-medium">{t("Status", "状态")}</th>
                <th className="px-5 py-3 font-medium">{t("Comment", "备注")}</th>
                <th className="px-5 py-3 text-right font-medium">{t("Actions", "操作")}</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-800">
              {approvals.map((a) => {
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
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold ${
                        a.status === "approved" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                        a.status === "rejected" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          a.status === "approved" ? "bg-green-500" : a.status === "rejected" ? "bg-red-500" : "bg-yellow-500"
                        }`} />
                        {a.status === "approved" ? t("Approved", "已通过") : a.status === "rejected" ? t("Rejected", "已拒绝") : t("Pending", "待审批")}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-500 max-w-xs truncate">{a.comment || "—"}</td>
                    <td className="px-5 py-3.5 text-right">
                      {a.status === "pending" ? (
                        <div className="flex items-center justify-end gap-1.5 opacity-70 group-hover:opacity-100 transition">
                          <button onClick={() => onReviewApproval(a.id, "approve")} disabled={apprBusy}
                            className="p-2 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-700 transition" title={t("Approve", "通过")}>
                            ✓
                          </button>
                          <button onClick={() => onReviewApproval(a.id, "reject")} disabled={apprBusy}
                            className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition" title={t("Reject", "拒绝")}>
                            ✕
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString()}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {approvals.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-12 text-center">
                  <div className="text-gray-500 font-medium">{t("No approvals yet", "暂无审批记录")}</div>
                  <div className="text-gray-400 text-xs mt-1">{t("Create an approval request using the form above.", "请使用上方的表单创建审批申请。")}</div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
