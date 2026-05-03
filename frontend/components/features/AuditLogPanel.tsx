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
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      <h1 className="text-3xl font-bold">{t("Comprehensive Audit Log", "全面审计日志")}</h1>
      <div className={`${cardClass} flex space-x-4`}>
        <button onClick={onRefresh} className={btnSecondary}>
          <RotateCcw className="w-4 h-4 mr-2" /> {t("Pull Latest Logs", "拉取最新日志")}
        </button>
      </div>
      <div className={`${cardClass} p-0 overflow-hidden`}>
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-800 text-gray-500">
            <tr>
              <th className="px-4 py-3">{t("Timestamp", "时间戳")}</th>
              <th className="px-4 py-3">{t("Actor", "操作人")}</th>
              <th className="px-4 py-3">{t("Action", "操作")}</th>
              <th className="px-4 py-3">{t("Rule ID", "规则 ID")}</th>
              <th className="px-4 py-3 text-right">{t("Status", "状态")}</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-800 cursor-default">
            {auditItems.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-900 transition">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                  {new Date(a.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 font-semibold">{a.actor}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded text-xs tracking-wide">
                    {a.action}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{a.rule_id || "-"}</td>
                <td className="px-4 py-3 text-right">
                  {a.success ? (
                    <span className="text-green-500 font-bold tracking-wide">
                      {t("SUCCESS", "成功")}
                    </span>
                  ) : (
                    <span className="text-red-500 font-bold tracking-wide">
                      {t("FAILED", "失败")}
                    </span>
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
  );
}
