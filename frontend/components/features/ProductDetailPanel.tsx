"use client";

import { ExternalLink, Users, Tag, ShieldAlert, TrendingUp, Clock, BarChart3 } from "lucide-react";
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
  const activeCount = product.active_subscription_count || 0;
  const totalCount = product.subscription_count || 0;

  return (
    <div className="border-t dark:border-gray-800 px-5 py-5 space-y-5 bg-gray-50/50 dark:bg-gray-900/30">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800/50 rounded-lg p-3 border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-1.5 text-[10px] text-gray-400 uppercase tracking-wider mb-1">
            <Users className="w-3 h-3" />{t("Active Subs", "活跃订阅")}
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{activeCount}</div>
          <div className="text-[10px] text-gray-400">{t("of", "共")} {totalCount} {t("total", "总计")}</div>
        </div>
        <div className="bg-white dark:bg-gray-800/50 rounded-lg p-3 border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-1.5 text-[10px] text-gray-400 uppercase tracking-wider mb-1">
            <ShieldAlert className="w-3 h-3" />{t("Rules", "规则")}
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{ruleIdArr.length}</div>
          <div className="text-[10px] text-gray-400">{t("associated", "已关联")}</div>
        </div>
        <div className="bg-white dark:bg-gray-800/50 rounded-lg p-3 border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-1.5 text-[10px] text-gray-400 uppercase tracking-wider mb-1">
            <BarChart3 className="w-3 h-3" />{t("Tiers", "方案")}
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{pt.length}</div>
          <div className="text-[10px] text-gray-400">{t("limit tiers", "限制方案")}</div>
        </div>
        <div className="bg-white dark:bg-gray-800/50 rounded-lg p-3 border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-1.5 text-[10px] text-gray-400 uppercase tracking-wider mb-1">
            <Clock className="w-3 h-3" />{t("Updated", "更新")}
          </div>
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{product.updated_at ? new Date(product.updated_at).toLocaleDateString() : "—"}</div>
          <div className="text-[10px] text-gray-400">{product.created_at ? new Date(product.created_at).toLocaleDateString() : "—"} {t("created", "创建")}</div>
        </div>
      </div>

      {/* Basic info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <span className="text-xs text-gray-400 uppercase tracking-wider">{t("Owner", "负责人")}</span>
          <p className="text-sm font-medium">{product.owner || "—"}</p>
        </div>
        <div>
          <span className="text-xs text-gray-400 uppercase tracking-wider">{t("Status", "状态")}</span>
          <p className="text-sm mt-0.5">{statusBadge(product.status)}</p>
        </div>
        <div>
          <span className="text-xs text-gray-400 uppercase tracking-wider">{t("Documentation", "文档")}</span>
          <p className="text-sm">{product.documentation_url ? <a href={product.documentation_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3" />{t("Open", "打开")}</a> : "—"}</p>
        </div>
      </div>

      {/* Tags */}
      {tagsArr.length > 0 && (
        <div>
          <span className="text-xs text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-1.5"><Tag className="w-3 h-3" />{t("Tags", "标签")}</span>
          <div className="flex flex-wrap gap-1.5">
            {tagsArr.map(tg => <span key={tg} className="text-[11px] px-2.5 py-1 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 font-medium">{tg}</span>)}
          </div>
        </div>
      )}

      {/* Rule IDs */}
      {ruleIdArr.length > 0 && (
        <div>
          <span className="text-xs text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-1.5"><ShieldAlert className="w-3 h-3" />{t("Associated Rules", "关联规则")}</span>
          <div className="flex flex-wrap gap-1.5">{ruleIdArr.map(rid => <code key={rid} className="text-[11px] bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono text-gray-600 dark:text-gray-300">{rid.substring(0, 24)}&hellip;</code>)}</div>
        </div>
      )}

      {/* Limit Tiers table */}
      {pt.length > 0 && (
        <div>
          <span className="text-xs text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-2"><TrendingUp className="w-3 h-3" />{t("Limit Tiers", "限制方案")}</span>
          <div className="mt-1 overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b dark:border-gray-700 text-left text-gray-400">
                <th className="py-2 pr-3 font-medium">{t("Name", "名称")}</th>
                <th className="py-2 pr-3 font-medium">RPS</th>
                <th className="py-2 pr-3 font-medium">{t("Daily", "日配额")}</th>
                <th className="py-2 pr-3 font-medium">{t("Monthly", "月配额")}</th>
              </tr></thead>
              <tbody className="divide-y dark:divide-gray-800">
                {pt.map((tier, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-3 font-medium text-gray-900 dark:text-gray-100">{tier.name}</td>
                    <td className="py-2 pr-3 font-mono text-gray-600 dark:text-gray-400">{tier.rate_limit_rps}</td>
                    <td className="py-2 pr-3 font-mono text-gray-600 dark:text-gray-400">{tier.quota_daily > 0 ? tier.quota_daily.toLocaleString() : "—"}</td>
                    <td className="py-2 pr-3 font-mono text-gray-600 dark:text-gray-400">{tier.quota_monthly > 0 ? tier.quota_monthly.toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subscriptions */}
      <div>
        <span className="text-xs text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-2">
          <Users className="w-3 h-3" />{t("Active Subscriptions", "活跃订阅")}
        </span>
        {loadingSubs ? (
          <p className="text-xs text-gray-400 mt-1">{t("Loading...", "加载中...")}</p>
        ) : subscriptions.length === 0 ? (
          <div className="bg-white dark:bg-gray-800/30 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 py-4 text-center">
            <Users className="w-5 h-5 mx-auto mb-1 text-gray-300" />
            <p className="text-xs text-gray-400">{t("No subscriptions yet", "暂无订阅")}</p>
          </div>
        ) : (
          <div className="mt-1 overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b dark:border-gray-700 text-left text-gray-400">
                <th className="py-2 pr-3 font-medium">{t("Subscriber", "订阅者")}</th>
                <th className="py-2 pr-3 font-medium">{t("Plan", "方案")}</th>
                <th className="py-2 pr-3 font-medium">{t("Status", "状态")}</th>
                <th className="py-2 pr-3 font-medium">{t("Expires", "过期")}</th>
              </tr></thead>
              <tbody className="divide-y dark:divide-gray-800">
                {subscriptions.map(sub => (
                  <tr key={sub.id}>
                    <td className="py-2 pr-3 font-mono text-[10px] text-gray-600 dark:text-gray-400">{sub.api_key_id.substring(0, 14)}&hellip;</td>
                    <td className="py-2 pr-3"><span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize ${sub.plan === "enterprise" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" : sub.plan === "pro" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800"}`}>{sub.plan}</span></td>
                    <td className="py-2 pr-3">{statusBadge(sub.status)}</td>
                    <td className="py-2 pr-3 text-gray-500">{sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : "—"}</td>
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
