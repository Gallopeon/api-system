"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Plus, Edit3, Trash2, Check, X, Package, Search, Power, PowerOff,
  ChevronDown, ChevronRight, DollarSign, Tag as TagIcon,
} from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary, btnSecondary } from "@/lib/constants";
import type { ApiProduct, PricingTier, Subscription } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import PricingTierEditor, { emptyTier, type TierForm } from "./PricingTierEditor";
import ProductDetailPanel from "./ProductDetailPanel";

interface Props {
  products: ApiProduct[];
  busy: boolean;
  createProduct: (data: Record<string, unknown>) => Promise<void>;
  updateProduct: (id: string, data: Record<string, unknown>) => Promise<void>;
  toggleProductStatus: (id: string, currentStatus: string) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  loadProducts: (search?: string) => Promise<void>;
  canWrite: boolean;
  notifyError: (m: string) => void;
  t: <T>(en: T, zh: T) => T;
}

const STATUS_OPTIONS = ["active", "inactive", "deprecated", "retired"] as const;

const ZHT: Record<string, string> = { active: "激活", inactive: "未激活", deprecated: "已弃用", retired: "已退役" };

const statusBadge = (s: string, t: Props["t"]) => {
  const map: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    inactive: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    deprecated: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    retired: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  };
  const label = ZHT[s] || s;
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[s] || map.inactive}`}>{s === "active" ? t("Active", label) : s === "inactive" ? t("Inactive", label) : t(s, label)}</span>;
};

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

export default function AdvancedProductsTab(props: Props) {
  const { products, busy, createProduct, updateProduct, toggleProductStatus, deleteProduct, loadProducts, canWrite, notifyError, t } = props;
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [productSubs, setProductSubs] = useState<Subscription[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

  // Create state
  const [name, setName] = useState(""); const [desc, setDesc] = useState("");
  const [tags, setTags] = useState(""); const [docUrl, setDocUrl] = useState("");
  const [ruleIds, setRuleIds] = useState(""); const [status, setStatus] = useState("active");
  const [tiers, setTiers] = useState<TierForm[]>([emptyTier()]);

  // Edit state
  const [eName, setEName] = useState(""); const [eDesc, setEDesc] = useState("");
  const [eTags, setETags] = useState(""); const [eDocUrl, setEDocUrl] = useState("");
  const [eRuleIds, setERuleIds] = useState(""); const [eStatus, setEStatus] = useState("active");
  const [eTiers, setETiers] = useState<TierForm[]>([emptyTier()]);

  useEffect(() => {
    if (!expandedId) { setProductSubs([]); return; }
    setLoadingSubs(true);
    apiFetch(`/admin/v1/products/${expandedId}/subscriptions`).then(r => {
      if (r.ok) r.json().then(d => setProductSubs((d as { items?: Subscription[] }).items || []));
    }).catch(() => {}).finally(() => setLoadingSubs(false));
  }, [expandedId]);

  const startEdit = (p: ApiProduct) => {
    setEditId(p.id); setEName(p.name); setEDesc(p.description || "");
    setETags(Array.isArray(p.tags) ? p.tags.join(", ") : "");
    setEDocUrl(p.documentation_url || "");
    setERuleIds(Array.isArray(p.rule_ids) ? p.rule_ids.join(", ") : "");
    setEStatus(p.status || "active");
    setETiers(formFromTiers(parseTiers(p.pricing_tiers)));
  };

  const buildData = (nm: string, dc: string, st: string, du: string, tg: string, ri: string, tf: TierForm[]) => {
    const data: Record<string, unknown> = { name: nm.trim(), description: dc, status: st };
    if (du.trim()) data.documentation_url = du.trim();
    if (tg.trim()) data.tags = JSON.stringify(tg.split(",").map(s => s.trim()).filter(Boolean));
    if (ri.trim()) data.rule_ids = JSON.stringify(ri.split(",").map(s => s.trim()).filter(Boolean));
    data.pricing_tiers = JSON.stringify(tiersToPayload(tf));
    return data;
  };

  const saveEdit = useCallback(async () => {
    if (!editId) return;
    await updateProduct(editId, buildData(eName, eDesc, eStatus, eDocUrl, eTags, eRuleIds, eTiers));
    setEditId(null);
  }, [editId, eName, eDesc, eStatus, eDocUrl, eTags, eRuleIds, eTiers, updateProduct]);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) { notifyError("Product name is required"); return; }
    await createProduct(buildData(name, desc, status, docUrl, tags, ruleIds, tiers));
    setName(""); setDesc(""); setTags(""); setDocUrl(""); setRuleIds(""); setStatus("active");
    setTiers([emptyTier()]); setShowForm(false);
  }, [name, desc, status, docUrl, tags, ruleIds, tiers, createProduct, notifyError]);

  const handleSearch = useCallback((q: string) => {
    setSearch(q); loadProducts(q || undefined);
  }, [loadProducts]);

  const FormFields = ({ nm, setNm, dc, setDc, st, setSt, du, setDu, tg, setTg, ri, setRi }: Record<string, any>) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div><label className={labelClass}>{t("Product Name", "产品名称")} <span className="text-red-500">*</span></label><input className={inputClass} value={nm} onChange={e => setNm(e.target.value)} placeholder={t("e.g. Enterprise Plan", "例如：企业版套餐")} /></div>
      <div><label className={labelClass}>{t("Status", "状态")}</label><select className={inputClass} value={st} onChange={e => setSt(e.target.value)}>{STATUS_OPTIONS.map(s => <option key={s} value={s}>{ZHT[s] || s}</option>)}</select></div>
      <div><label className={labelClass}>{t("Documentation URL", "文档链接")}</label><input className={inputClass} value={du} onChange={e => setDu(e.target.value)} placeholder="https://docs.example.com" /></div>
      <div><label className={labelClass}>{t("Rule IDs", "规则 ID")}</label><input className={inputClass} value={ri} onChange={e => setRi(e.target.value)} placeholder="uuid1, uuid2" /></div>
      <div className="md:col-span-2"><label className={labelClass}>{t("Description", "描述")}</label><textarea className={inputClass} rows={2} value={dc} onChange={e => setDc(e.target.value)} placeholder={t("Product description...", "产品描述...")} /></div>
      <div className="md:col-span-2"><label className={labelClass}>{t("Tags (comma-separated)", "标签（逗号分隔）")}</label><input className={inputClass} value={tg} onChange={e => setTg(e.target.value)} placeholder="rest, json, public" /></div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t("API Products", "API 产品")}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t("Bundle rules into products with pricing tiers for subscription-based access.", "将规则打包为带定价方案的产品，支持基于订阅的访问控制。")}</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
            <input className={`${inputClass} pl-8 w-48`} placeholder={t("Search products…", "搜索产品…")} value={search} onChange={e => handleSearch(e.target.value)} />
          </div>
          {canWrite && <button className={btnPrimary} onClick={() => setShowForm(!showForm)} disabled={busy}><Plus className="w-4 h-4 mr-1" />{t("Create", "创建")}</button>}
        </div>
      </div>

      {/* Create Form */}
      {canWrite && showForm && (
        <div className={`${cardClass} space-y-4 border-l-4 border-l-blue-500`}>
          <h3 className="font-bold flex items-center gap-2"><Package className="w-4 h-4 text-blue-500" />{t("Create Product", "创建产品")}</h3>
          <FormFields nm={name} setNm={setName} dc={desc} setDc={setDesc} st={status} setSt={setStatus} du={docUrl} setDu={setDocUrl} tg={tags} setTg={setTags} ri={ruleIds} setRi={setRuleIds} />
          <PricingTierEditor tiers={tiers} onUpdate={setTiers} t={t} />
          <div className="flex gap-2"><button className={btnPrimary} onClick={handleCreate} disabled={busy}>{busy ? t("Creating…", "创建中…") : t("Save Product", "保存产品")}</button><button className={btnSecondary} onClick={() => setShowForm(false)}>{t("Cancel", "取消")}</button></div>
        </div>
      )}

      {/* Edit Form */}
      {editId && (
        <div className={`${cardClass} space-y-4 border-l-4 border-l-amber-500`}>
          <h3 className="font-bold flex items-center gap-2"><Edit3 className="w-4 h-4 text-amber-500" />{t("Edit Product", "编辑产品")}</h3>
          <FormFields nm={eName} setNm={setEName} dc={eDesc} setDc={setEDesc} st={eStatus} setSt={setEStatus} du={eDocUrl} setDu={setEDocUrl} tg={eTags} setTg={setETags} ri={eRuleIds} setRi={setERuleIds} />
          <PricingTierEditor tiers={eTiers} onUpdate={setETiers} t={t} />
          <div className="flex gap-2"><button className={btnPrimary} onClick={saveEdit} disabled={busy}><Check className="w-4 h-4 mr-1" />{t("Save Changes", "保存更改")}</button><button className={btnSecondary} onClick={() => setEditId(null)}><X className="w-4 h-4 mr-1" />{t("Cancel", "取消")}</button></div>
        </div>
      )}

      {/* Product list */}
      {products.length === 0 ? (
        <div className={`${cardClass} text-center py-10 text-gray-400`}><Package className="w-10 h-10 mx-auto mb-3 opacity-40" /><p className="text-sm">{t("No items found", "暂无数据")}</p></div>
      ) : (
        <div className="space-y-3">
          {products.map(p => {
            const pt = parseTiers(p.pricing_tiers);
            const ruleIdArr = Array.isArray(p.rule_ids) ? p.rule_ids : [];
            const isExpanded = expandedId === p.id;

            return (
              <div key={p.id} className={`${cardClass} p-0 overflow-hidden`}>
                <div className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                  <button className="shrink-0 text-gray-400">{isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{p.name}</span>
                      {statusBadge(p.status, t)}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{p.description || t("No description", "暂无描述")}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500 shrink-0">
                    {pt.length > 0 && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3 text-gray-400" />{pt.length} {t("tiers", "个方案")}</span>}
                    <span className="flex items-center gap-1"><TagIcon className="w-3 h-3 text-gray-400" />{ruleIdArr.length} {t("APIs", "个API")}</span>
                    <span className="text-gray-400">{new Date(p.updated_at || p.created_at).toLocaleDateString()}</span>
                  </div>
                  {canWrite && (
                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <button className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition" onClick={() => startEdit(p)} title={t("Edit", "编辑")}><Edit3 className="w-3.5 h-3.5" /></button>
                      <button className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition" onClick={() => toggleProductStatus(p.id, p.status)} disabled={busy} title={p.status === "active" ? t("Deactivate", "停用") : t("Activate", "激活")}>
                        {p.status === "active" ? <PowerOff className="w-3.5 h-3.5 text-amber-500" /> : <Power className="w-3.5 h-3.5 text-emerald-500" />}
                      </button>
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
