"use client";

import { useState, useMemo, useCallback } from "react";
import { RotateCcw, Key, Check, Copy, Power, PowerOff, Trash2, Clock, Hash, Globe, Calendar } from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary, btnSecondary } from "@/lib/constants";
import type { ApiKeyItem } from "@/lib/types";

// ---- helpers ----
function toLocalDate(d: Date): string {
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}

function clamp(v: number, lo: number, hi: number) { return Math.min(Math.max(v, lo), hi); }

function dateAtTime(dateStr: string, h: number, m: number, s: number): Date {
  const d = new Date(dateStr + "T00:00:00");
  d.setHours(h, m, s, 0);
  return d;
}

function fmtHHMMSS(h: number, m: number, s: number): string {
  return [h, m, s].map(v => String(v).padStart(2, "0")).join(":");
}

function fmtNum(v: number) { return String(v).padStart(2, "0"); }

// ---- component ----
interface ApiKeysPanelProps {
  apiKeys: ApiKeyItem[];
  akName: string; akScopes: string; akExpires: string; akMaxCalls: string;
  akCreatedKey: string; akBusy: boolean;
  setAkName: (v: string) => void; setAkScopes: (v: string) => void;
  setAkExpires: (v: string) => void; setAkMaxCalls: (v: string) => void;
  setAkCreatedKey: (v: string) => void;
  onCreateApiKey: () => void;
  onToggleApiKey: (id: string, status: string) => void;
  onDeleteApiKey: (id: string) => void;
  onRefresh: () => void;
  fmtExpiry: (v: string | null) => { text: string; expired: boolean };
  canWrite: boolean;
  notifySucc: (m: string) => void;
  t: <T>(en: T, zh: T) => T;
}

