"use client";

import { AlertTriangle, Code2, Database, Settings, ShieldAlert } from "lucide-react";
import { cardClass } from "@/lib/constants";

interface AdvancedPanelProps {
  t: <T>(en: T, zh: T) => T;
}

export default function AdvancedPanel({ t }: AdvancedPanelProps) {
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold">{t("Advanced Features", "高级功能")}</h1>
        <p className="text-gray-500 mt-1">{t("API Products, circuit breakers, protocol extensions, compliance, and plugin system.", "API 产品化、熔断器、协议扩展、合规管理和插件系统。")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`${cardClass} border-l-4 border-l-emerald-500`}>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><Database className="w-5 h-5 text-emerald-500" /> {t("API Products & Subscriptions", "API 产品化 & 订阅")}</h2>
          <p className="text-sm text-gray-500 mb-3">{t("Package multiple rules into products with Free/Pro/Enterprise plans. Manage subscriptions with rate limits and quotas per plan.", "将多个规则打包为产品，支持 Free/Pro/Enterprise 套餐。管理带有限速和配额的订阅计划。")}</p>
          <div className="flex gap-2 text-xs">
            <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{t("POST /api/v1/products", "POST /api/v1/products")}</code>
            <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{t("POST /api/v1/subscriptions", "POST /api/v1/subscriptions")}</code>
          </div>
        </div>

        <div className={`${cardClass} border-l-4 border-l-orange-500`}>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-orange-500" /> {t("Circuit Breakers & Retry", "熔断器 & 重试")}</h2>
          <p className="text-sm text-gray-500 mb-3">{t("Configure failure thresholds, recovery timeouts, half-open state limits, and retry policies per API path. Prevent cascading failures.", "按 API 路径配置故障阈值、恢复超时、半开状态限制和重试策略。防止级联故障。")}</p>
          <div className="flex gap-2 text-xs">
            <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{t("POST /api/v1/circuit-breakers", "POST /api/v1/circuit-breakers")}</code>
          </div>
        </div>

        <div className={`${cardClass} border-l-4 border-l-cyan-500`}>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><Code2 className="w-5 h-5 text-cyan-500" /> {t("Protocol Extensions", "协议扩展")}</h2>
          <p className="text-sm text-gray-500 mb-3">{t("Support for GraphQL query validation, gRPC-Web proxying, SSE streaming for LLM tokens, and WebSocket connection management.", "支持 GraphQL 查询验证、gRPC-Web 代理、LLM Token 的 SSE 流式传输和 WebSocket 连接管理。")}</p>
          <div className="flex gap-2 text-xs">
            <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{t("POST /api/v1/protocols", "POST /api/v1/protocols")}</code>
            <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">graphql | grpc | sse | ws</code>
          </div>
        </div>

        <div className={`${cardClass} border-l-4 border-l-red-500`}>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-red-500" /> {t("Compliance (API-BOM)", "合规仪表板 (API-BOM)")}</h2>
          <p className="text-sm text-gray-500 mb-3">{t("Classify API data: Public / Internal / Confidential / PII. Track GDPR relevance, retention policies, and OWASP risk scanning.", "API 数据分类：公共 / 内部 / 机密 / PII。追踪 GDPR 相关性、数据保留策略和 OWASP 风险扫描。")}</p>
          <div className="flex gap-2 text-xs">
            <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{t("POST /api/v1/data-classifications", "POST /api/v1/data-classifications")}</code>
          </div>
        </div>

        <div className={`${cardClass} border-l-4 border-l-violet-500 md:col-span-2`}>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><Settings className="w-5 h-5 text-violet-500" /> {t("Plugin / Extension System", "插件 / 扩展系统")}</h2>
          <p className="text-sm text-gray-500 mb-3">{t("Register custom plugins (Lua/JS/WASM) at specific hook points in the transform pipeline: pre_transform, post_transform, pre_auth, post_auth, pre_cache, post_cache. Plugins execute in priority order.", "在转换管线的特定钩子点注册自定义插件（Lua/JS/WASM）：pre_transform、post_transform、pre_auth、post_auth、pre_cache、post_cache。插件按优先级顺序执行。")}</p>
          <div className="flex gap-2 text-xs mb-3">
            <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{t("POST /api/v1/plugins", "POST /api/v1/plugins")}</code>
            <span className="text-gray-400">{t("Hook: pre_transform | post_transform | pre_auth | post_auth | pre_cache | post_cache", "钩子点: pre_transform | post_transform | pre_auth | post_auth | pre_cache | post_cache")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
