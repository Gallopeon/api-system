"use client";

import { useState, useCallback } from "react";
import { Plus, Edit3, Trash2, Check, X, Package, Search, Power, PowerOff, Tag } from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary, btnSecondary } from "@/lib/constants";
import type { ApiProduct } from "@/lib/types";

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

const statusBadge = (s: string, t: Props["t"]) => (
  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : s === "deprecated" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>
    {s === "active" ? t("Active", "激活") : s === "deprecated" ? t("Deprecated", "已弃用") : s === "retired" ? t("Retired", "已退役") : s}
  </span>
);

const th = (t: string) => <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t}</th>;
const td = (c: React.ReactNode, cls = "") => <td className={`px-3 py-3 ${cls}`}>{c}</td>;

export default function AdvancedProductsTab({ products, busy, createProduct, updateProduct, toggleProductStatus, deleteProduct, loadProducts, canWrite, notifyError, t }: Props) {
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Create form
  const [name, setName] = useState(""); const [desc, setDesc] = useState("");
  const [tags, setTags] = useState(""); const [docUrl, setDocUrl] = useState("");
  const [ruleIds, setRuleIds] = useState("");

  // Edit form
  const [eName, setEName] = useState(""); const [eDesc, setEDesc] = useState("");
  const [eTags, setETags] = useState(""); const [eDocUrl, setEDocUrl] = useState("");
  const [eRuleIds, setERuleIds] = useState("");

  const startEdit = (p: ApiProduct) => {
    setEditId(p.id); setEName(p.name); setEDesc(p.description || "");
    setETags(Array.isArray(p.tags) ? p.tags.join(", ") : "");
    setEDocUrl(p.documentation_url || "");
    setERuleIds(Array.isArray(p.rule_ids) ? p.rule_ids.join(", ") : "");
  };

  const saveEdit = useCallback(async () => {
    if (!editId) return;
    const data: Record<string, unknown> = { name: eName.trim(), description: eDesc };
    data.documentation_url = eDocUrl.trim();
    if (eTags.trim()) data.tags = eTags.split(",").map(s => s.trim()).filter(Boolean);
    if (eRuleIds.trim()) data.rule_ids = eRuleIds.split(",").map(s => s.trim()).filter(Boolean);
    await updateProduct(editId, data);
    setEditId(null);
  }, [editId, eName, eDesc, eTags, eDocUrl, eRuleIds, updateProduct]);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) { notifyError("Product name is required"); return; }
    const data: Record<string, unknown> = { name: name.trim(), description: desc };
    if (docUrl.trim()) data.documentation_url = docUrl.trim();
    if (tags.trim()) data.tags = tags.split(",").map(s => s.trim()).filter(Boolean);
    if (ruleIds.trim()) data.rule_ids = ruleIds.split(",").map(s => s.trim()).filter(Boolean);
    await createProduct(data);
    setName(""); setDesc(""); setTags(""); setDocUrl(""); setRuleIds(""); setShow(false);
  }, [name, desc, tags, docUrl, ruleIds, createProduct, notifyError]);

  const handleSearch = useCallback((q: string) => {
    setSearch(q);
    loadProducts(q || undefined);
  }, [loadProducts]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t("API Products", "API 产品")}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t("Bundle rules into products for subscription-based access.", "将规则打包为产品，支持基于订阅的访问控制。")}</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
            <input className={`${inputClass} pl-8 w-48`} placeholder={t("Search products…", "搜索产品…")} value={search} onChange={e => handleSearch(e.target.value)} />
          </div>
          {canWrite && <button className={btnPrimary} onClick={() => setShow(!show)} disabled={busy}><Plus className="w-4 h-4 mr-1" />{t("Create", "创建")}</button>}
        </div>
      </div>

      {canWrite && show && (
        <div className={`${cardClass} space-y-4`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={labelClass}>{t("Product Name", "产品名称")} <span className="text-red-500">*</span></label><input className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder={t("e.g. Enterprise Plan", "例如：企业版套餐")} /></div>
            <div><label className={labelClass}>{t("Documentation URL", "文档链接")}</label><input className={inputClass} value={docUrl} onChange={e => setDocUrl(e.target.value)} placeholder="https://docs.example.com" /></div>
            <div className="md:col-span-2"><label className={labelClass}>{t("Description", "描述")}</label><textarea className={inputClass} rows={2} value={desc} onChange={e => setDesc(e.target.value)} placeholder={t("Product description...", "产品描述...")} /></div>
            <div><label className={labelClass}>{t("Tags (comma-separated)", "标签（逗号分隔）")}</label><input className={inputClass} value={tags} onChange={e => setTags(e.target.value)} placeholder="rest, json, public" /></div>
            <div><label className={labelClass}>{t("Rule IDs (comma-separated)", "规则 ID（逗号分隔）")}</label><input className={inputClass} value={ruleIds} onChange={e => setRuleIds(e.target.value)} placeholder="uuid1, uuid2" /></div>
          </div>
          <div className="flex gap-2"><button className={btnPrimary} onClick={handleCreate} disabled={busy}>{busy ? t("Creating…", "创建中…") : t("Save Product", "保存产品")}</button><button className={btnSecondary} onClick={() => setShow(false)}>{t("Cancel", "取消")}</button></div>
        </div>
      )}

      {products.length === 0 ? (
        <div className={`${cardClass} text-center py-10 text-gray-400`}><Package className="w-10 h-10 mx-auto mb-3 opacity-40" /><p className="text-sm">{t("No items found", "暂无数据")}</p></div>
      ) : (
        <div className={`${cardClass} p-0 overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-800">
              <tr>{[t("Name", "名称"), t("Tags", "标签"), t("Rules", "规则"), t("Status", "状态"), t("Owner", "负责人"), t("Updated", "更新时间"), ...(canWrite ? [t("Actions", "操作")] : [])].map(h => th(h))}</tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-800">
              {products.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition">
                  {editId === p.id ? (
                    <>
                      {td(<input className={inputClass} value={eName} onChange={e => setEName(e.target.value)} />)}
                      {td(<input className={inputClass} value={eTags} onChange={e => setETags(e.target.value)} placeholder="tag1, tag2" />)}
                      {td(<input className={inputClass} value={eRuleIds} onChange={e => setERuleIds(e.target.value)} placeholder="uuid1, uuid2" />)}
                      {td(statusBadge(p.status, t))}
                      {td(<input className={inputClass} value={eDocUrl} onChange={e => setEDocUrl(e.target.value)} placeholder="docs url" />)}
                      {td(<span className="text-gray-500 text-xs">{new Date(p.updated_at || p.created_at).toLocaleDateString()}</span>)}
                      {td(<div className="flex gap-1"><button className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg" onClick={saveEdit}><Check className="w-3.5 h-3.5" /></button><button className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg" onClick={() => setEditId(null)}><X className="w-3.5 h-3.5" /></button></div>)}
                    </>
                  ) : (
                    <>
                      {td(<div><span className="font-medium text-gray-900 dark:text-gray-100">{p.name}</span><p className="text-xs text-gray-400 mt-0.5 truncate max-w-[180px]">{p.description || "—"}</p></div>)}
                      {td(<div className="flex flex-wrap gap-1">{Array.isArray(p.tags) && p.tags.length > 0 ? p.tags.slice(0, 3).map((tg: string) => <span key={tg} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"><Tag className="w-2.5 h-2.5" />{tg}</span>) : <span className="text-gray-400 text-xs">—</span>}</div>)}
                      {td(<span className="text-xs text-gray-500">{Array.isArray(p.rule_ids) ? p.rule_ids.length : 0} {t("rules", "条规则")}</span>)}
                      {td(statusBadge(p.status, t))}
                      {td(<span className="text-xs text-gray-500">{p.owner || "—"}</span>)}
                      {td(<span className="text-gray-500 text-xs">{new Date(p.updated_at || p.created_at).toLocaleDateString()}</span>)}
                      {canWrite && td(<div className="flex items-center gap-1">
                        <button className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition" onClick={() => startEdit(p)} title={t("Edit", "编辑")}><Edit3 className="w-3.5 h-3.5" /></button>
                        <button className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition" onClick={() => toggleProductStatus(p.id, p.status)} title={p.status === "active" ? t("Deactivate", "停用") : t("Activate", "激活")} disabled={busy}>
                          {p.status === "active" ? <PowerOff className="w-3.5 h-3.5 text-amber-500" /> : <Power className="w-3.5 h-3.5 text-emerald-500" />}
                        </button>
                        <button className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition" onClick={() => deleteProduct(p.id)} disabled={busy} title={t("Delete", "删除")}><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>)}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