export default function ApiKeysPanel({
  apiKeys, akName, akScopes, akExpires, akMaxCalls, akCreatedKey, akBusy,
  setAkName, setAkScopes, setAkExpires, setAkMaxCalls, setAkCreatedKey,
  onCreateApiKey, onToggleApiKey, onDeleteApiKey, onRefresh, fmtExpiry, canWrite, notifySucc, t,
}: ApiKeysPanelProps) {
  const now = new Date();
  const todayStr = toLocalDate(now);

  // initialise: tomorrow, current time
  const tomorrow = new Date(now.getTime() + 86400000);
  const initDate = toLocalDate(tomorrow);
  const initHour = now.getHours();
  const initMin  = now.getMinutes();
  const initSec  = now.getSeconds();

  const [expiryDate,   setExpiryDate]   = useState(initDate);
  const [expiryHour,   setExpiryHour]   = useState(initHour);
  const [expiryMinute, setExpiryMinute] = useState(initMin);
  const [expirySecond, setExpirySecond] = useState(initSec);

  const isToday = expiryDate === todayStr;

  // ---- bounds for today ----
  const hourMin = isToday ? now.getHours() : 0;
  const hourMax = 24;

  // ---- commit to parent ----
  const commit = useCallback((date: string, h: number, m: number, s: number) => {
    const safeH = clamp(h, hourMin, hourMax);
    const safeM = clamp(m, 0, 59);
    const safeS = clamp(s, 0, 59);
    const d = dateAtTime(date, safeH, safeM, safeS);
    setAkExpires(d.toISOString().slice(0, 19));
  }, [setAkExpires, hourMin]);

  // ---- handlers ----
  const onDateChange = (d: string) => {
    setExpiryDate(d);
    const newIsToday = d === todayStr;
    const lo = newIsToday ? now.getHours() : 0;
    const safeH = clamp(expiryHour, lo, hourMax);
    const safeM = clamp(expiryMinute, 0, 59);
    const safeS = clamp(expirySecond, 0, 59);
    setExpiryHour(safeH);
    setExpiryMinute(safeM);
    setExpirySecond(safeS);
    commit(d, safeH, safeM, safeS);
  };

  const onHourChange = (h: number) => {
    if (h < hourMin || h > hourMax) return;
    setExpiryHour(h);
    commit(expiryDate, h, expiryMinute, expirySecond);
  };

  const onMinuteChange = (m: number) => {
    if (m < 0 || m > 59) return;
    setExpiryMinute(m);
    commit(expiryDate, expiryHour, m, expirySecond);
  };

  const onSecondChange = (s: number) => {
    if (s < 0 || s > 59) return;
    setExpirySecond(s);
    commit(expiryDate, expiryHour, expiryMinute, s);
  };

  // ---- preview ----
  const preview = useMemo(() => {
    const timePart = fmtHHMMSS(expiryHour, expiryMinute, expirySecond);
    return expiryDate + " " + timePart;
  }, [expiryDate, expiryHour, expiryMinute, expirySecond]);

  const isPast = isToday && (expiryHour < now.getHours() ||
    (expiryHour === now.getHours() && expiryMinute < now.getMinutes()) ||
    (expiryHour === now.getHours() && expiryMinute === now.getMinutes() && expirySecond <= now.getSeconds()));

  // ---- slider helpers ----
  const hPct = ((expiryHour - 0) / (hourMax - 0)) * 100;
  const mPct = (expiryMinute / 59) * 100;
  const sPct = (expirySecond / 59) * 100;

  const sliderClass =
    "w-full h-1.5 rounded-full appearance-none cursor-pointer accent-blue-600 " +
    "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 " +
    "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 " +
    "[&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer " +
    "[&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110 " +
    "[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full " +
    "[&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:cursor-pointer";

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {t("API Key Management", "API 密钥管理")}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-sm">
            {t("Create and manage API keys for external service access.", "创建和管理用于外部服务访问的 API 密钥。")}
          </p>
        </div>
        <button onClick={onRefresh} className={`${btnSecondary} whitespace-nowrap shrink-0`}>
          <RotateCcw className="w-4 h-4 mr-2" />
          {t("Refresh", "刷新")}
        </button>
      </div>

      {/* ── New-key banner ── */}
      {akCreatedKey && (
        <div className="relative bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-300 dark:border-green-700 rounded-2xl p-5 shadow-lg shadow-green-100/50 dark:shadow-green-900/20">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center shrink-0">
              <Check className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-green-800 dark:text-green-200 mb-1">{t("API Key Created — Copy it now!", "API 密钥已创建 — 请立即复制！")}</div>
              <div className="text-xs text-green-600 dark:text-green-400 mb-3">{t("This key will not be displayed again. Store it securely.", "此密钥不会再次显示，请妥善保管。")}</div>
              <div className="flex items-center gap-2">
                <code className="bg-white dark:bg-black/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-2.5 rounded-xl text-sm font-mono flex-1 break-all select-all">{akCreatedKey}</code>
                <button onClick={() => { navigator.clipboard.writeText(akCreatedKey); notifySucc(t("Copied!", "已复制！")); }} className="shrink-0 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl transition font-medium text-sm flex items-center gap-2"><Copy className="w-4 h-4" /> {t("Copy", "复制")}</button>
              </div>
            </div>
            <button onClick={() => setAkCreatedKey("")} className="shrink-0 w-8 h-8 rounded-lg hover:bg-green-200/50 dark:hover:bg-green-800/50 text-green-500 flex items-center justify-center transition">&times;</button>
          </div>
        </div>
      )}

      {/* ── Create form ── */}
      {canWrite && (
      <div className={`${cardClass} border-l-4 border-l-blue-500`}>
        <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
          <Key className="w-5 h-5 text-blue-500" />
          {t("Create New API Key", "创建新 API 密钥")}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Key Name */}
          <div className="space-y-1.5">
            <label className={labelClass}>{t("Key Name", "密钥名称")} <span className="text-red-500">*</span></label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className={`${inputClass} pl-9`} value={akName} onChange={e => setAkName(e.target.value)} placeholder={t("e.g. Mobile App Key", "如：移动应用密钥")} />
            </div>
          </div>

          {/* Scopes */}
          <div className="space-y-1.5">
            <label className={labelClass}>{t("Scopes (API paths, comma separated)", "范围（API 路径，逗号分隔）")}</label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className={`${inputClass} pl-9`} value={akScopes} onChange={e => setAkScopes(e.target.value)} placeholder="/admin/v1/users, /api/v1/orders" />
            </div>
          </div>

          {/* ── Expiry: date + H:M:S sliders ── */}
          <div className="space-y-3">
            <label className={labelClass}>{t("Expires At", "过期时间")}</label>
            {/* date */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className={`${inputClass} pl-9`} type="date" min={todayStr} value={expiryDate} onChange={e => onDateChange(e.target.value)} />
            </div>

            {/* H:M:S row */}
            <div className="grid grid-cols-3 gap-3">
              {/* Hour */}
              <div>
                <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5">
                  <span>{t("Hour", "时")}</span>
                  <span className="tabular-nums font-mono">{fmtNum(expiryHour)}</span>
                </div>
                <input type="range" min={0} max={hourMax} step={1} value={expiryHour} onChange={e => onHourChange(Number(e.target.value))}
                  className={sliderClass}
                  style={{ background: `linear-gradient(to right, #2563eb 0%, #2563eb ${hPct}%, #e5e7eb ${hPct}%, #e5e7eb 100%)` }}
                />
              </div>
              {/* Minute */}
              <div>
                <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5">
                  <span>{t("Min", "分")}</span>
                  <span className="tabular-nums font-mono">{fmtNum(expiryMinute)}</span>
                </div>
                <input type="range" min={0} max={59} step={1} value={expiryMinute} onChange={e => onMinuteChange(Number(e.target.value))}
                  className={sliderClass}
                  style={{ background: `linear-gradient(to right, #2563eb 0%, #2563eb ${mPct}%, #e5e7eb ${mPct}%, #e5e7eb 100%)` }}
                />
              </div>
              {/* Second */}
              <div>
                <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5">
                  <span>{t("Sec", "秒")}</span>
                  <span className="tabular-nums font-mono">{fmtNum(expirySecond)}</span>
                </div>
                <input type="range" min={0} max={59} step={1} value={expirySecond} onChange={e => onSecondChange(Number(e.target.value))}
                  className={sliderClass}
                  style={{ background: `linear-gradient(to right, #2563eb 0%, #2563eb ${sPct}%, #e5e7eb ${sPct}%, #e5e7eb 100%)` }}
                />
              </div>
            </div>

            {/* preview */}
            <div className="flex items-center gap-2 text-sm bg-gray-50 dark:bg-gray-900/50 rounded-lg px-3 py-2">
              <Clock className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-gray-500 dark:text-gray-400">{t("Will expire at", "将于此时过期")}:</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100 font-mono tabular-nums">{preview}</span>
              {isPast && (
                <span className="text-red-500 text-xs font-medium ml-1">{t("(past time)", "(已过期)")}</span>
              )}
            </div>
          </div>

          {/* Max Calls */}
          <div className="space-y-1.5">
            <label className={labelClass}>{t("Max Calls (empty = unlimited)", "最大调用次数（空 = 无限制）")}</label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className={`${inputClass} pl-9`} type="number" value={akMaxCalls} onChange={e => setAkMaxCalls(e.target.value)} placeholder="10000" min="1" />
            </div>
          </div>
        </div>

        <button onClick={onCreateApiKey} disabled={akBusy || !akName.trim()} className={`${btnPrimary} px-6`}>
          {akBusy ? t("Creating...", "创建中...") : <><Key className="w-4 h-4 mr-2" />{t("Generate API Key", "生成 API 密钥")}</>}
        </button>
      </div>
      )}

      {/* ── Key list ── */}
      {apiKeys.length > 0 && (
        <div className={`${cardClass} p-0 overflow-hidden`}>
          <div className="px-5 py-3 border-b dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/30">
            <h3 className="font-bold text-sm text-gray-700 dark:text-gray-300">{t("API Keys", "API 密钥列表")} <span className="text-gray-400 font-normal">({apiKeys.length})</span></h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3 font-medium">{t("Name / Prefix", "名称 / 前缀")}</th>
                  <th className="px-5 py-3 font-medium">{t("Status", "状态")}</th>
                  <th className="px-5 py-3 text-right font-medium">{t("Actions", "操作")}</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-800">
                {apiKeys.map(k => {
                  const act = k.status === "active";
                  const rev = k.status === "revoked";
                  const badge = `inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold ${act ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : rev ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"}`;
                  const dot = `w-1.5 h-1.5 rounded-full ${act ? "bg-green-500" : rev ? "bg-red-500" : "bg-yellow-500"}`;
                  return (
                    <tr key={k.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition group">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">{k.name}</div>
                        <div className="text-xs text-gray-400 font-mono mt-0.5">{k.key_prefix}***</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={badge}>
                          <span className={dot} />
                          {act ? t("Active", "活跃") : rev ? t("Revoked", "已吊销") : t("Disabled", "已禁用")}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {canWrite ? (
                        <div className="flex items-center justify-end gap-1.5 opacity-70 group-hover:opacity-100 transition">
                          <button onClick={() => onToggleApiKey(k.id, k.status)} className={`p-2 rounded-lg transition ${act ? "text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20" : "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"}`} title={act ? t("Disable", "禁用") : t("Enable", "启用")}>
                            {act ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                          </button>
                          <button onClick={() => onDeleteApiKey(k.id)} className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition" title={t("Delete", "删除")}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        ) : (
                          <span className="text-xs text-gray-400">{t("Read-only", "只读")}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
