"use client";

import { useState, useCallback } from "react";
import { Plus, Edit3, Trash2, Check, X, Package } from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary, btnSecondary } from "@/lib/constants";
import type { ApiProduct } from "@/lib/types";

interface Props {
  products: ApiProduct[];
  busy: boolean;
  createProduct: (name: string, description: string, rule_ids?: string[]) => Promise<void>;
  updateProduct: (id: string, data: Record<string, unknown>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  notifyError: (m: string) => void;
  t: <T>(en: T, zh: T) => T;
}

const statusBadge = (s: string, t: Props["t"]) => (
  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>
    {s === "active" ? t("active", "激活") : s}
  </span>
);
const th = (t: string) => <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t}</th>;
const td = (c: React.ReactNode, cls = "") => <td className={`px-4 py-3 ${cls}`}>{c}</td>;

export default function AdvancedProductsTab({ products, busy, createProduct, updateProduct, deleteProduct, notifyError, t }: Props) {
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState(""); const [desc, setDesc] = useState("");
  const [eName, setEName] = useState(""); const [eDesc, setEDesc] = useState("");

  const startEdit = (p: ApiProduct) => { setEditId(p.id); setEName(p.name); setEDesc(p.description || ""); };
  const saveEdit = useCallback(async () => {
    if (!editId) return;
    await updateProduct(editId, { name: eName.trim(), description: eDesc });
    setEditId(null);
  }, [editId, eName, eDesc, updateProduct]);
  const handleCreate = useCallback(async () => {
    if (!name.trim()) { notifyError("Product name is required"); return; }
    await createProduct(name.trim(), desc);
    setName(""); setDesc(""); setShow(false);
  }, [name, desc, createProduct, notifyError]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div><h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t("API Products", "API 产品")}</h2><p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t("Bundle rules into products for subscription-based access.", "将规则打包为产品，支持基于订阅的访问控制。")}</p></div>
        <button className={btnPrimary} onClick={() => setShow(!show)} disabled={busy}><Plus className="w-4 h-4 mr-1" />{t("Create", "创建")}</button>
      </div>
      {show && (
        <div className={`${cardClass} space-y-4`}>
          <div><label className={labelClass}>{t("Product Name", "产品名称")} <span className="text-red-500">*</span></label><input className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder={t("e.g. Enterprise Plan", "例如：企业版套餐")} /></div>
          <div><label className={labelClass}>{t("Description", "描述")}</label><textarea className={inputClass} rows={3} value={desc} onChange={e => setDesc(e.target.value)} placeholder={t("Product description...", "产品描述...")} /></div>
          <div className="flex gap-2"><button className={btnPrimary} onClick={handleCreate} disabled={busy}>{busy ? t("Creating…", "创建中…") : t("Save Product", "保存产品")}</button><button className={btnSecondary} onClick={() => setShow(false)}>{t("Cancel", "取消")}</button></div>
        </div>
      )}
      {products.length === 0 ? (
        <div className={`${cardClass} text-center py-10 text-gray-400`}><Package className="w-10 h-10 mx-auto mb-3 opacity-40" /><p className="text-sm">{t("No items found", "暂无数据")}</p></div>
      ) : (
        <div className={`${cardClass} p-0 overflow-hidden`}>
          <table className="w-full text-sm"><thead className="bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-800"><tr>{[t("Name", "名称"), t("Description", "描述"), t("Status", "状态"), t("Actions", "操作")].map(h => th(h))}</tr></thead>
          <tbody className="divide-y dark:divide-gray-800">
            {products.map(p => (
              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition">
                {editId === p.id ? (
                  <>{td(<input className={inputClass} value={eName} onChange={e => setEName(e.target.value)} />)}{td(<textarea className={inputClass} rows={2} value={eDesc} onChange={e => setEDesc(e.target.value)} />)}{td(statusBadge(p.status, t))}{td(<div className="flex gap-1"><button className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg" onClick={saveEdit}><Check className="w-3.5 h-3.5" /></button><button className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg" onClick={() => setEditId(null)}><X className="w-3.5 h-3.5" /></button></div>)}</>
                ) : (
                  <>{td(<span className="font-medium text-gray-900 dark:text-gray-100">{p.name}</span>)}{td(<span className="text-xs text-gray-500 truncate max-w-[200px] block">{p.description || "—"}</span>)}{td(statusBadge(p.status, t))}{td(<div className="flex items-center gap-1"><button className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition" onClick={() => startEdit(p)}><Edit3 className="w-3.5 h-3.5" /></button><button className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition" onClick={() => deleteProduct(p.id)} disabled={busy}><Trash2 className="w-3.5 h-3.5" /></button></div>)}</>
                )}
              </tr>
            ))}
          </tbody></table>
        </div>
      )}
    </div>
  );
}
