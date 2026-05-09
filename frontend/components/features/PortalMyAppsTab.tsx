"use client";

import { BarChart3, Check, Clock, Copy, Key, Zap } from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary } from "@/lib/constants";
import { statusBadge, type PortalPanelProps } from "./PortalPanel";

export default function PortalMyAppsTab({
  myKeys, mySubscriptions, usageMap, getProduct,
  akName, akScopes, akExpires, akCreatedKey, akBusy,
  onAkNameChange, onAkScopesChange, onAkExpiresChange,
  onCreateKey, getDefaultExpiry, onNavigateToMenu,
  canRequestKey, notifySucc, t,
}: PortalPanelProps) {
  return (
    <div className="space-y-6">
      {/* My API Keys */}
      <div className={cardClass}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2"><Key className="w-5 h-5 text-blue-500" /> {t("My API Keys", "我的 API 密钥")}</h2>
          <button onClick={() => onNavigateToMenu("apikeys")} className="text-xs text-blue-600 hover:text-blue-700 font-medium">{t("Manage All", "管理全部")} →</button>
        </div>
        {myKeys.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <Key className="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-gray-700" />
            <p className="text-sm">{t("No API keys yet. Request one below.", "暂无 API 密钥，请在下方申请。")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {myKeys.slice(0, 5).map((key) => (
              <div key={key.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold truncate">{key.name}</span>
                    {statusBadge(key.status, t)}
                  </div>
                  <code className="text-xs text-gray-400 font-mono">{key.key_prefix}****</code>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                    <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" /> {key.call_count.toLocaleString()} {t("calls", "次调用")}</span>
                    {key.expires_at && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(key.expires_at).toLocaleDateString()}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* My Subscriptions */}
      <div className={cardClass}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2"><Zap className="w-5 h-5 text-amber-500" /> {t("My Subscriptions", "我的订阅")}</h2>
          <button onClick={() => onNavigateToMenu("advanced")} className="text-xs text-blue-600 hover:text-blue-700 font-medium">{t("Browse Plans", "浏览方案")} →</button>
        </div>
        {mySubscriptions.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <Zap className="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-gray-700" />
            <p className="text-sm">{t("No subscriptions yet. Browse the API Catalog to subscribe.", "暂无订阅。浏览 API 目录进行订阅。")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {mySubscriptions.map((sub) => {
              const product = getProduct(sub.product_id);
              const usage = usageMap[sub.id];
              const key = myKeys.find((k) => k.id === sub.api_key_id);
              return (
                <div key={sub.id} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-sm font-bold">{product?.name || sub.product_id}</span>
                      <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded font-medium">{sub.plan}</span>
                    </div>
                    {statusBadge(sub.status, t)}
                  </div>
                  {key && <div className="text-xs text-gray-400 mb-1">{t("Key", "密钥")}: {key.name} ({key.key_prefix}****)</div>}
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    <span>RPS: {sub.rate_limit_rps || "-"}</span>
                    <span>{t("Daily Quota", "日配额")}: {sub.quota_daily?.toLocaleString() || "-"}</span>
                    {sub.expires_at && <span>{t("Expires", "过期")}: {new Date(sub.expires_at).toLocaleDateString()}</span>}
                  </div>
                  {usage && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{t("Today's Usage", "今日用量")}: {usage.calls_today.toLocaleString()}</span>
                        {usage.quota_used_pct != null && (
                          <span className={usage.quota_used_pct > 80 ? "text-red-500 font-bold" : ""}>{usage.quota_used_pct.toFixed(1)}%</span>
                        )}
                      </div>
                      {usage.quota_used_pct != null && (
                        <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${usage.quota_used_pct > 80 ? "bg-red-500" : usage.quota_used_pct > 60 ? "bg-amber-500" : "bg-green-500"}`}
                            style={{ width: `${Math.min(usage.quota_used_pct, 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Request API Key */}
      {canRequestKey && (
        <div className={`${cardClass} border-l-4 border-l-green-500`}>
          <h2 className="text-lg font-bold mb-2 flex items-center gap-2"><Key className="w-5 h-5 text-green-500" /> {t("Request New API Key", "申请新 API 密钥")}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{t("Create a new API key to access our APIs. Keys are scoped to specific paths for security.", "创建新的 API 密钥以访问我们的 API。出于安全考虑，密钥将限定到特定路径范围。")}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="space-y-1">
              <label className={labelClass}>{t("App Name", "应用名称")} <span className="text-red-500">*</span></label>
              <input className={`${inputClass} pl-9`} value={akName} onChange={(e) => onAkNameChange(e.target.value)} placeholder={t("e.g. My Mobile App", "如：我的移动应用")} />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>{t("API Paths", "API 路径")}</label>
              <input className={`${inputClass} pl-9`} value={akScopes} onChange={(e) => onAkScopesChange(e.target.value)} placeholder="/admin/v1/users, /api/v1/orders" />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>{t("Expires", "过期时间")}</label>
              <div className="flex gap-1.5">
                {[{ h: 24, l: "24h" }, { h: 72, l: t("3d", "3天") }, { h: 168, l: t("7d", "7天") }, { h: 720, l: t("30d", "30天") }].map((p) => (
                  <button key={p.h} type="button" onClick={() => onAkExpiresChange(getDefaultExpiry(p.h))}
                    className={`text-xs px-2.5 py-2 rounded-lg border transition font-medium flex-1 ${
                      akExpires === getDefaultExpiry(p.h)
                        ? "bg-green-50 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-600 dark:text-green-300"
                        : "bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300 dark:bg-gray-900/30 dark:border-gray-700 dark:text-gray-400"
                    }`}
                  >{p.l}</button>
                ))}
              </div>
            </div>
          </div>
          <button onClick={onCreateKey} disabled={akBusy || !akName.trim()} className={`${btnPrimary} px-6`}>
            {akBusy ? t("Generating...", "生成中...") : <><Key className="w-4 h-4 mr-2" />{t("Generate API Key", "生成 API 密钥")}</>}
          </button>
          {akCreatedKey && (
            <div className="mt-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-300 dark:border-green-700 rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-500 flex items-center justify-center shrink-0"><Check className="w-5 h-5 text-white" /></div>
              <code className="bg-white dark:bg-black/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-3 py-2 rounded-lg text-sm font-mono flex-1 break-all select-all">{akCreatedKey}</code>
              <button onClick={() => { navigator.clipboard.writeText(akCreatedKey); notifySucc(t("Copied!", "已复制！")); }} className="shrink-0 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg transition text-sm flex items-center gap-1.5"><Copy className="w-4 h-4" /> {t("Copy", "复制")}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
