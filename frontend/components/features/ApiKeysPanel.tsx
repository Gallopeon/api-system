"use client";

import { RotateCcw, Key, Share2, Activity, Clock, Copy, Check, Power, PowerOff, Trash2 } from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary, btnSecondary } from "@/lib/constants";
import { getDefaultExpiry } from "@/lib/utils";
import type { ApiKeyItem } from "@/lib/types";

interface ApiKeysPanelProps {
  apiKeys: ApiKeyItem[];
  akName: string;
  akScopes: string;
  akExpires: string;
  akMaxCalls: string;
  akCreatedKey: string;
  akBusy: boolean;
  setAkName: (v: string) => void;
  setAkScopes: (v: string) => void;
  setAkExpires: (v: string) => void;
  setAkMaxCalls: (v: string) => void;
  setAkCreatedKey: (v: string) => void;
  onCreateApiKey: () => void;
  onToggleApiKey: (id: string, status: string) => void;
  onDeleteApiKey: (id: string) => void;
  onRefresh: () => void;
  fmtExpiry: (v: string | null) => { text: string; expired: boolean };
  notifySucc: (m: string) => void;
  t: <T>(en: T, zh: T) => T;
}

export default function ApiKeysPanel({
  apiKeys, akName, akScopes, akExpires, akMaxCalls, akCreatedKey, akBusy,
  setAkName, setAkScopes, setAkExpires, setAkMaxCalls, setAkCreatedKey,
  onCreateApiKey, onToggleApiKey, onDeleteApiKey, onRefresh, fmtExpiry, notifySucc, t,
}: ApiKeysPanelProps) {
  const expiryBtnClass = (h: number) =>
    `text-xs px-2.5 py-1 rounded-md border transition font-medium ${
      akExpires === getDefaultExpiry(h)
        ? "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-600 dark:text-blue-300"
        : "bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300 dark:bg-gray-900/30 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-600"
    }`;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">{t("API Key Management", "API 密钥管理")}</h1><p className="text-gray-500 mt-1">{t("Create and manage API keys for external service access.", "创建和管理用于外部服务访问的 API 密钥。")}</p></div>
        <button onClick={onRefresh} className={btnSecondary}><RotateCcw className="w-4 h-4 mr-2" /> {t("Refresh", "刷新")}</button>
      </div>

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
                <button onClick={() => { navigator.clipboard.writeText(akCreatedKey); notifySucc(t("Copied!", "已复制！")); }} className="shrink-0 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl transition font-medium text-sm flex items-center gap-2">
                  <Copy className="w-4 h-4" /> {t("Copy", "复制")}
                </button>
              </div>
            </div>
            <button onClick={() => setAkCreatedKey("")} className="shrink-0 w-8 h-8 rounded-lg hover:bg-green-200/50 dark:hover:bg-green-800/50 text-green-500 flex items-center justify-center transition">&times;</button>
          </div>
        </div>
      )}

      <div className={`${cardClass} border-l-4 border-l-blue-500`}>
        <h2 className="text-lg font-bold mb-5 flex items-center gap-2"><Key className="w-5 h-5 text-blue-500" /> {t("Create New API Key", "创建新 API 密钥")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          <div className="space-y-1.5">
            <label className={labelClass}>{t("Key Name", "密钥名称")} <span className="text-red-500">*</span></label>
            <input className={`${inputClass} pl-9`} value={akName} onChange={(e) => setAkName(e.target.value)} placeholder={t("e.g. Mobile App Key", "如：移动应用密钥")} />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>{t("Scopes (API paths, comma separated)", "范围（API 路径，逗号分隔）")}</label>
            <input className={`${inputClass} pl-9`} value={akScopes} onChange={(e) => setAkScopes(e.target.value)} placeholder="/api/v1/users, /api/v1/orders" />
          </div>
          <div className="space-y-2">
            <label className={labelClass}>{t("Expires At (UTC)", "过期时间 (UTC)")}</label>
            <div className="flex gap-2 items-center">
              <input className={`${inputClass} w-36`} type="date" value={akExpires.slice(0, 10)} onChange={(e) => setAkExpires(e.target.value + "T" + akExpires.slice(11, 16))} />
              <span className="text-gray-400 text-sm font-medium">{t("at", "@")}</span>
              <input className={`${inputClass} w-28`} type="time" step="60" value={akExpires.slice(11, 16)} onChange={(e) => setAkExpires(akExpires.slice(0, 10) + "T" + e.target.value)} />
              <Clock className="w-4 h-4 text-gray-400 shrink-0" />
            </div>
            <div className="flex gap-2 pt-0.5">
              {[{ h: 24, l: t("24h", "24h") }, { h: 72, l: t("72h", "3d") }, { h: 168, l: t("7d", "7d") }, { h: 720, l: t("30d", "30d") }, { h: 8760, l: t("1y", "1y") }].map((p) => (
                <button key={p.h} type="button" onClick={() => setAkExpires(getDefaultExpiry(p.h))} className={expiryBtnClass(p.h)}>{p.l}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>{t("Max Calls (empty = unlimited)", "最大调用次数（空 = 无限制）")}</label>
            <input className={`${inputClass} pl-9`} type="number" value={akMaxCalls} onChange={(e) => setAkMaxCalls(e.target.value)} placeholder="10000" min="1" />
          </div>
        </div>
        <button onClick={onCreateApiKey} disabled={akBusy || !akName.trim()} className={`${btnPrimary} px-6`}>
          {akBusy ? t("Creating...", "创建中...") : <><Key className="w-4 h-4 mr-2" />{t("Generate API Key", "生成 API 密钥")}</>}
        </button>
      </div>

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
                {apiKeys.map((k) => (
                  <tr key={k.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition group">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-gray-900 dark:text-gray-100">{k.name}</div>
                      <div className="text-xs text-gray-400 font-mono mt-0.5">{k.key_prefix}***</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold ${
                        k.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                        k.status === "revoked" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${k.status === "active" ? "bg-green-500" : k.status === "revoked" ? "bg-red-500" : "bg-yellow-500"}`} />
                        {k.status === "active" ? t("Active", "活跃") : k.status === "revoked" ? t("Revoked", "已吊销") : t("Disabled", "已禁用")}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-70 group-hover:opacity-100 transition">
                        <button onClick={() => onToggleApiKey(k.id, k.status)}
                          className={`p-2 rounded-lg transition ${k.status === "active" ? "text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20" : "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"}`}>
                          {k.status === "active" ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                        </button>
                        <button onClick={() => onDeleteApiKey(k.id)} className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {apiKeys.length === 0 && (
                  <tr><td colSpan={3} className="px-5 py-12 text-center"><Key className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" /><div className="text-gray-500 font-medium">{t("No API keys yet", "暂无 API 密钥")}</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
