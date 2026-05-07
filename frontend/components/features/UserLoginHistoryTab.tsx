"use client";

import { cardClass } from "@/lib/constants";
import type { LoginHistoryItem } from "@/lib/types";

interface Props {
  loginHistory: LoginHistoryItem[];
  t: <T>(en: T, zh: T) => T;
}

export default function UserLoginHistoryTab({ loginHistory, t }: Props) {
  return (
    <div className={cardClass}>
      <h2 className="text-lg font-semibold mb-4">{t("Login History", "登录历史")}</h2>
      {loginHistory.length === 0 ? (
        <p className="text-gray-400">{t("No login history", "无登录记录")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                <th className="py-2 pr-4 font-medium text-gray-500">{t("Time", "时间")}</th>
                <th className="py-2 pr-4 font-medium text-gray-500">{t("Username", "用户名")}</th>
                <th className="py-2 pr-4 font-medium text-gray-500">{t("Status", "状态")}</th>
                <th className="py-2 font-medium text-gray-500">{t("Reason", "原因")}</th>
              </tr>
            </thead>
            <tbody>
              {loginHistory.map((h) => {
                const date = new Date(h.created_at);
                const dateString = isNaN(date.getTime()) ? h.created_at : date.toLocaleString();

                return (
                <tr key={h.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2 pr-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {dateString}
                  </td>
                  <td className="py-2 pr-4">{h.username_attempt}</td>
                  <td className="py-2 pr-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      h.success
                        ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                        : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                    }`}>
                      {h.success ? t("Success", "成功") : t("Failed", "失败")}
                    </span>
                  </td>
                  <td className="py-2 text-gray-500 text-xs">{h.failure_reason || "—"}</td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
