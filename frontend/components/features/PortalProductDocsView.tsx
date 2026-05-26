"use client";

import {
  BookOpen, TerminalSquare, FileText, ExternalLink,
  Key, Zap, BarChart3, Shield,
} from "lucide-react";
import { cardClass, btnSecondary } from "@/lib/constants";
import { CodeBlock, CopyButton, CodeTabs } from "@/components/ui/CodeBlock";
import { statusBadge } from "./PortalPanel";
import type { ApiProduct, PricingTier } from "@/lib/types";

interface Props {
  product: ApiProduct;
  onNavigateToMenu: (menu: string) => void;
  onSetOpenApiFilter: (v: string) => void;
  onBack: () => void;
  t: <T>(en: T, zh: T) => T;
}

export default function PortalProductDocsView({ product, onNavigateToMenu, onSetOpenApiFilter, onBack, t }: Props) {
  const tiers: PricingTier[] = Array.isArray(product.pricing_tiers) ? product.pricing_tiers : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <button
        onClick={onBack}
        className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
      >
        &larr; {t("Back to Guide", "返回指南")}
      </button>

      {/* Product header */}
      <div className={`${cardClass} border-l-4 border-l-blue-500`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{product.name}</h1>
            {product.description && (
              <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">{product.description}</p>
            )}
          </div>
          {statusBadge(product.status, t)}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {product.documentation_url && (
            <a href={product.documentation_url} target="_blank" rel="noopener noreferrer"
              className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-lg hover:bg-blue-100 transition inline-flex items-center gap-1">
              <ExternalLink className="w-3 h-3" />{t("External Documentation", "外部文档")}
            </a>
          )}
        </div>
      </div>

      {/* Limit Tiers */}
      {tiers.length > 0 && (
        <div className={cardClass}>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />{t("Limit Tiers", "限制方案")}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-gray-800 text-left text-xs text-gray-500 uppercase tracking-wider">
                  <th className="py-2 pr-4 font-medium">{t("Plan", "方案")}</th>
                  <th className="py-2 pr-4 font-medium">{t("Rate Limit", "速率限制")}</th>
                  <th className="py-2 pr-4 font-medium">{t("Daily Quota", "日配额")}</th>
                  <th className="py-2 pr-4 font-medium">{t("Monthly Quota", "月配额")}</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-800">
                {tiers.map((tier, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                    <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-gray-200">{tier.name}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs">{tier.rate_limit_rps} RPS</td>
                    <td className="py-2.5 pr-4 font-mono text-xs">{tier.quota_daily > 0 ? tier.quota_daily.toLocaleString() : <span className="text-gray-400">—</span>}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs">{tier.quota_monthly > 0 ? tier.quota_monthly.toLocaleString() : <span className="text-gray-400">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Authentication */}
      <div className={cardClass}>
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
          <Key className="w-5 h-5 text-amber-500" />{t("Authentication", "认证方式")}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          {t("All API requests require an API Key passed in the X-API-Key header.", "所有 API 请求都需要在 X-API-Key 请求头中传递 API 密钥。")}
        </p>
        <div className="bg-gray-900 dark:bg-black rounded-xl p-4 font-mono text-sm text-green-400 relative group">
          <span className="text-gray-500">curl</span> <span className="text-blue-400">-H</span> <span className="text-yellow-300">"X-API-Key: YOUR_API_KEY"</span>{" "}
          <span className="text-blue-400">-H</span> <span className="text-yellow-300">"Content-Type: application/json"</span>{" "}
          <span className="text-white">https://your-gateway/api/v1/{product.rule_ids?.[0]?.substring(0, 12) || "..."}...</span>
          <CopyButton text={`curl -H "X-API-Key: YOUR_API_KEY" -H "Content-Type: application/json" https://your-gateway/api/v1/...`} />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {t("Get your API Key from", "在以下位置获取您的 API 密钥：")}{" "}
          <button onClick={() => onNavigateToMenu("portal")} className="text-blue-600 dark:text-blue-400 underline">{t("My Apps", "我的应用")}</button>
        </p>
      </div>

      {/* API Endpoints */}
      {product.rule_ids && product.rule_ids.length > 0 && (
        <div className={cardClass}>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-500" />{t("API Endpoints", "API 端点")}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            {t("This product includes the following API endpoints backed by transform rules.", "此产品包含以下 API 端点，每个端点都由转换规则支持。")}
          </p>
          <div className="space-y-2">
            {product.rule_ids.map((ruleId, i) => (
              <div key={ruleId} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg px-4 py-3 group hover:bg-gray-100 dark:hover:bg-gray-800/50 transition">
                <span className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-mono text-gray-800 dark:text-gray-200 truncate">{ruleId}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{t("Rule ID — view in OpenAPI for full schema", "规则 ID — 在 OpenAPI 中查看完整结构")}</div>
                </div>
                <button
                  onClick={() => { onNavigateToMenu("openapi"); onSetOpenApiFilter(ruleId); }}
                  className="text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 px-2.5 py-1.5 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0"
                >
                  <FileText className="w-3.5 h-3.5" />{t("Schema", "结构")}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rate Limits */}
      <div className={cardClass}>
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
          <Shield className="w-5 h-5 text-green-500" />{t("Rate Limits & Quotas", "速率限制与配额")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {tiers.length > 0 ? `${tiers[0].rate_limit_rps} RPS` : t("Varies", "各异")}
            </div>
            <div className="text-xs text-gray-500 mt-1">{t("Per-Key Rate Limit", "每密钥速率限制")}</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {tiers.length > 0 && tiers[0].quota_daily > 0 ? tiers[0].quota_daily.toLocaleString() : t("Unlimited", "无限制")}
            </div>
            <div className="text-xs text-gray-500 mt-1">{t("Daily Call Quota", "每日调用配额")}</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {tiers.length > 0 && tiers[0].quota_monthly > 0 ? tiers[0].quota_monthly.toLocaleString() : t("Unlimited", "无限制")}
            </div>
            <div className="text-xs text-gray-500 mt-1">{t("Monthly Call Quota", "每月调用配额")}</div>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          {t("Rate limits are enforced per API key. Exceeding the limit returns HTTP 429.", "速率限制按 API 密钥执行。超出限制将返回 HTTP 429。")}
        </p>
      </div>

      {/* Quick Start Code */}
      <div className={cardClass}>
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
          <TerminalSquare className="w-5 h-5 text-gray-700 dark:text-gray-300" />{t("Quick Start", "快速开始")}
        </h2>
        <CodeTabs
          tabs={[
            { id: "curl", label: "cURL" },
            { id: "js", label: "JavaScript" },
            { id: "py", label: "Python" },
          ]}
          content={{
            curl: <CodeBlock language="bash" code={`# ${t("Set your API key", "设置您的 API 密钥")}
export API_KEY="your_key_here"

# ${t("Make a request", "发起请求")}
curl -X GET \\
  -H "X-API-Key: $API_KEY" \\
  -H "Content-Type: application/json" \\
  "https://your-gateway/api/v1/endpoint"

# ${t("POST example with JSON body", "带 JSON 请求体的 POST 示例")}
curl -X POST \\
  -H "X-API-Key: $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"key": "value"}' \\
  "https://your-gateway/api/v1/endpoint"`} />,
            js: <CodeBlock language="javascript" code={`// ${t("Using fetch API", "使用 fetch API")}
const API_KEY = "your_key_here";
const BASE_URL = "https://your-gateway/api/v1";

async function callApi(endpoint, method = "GET", body = null) {
  const options = {
    method,
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
    },
  };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(\`\${BASE_URL}/\${endpoint}\`, options);
  if (!response.ok) {
    throw new Error(\`HTTP \${response.status}: \${await response.text()}\`);
  }
  return response.json();
}

const data = await callApi("endpoint");
console.log(data);`} />,
            py: <CodeBlock language="python" code={`# ${t("Using requests library", "使用 requests 库")}
import requests

API_KEY = "your_key_here"
BASE_URL = "https://your-gateway/api/v1"

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json",
}

# GET ${t("request", "请求")}
response = requests.get(f"{BASE_URL}/endpoint", headers=headers)
response.raise_for_status()
data = response.json()
print(data)

# POST ${t("request with body", "带请求体的 POST")}
payload = {"key": "value"}
response = requests.post(f"{BASE_URL}/endpoint", headers=headers, json=payload)
response.raise_for_status()
print(response.json())`} />,
          }}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={() => onNavigateToMenu("playground")} className={btnSecondary}>
          <TerminalSquare className="w-4 h-4 mr-2" />{t("Test in Playground", "在模拟工作台测试")}
        </button>
        <button onClick={() => { onNavigateToMenu("openapi"); onSetOpenApiFilter(product.rule_ids?.[0] || ""); }} className={btnSecondary}>
          <FileText className="w-4 h-4 mr-2" />{t("OpenAPI Schema", "OpenAPI 结构")}
        </button>
      </div>
    </div>
  );
}
