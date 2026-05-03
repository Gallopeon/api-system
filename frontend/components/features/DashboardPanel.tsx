"use client";

import { RotateCcw, Activity, SlidersHorizontal, Layers, Database } from "lucide-react";
import { cardClass } from "@/lib/constants";
import type { MetricsOverview } from "@/lib/types";

interface DashboardPanelProps {
  metrics: MetricsOverview | null;
  onRefresh: () => void;
  btnSecondary: string;
  t: <T>(en: T, zh: T) => T;
}

export default function DashboardPanel({ metrics, onRefresh, btnSecondary, t }: DashboardPanelProps) {
  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            {t("Control Dashboard", "控制平面概览")}
          </h1>
          <p className="text-gray-500">
            {t("Overview of API governance and rule metrics.", "API 治理与规则指标总览。")}
          </p>
        </div>
        <button onClick={onRefresh} className={btnSecondary}>
          <RotateCcw className="w-4 h-4 mr-2" /> {t("Refresh Data", "刷新数据")}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: t("Uptime", "运行时间"), val: `${((metrics?.uptime_seconds || 0) / 3600).toFixed(1)}h`, icon: Activity },
          { label: t("Active Rules", "生效规则"), val: metrics?.total_rules ?? 0, icon: SlidersHorizontal },
          { label: t("Versions Tracked", "版本记录"), val: metrics?.total_versions ?? 0, icon: Layers },
          { label: t("Audit Traits", "审计条目"), val: metrics?.total_audit_events ?? 0, icon: Database },
        ].map((s, i) => (
          <div key={i} className={`${cardClass} flex items-center space-x-4 border-l-4 border-l-blue-500 hover:shadow-md transition`}>
            <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg">
              <s.icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">{s.label}</div>
              <div className="text-2xl font-bold">{s.val}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
