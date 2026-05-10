"use client";

import { useState } from "react";
import { BookOpen, ExternalLink, FileText, Search, Tag, X, ShoppingCart, Check, Key } from "lucide-react";
import { cardClass, inputClass, btnPrimary } from "@/lib/constants";
import { statusBadge, type PortalPanelProps } from "./PortalPanel";
import type { ApiProduct, PricingTier } from "@/lib/types";

export default function PortalCatalogTab({
  products, allTags, catalogBusy, searchQuery, selectedTags,
  onSearchChange, onTagToggle, onNavigateToMenu, onSetOpenApiFilter,
  onViewProductDocs, myKeys, subscribeToProduct, subBusy,
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
            <ProductCard key={p.id} product={p} onNavigateToMenu={onNavigateToMenu} onSetOpenApiFilter={onSetOpenApiFilter} onViewProductDocs={onViewProductDocs} myKeys={myKeys} subscribeToProduct={subscribeToProduct} subBusy={subBusy} t={t} />
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
  onViewProductDocs,
  onNavigateToMenu,
  onSetOpenApiFilter,
  myKeys,
  subscribeToProduct,
  subBusy,
  t,
}: {
  product: ApiProduct;
  onViewProductDocs?: (productId: string) => void;
  onNavigateToMenu: (menu: string) => void;
  onSetOpenApiFilter: (v: string) => void;
  myKeys?: Array<{ id: string; name: string; key_prefix: string; status: string }>;
  subscribeToProduct?: (productId: string, apiKeyId: string, plan: string) => Promise<void>;
  subBusy?: boolean;
  t: <T>(en: T, zh: T) => T;
}) {
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [selectedKey, setSelectedKey] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const tiers: PricingTier[] = Array.isArray(product.pricing_tiers) ? product.pricing_tiers : [];
  const tags = normalizeTags(product.tags);
  const activeKeys = (myKeys || []).filter((k) => k.status === "active");

  const handleSubscribe = async () => {
    if (!selectedKey || !selectedPlan) return;
    await subscribeToProduct?.(product.id, selectedKey, selectedPlan);
    setSubmitted(true);
  };

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
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex-wrap">
        <button
          onClick={() => onViewProductDocs?.(product.id)}
          className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2.5 py-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition flex items-center gap-1 font-medium"
        >
          <BookOpen className="w-3.5 h-3.5" />
          {t("View Docs", "查看文档")}
        </button>
        <button
          onClick={() => { onNavigateToMenu("openapi"); onSetOpenApiFilter(product.rule_ids?.[0] || ""); }}
          className="text-xs bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition flex items-center gap-1"
        >
          <FileText className="w-3.5 h-3.5" />
          {t("OpenAPI", "OpenAPI")}
        </button>
        {product.documentation_url && (
          <a href={product.documentation_url} target="_blank" rel="noopener noreferrer" className="text-xs bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition flex items-center gap-1">
            <ExternalLink className="w-3.5 h-3.5" />
            {t("External Docs", "外部文档")}
          </a>
        )}
        {subscribeToProduct && tiers.length > 0 && (
          submitted ? (
            <span className="text-xs bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-2.5 py-1.5 rounded-lg flex items-center gap-1 font-medium">
              <Check className="w-3.5 h-3.5" />{t("Subscribed", "已订阅")}
            </span>
          ) : (
            <button
              onClick={() => { setShowSubscribe(true); setSelectedKey(activeKeys[0]?.id || ""); setSelectedPlan(tiers[0]?.name || ""); }}
              className="text-xs bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-2.5 py-1.5 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition flex items-center gap-1 font-medium"
            >
              <ShoppingCart className="w-3.5 h-3.5" />{t("Subscribe", "订阅")}
            </button>
          )
        )}
        <span className="ml-auto text-xs text-gray-400">{product.rule_ids?.length || 0} {t("APIs", "个 API")}</span>
      </div>

      {/* Subscribe Dialog */}
      {showSubscribe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowSubscribe(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-1">{t("Subscribe to", "订阅")} {product.name}</h3>
            <p className="text-sm text-gray-500 mb-4">{t("Select an API key and plan to subscribe.", "选择一个 API 密钥和方案进行订阅。")}</p>

            {activeKeys.length === 0 ? (
              <div className="text-center py-6 text-gray-400">
                <Key className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">{t("No active API keys. Create one in My Apps first.", "没有活跃的 API 密钥。请先在「我的应用」中创建。")}</p>
              </div>
            ) : (
              <>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">{t("API Key", "API 密钥")}</label>
                <select className={`${inputClass} mb-3`} value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)}>
                  {activeKeys.map((k) => (
                    <option key={k.id} value={k.id}>{k.name} ({k.key_prefix}****)</option>
                  ))}
                </select>

                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">{t("Plan", "方案")}</label>
                <div className="space-y-2 mb-4">
                  {tiers.map((tier) => (
                    <button
                      key={tier.name}
                      onClick={() => setSelectedPlan(tier.name)}
                      className={`w-full text-left p-3 rounded-xl border transition ${
                        selectedPlan === tier.name
                          ? "border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-600"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-sm">{tier.name}</span>
                        <span className="text-xs">{tier.price_monthly > 0 ? `$${tier.price_monthly}/${t("mo", "月")}` : t("Free", "免费")}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{tier.rate_limit_rps} RPS · {t("Daily", "日")}: {tier.quota_daily?.toLocaleString() || "—"}</div>
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowSubscribe(false)} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition">{t("Cancel", "取消")}</button>
              {activeKeys.length > 0 && (
                <button onClick={handleSubscribe} disabled={subBusy || !selectedKey || !selectedPlan} className={`${btnPrimary} px-4`}>
                  {subBusy ? t("Subscribing...", "订阅中...") : t("Confirm Subscribe", "确认订阅")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
