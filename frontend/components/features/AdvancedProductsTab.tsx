"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Plus, Edit3, Trash2, Check, X, Package, Search, Power, PowerOff,
  ChevronDown, ChevronRight, DollarSign, Users, BookOpen, Sparkles,
} from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary, btnSecondary } from "@/lib/constants";
import type { ApiProduct, PricingTier, Subscription, RuleSummary } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import PricingTierEditor, { emptyTier, type TierForm } from "./PricingTierEditor";
import ProductDetailPanel from "./ProductDetailPanel";
import { RuleSelector, StatusMenu, TagChips } from "./ProductFormWidgets";

interface Props {
  products: ApiProduct[];
  rules: RuleSummary[];
  busy: boolean;
  createProduct: (data: Record<string, unknown>) => Promise<void>;
  updateProduct: (id: string, data: Record<string, unknown>) => Promise<void>;
  toggleProductStatus: (id: string, currentStatus: string) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  loadProducts: (search?: string) => Promise<void>;
  loadRules: () => Promise<void>;
  canWrite: boolean;
  notifyError: (m: string) => void;
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

function tiersToPayload(tf: TierForm[]): PricingTier[] {
  return tf.filter(t => t.name.trim()).map(t => ({
    name: t.name.trim(),
    rate_limit_rps: parseInt(t.rate_limit_rps) || 10,
    quota_daily: parseInt(t.quota_daily) || 0,
    quota_monthly: parseInt(t.quota_monthly) || 0,
    price_monthly: parseFloat(t.price_monthly) || 0,
  }));
}

function formFromTiers(tl: PricingTier[]): TierForm[] {
  if (!tl || tl.length === 0) return [emptyTier()];
  return tl.map(t => ({
    name: t.name || "",
    price_monthly: t.price_monthly?.toString() || "",
    rate_limit_rps: t.rate_limit_rps?.toString() || "",
    quota_daily: t.quota_daily?.toString() || "",
    quota_monthly: t.quota_monthly?.toString() || "",
  }));
}

const statusBadge = (s: string, t: Props["t"]) => {
  const map: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    inactive: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    deprecated: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    retired: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  };
  const ZHT: Record<string, string> = { active: "激活", inactive: "未激活", deprecated: "已弃用", retired: "已退役" };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[s] || map.inactive}`}>{s === "active" ? t("Active", ZHT.active) : s === "inactive" ? t("Inactive", ZHT.inactive) : t(s, ZHT[s] || s)}</span>;
};

export default function AdvancedProductsTab(props: Props) {
  const { products, rules, busy, createProduct, updateProduct, toggleProductStatus, deleteProduct, loadProducts, loadRules, canWrite, notifyError, t } = props;
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [productSubs, setProductSubs] = useState<Subscription[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

  useEffect(() => { loadRules(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Create state
  const [name, setName] = useState(""); const [desc, setDesc] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
  const [status, setStatus] = useState("active");
  const [tiers, setTiers] = useState<TierForm[]>([emptyTier()]);

  // Edit state
  const [eName, setEName] = useState(""); const [eDesc, setEDesc] = useState("");
  const [eSelectedTags, setESelectedTags] = useState<string[]>([]);
  const [eTagInput, setETagInput] = useState("");
  const [eDocUrl, setEDocUrl] = useState("");
  const [eSelectedRuleIds, setESelectedRuleIds] = useState<string[]>([]);
  const [eStatus, setEStatus] = useState("active");
  const [eTiers, setETiers] = useState<TierForm[]>([emptyTier()]);

  useEffect(() => {
    if (!expandedId) { setProductSubs([]); return; }
    setLoadingSubs(true);
    apiFetch(`/admin/v1/products/${expandedId}/subscriptions`).then(r => {
      if (r.ok) r.json().then(d => setProductSubs((d as { items?: Subscription[] }).items || []));
    }).catch(() => {}).finally(() => setLoadingSubs(false));
  }, [expandedId]);

  const addTag = (val: string, setter: (t: string[]) => void, current: string[]) => {
    const v = val.trim();
    if (v && !current.includes(v)) setter([...current, v]);
  };
  const removeTag = (tag: string, setter: (t: string[]) => void, current: string[]) => setter(current.filter(x => x !== tag));

  const startEdit = (p: ApiProduct) => {
    setEditId(p.id); setEName(p.name); setEDesc(p.description || "");
    setESelectedTags(Array.isArray(p.tags) ? p.tags : []);
    setEDocUrl(p.documentation_url || "");
    setESelectedRuleIds(Array.isArray(p.rule_ids) ? p.rule_ids : []);
    setEStatus(p.status || "active");
    setETiers(formFromTiers(parseTiers(p.pricing_tiers)));
  };

  const buildData = (nm: string, dc: string, st: string, du: string, tg: string[], ri: string[], tf: TierForm[]) => {
    const data: Record<string, unknown> = { name: nm.trim(), description: dc, status: st };
    if (du.trim()) data.documentation_url = du.trim();
    if (tg.length) data.tags = JSON.stringify(tg);
    if (ri.length) data.rule_ids = JSON.stringify(ri);
    data.pricing_tiers = JSON.stringify(tiersToPayload(tf));
    return data;
  };

  const saveEdit = useCallback(async () => {
    if (!editId) return;
    await updateProduct(editId, buildData(eName, eDesc, eStatus, eDocUrl, eSelectedTags, eSelectedRuleIds, eTiers));
    setEditId(null);
  }, [editId, eName, eDesc, eStatus, eDocUrl, eSelectedTags, eSelectedRuleIds, eTiers, updateProduct]);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) { notifyError("Product name is required"); return; }
    await createProduct(buildData(name, desc, status, docUrl, selectedTags, selectedRuleIds, tiers));
    setName(""); setDesc(""); setSelectedTags([]); setTagInput(""); setDocUrl(""); setSelectedRuleIds([]); setStatus("active");
    setTiers([emptyTier()]); setShowForm(false);
  }, [name, desc, status, docUrl, selectedTags, selectedRuleIds, tiers, createProduct, notifyError]);

  const handleSearch = useCallback((q: string) => {
    setSearch(q); loadProducts(q || undefined);
  }, [loadProducts]);

  const minPrice = (pt: PricingTier[]) => {
    if (!pt.length) return null;
    const prices = pt.map(t => t.price_monthly).filter(p => p > 0);
    return prices.length ? Math.min(...prices) : null;
  };
  const maxPrice = (pt: PricingTier[]) => {
    if (!pt.length) return null;
    const prices = pt.map(t => t.price_monthly).filter(p => p > 0);
    return prices.length ? Math.max(...prices) : null;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Sparkles className="w-5 h-5 text-blue-500" />{t("API Products", "API 产品")}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t("Bundle rules into products with pricing tiers for subscription-based access.", "将规则打包为带定价方案的产品，支持基于订阅的访问控制。")}</p>
        </div>
        <div className="flex gap-2">
          <div className="relative"><Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" /><input className={`${inputClass} pl-8 w-48`} placeholder={t("Search products…", "搜索产品…")} value={search} onChange={e => handleSearch(e.target.value)} /></div>
          {canWrite && <button className={btnPrimary} onClick={() => setShowForm(!showForm)} disabled={busy}><Plus className="w-4 h-4 mr-1" />{t("Create", "创建")}</button>}
        </div>
      </div>

      {canWrite && showForm && (
        <div className={`${cardClass} space-y-4 border-l-4 border-l-blue-500`}>
          <h3 className="font-bold flex items-center gap-2"><Package className="w-4 h-4 text-blue-500" />{t("Create Product", "创建产品")}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={labelClass}>{t("Product Name", "产品名称")} <span className="text-red-500">*</span></label><input className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder={t("e.g. Enterprise Plan", "例如：企业版套餐")} /></div>
            <div><label className={labelClass}>{t("Status", "状态")}</label><StatusMenu current={status} onChange={setStatus} t={t} /></div>
            <div><label className={labelClass}>{t("Documentation URL", "文档链接")}</label><div className="relative"><BookOpen className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" /><input className={`${inputClass} pl-8`} value={docUrl} onChange={e => setDocUrl(e.target.value)} placeholder="https://docs.example.com" /></div></div>
            <div><label className={labelClass}>{t("Associated Rules", "关联规则")}</label><RuleSelector rules={rules} selected={selectedRuleIds} onChange={setSelectedRuleIds} t={t} />{selectedRuleIds.length > 0 && <div className="mt-1.5 text-[10px] text-gray-400">{selectedRuleIds.length} {t("rules selected", "条规则已选")}</div>}</div>
            <div className="md:col-span-2"><label className={labelClass}>{t("Description", "描述")}</label><textarea className={inputClass} rows={2} value={desc} onChange={e => setDesc(e.target.value)} placeholder={t("Product description...", "产品描述...")} /></div>
            <div className="md:col-span-2"><label className={labelClass}>{t("Tags", "标签")}</label><div className="flex gap-2"><input className={inputClass} value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput, setSelectedTags, selectedTags); setTagInput(""); } }} placeholder={t("Type tag and press Enter", "输入标签按回车")} /><button type="button" onClick={() => { addTag(tagInput, setSelectedTags, selectedTags); setTagInput(""); }} className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-900/40 transition whitespace-nowrap"><Plus className="w-3 h-3" />{t("Add", "添加")}</button></div><TagChips tags={selectedTags} onRemove={(tg: string) => removeTag(tg, setSelectedTags, selectedTags)} /></div>
          </div>
          <PricingTierEditor tiers={tiers} onUpdate={setTiers} t={t} />
          <div className="flex gap-2"><button className={btnPrimary} onClick={handleCreate} disabled={busy}>{busy ? t("Creating…", "创建中…") : t("Save Product", "保存产品")}</button><button className={btnSecondary} onClick={() => setShowForm(false)}>{t("Cancel", "取消")}</button></div>
        </div>
      )}

      {editId && (
        <div className={`${cardClass} space-y-4 border-l-4 border-l-amber-500`}>
          <h3 className="font-bold flex items-center gap-2"><Edit3 className="w-4 h-4 text-amber-500" />{t("Edit Product", "编辑产品")}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={labelClass}>{t("Product Name", "产品名称")} <span className="text-red-500">*</span></label><input className={inputClass} value={eName} onChange={e => setEName(e.target.value)} placeholder={t("e.g. Enterprise Plan", "例如：企业版套餐")} /></div>
            <div><label className={labelClass}>{t("Status", "状态")}</label><StatusMenu current={eStatus} onChange={setEStatus} t={t} /></div>
            <div><label className={labelClass}>{t("Documentation URL", "文档链接")}</label><div className="relative"><BookOpen className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" /><input className={`${inputClass} pl-8`} value={eDocUrl} onChange={e => setEDocUrl(e.target.value)} placeholder="https://docs.example.com" /></div></div>
            <div><label className={labelClass}>{t("Associated Rules", "关联规则")}</label><RuleSelector rules={rules} selected={eSelectedRuleIds} onChange={setESelectedRuleIds} t={t} />{eSelectedRuleIds.length > 0 && <div className="mt-1.5 text-[10px] text-gray-400">{eSelectedRuleIds.length} {t("rules selected", "条规则已选")}</div>}</div>
            <div className="md:col-span-2"><label className={labelClass}>{t("Description", "描述")}</label><textarea className={inputClass} rows={2} value={eDesc} onChange={e => setEDesc(e.target.value)} placeholder={t("Product description...", "产品描述...")} /></div>
            <div className="md:col-span-2"><label className={labelClass}>{t("Tags", "标签")}</label><div className="flex gap-2"><input className={inputClass} value={eTagInput} onChange={e => setETagInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(eTagInput, setESelectedTags, eSelectedTags); setETagInput(""); } }} placeholder={t("Type tag and press Enter", "输入标签按回车")} /><button type="button" onClick={() => { addTag(eTagInput, setESelectedTags, eSelectedTags); setETagInput(""); }} className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-900/40 transition whitespace-nowrap"><Plus className="w-3 h-3" />{t("Add", "添加")}</button></div><TagChips tags={eSelectedTags} onRemove={(tg: string) => removeTag(tg, setESelectedTags, eSelectedTags)} /></div>
          </div>
          <PricingTierEditor tiers={eTiers} onUpdate={setETiers} t={t} />
          <div className="flex gap-2"><button className={btnPrimary} onClick={saveEdit} disabled={busy}><Check className="w-4 h-4 mr-1" />{t("Save Changes", "保存更改")}</button><button className={btnSecondary} onClick={() => setEditId(null)}><X className="w-4 h-4 mr-1" />{t("Cancel", "取消")}</button></div>
        </div>
      )}

      {products.length === 0 ? (
        <div className={`${cardClass} text-center py-10 text-gray-400`}><Package className="w-10 h-10 mx-auto mb-3 opacity-40" /><p className="text-sm">{t("No items found", "暂无数据")}</p></div>
      ) : (
        <div className="space-y-3">
          {products.map(p => {
            const pt = parseTiers(p.pricing_tiers);
            const ruleIdArr = Array.isArray(p.rule_ids) ? p.rule_ids : [];
            const tagsArr = Array.isArray(p.tags) ? p.tags : [];
            const isExpanded = expandedId === p.id;
            const minP = minPrice(pt); const maxP = maxPrice(pt);
            const hasFree = pt.some(t => t.price_monthly === 0);
            return (
              <div key={p.id} className={`${cardClass} p-0 overflow-hidden transition-shadow hover:shadow-md`}>
                <div className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                  <button className="shrink-0 text-gray-400">{isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{p.name}</span>
                      {statusBadge(p.status, t)}
                      {tagsArr.length > 0 && tagsArr.slice(0, 3).map(tg => <span key={tg} className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">{tg}</span>)}
                      {tagsArr.length > 3 && <span className="hidden sm:inline text-[10px] text-gray-400">+{tagsArr.length - 3}</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{p.description || t("No description", "暂无描述")}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500 shrink-0">
                    <span className="flex items-center gap-1"><DollarSign className="w-3 h-3 text-gray-400" />{pt.length > 0 ? (minP !== null && maxP !== null ? (minP === maxP ? `$${minP}/mo` : `$${minP}–${maxP}/mo`) : hasFree ? t("Has Free", "含免费") : t(`${pt.length} tiers`, `${pt.length} 个方案`)) : t("No pricing", "未定价")}</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3 text-gray-400" /><span className={p.active_subscription_count ? "text-emerald-600 font-medium" : ""}>{p.active_subscription_count || 0}</span><span className="text-gray-400">/ {p.subscription_count || 0}</span></span>
                    <span className="text-gray-400">{new Date(p.updated_at || p.created_at).toLocaleDateString()}</span>
                  </div>
                  {canWrite && (
                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <button className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition" onClick={() => startEdit(p)} title={t("Edit", "编辑")}><Edit3 className="w-3.5 h-3.5" /></button>
                      <button className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition" onClick={() => toggleProductStatus(p.id, p.status)} disabled={busy} title={p.status === "active" ? t("Deactivate", "停用") : t("Activate", "激活")}>{p.status === "active" ? <PowerOff className="w-3.5 h-3.5 text-amber-500" /> : <Power className="w-3.5 h-3.5 text-emerald-500" />}</button>
                      <button className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition" onClick={() => deleteProduct(p.id)} disabled={busy} title={t("Delete", "删除")}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>
                {isExpanded && <ProductDetailPanel product={p} subscriptions={productSubs} loadingSubs={loadingSubs} statusBadge={(s) => statusBadge(s, t)} t={t} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
