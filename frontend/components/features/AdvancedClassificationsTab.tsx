"use client";

import { useState, useCallback } from "react";
import { Plus, Edit3, Trash2, Check, X, ShieldAlert } from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary, btnSecondary } from "@/lib/constants";
import type { DataClassification } from "@/lib/types";

interface Props {
  classifications: DataClassification[];
  busy: boolean;
  createClassification: (data: Record<string, unknown>) => Promise<void>;
  updateClassification: (id: string, data: Record<string, unknown>) => Promise<void>;
  deleteClassification: (id: string) => Promise<void>;
  canWrite: boolean;
  notifyError: (m: string) => void;
  t: <T>(en: T, zh: T) => T;
}

const th = (t: string) => <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t}</th>;
const td = (c: React.ReactNode, cls = "") => <td className={`px-4 py-3 ${cls}`}>{c}</td>;

export default function AdvancedClassificationsTab({ classifications, busy, createClassification, updateClassification, deleteClassification, canWrite, notifyError, t }: Props) {
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [path, setPath] = useState(""); const [cat, setCat] = useState("internal"); const [pii, setPii] = useState(false);
  const [gdpr, setGdpr] = useState(false); const [ret, setRet] = useState("365"); const [note, setNote] = useState("");
  const [ePath, setEPath] = useState(""); const [eCat, setECat] = useState("internal"); const [ePii, setEPii] = useState(false);
  const [eGdpr, setEGdpr] = useState(false); const [eRet, setERet] = useState(""); const [eNote, setENote] = useState("");

  const startEdit = (c: DataClassification) => { setEditId(c.id); setEPath(c.api_path); setECat(c.data_category); setEPii(c.contains_pii); setEGdpr(c.gdpr_relevant); setERet(String(c.retention_days)); setENote(c.notes || ""); };
  const saveEdit = useCallback(async () => {
    if (!editId) return;
    await updateClassification(editId, { api_path: ePath.trim(), data_category: eCat, contains_pii: ePii, gdpr_relevant: eGdpr, retention_days: parseInt(eRet) || 365, notes: eNote });
    setEditId(null);
  }, [editId, ePath, eCat, ePii, eGdpr, eRet, eNote, updateClassification]);
  const handleCreate = useCallback(async () => {
    if (!path.trim()) { notifyError("API path is required"); return; }
    await createClassification({ api_path: path.trim(), data_category: cat, contains_pii: pii, gdpr_relevant: gdpr, retention_days: parseInt(ret) || 365, notes: note });
    setPath(""); setCat("internal"); setPii(false); setGdpr(false); setRet("365"); setNote(""); setShow(false);
  }, [path, cat, pii, gdpr, ret, note, createClassification, notifyError]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div><h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t("Data Classifications", "数据分类")}</h2><p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t("Classify API data categories, track PII and GDPR relevance per path.", "分类 API 数据，按路径追踪 PII 和 GDPR 相关性。")}</p></div>
        {canWrite && <button className={btnPrimary} onClick={() => setShow(!show)} disabled={busy}><Plus className="w-4 h-4 mr-1" />{t("Create", "创建")}</button>}
      </div>
      {canWrite && show && (
        <div className={`${cardClass} space-y-4`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className={labelClass}>{t("API Path", "API 路径")} <span className="text-red-500">*</span></label><input className={inputClass} value={path} onChange={e => setPath(e.target.value)} placeholder="/admin/v1/users" /></div>
            <div><label className={labelClass}>{t("Data Category", "数据类别")}</label><select className={inputClass} value={cat} onChange={e => setCat(e.target.value)}><option value="public">{t("Public", "公共")}</option><option value="internal">{t("Internal", "内部")}</option><option value="confidential">{t("Confidential", "机密")}</option><option value="pii">{t("PII", "个人信息")}</option></select></div>
            <div><label className={labelClass}>{t("Retention (days)", "保留天数")}</label><input className={inputClass} type="number" value={ret} onChange={e => setRet(e.target.value)} /></div>
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={pii} onChange={e => setPii(e.target.checked)} className="rounded" />{t("Contains PII", "包含 PII")}</label>
            <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={gdpr} onChange={e => setGdpr(e.target.checked)} className="rounded" />{t("GDPR Relevant", "GDPR 相关")}</label>
          </div>
          <div><label className={labelClass}>{t("Notes", "备注")}</label><textarea className={inputClass} rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder={t("Optional notes", "可选备注")} /></div>
          <div className="flex gap-2"><button className={btnPrimary} onClick={handleCreate} disabled={busy}>{busy ? t("Creating…", "创建中…") : t("Save Classification", "保存分类")}</button><button className={btnSecondary} onClick={() => setShow(false)}>{t("Cancel", "取消")}</button></div>
        </div>
      )}
      {classifications.length === 0 ? (
        <div className={`${cardClass} text-center py-10 text-gray-400`}><ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-40" /><p className="text-sm">{t("No items found", "暂无数据")}</p></div>
      ) : (
        <div className={`${cardClass} p-0 overflow-hidden`}>
          <table className="w-full text-sm"><thead className="bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-800"><tr>{[t("API Path", "API 路径"), t("Category", "类别"), t("PII", "PII"), t("GDPR", "GDPR"), t("Retention", "保留"), t("Notes", "备注"), ...(canWrite ? [t("Actions", "操作")] : [])].map(h => th(h))}</tr></thead>
          <tbody className="divide-y dark:divide-gray-800">
            {classifications.map(c => {
              const catStyle = c.data_category === "pii" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" : c.data_category === "confidential" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400" : c.data_category === "internal" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
              return (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition">
                  {editId === c.id ? (
                    <>{td(<input className={inputClass} value={ePath} onChange={e => setEPath(e.target.value)} />)}{td(<select className={inputClass} value={eCat} onChange={e => setECat(e.target.value)}><option value="public">{t("Public", "公共")}</option><option value="internal">{t("Internal", "内部")}</option><option value="confidential">{t("Confidential", "机密")}</option><option value="pii">{t("PII", "个人信息")}</option></select>)}{td(<input type="checkbox" checked={ePii} onChange={e => setEPii(e.target.checked)} />)}{td(<input type="checkbox" checked={eGdpr} onChange={e => setEGdpr(e.target.checked)} />)}{td(<input className={inputClass} type="number" value={eRet} onChange={e => setERet(e.target.value)} />)}{td(<input className={inputClass} value={eNote} onChange={e => setENote(e.target.value)} />)}{canWrite && td(<div className="flex gap-1"><button className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg" onClick={saveEdit}><Check className="w-3.5 h-3.5" /></button><button className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg" onClick={() => setEditId(null)}><X className="w-3.5 h-3.5" /></button></div>)}</>
                  ) : (
                    <>{td(<span className="font-mono text-xs text-gray-900 dark:text-gray-100">{c.api_path}</span>)}{td(<span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catStyle}`}>{c.data_category}</span>)}{td(<span className={c.contains_pii ? "text-red-600 dark:text-red-400 font-semibold" : "text-gray-400"}>{c.contains_pii ? t("Yes", "是") : t("No", "否")}</span>)}{td(<span className={c.gdpr_relevant ? "text-orange-600 dark:text-orange-400 font-semibold" : "text-gray-400"}>{c.gdpr_relevant ? t("Yes", "是") : t("No", "否")}</span>)}{td(<span className="text-gray-600 dark:text-gray-400">{c.retention_days}d</span>)}{td(<span className="text-gray-500 text-xs max-w-[120px] truncate block">{c.notes || "—"}</span>)}{canWrite && td(<div className="flex items-center gap-1"><button className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition" onClick={() => startEdit(c)}><Edit3 className="w-3.5 h-3.5" /></button><button className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition" onClick={() => deleteClassification(c.id)} disabled={busy}><Trash2 className="w-3.5 h-3.5" /></button></div>)}</>
                  )}
                </tr>
              );
            })}
          </tbody></table>
        </div>
      )}
    </div>
  );
}
