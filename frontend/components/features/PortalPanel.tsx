"use client";

import { BookOpen, Check, Copy, FileText, Key, Share2 } from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary, btnSecondary } from "@/lib/constants";
import type { RuleSummary } from "@/lib/types";

interface PortalPanelProps {
  rules: RuleSummary[];
  akName: string;
  akScopes: string;
  akExpires: string;
  akBusy: boolean;
  akCreatedKey: string;
  setAkName: (v: string) => void;
  setAkScopes: (v: string) => void;
  setAkExpires: (v: string) => void;
  setAkCreatedKey: (v: string) => void;
  onCreateApiKey: () => Promise<void>;
  setActiveMenu: (v: string) => void;
  onSelectRule: (id: string) => void;
  setOpenApiFilter: (v: string) => void;
  getDefaultExpiry: (hours?: number) => string;
  canRequestKey: boolean;
  notifySucc: (msg: string) => void;
  t: <T>(en: T, zh: T) => T;
}

export default function PortalPanel({
  rules, akName, akScopes, akExpires, akBusy, akCreatedKey,
  setAkName, setAkScopes, setAkExpires, setAkCreatedKey,
  onCreateApiKey, setActiveMenu, onSelectRule, setOpenApiFilter,
  getDefaultExpiry, canRequestKey, notifySucc, t,
}: PortalPanelProps) {
  const expiryBtnClass = (h: number) =>
    `text-xs px-2.5 py-2 rounded-lg border transition font-medium flex-1 ${
      akExpires === getDefaultExpiry(h)
        ? "bg-green-50 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-600 dark:text-green-300"
        : "bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300 dark:bg-gray-900/30 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-600"
    }`;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold">{t("Developer Portal", "开发者门户")}</h1>
        <p className="text-gray-500 mt-1">{t("Explore APIs, read documentation, and get your API keys.", "探索 API、阅读文档并获取您的 API 密钥。")}</p>
      </div>

      {/* API Catalog */}
      <div className={cardClass}>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-blue-500" /> {t("API Catalog", "API 目录")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.filter((r) => r.status === "published").map((r) => (
            <div key={r.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition cursor-pointer" onClick={() => onSelectRule(r.id)}>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg">{r.name}</h3>
                <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded font-semibold">{t("Published", "已发布")}</span>
              </div>
              <code className="text-sm text-blue-600 dark:text-blue-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono">{r.api_path}</code>
              <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                <span>v{r.current_version}</span>
                <span>|</span>
                <span>{t("Updated", "更新于")}: {new Date(r.updated_at).toLocaleDateString()}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={(e) => { e.stopPropagation(); setActiveMenu("openapi"); setOpenApiFilter(r.api_path); }} className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded hover:bg-blue-100 transition">
                  {t("View OpenAPI Doc", "查看 OpenAPI 文档")}
                </button>
                <button onClick={(e) => { e.stopPropagation(); setActiveMenu("playground"); }} className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded hover:bg-gray-200 transition">
                  {t("Try in Playground", "在模拟台中测试")}
                </button>
              </div>
            </div>
          ))}
          {rules.filter((r) => r.status === "published").length === 0 && (
            <div className="col-span-2 text-center py-8 text-gray-500">
              <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>{t("No published APIs yet. Publish a rule to make it visible in the portal.", "暂无已发布的 API。发布规则后即可在门户中显示。")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Self-Service API Key Request */}
      {canRequestKey && (
      <div className={`${cardClass} border-l-4 border-l-green-500`}>
        <h2 className="text-lg font-bold mb-2 flex items-center gap-2"><Key className="w-5 h-5 text-green-500" /> {t("Request API Access", "申请 API 访问权限")}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">{t("Fill in the form below to generate an API key for accessing our APIs. Keys can be scoped to specific API paths.", "填写以下表单即可生成用于访问我们 API 的密钥。密钥可以限定到特定的 API 路径范围。")}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="space-y-1.5">
            <label className={labelClass}>{t("Application Name", "应用名称")} <span className="text-red-500">*</span></label>
            <input className={`${inputClass} pl-9`} value={akName} onChange={(e) => setAkName(e.target.value)} placeholder={t("e.g. My Mobile App", "如：我的移动应用")} />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>{t("Scopes (API paths)", "访问范围（API 路径）")}</label>
            <input className={`${inputClass} pl-9`} value={akScopes} onChange={(e) => setAkScopes(e.target.value)} placeholder="/admin/v1/users, /api/v1/orders" />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>{t("Expires", "过期时间")}</label>
            <div className="flex gap-1.5">
              {[{ h: 24, l: "24h" }, { h: 72, l: t("3d", "3天") }, { h: 168, l: t("7d", "7天") }, { h: 720, l: t("30d", "30天") }].map((p) => (
                <button key={p.h} type="button" onClick={() => setAkExpires(getDefaultExpiry(p.h))} className={expiryBtnClass(p.h)}>{p.l}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onCreateApiKey} disabled={akBusy || !akName.trim()} className={`${btnPrimary} px-6`}>{akBusy ? t("Generating...", "生成中...") : <><Key className="w-4 h-4 mr-2" />{t("Generate API Key", "生成 API 密钥")}</>}</button>
          <button onClick={() => setActiveMenu("apikeys")} className={btnSecondary}>{t("Manage Existing Keys", "管理已有密钥")}</button>
        </div>
        {akCreatedKey && (
          <div className="mt-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-300 dark:border-green-700 rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-500 flex items-center justify-center shrink-0"><Check className="w-5 h-5 text-white" /></div>
            <code className="bg-white dark:bg-black/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-3 py-2 rounded-lg text-sm font-mono flex-1 break-all select-all">{akCreatedKey}</code>
            <button onClick={() => { navigator.clipboard.writeText(akCreatedKey); notifySucc(t("Copied!", "已复制！")); }} className="shrink-0 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg transition text-sm flex items-center gap-1.5"><Copy className="w-4 h-4" /> {t("Copy", "复制")}</button>
          </div>
        )}
      </div>
      )}

      {/* Quick Start Guide */}
      <div className={cardClass}>
        <h2 className="text-lg font-bold mb-4">{t("Quick Start Guide", "快速入门指南")}</h2>
        <div className="space-y-4 text-sm">
          {[
            { step: "1", en: "Browse the API Catalog above and find the API you need.", zh: "浏览上方的 API 目录，找到您需要的 API。" },
            { step: "2", en: "Request an API Key using the form above, specifying which API paths you need access to.", zh: "使用上方的表单申请 API Key，指定您需要访问的 API 路径。" },
            { step: "3", en: "Use the API Key in your requests via the X-API-Key header or api_key query parameter.", zh: "在请求中通过 X-API-Key 请求头或 api_key 查询参数使用您的 API Key。" },
            { step: "4", en: "Test your integration in the Playground tab before going live.", zh: "上线前在模拟工作台（Playground）选项卡中测试您的集成。" },
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">{s.step}</div>
              <div className="text-gray-700 dark:text-gray-300 pt-0.5">{t(s.en, s.zh)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
