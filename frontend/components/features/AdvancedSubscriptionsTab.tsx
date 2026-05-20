"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Plus, Edit3, Trash2, Check, X, RefreshCw, TrendingUp, XCircle, RotateCcw, BarChart3, Package, Zap } from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary, btnSecondary } from "@/lib/constants";
import type { Subscription, SubscriptionUsage, ApiKeyItem, ApiProduct, PricingTier } from "@/lib/types";
import SubscriptionPlanSelect from "./SubscriptionPlanSelect";

interface Props {
  subscriptions: Subscription[];
  busy: boolean;
  apiKeys: ApiKeyItem[];
  productsList: ApiProduct[];
  usageMap: Record<string, SubscriptionUsage>;
  loadSubscriptions: () => Promise<void>;
  loadApiKeys: () => Promise<void>;
  loadProductsList: () => Promise<void>;
  createSubscription: (data: Record<string, unknown>) => Promise<void>;
  updateSubscription: (id: string, data: Record<string, unknown>) => Promise<void>;
  upgradeSubscription: (id: string, plan: string) => Promise<void>;
  cancelSubscription: (id: string) => Promise<void>;
  renewSubscription: (id: string, expiresAt: string) => Promise<void>;
  getSubscriptionUsage: (id: string) => Promise<SubscriptionUsage | null>;
  deleteSubscription: (id: string) => Promise<void>;
  canWrite: boolean;
  notifyError: (m: string) => void;
  t: <T>(en: T, zh: T) => T;
}

function parseTiers(product: ApiProduct | undefined): PricingTier[] {
  if (!product?.pricing_tiers) return [];
  if (Array.isArray(product.pricing_tiers)) return product.pricing_tiers;
  if (typeof product.pricing_tiers === "string") {
    try { const p = JSON.parse(product.pricing_tiers); return Array.isArray(p) ? p : []; } catch { return []; }
  }
  return [];
}

