"use client";

import { RotateCcw, Activity, Power, PowerOff, Trash2 } from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary, btnSecondary } from "@/lib/constants";
import type { RateLimitItem } from "@/lib/types";

interface RateLimitsPanelProps {
  rateLimits: RateLimitItem[];
  rlName: string;
  rlApiPath: string;
  rlWindow: string;
  rlMaxReq: string;
  rlBurst: string;
  rlQuotaDaily: string;
  rlQuotaMonthly: string;
  rlPerKey: boolean;
  rlPerIp: boolean;
  rlBusy: boolean;
  setRlName: (v: string) => void;
  setRlApiPath: (v: string) => void;
  setRlWindow: (v: string) => void;
  setRlMaxReq: (v: string) => void;
  setRlBurst: (v: string) => void;
  setRlQuotaDaily: (v: string) => void;
  setRlQuotaMonthly: (v: string) => void;
  setRlPerKey: (v: boolean) => void;
  setRlPerIp: (v: boolean) => void;
  onCreate: () => void;
  onToggle: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  canWrite: boolean;
  t: <T>(en: T, zh: T) => T;
}

export default function RateLimitsPanel({
  rateLimits, rlName, rlApiPath, rlWindow, rlMaxReq, rlBurst,
  rlQuotaDaily, rlQuotaMonthly, rlPerKey, rlPerIp, rlBusy,
  setRlName, setRlApiPath, setRlWindow, setRlMaxReq, setRlBurst,
  setRlQuotaDaily, setRlQuotaMonthly, setRlPerKey, setRlPerIp,
  onCreate, onToggle, onDelete, onRefresh, canWrite, t,
}: RateLimitsPanelProps) {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div><h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("Rate Limit Management", "限流管理")}</h1><p className="text-gray-500 dark:text-gray-400 mt-1.5 text-sm">{t("Configure per-API rate limits, burst control, and usage quotas.", "配置每个 API 的速率限制、突发控制和用量配额。")}</p></div>
        <button onClick={onRefresh} className={`${btnSecondary} whitespace-nowrap shrink-0`}><RotateCcw className="w-4 h-4 mr-2" /> {t("Refresh", "刷新")}</button>
      </div>

      {canWrite && (
      <div className={`${cardClass} border-l-4 border-l-purple-500`}>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Activity className="w-5 h-5 text-purple-500" /> {t("Create Rate Limit", "创建限流规则")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div><label className={labelClass}>{t("Name", "名称")} *</label><input className={inputClass} value={rlName} onChange={(e) => setRlName(e.target.value)} /></div>
          <div><label className={labelClass}>{t("API Path", "API 路径")} *</label><input className={inputClass} value={rlApiPath} onChange={(e) => setRlApiPath(e.target.value)} placeholder="/admin/v1/users" /></div>
          <div><label className={labelClass}>{t("Window (seconds)", "时间窗口（秒）")}</label><input className={inputClass} type="number" value={rlWindow} onChange={(e) => setRlWindow(e.target.value)} /></div>
          <div><label className={labelClass}>{t("Max Requests", "最大请求数")}</label><input className={inputClass} type="number" value={rlMaxReq} onChange={(e) => setRlMaxReq(e.target.value)} /></div>
          <div><label className={labelClass}>{t("Burst Size", "突发大小")}</label><input className={inputClass} type="number" value={rlBurst} onChange={(e) => setRlBurst(e.target.value)} /></div>
          <div><label className={labelClass}>{t("Daily Quota (optional)", "日配额（可选）")}</label><input className={inputClass} type="number" value={rlQuotaDaily} onChange={(e) => setRlQuotaDaily(e.target.value)} placeholder="10000" /></div>
          <div><label className={labelClass}>{t("Monthly Quota (optional)", "月配额（可选）")}</label><input className={inputClass} type="number" value={rlQuotaMonthly} onChange={(e) => setRlQuotaMonthly(e.target.value)} placeholder="300000" /></div>
          <div className="flex items-center gap-6 pt-5">
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={rlPerKey} onChange={(e) => setRlPerKey(e.target.checked)} className="rounded" /><span className="text-sm">{t("Per API Key", "按 API Key")}</span></label>
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={rlPerIp} onChange={(e) => setRlPerIp(e.target.checked)} className="rounded" /><span className="text-sm">{t("Per IP", "按 IP")}</span></label>
          </div>
        </div>
        <button onClick={onCreate} disabled={rlBusy || !rlName.trim() || !rlApiPath.trim()} className={btnPrimary}>{rlBusy ? t("Creating...", "创建中...") : t("Create Rate Limit", "创建限流规则")}</button>
      </div>
      )}

      <div className={`${cardClass} p-0 overflow-hidden`}>
        <table className="w-full text-sm text-left resp-table">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 font-medium">{t("Name / Path", "名称 / 路径")}</th>
              <th className="px-4 py-3 font-medium">{t("Window", "窗口")}</th>
              <th className="px-4 py-3 font-medium">{t("Rate (max+burst)", "速率 (最大+突发)")}</th>
              <th className="px-4 py-3 font-medium">{t("Status", "状态")}</th>
              {canWrite && <th className="px-4 py-3 text-right font-medium">{t("Actions", "操作")}</th>}
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-800">
            {rateLimits.map((rl) => (
              <tr key={rl.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition">
                <td className="px-4 py-3" data-label={t("Name / Path", "名称 / 路径")}><div className="font-semibold">{rl.name}</div><div className="text-xs text-gray-400 font-mono">{rl.api_path}</div></td>
                <td className="px-4 py-3 font-mono text-xs" data-label={t("Window", "窗口")}>{rl.window_seconds}s</td>
                <td className="px-4 py-3 font-mono text-xs" data-label={t("Rate", "速率")}>{rl.max_requests} + {rl.burst_size}</td>
                <td className="px-4 py-3" data-label={t("Status", "状态")}><span className={`text-xs px-2 py-0.5 rounded font-semibold ${rl.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"}`}>{rl.status}</span></td>
                {canWrite && (
                <td className="px-4 py-3 text-right" data-label={t("Actions", "操作")}>
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => onToggle(rl.id, rl.status)} className={`p-1.5 rounded-lg transition ${rl.status === "active" ? "text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20" : "text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20"}`}>
                      {rl.status === "active" ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                    </button>
                    <button onClick={() => onDelete(rl.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
                )}
              </tr>
            ))}
            {rateLimits.length === 0 && (
              <tr><td colSpan={canWrite ? 5 : 4} className="px-4 py-8 text-center text-gray-500">{t("No rate limits configured yet.", "暂无配置限流规则。")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
