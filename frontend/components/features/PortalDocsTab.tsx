"use client";

import { useState, useEffect } from "react";
import { BookOpen, TerminalSquare, FileText, Search, Key, Zap, BarChart3 } from "lucide-react";
import { cardClass, inputClass, btnSecondary } from "@/lib/constants";
import type { PortalPanelProps } from "./PortalPanel";
import PortalProductDocsView from "./PortalProductDocsView";

export default function PortalDocsTab(props: PortalPanelProps) {
  const { allProducts, docsProductId, onNavigateToMenu, onViewProductDocs, onSetOpenApiFilter, t } = props;
  const [selectedId, setSelectedId] = useState(docsProductId || "");
  const [searchProduct, setSearchProduct] = useState("");

  useEffect(() => {
    if (docsProductId) setSelectedId(docsProductId);
  }, [docsProductId]);

  const activeProducts = allProducts.filter((p) => p.status === "active");
  const selectedProduct = allProducts.find((p) => p.id === selectedId) || null;

  const filteredProducts = activeProducts.filter((p) => {
    if (!searchProduct) return true;
    const q = searchProduct.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q);
  });

  if (selectedProduct) {
    return (
      <PortalProductDocsView
        product={selectedProduct}
        onNavigateToMenu={onNavigateToMenu}
        onSetOpenApiFilter={onSetOpenApiFilter}
        onBack={() => setSelectedId("")}
        t={t}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Product browser */}
      <div className={cardClass}>
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-500" />{t("Browse Product Documentation", "浏览产品文档")}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          {t("Select a product to view its detailed documentation, including API endpoints, authentication, pricing, and code examples.", "选择一个产品以查看其详细文档，包括 API 端点、认证方式、定价和代码示例。")}
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className={`${inputClass} pl-9`}
            placeholder={t("Search products...", "搜索产品...")}
            value={searchProduct}
            onChange={(e) => setSearchProduct(e.target.value)}
          />
        </div>
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
            {filteredProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => { setSelectedId(p.id); onViewProductDocs?.(p.id); }}
                className="text-left p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-200 dark:hover:border-blue-800 border border-transparent transition group"
              >
                <div className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-400">{p.name}</div>
                <div className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description || t("No description", "暂无描述")}</div>
                <div className="flex items-center gap-1 mt-2 text-xs text-blue-600 dark:text-blue-400">
                  <BookOpen className="w-3 h-3" />{t("View Documentation", "查看文档")}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-center py-6 text-gray-400 text-sm">
            {activeProducts.length === 0
              ? t("No active products. Publish products in the Advanced panel first.", "暂无活跃产品，请先在高级面板中发布产品。")
              : t("No products match your search.", "没有匹配搜索的产品。")}
          </p>
        )}
      </div>

      {/* Quick Start Guide */}
      <div className={`${cardClass} space-y-4`}>
        <h2 className="text-xl font-bold">{t("Integration Quick Start", "集成快速入门")}</h2>
        <div className="space-y-3">
          {[
            { step: "1", en: "Browse the API Catalog to find the APIs and products you need. Each product shows available pricing plans with rate limits and quotas.", zh: "浏览 API 目录，找到您需要的 API 和产品。每个产品都展示了可用的定价方案，包括速率限制和配额。" },
            { step: "2", en: "Request an API Key in the \"My Apps\" tab. Choose an expiry duration and optionally restrict access to specific API paths.", zh: "在「我的应用」选项卡中申请 API 密钥。选择过期时间，并可选择将访问权限限制到特定的 API 路径。" },
            { step: "3", en: "Use the API Key in your HTTP requests via the X-API-Key header. Check the product docs above for code examples in cURL, JavaScript, and Python.", zh: "在 HTTP 请求中通过 X-API-Key 请求头使用您的 API 密钥。查看上方产品文档获取 cURL、JavaScript 和 Python 的代码示例。" },
            { step: "4", en: "Monitor your usage in the \"My Apps\" tab — track call counts, quota consumption, and subscription status at a glance.", zh: "在「我的应用」选项卡中监控您的使用情况 — 一目了然地查看调用次数、配额消耗和订阅状态。" },
            { step: "5", en: "Test API transformations in the Playground before integrating. Use the OpenAPI docs for request/response schemas.", zh: "在集成之前，使用模拟工作台（Playground）测试 API 转换。使用 OpenAPI 文档了解请求/响应结构。" },
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold shrink-0">{s.step}</div>
              <div className="flex-1"><div className="text-sm text-gray-700 dark:text-gray-300">{t(s.en, s.zh)}</div></div>
            </div>
          ))}
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={() => onNavigateToMenu("playground")} className={btnSecondary}>
            <TerminalSquare className="w-4 h-4 mr-2" />{t("Open Playground", "打开模拟工作台")}
          </button>
          <button onClick={() => onNavigateToMenu("openapi")} className={btnSecondary}>
            <FileText className="w-4 h-4 mr-2" />{t("View OpenAPI Docs", "查看 OpenAPI 文档")}
          </button>
        </div>
      </div>
    </div>
  );
}