function tierBadge(plan: string, tiers: PricingTier[]) {
  const idx = tiers.findIndex(t => t.name === plan);
  const colors = [
    "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  ];
  return colors[idx >= 0 ? idx % colors.length : 0];
}

const statusBadge = (s: string, t: Props["t"]) => {
  const colors: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    cancelled: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
    expired: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    suspended: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[s] || colors.suspended}`}>{s}</span>;
};

const th = (t: string) => <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t}</th>;
const td = (c: React.ReactNode, cls = "") => <td className={`px-3 py-3 ${cls}`}>{c}</td>;

export default function AdvancedSubscriptionsTab(props: Props) {
  const { subscriptions, busy, apiKeys, productsList, usageMap, loadSubscriptions, loadApiKeys, loadProductsList, createSubscription, updateSubscription, upgradeSubscription, cancelSubscription, renewSubscription, getSubscriptionUsage, deleteSubscription, canWrite, notifyError, t } = props;
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showRenew, setShowRenew] = useState<string | null>(null);
  const [renewDate, setRenewDate] = useState("");

  // Create form
  const [keyId, setKeyId] = useState(""); const [prodId, setProdId] = useState("");
  const [plan, setPlan] = useState(""); const [rps, setRps] = useState("");
  const [quota, setQuota] = useState(""); const [expiry, setExpiry] = useState("");

  // Edit form
  const [ePlan, setEPlan] = useState(""); const [eRps, setERps] = useState("");
  const [eQuota, setEQuota] = useState(""); const [eExpiry, setEExpiry] = useState("");

  const selectedProduct = useMemo(() => productsList.find(p => p.id === prodId), [prodId, productsList]);
  const selectedTiers = useMemo(() => parseTiers(selectedProduct), [selectedProduct]);

  const editProduct = useMemo(() => {
    const sub = subscriptions.find(s => s.id === editId);
    return sub ? productsList.find(p => p.id === sub.product_id) : undefined;
  }, [editId, subscriptions, productsList]);
  const editTiers = useMemo(() => parseTiers(editProduct), [editProduct]);

  useEffect(() => {
    loadApiKeys(); loadProductsList();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When product changes, reset plan and auto-fill from tier
  useEffect(() => {
    if (selectedTiers.length > 0) {
      const first = selectedTiers[0];
      setPlan(first.name);
      setRps(first.rate_limit_rps?.toString() || "");
      setQuota(first.quota_daily?.toString() || "");
    } else {
      setPlan(""); setRps(""); setQuota("");
    }
  }, [prodId, selectedTiers]);

  const getKeyName = (keyId: string) => apiKeys.find(k => k.id === keyId)?.name || keyId.substring(0, 12) + "...";
  const getProductName = (prodId: string) => productsList.find(p => p.id === prodId)?.name || prodId.substring(0, 12) + "...";

  const startEdit = (s: Subscription) => {
    setEditId(s.id); setEPlan(s.plan); setERps(s.rate_limit_rps?.toString() || "");
    setEQuota(s.quota_daily?.toString() || ""); setEExpiry(s.expires_at || "");
  };

  const saveEdit = useCallback(async () => {
    if (!editId) return;
    const data: Record<string, unknown> = { plan: ePlan };
    if (eRps) data.rate_limit_rps = parseInt(eRps);
    if (eQuota) data.quota_daily = parseInt(eQuota);
    if (eExpiry) data.expires_at = eExpiry;
    await updateSubscription(editId, data);
    setEditId(null);
  }, [editId, ePlan, eRps, eQuota, eExpiry, updateSubscription]);

  const handleCreate = useCallback(async () => {
    if (!keyId || !prodId) { notifyError("API Key and Product are required"); return; }
    const data: Record<string, unknown> = { api_key_id: keyId, product_id: prodId, plan };
    if (rps) data.rate_limit_rps = parseInt(rps);
    if (quota) data.quota_daily = parseInt(quota);
    if (expiry) data.expires_at = expiry;
    await createSubscription(data);
    setKeyId(""); setProdId(""); setPlan(""); setRps(""); setQuota(""); setExpiry(""); setShow(false);
  }, [keyId, prodId, plan, rps, quota, expiry, createSubscription, notifyError]);

  const handleRenew = useCallback(async () => {
    if (!showRenew || !renewDate) return;
    await renewSubscription(showRenew, renewDate);
    setShowRenew(null); setRenewDate("");
  }, [showRenew, renewDate, renewSubscription]);

  const renderUsage = (s: Subscription) => {
    const u = usageMap[s.id];
    if (!u || u.quota_used_pct === null) return <span className="text-gray-400 text-xs">—</span>;
    const pct = u.quota_used_pct;
    const barColor = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500";
    return (
      <div className="flex items-center gap-2 min-w-[100px]">
        <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <span className={`text-[10px] font-medium ${pct > 90 ? "text-red-500" : pct > 70 ? "text-amber-500" : "text-emerald-500"}`}>{pct}%</span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-500" />
            {t("Subscriptions", "订阅管理")}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t("Manage API product subscriptions with tiered plans, quotas, and lifecycle controls.", "管理 API 产品订阅，支持分层套餐、配额和生命周期控制。")}</p>
        </div>
        {canWrite && <button className={btnPrimary} onClick={() => setShow(!show)} disabled={busy}><Plus className="w-4 h-4 mr-1" />{t("Create", "创建")}</button>}
      </div>

      {canWrite && show && (
        <div className={`${cardClass} space-y-4`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>{t("API Key", "API Key")} <span className="text-red-500">*</span></label>
              <select className={inputClass} value={keyId} onChange={e => setKeyId(e.target.value)}>
                <option value="">{t("Select API Key…", "选择 API Key…")}</option>
                {apiKeys.filter(k => k.status === "active").map(k => <option key={k.id} value={k.id}>{k.name} ({k.key_prefix}…)</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("Product", "产品")} <span className="text-red-500">*</span></label>
              <select className={inputClass} value={prodId} onChange={e => setProdId(e.target.value)}>
                <option value="">{t("Select Product…", "选择产品…")}</option>
                {productsList.filter(p => p.status === "active").map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("Plan", "套餐")}</label>
              <SubscriptionPlanSelect value={plan} onChange={setPlan} tiers={selectedTiers} t={t} />
              {selectedTiers.length === 0 && prodId && (
                <p className="text-[10px] text-amber-500 mt-1">{t("Product has no pricing tiers. Enter plan name manually.", "产品未配置定价方案，请手动输入。")}</p>
              )}
            </div>
            <div>
              <label className={labelClass}>{t("Rate Limit (RPS)", "速率限制 (RPS)")}</label>
              <div className="relative">
                <Zap className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                <input className={`${inputClass} pl-8`} type="number" value={rps} onChange={e => setRps(e.target.value)} placeholder="100" />
              </div>
            </div>
            <div>
              <label className={labelClass}>{t("Daily Quota", "每日配额")}</label>
              <div className="relative">
                <TrendingUp className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                <input className={`${inputClass} pl-8`} type="number" value={quota} onChange={e => setQuota(e.target.value)} placeholder="10000" />
              </div>
            </div>
            <div>
              <label className={labelClass}>{t("Expires At", "过期时间")}</label>
              <input className={inputClass} type="date" value={expiry} onChange={e => setExpiry(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2"><button className={btnPrimary} onClick={handleCreate} disabled={busy}>{busy ? t("Creating…", "创建中…") : t("Save Subscription", "保存订阅")}</button><button className={btnSecondary} onClick={() => setShow(false)}>{t("Cancel", "取消")}</button></div>
        </div>
      )}

      {subscriptions.length === 0 ? (
        <div className={`${cardClass} text-center py-10 text-gray-400`}><RefreshCw className="w-10 h-10 mx-auto mb-3 opacity-40" /><p className="text-sm">{t("No items found", "暂无数据")}</p></div>
      ) : (
        <div className={`${cardClass} p-0 overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-800">
              <tr>{[t("API Key", "API Key"), t("Product", "产品"), t("Plan", "套餐"), t("Rate/QoS", "速率/配额"), t("Usage", "用量"), t("Expires", "过期"), t("Status", "状态"), ...(canWrite ? [t("Actions", "操作")] : [])].map(h => th(h))}</tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-800">
              {subscriptions.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition">
                  {editId === s.id ? (
                    <>
                      {td(<span className="font-mono text-xs text-gray-600">{getKeyName(s.api_key_id)}</span>)}
                      {td(<span className="text-xs text-gray-600">{getProductName(s.product_id)}</span>)}
                      {td(<SubscriptionPlanSelect value={ePlan} onChange={setEPlan} tiers={editTiers} t={t} />)}
                      {td(<div className="flex gap-1"><input className={inputClass} type="number" value={eRps} onChange={e => setERps(e.target.value)} placeholder="RPS" style={{ width: 70 }} /><input className={inputClass} type="number" value={eQuota} onChange={e => setEQuota(e.target.value)} placeholder="Qty" style={{ width: 70 }} /></div>)}
                      {td(<span className="text-xs">—</span>)}
                      {td(<input className={inputClass} type="date" value={eExpiry} onChange={e => setEExpiry(e.target.value)} />)}
                      {td(statusBadge(s.status, t))}
                      {td(<div className="flex gap-1"><button className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg" onClick={saveEdit}><Check className="w-3.5 h-3.5" /></button><button className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg" onClick={() => setEditId(null)}><X className="w-3.5 h-3.5" /></button></div>)}
                    </>
                  ) : (
                    <>
                      {td(<span className="font-mono text-xs text-gray-600 dark:text-gray-400" title={s.api_key_id}>{getKeyName(s.api_key_id)}</span>)}
                      {td(<span className="text-xs font-medium text-gray-700 dark:text-gray-300">{getProductName(s.product_id)}</span>)}
                      {td(<span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold capitalize ${tierBadge(s.plan, parseTiers(productsList.find(p => p.id === s.product_id)))}`}>{s.plan}</span>)}
                      {td(<div className="flex flex-col gap-0.5 text-[10px] text-gray-500">{s.rate_limit_rps ? <span>{t("RPS", "速率")}: {s.rate_limit_rps}</span> : null}{s.quota_daily ? <span>{t("Qty", "配额")}: {s.quota_daily.toLocaleString()}/day</span> : null}{!s.rate_limit_rps && !s.quota_daily && <span className="text-gray-400">—</span>}</div>)}
                      {td(renderUsage(s))}
                      {td(<span className={`text-xs ${s.expires_at && new Date(s.expires_at) < new Date() ? "text-red-500 font-medium" : "text-gray-500"}`}>{s.expires_at ? new Date(s.expires_at).toLocaleDateString() : <span className="text-gray-400">{t("Never", "无限制")}</span>}</span>)}
                      {td(statusBadge(s.status, t))}
                      {canWrite && td(
                        <div className="flex items-center gap-0.5">
                          <button className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition" onClick={() => getSubscriptionUsage(s.id)} title={t("Check Usage", "查看用量")}><BarChart3 className="w-3.5 h-3.5" /></button>
                          <button className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition" onClick={() => startEdit(s)} title={t("Edit", "编辑")}><Edit3 className="w-3.5 h-3.5" /></button>
                          {s.status === "active" && (
                            <>
                              {/* Upgrade/Downgrade */}
                              {(() => {
                                const subProduct = productsList.find(p => p.id === s.product_id);
                                const subTiers = parseTiers(subProduct);
                                if (subTiers.length <= 1) return null;
                                return (
                                  <select className="text-[10px] px-1 py-1 rounded border border-gray-200 dark:border-gray-700 dark:bg-gray-800" value="" onChange={e => { if (e.target.value) upgradeSubscription(s.id, e.target.value); }}>
                                    <option value="">{t("Change", "切换")}</option>
                                    {subTiers.filter(v => v.name !== s.plan).map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                                  </select>
                                );
                              })()}
                              <button className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition" onClick={() => { setShowRenew(s.id); setRenewDate(""); }} title={t("Renew", "续期")}><RotateCcw className="w-3.5 h-3.5" /></button>
                              <button className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition" onClick={() => cancelSubscription(s.id)} title={t("Cancel", "取消订阅")} disabled={busy}><XCircle className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                          <button className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition" onClick={() => deleteSubscription(s.id)} disabled={busy} title={t("Delete", "删除")}><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showRenew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className={`${cardClass} w-80 space-y-4`}>
            <h3 className="text-lg font-semibold">{t("Renew Subscription", "续期订阅")}</h3>
            <div><label className={labelClass}>{t("New Expiry Date", "新过期日期")}</label><input className={inputClass} type="date" value={renewDate} onChange={e => setRenewDate(e.target.value)} /></div>
            <div className="flex gap-2 justify-end"><button className={btnPrimary} onClick={handleRenew} disabled={busy || !renewDate}>{t("Renew", "续期")}</button><button className={btnSecondary} onClick={() => setShowRenew(null)}>{t("Cancel", "取消")}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
