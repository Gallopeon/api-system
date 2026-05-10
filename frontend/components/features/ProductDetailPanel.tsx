"use client";

import { ExternalLink, Users, Tag } from "lucide-react";
import type { ApiProduct, Subscription, PricingTier } from "@/lib/types";

interface Props {
  product: ApiProduct;
  subscriptions: Subscription[];
  loadingSubs: boolean;
  statusBadge: (s: string) => React.ReactNode;
  t: <T>(en: T, zh: T) => T;
}

function parseTiers(tiers: unknown): PricingTier[] {
  if (!tiers) return [];
  if (Array.isArray(tiers)) return tiers as PricingTier[];
  if (typeof tiers === "string") {
    try { const p = JSON.parse(tiers); return Array.isArray(p) ? p : []; } catch { return []; }
  }
  return [];
}

export default function ProductDetailPanel({ product, subscriptions, loadingSubs, statusBadge, t }: Props) {
  const pt = parseTiers(product.pricing_tiers);
  const tagsArr = Array.isArray(product.tags) ? product.tags : [];
  const ruleIdArr = Array.isArray(product.rule_ids) ? product.rule_ids : [];

  return (
    <div className="border-t dark:border-gray-800 px-5 py-4 space-y-4 bg-gray-50/50 dark:bg-gray-900/30">
      {/* Basic info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <span className="text-xs text-gray-400 uppercase tracking-wider">{t("Owner", "负责人")}</span>
          <p className="text-sm font-medium">{product.owner || "—"}</p>
        </div>
        <div>
          <span className="text-xs text-gray-400 uppercase tracking-wider">{t("Created", "创建时间")}</span>
          <p className="text-sm">{product.created_at ? new Date(product.created_at).toLocaleDateString() : "—"}</p>
        </div>
        <div>
          <span className="text-xs text-gray-400 uppercase tracking-wider">{t("Documentation", "文档")}</span>
          <p className="text-sm">{product.documentation_url ? <a href={product.documentation_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3" />{t("Open", "打开")}</a> : "—"}</p>
        </div>
      </div>

      {/* Tags */}
      {tagsArr.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tagsArr.map(tg => <span key={tg} className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">{tg}</span>)}
        </div>
      )}

      {/* Rule IDs */}
      {ruleIdArr.length > 0 && (
        <div>
          <span className="text-xs text-gray-400 uppercase tracking-wider">{t("Associated Rules", "关联规则")}</span>
          <div className="flex flex-wrap gap-1 mt-1">{ruleIdArr.map(rid => <code key={rid} className="text-[10px] bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded font-mono">{rid.substring(0, 20)}&hellip;</code>)}</div>
        </div>
      )}

      {/* Pricing Tiers table */}
      {pt.length > 0 && (
        <div>
          <span className="text-xs text-gray-400 uppercase tracking-wider">{t("Pricing Tiers", "定价方案")}</span>
          <div className="mt-1 overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b dark:border-gray-700 text-left text-gray-400">
                <th className="py-1.5 pr-3 font-medium">{t("Name", "名称")}</th>
                <th className="py-1.5 pr-3 font-medium">{t("Price/mo", "月费")}</th>
                <th className="py-1.5 pr-3 font-medium">RPS</th>
                <th className="py-1.5 pr-3 font-medium">{t("Daily", "日配额")}</th>
                <th className="py-1.5 pr-3 font-medium">{t("Monthly", "月配额")}</th>
              </tr></thead>
              <tbody className="divide-y dark:divide-gray-800">
                {pt.map((tier, i) => (
                  <tr key={i}>
                    <td className="py-1.5 pr-3 font-medium">{tier.name}</td>
                    <td className="py-1.5 pr-3">{tier.price_monthly > 0 ? `$${tier.price_monthly}` : <span className="text-green-600">{t("Free", "免费")}</span>}</td>
                    <td className="py-1.5 pr-3 font-mono">{tier.rate_limit_rps}</td>
                    <td className="py-1.5 pr-3 font-mono">{tier.quota_daily > 0 ? tier.quota_daily.toLocaleString() : "—"}</td>
                    <td className="py-1.5 pr-3 font-mono">{tier.quota_monthly > 0 ? tier.quota_monthly.toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subscriptions */}
      <div>
        <span className="text-xs text-gray-400 uppercase tracking-wider flex items-center gap-1">
          <Users className="w-3 h-3" />{t("Active Subscriptions", "活跃订阅")}
        </span>
        {loadingSubs ? (
          <p className="text-xs text-gray-400 mt-1">{t("Loading...", "加载中...")}</p>
        ) : subscriptions.length === 0 ? (
          <p className="text-xs text-gray-400 mt-1">{t("No subscriptions yet", "暂无订阅")}</p>
        ) : (
          <div className="mt-1 overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b dark:border-gray-700 text-left text-gray-400">
                <th className="py-1.5 pr-3 font-medium">{t("Subscriber", "订阅者")}</th>
                <th className="py-1.5 pr-3 font-medium">{t("Plan", "方案")}</th>
                <th className="py-1.5 pr-3 font-medium">{t("Status", "状态")}</th>
                <th className="py-1.5 pr-3 font-medium">{t("Expires", "过期")}</th>
              </tr></thead>
              <tbody className="divide-y dark:divide-gray-800">
                {subscriptions.map(sub => (
                  <tr key={sub.id}>
                    <td className="py-1.5 pr-3 font-mono text-[10px]">{sub.api_key_id.substring(0, 14)}&hellip;</td>
                    <td className="py-1.5 pr-3"><span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize ${sub.plan === "enterprise" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" : sub.plan === "pro" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800"}`}>{sub.plan}</span></td>
                    <td className="py-1.5 pr-3">{statusBadge(sub.status)}</td>
                    <td className="py-1.5 pr-3">{sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
