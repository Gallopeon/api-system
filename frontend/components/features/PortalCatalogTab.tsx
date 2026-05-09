"use client";

import { BookOpen, ExternalLink, FileText, Search, Tag, X } from "lucide-react";
import { cardClass, inputClass } from "@/lib/constants";
import { statusBadge, type PortalPanelProps } from "./PortalPanel";
import type { ApiProduct } from "@/lib/types";

export default function PortalCatalogTab({
  products, allTags, catalogBusy, searchQuery, selectedTags,
  onSearchChange, onTagToggle, onNavigateToMenu, onSetOpenApiFilter,
  t,
}: PortalPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className={`${inputClass} pl-9`}
            placeholder={t("Search APIs by name, description or tag...", "按名称、描述或标签搜索 API...")}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => onSearchChange("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => onTagToggle(tag)}
                className={`text-xs px-2.5 py-1 rounded-full border transition font-medium flex items-center gap-1 ${
                  selectedTags.includes(tag)
                    ? "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-600 dark:text-blue-300"
                    : "bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300 dark:bg-gray-900/30 dark:border-gray-700 dark:text-gray-400"
                }`}
              >
                <Tag className="w-3 h-3" />
                {tag}
              </button>
            ))}
            {selectedTags.length > 0 && (
              <button onClick={() => selectedTags.forEach(onTagToggle)} className="text-xs px-2 py-1 text-red-500 hover:text-red-700">
                {t("Clear all", "清除全部")}
              </button>
            )}
          </div>
        )}
      </div>

      {catalogBusy ? (
        <div className="text-center py-12 text-gray-400">{t("Loading catalog...", "正在加载目录...")}</div>
      ) : products.length === 0 ? (
        <div className={`${cardClass} text-center py-12`}>
          <BookOpen className="w-14 h-14 mx-auto mb-3 text-gray-300 dark:text-gray-700" />
          <p className="text-gray-500 font-medium">{t("No APIs found", "未找到 API")}</p>
          <p className="text-gray-400 text-sm mt-1">
            {searchQuery || selectedTags.length > 0
              ? t("Try adjusting your search or filters.", "请尝试调整搜索条件或筛选器。")
              : t("No products have been published yet. Create and activate products in the Advanced panel.", "尚未发布任何产品。请在高级面板中创建并激活产品。")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} onNavigateToMenu={onNavigateToMenu} onSetOpenApiFilter={onSetOpenApiFilter} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function normalizeTags(t: unknown): string[] {
  if (!t) return [];
  if (Array.isArray(t)) return t;
  if (typeof t === "string") {
    try { const parsed = JSON.parse(t); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }
  return [];
}

function ProductCard({
  product,
  onNavigateToMenu,
  onSetOpenApiFilter,
  t,
}: {
  product: ApiProduct;
  onNavigateToMenu: (menu: string) => void;
  onSetOpenApiFilter: (v: string) => void;
  t: <T>(en: T, zh: T) => T;
}) {
  const tiers = Array.isArray(product.pricing_tiers) ? product.pricing_tiers : [];
  const tags = normalizeTags(product.tags);

  return (
    <div className={`${cardClass} hover:shadow-lg transition-shadow group`}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">{product.name}</h3>
        {statusBadge(product.status, t)}
      </div>
      {product.description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{product.description}</p>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {tags.map((tag) => (
            <span key={tag} className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">{tag}</span>
          ))}
        </div>
      )}
      {tiers.length > 0 && (
        <div className="mb-3 space-y-1.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("Pricing Plans", "定价方案")}</p>
          <div className="grid grid-cols-2 gap-2">
            {tiers.slice(0, 4).map((tier, i) => (
              <div key={i} className="bg-gray-50 dark:bg-gray-900/50 rounded-lg px-2.5 py-2 border border-gray-100 dark:border-gray-800">
                <div className="text-xs font-bold text-gray-800 dark:text-gray-200">{tier.name}</div>
                <div className="text-xs text-gray-500">
                  {tier.price_monthly > 0
                    ? <>${tier.price_monthly}/{t("mo", "月")}</>
                    : t("Free", "免费")}
                  <span className="mx-1">·</span>
                  {tier.rate_limit_rps} RPS
                </div>
                {(tier.quota_daily > 0 || tier.quota_monthly > 0) && (
                  <div className="text-xs text-gray-400 mt-0.5">
                    {tier.quota_daily > 0 && <span>{t("Daily", "日")}: {tier.quota_daily.toLocaleString()}</span>}
                    {tier.quota_daily > 0 && tier.quota_monthly > 0 && <span className="mx-1">·</span>}
                    {tier.quota_monthly > 0 && <span>{t("Monthly", "月")}: {tier.quota_monthly.toLocaleString()}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={() => { onNavigateToMenu("openapi"); onSetOpenApiFilter(product.rule_ids?.[0] || ""); }}
          className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2.5 py-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition flex items-center gap-1"
        >
          <FileText className="w-3.5 h-3.5" />
          {t("Docs", "文档")}
        </button>
        {product.documentation_url && (
          <a href={product.documentation_url} target="_blank" rel="noopener noreferrer" className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2.5 py-1.5 rounded-lg hover:bg-gray-200 transition flex items-center gap-1">
            <ExternalLink className="w-3.5 h-3.5" />
            {t("External Docs", "外部文档")}
          </a>
        )}
        <span className="ml-auto text-xs text-gray-400">{product.rule_ids?.length || 0} {t("APIs", "个 API")}</span>
      </div>
    </div>
  );
}
