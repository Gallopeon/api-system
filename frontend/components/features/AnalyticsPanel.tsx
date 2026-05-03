"use client";

import { RotateCcw } from "lucide-react";
import { cardClass, inputClass, btnSecondary } from "@/lib/constants";
import type { AnalyticsData, TopApisResponse, ApiKeyStatsResponse } from "@/lib/types";

interface AnalyticsPanelProps {
  analytics: AnalyticsData | null;
  analyticsHours: string;
  analyticsBusy: boolean;
  topApis: TopApisResponse | null;
  keyStats: ApiKeyStatsResponse | null;
  onSetAnalyticsHours: (v: string) => void;
  onRefresh: () => void;
  t: <T>(en: T, zh: T) => T;
}

export default function AnalyticsPanel({
  analytics, analyticsHours, analyticsBusy, topApis, keyStats,
  onSetAnalyticsHours, onRefresh, t,
}: AnalyticsPanelProps) {
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("Analytics Dashboard", "分析仪表板")}</h1>
          <p className="text-gray-500 mt-1">{t("Real-time API usage metrics and performance trends.", "实时 API 使用指标和性能趋势。")}</p>
        </div>
        <div className="flex items-center gap-3">
          <select className={`${inputClass} w-32`} value={analyticsHours} onChange={(e) => onSetAnalyticsHours(e.target.value)}>
            {[1, 6, 12, 24, 48, 168].map((h) => (
              <option key={h} value={h}>{h}h</option>
            ))}
          </select>
          <button onClick={onRefresh} disabled={analyticsBusy} className={btnSecondary}>
            <RotateCcw className="w-4 h-4 mr-2" />{analyticsBusy ? t("Loading...", "加载中...") : t("Refresh", "刷新")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { label: t("Total Requests", "请求总数"), val: (analytics?.total_requests ?? 0).toLocaleString(), color: "blue" },
          { label: t("Avg Latency", "平均延迟"), val: `${(analytics?.avg_latency_ms ?? 0).toFixed(1)}ms`, color: "green" },
          { label: t("P95 Latency", "P95 延迟"), val: `${analytics?.p95_latency_ms ?? 0}ms`, color: "yellow" },
          { label: t("P99 Latency", "P99 延迟"), val: `${analytics?.p99_latency_ms ?? 0}ms`, color: "orange" },
          { label: t("Error Rate", "错误率"), val: `${((analytics?.error_rate ?? 0) * 100).toFixed(2)}%`, color: "red" },
        ].map((kpi, i) => (
          <div key={i} className={`${cardClass} border-t-4 border-t-${kpi.color}-500 text-center`}>
            <div className="text-xs text-gray-500 mb-1">{kpi.label}</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{kpi.val}</div>
          </div>
        ))}
      </div>

      <div className={cardClass}>
        <h3 className="text-lg font-bold mb-4">{t("Requests by Hour", "按小时请求量")}</h3>
        {analytics?.requests_by_hour && analytics.requests_by_hour.length > 0 ? (
          <div className="flex items-end gap-0.5 h-48">
            {analytics.requests_by_hour.map((h, i) => {
              const maxCount = Math.max(...analytics.requests_by_hour.map((x) => x.count), 1);
              const heightPct = (h.count / maxCount) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative" title={`${h.hour}: ${h.count} reqs, ${h.avg_latency.toFixed(1)}ms`}>
                  <div className="w-full bg-blue-500 hover:bg-blue-400 rounded-t transition-all" style={{ height: `${Math.max(heightPct, 2)}%` }} />
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-400 text-sm text-center py-8">{t("No data available yet. Requests are ingested via /api/v1/metrics/ingest", "暂无数据。通过 /api/v1/metrics/ingest 上报请求指标。")}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={cardClass}>
          <h3 className="text-lg font-bold mb-4">{t("Top APIs", "热门 API")}</h3>
          {topApis?.items && topApis.items.length > 0 ? (
            <div className="space-y-2">
              {topApis.items.slice(0, 8).map((api, i) => {
                const maxCount = Math.max(...topApis.items.map((x) => x.count), 1);
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 w-5">{i + 1}.</span>
                    <div className="flex-1">
                      <div className="text-sm font-mono truncate">{api.api_path}</div>
                      <div className="text-xs text-gray-400">{api.count.toLocaleString()} reqs | {api.avg_latency.toFixed(1)}ms</div>
                    </div>
                    <div className="w-16 bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                      <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.min((api.count / maxCount) * 100, 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-4">{t("No data", "无数据")}</p>
          )}
        </div>

        <div className={cardClass}>
          <h3 className="text-lg font-bold mb-4">{t("Status Distribution", "状态码分布")}</h3>
          {analytics?.status_distribution && analytics.status_distribution.length > 0 ? (
            <div className="space-y-2">
              {analytics.status_distribution.map((s, i) => {
                const total = analytics.status_distribution.reduce((sum, x) => sum + x.count, 0);
                const pct = total > 0 ? (s.count / total) * 100 : 0;
                const color = s.status_code < 300 ? "bg-green-500" : s.status_code < 400 ? "bg-yellow-500" : s.status_code < 500 ? "bg-orange-500" : "bg-red-500";
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`text-xs font-bold w-10 ${s.status_code < 300 ? "text-green-600" : s.status_code < 400 ? "text-yellow-600" : "text-red-600"}`}>{s.status_code}</span>
                    <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-3 overflow-hidden">
                      <div className={`${color} h-full rounded-full transition-all`} style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-16 text-right">{s.count.toLocaleString()} ({pct.toFixed(1)}%)</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-4">{t("No data", "无数据")}</p>
          )}
        </div>
      </div>

      <div className={`${cardClass} p-0 overflow-hidden`}>
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-800 text-gray-500">
            <tr>
              <th className="px-4 py-3">{t("API Key", "API 密钥")}</th>
              <th className="px-4 py-3">{t("Total Calls", "总调用")}</th>
              <th className="px-4 py-3">{t("Avg Latency", "平均延迟")}</th>
              <th className="px-4 py-3">{t("Errors", "错误数")}</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-800">
            {keyStats?.items && keyStats.items.length > 0 ? (
              keyStats.items.map((k, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{k.key_name}</div>
                    <div className="text-xs text-gray-400 font-mono">{k.key_id}</div>
                  </td>
                  <td className="px-4 py-3 font-mono">{k.total_calls.toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono">{k.avg_latency.toFixed(1)}ms</td>
                  <td className="px-4 py-3">
                    <span className={k.error_count > 0 ? "text-red-500 font-bold" : "text-gray-400"}>{k.error_count}</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">{t("No data", "无数据")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
