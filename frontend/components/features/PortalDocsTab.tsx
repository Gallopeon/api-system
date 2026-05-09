"use client";

import { FileText, TerminalSquare } from "lucide-react";
import { cardClass, btnSecondary } from "@/lib/constants";
import type { PortalPanelProps } from "./PortalPanel";

export default function PortalDocsTab({ onNavigateToMenu, t }: PortalPanelProps) {
  return (
    <div className={`${cardClass} space-y-6`}>
      <h2 className="text-xl font-bold">{t("Integration Quick Start", "集成快速入门")}</h2>
      <div className="space-y-4">
        {[
          {
            step: "1",
            en: "Browse the API Catalog to find the APIs and products you need. Each product shows available pricing plans with rate limits and quotas.",
            zh: "浏览 API 目录，找到您需要的 API 和产品。每个产品都展示了可用的定价方案，包括速率限制和配额。",
          },
          {
            step: "2",
            en: "Request an API Key in the \"My Apps\" tab. Choose an expiry duration and optionally restrict access to specific API paths.",
            zh: "在「我的应用」选项卡中申请 API 密钥。选择过期时间，并可选择将访问权限限制到特定的 API 路径。",
          },
          {
            step: "3",
            en: "Use the API Key in your HTTP requests via the X-API-Key header: curl -H \"X-API-Key: YOUR_KEY\" https://your-gateway/api/v1/...",
            zh: "在 HTTP 请求中通过 X-API-Key 请求头使用您的 API 密钥：curl -H \"X-API-Key: YOUR_KEY\" https://your-gateway/api/v1/...",
          },
          {
            step: "4",
            en: "Monitor your usage in the \"My Apps\" tab — track call counts, quota consumption, and subscription status at a glance.",
            zh: "在「我的应用」选项卡中监控您的使用情况 — 一目了然地查看调用次数、配额消耗和订阅状态。",
          },
          {
            step: "5",
            en: "Test API transformations in the Playground before integrating. Use the OpenAPI docs for request/response schemas.",
            zh: "在集成之前，使用模拟工作台（Playground）测试 API 转换。使用 OpenAPI 文档了解请求/响应结构。",
          },
        ].map((s, i) => (
          <div key={i} className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold shrink-0">{s.step}</div>
            <div className="text-sm text-gray-700 dark:text-gray-300 pt-0.5">{t(s.en, s.zh)}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={() => onNavigateToMenu("playground")} className={btnSecondary}>
          <TerminalSquare className="w-4 h-4 mr-2" />
          {t("Open Playground", "打开模拟工作台")}
        </button>
        <button onClick={() => onNavigateToMenu("openapi")} className={btnSecondary}>
          <FileText className="w-4 h-4 mr-2" />
          {t("View OpenAPI Docs", "查看 OpenAPI 文档")}
        </button>
      </div>
    </div>
  );
}
