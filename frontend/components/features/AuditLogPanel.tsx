"use client";

import { RotateCcw, ShieldAlert } from "lucide-react";
import { cardClass, btnSecondary } from "@/lib/constants";
import type { AuditLogItem } from "@/lib/types";

interface AuditLogPanelProps {
  auditItems: AuditLogItem[];
  onRefresh: () => void;
  t: <T>(en: T, zh: T) => T;
}

export default function AuditLogPanel({ auditItems, onRefresh, t }: AuditLogPanelProps) {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("Comprehensive Audit Log", "全面审计日志")}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-sm">{t("Real-time trail of all administrative operations.", "所有管理操作的实时审计跟踪。")}</p>
        </div>
        <button onClick={onRefresh} className={`${btnSecondary} whitespace-nowrap shrink-0`}>
          <RotateCcw className="w-4 h-4 mr-2" /> {t("Pull Latest Logs", "拉取最新日志")}
        </button>
      </div>
      <div className={`${cardClass} p-0 overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left resp-table">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 font-medium">{t("Timestamp", "时间戳")}</th>
                <th className="px-4 py-3 font-medium">{t("Actor", "操作人")}</th>
                <th className="px-4 py-3 font-medium">{t("Action", "操作")}</th>
                <th className="px-4 py-3 font-medium">{t("Rule ID", "规则 ID")}</th>
                <th className="px-4 py-3 font-medium text-right">{t("Status", "状态")}</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-800 cursor-default">
              {auditItems.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500" data-label={t("Timestamp", "时间戳")}>
                    {new Date(a.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-semibold" data-label={t("Actor", "操作人")}>{a.actor}</td>
                  <td className="px-4 py-3" data-label={t("Action", "操作")}>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded text-xs tracking-wide">
                      {a.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" data-label={t("Rule ID", "规则 ID")}>{a.rule_id || "-"}</td>
                  <td className="px-4 py-3 text-right" data-label={t("Status", "状态")}>
                    {a.success ? (
                      <span className="text-green-500 font-bold tracking-wide">{t("SUCCESS", "成功")}</span>
                    ) : (
                      <span className="text-red-500 font-bold tracking-wide">{t("FAILED", "失败")}</span>
                    )}
                  </td>
                </tr>
              ))}
              {auditItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    {t("No recent audit trails available.", "暂无近期审计记录。")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
