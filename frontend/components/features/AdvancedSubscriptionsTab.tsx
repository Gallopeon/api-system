"use client";

import { useState, useCallback } from "react";
import { Plus, Edit3, Trash2, Check, X, RefreshCw } from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary, btnSecondary } from "@/lib/constants";
import type { Subscription } from "@/lib/types";

interface Props {
  subscriptions: Subscription[];
  busy: boolean;
  createSubscription: (keyId: string, prodId: string, plan: string) => Promise<void>;
  updateSubscription: (id: string, data: Record<string, unknown>) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
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

export default function AdvancedSubscriptionsTab({ subscriptions, busy, createSubscription, updateSubscription, deleteSubscription, notifyError, t }: Props) {
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [keyId, setKeyId] = useState(""); const [prodId, setProdId] = useState(""); const [plan, setPlan] = useState("free");
  const [eKey, setEKey] = useState(""); const [eProd, setEProd] = useState(""); const [ePlan, setEPlan] = useState("free");

  const startEdit = (s: Subscription) => { setEditId(s.id); setEKey(s.api_key_id); setEProd(s.product_id); setEPlan(s.plan); };

  const saveEdit = useCallback(async () => {
    if (!editId) return;
    await updateSubscription(editId, { api_key_id: eKey.trim(), product_id: eProd.trim(), plan: ePlan });
    setEditId(null);
  }, [editId, eKey, eProd, ePlan, updateSubscription]);

  const handleCreate = useCallback(async () => {
    if (!keyId.trim() || !prodId.trim()) { notifyError("API Key ID and Product ID are required"); return; }
    await createSubscription(keyId.trim(), prodId.trim(), plan);
    setKeyId(""); setProdId(""); setPlan("free"); setShow(false);
  }, [keyId, prodId, plan, createSubscription, notifyError]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div><h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t("Subscriptions", "订阅管理")}</h2><p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t("Manage API product subscriptions with tiered plans.", "管理 API 产品订阅，支持分层套餐。")}</p></div>
        <button className={btnPrimary} onClick={() => setShow(!show)} disabled={busy}><Plus className="w-4 h-4 mr-1" />{t("Create", "创建")}</button>
      </div>
      {show && (
        <div className={`${cardClass} space-y-4`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className={labelClass}>{t("API Key ID", "API Key ID")} <span className="text-red-500">*</span></label><input className={inputClass} value={keyId} onChange={e => setKeyId(e.target.value)} placeholder="key-abc123" /></div>
            <div><label className={labelClass}>{t("Product ID", "产品 ID")} <span className="text-red-500">*</span></label><input className={inputClass} value={prodId} onChange={e => setProdId(e.target.value)} placeholder="prod-xyz" /></div>
            <div><label className={labelClass}>{t("Plan", "套餐")}</label><select className={inputClass} value={plan} onChange={e => setPlan(e.target.value)}><option value="free">{t("Free", "免费")}</option><option value="pro">{t("Pro", "专业")}</option><option value="enterprise">{t("Enterprise", "企业")}</option></select></div>
          </div>
          <div className="flex gap-2"><button className={btnPrimary} onClick={handleCreate} disabled={busy}>{busy ? t("Creating…", "创建中…") : t("Save Subscription", "保存订阅")}</button><button className={btnSecondary} onClick={() => setShow(false)}>{t("Cancel", "取消")}</button></div>
        </div>
      )}
      {subscriptions.length === 0 ? (
        <div className={`${cardClass} text-center py-10 text-gray-400`}><RefreshCw className="w-10 h-10 mx-auto mb-3 opacity-40" /><p className="text-sm">{t("No items found", "暂无数据")}</p></div>
      ) : (
        <div className={`${cardClass} p-0 overflow-hidden`}>
          <table className="w-full text-sm"><thead className="bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-800"><tr>{[t("API Key ID", "API Key ID"), t("Product ID", "产品 ID"), t("Plan", "套餐"), t("Status", "状态"), t("Created", "创建时间"), t("Actions", "操作")].map(h => th(h))}</tr></thead>
            <tbody className="divide-y dark:divide-gray-800">
              {subscriptions.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition">
                  {editId === s.id ? (
                    <>{td(<input className={inputClass} value={eKey} onChange={e => setEKey(e.target.value)} />)}{td(<input className={inputClass} value={eProd} onChange={e => setEProd(e.target.value)} />)}{td(<select className={inputClass} value={ePlan} onChange={e => setEPlan(e.target.value)}><option value="free">{t("Free", "免费")}</option><option value="pro">{t("Pro", "专业")}</option><option value="enterprise">{t("Enterprise", "企业")}</option></select>)}{td(statusBadge(s.status, t))}{td(<span className="text-gray-500 text-xs">{new Date(s.created_at).toLocaleDateString()}</span>)}{td(<div className="flex gap-1"><button className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg" onClick={saveEdit}><Check className="w-3.5 h-3.5" /></button><button className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg" onClick={() => setEditId(null)}><X className="w-3.5 h-3.5" /></button></div>)}</>
                  ) : (
                    <>{td(<span className="font-mono text-xs text-gray-600 dark:text-gray-400">{s.api_key_id}</span>)}{td(<span className="font-mono text-xs text-gray-600 dark:text-gray-400">{s.product_id}</span>)}{td(<span className="capitalize font-medium">{s.plan}</span>)}{td(statusBadge(s.status, t))}{td(<span className="text-gray-500 text-xs">{new Date(s.created_at).toLocaleDateString()}</span>)}{td(<div className="flex items-center gap-1"><button className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition" onClick={() => startEdit(s)}><Edit3 className="w-3.5 h-3.5" /></button><button className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition" onClick={() => deleteSubscription(s.id)} disabled={busy}><Trash2 className="w-3.5 h-3.5" /></button></div>)}</>
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
