"use client";

import { RotateCcw, Activity, SlidersHorizontal, Layers, Database } from "lucide-react";
import { cardClass, btnSecondary } from "@/lib/constants";
import type { MetricsOverview } from "@/lib/types";

interface DashboardPanelProps {
  metrics: MetricsOverview | null;
  onRefresh: () => void;
  t: <T>(en: T, zh: T) => T;
}

const kpiCards = [
  { key: "uptime", icon: Activity, color: "blue" },
  { key: "rules", icon: SlidersHorizontal, color: "emerald" },
  { key: "versions", icon: Layers, color: "violet" },
  { key: "audit", icon: Database, color: "amber" },
] as const;

const colorMap: Record<string, { bg: string; icon: string; border: string }> = {
  blue:    { bg: "bg-blue-50 dark:bg-blue-900/30",   icon: "text-blue-600 dark:text-blue-400",   border: "border-l-blue-500" },
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-900/30", icon: "text-emerald-600 dark:text-emerald-400", border: "border-l-emerald-500" },
  violet:  { bg: "bg-violet-50 dark:bg-violet-900/30",  icon: "text-violet-600 dark:text-violet-400",  border: "border-l-violet-500" },
  amber:   { bg: "bg-amber-50 dark:bg-amber-900/30",   icon: "text-amber-600 dark:text-amber-400",   border: "border-l-amber-500" },
};

export default function DashboardPanel({ metrics, onRefresh, t }: DashboardPanelProps) {
  const vals: Record<string, string> = {
    uptime:   `${((metrics?.uptime_seconds || 0) / 3600).toFixed(1)}h`,
    rules:    String(metrics?.total_rules ?? 0),
    versions: String(metrics?.total_versions ?? 0),
    audit:    String(metrics?.total_audit_events ?? 0),
  };

  const labels: Record<string, string> = {
    uptime:   t("Uptime", "运行时间"),
    rules:    t("Active Rules", "生效规则"),
    versions: t("Versions Tracked", "版本记录"),
    audit:    t("Audit Traits", "审计条目"),
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {t("Control Dashboard", "控制平面概览")}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-sm">
            {t("Overview of API governance and rule metrics.", "API 治理与规则指标总览。")}
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 shrink-0 whitespace-nowrap rounded-lg px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-zinc-700 hover:border-gray-300 dark:hover:border-gray-600 shadow-sm transition-all active:scale-95"
        >
          <RotateCcw className="w-4 h-4" />
          {t("Refresh Data", "刷新数据")}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {kpiCards.map(({ key, icon: Icon, color }) => {
          const c = colorMap[color];
          return (
            <div
              key={key}
              className={`${cardClass} flex items-center gap-4 border-l-4 ${c.border} hover:shadow-md transition-shadow group cursor-default`}
            >
              <div className={`p-3 rounded-xl ${c.bg} transition-colors`}>
                <Icon className={`w-6 h-6 ${c.icon}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {labels[key]}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-0.5 tabular-nums">
                  {vals[key]}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
