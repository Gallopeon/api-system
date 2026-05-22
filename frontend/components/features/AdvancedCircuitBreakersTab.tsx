"use client";

import { useState, useCallback } from "react";
import { Plus, Edit3, Trash2, Check, X, AlertTriangle } from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary, btnSecondary } from "@/lib/constants";
import type { CircuitBreaker } from "@/lib/types";

interface Props {
  cbs: CircuitBreaker[];
  busy: boolean;
  createCB: (data: Record<string, unknown>) => Promise<void>;
  updateCB: (id: string, data: Record<string, unknown>) => Promise<void>;
  deleteCB: (id: string) => Promise<void>;
  canWrite: boolean;
  notifyError: (m: string) => void;
  t: <T>(en: T, zh: T) => T;
}

const statusBadge = (s: string, t: Props["t"]) => (
  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>
    {s === "active" ? t("active", "激活") : s}
  </span>
);

const th = (t: string) => <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t}</th>;
const td = (c: React.ReactNode, cls = "", label?: string) => <td className={`px-4 py-3 ${cls}`} data-label={label}>{c}</td>;

export default function AdvancedCircuitBreakersTab({ cbs, busy, createCB, updateCB, deleteCB, canWrite, notifyError, t }: Props) {
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [path, setPath] = useState(""); const [fail, setFail] = useState("5"); const [rec, setRec] = useState("30");
  const [half, setHalf] = useState("3"); const [retry, setRetry] = useState("3"); const [delay, setDelay] = useState("100"); const [to, setTo] = useState("5000");
  const [ePath, setEPath] = useState(""); const [eFail, setEFail] = useState(""); const [eRec, setERec] = useState("");
  const [eHalf, setEHalf] = useState(""); const [eRetry, setERetry] = useState(""); const [eDelay, setEDelay] = useState(""); const [eTo, setETo] = useState("");

  const startEdit = (c: CircuitBreaker) => {
    setEditId(c.id); setEPath(c.api_path); setEFail(String(c.failure_threshold)); setERec(String(c.recovery_timeout_sec));
    setEHalf(String(c.half_open_max)); setERetry(String(c.retry_count)); setEDelay(String(c.retry_delay_ms)); setETo(String(c.timeout_ms));
  };

  const saveEdit = useCallback(async () => {
    if (!editId) return;
    await updateCB(editId, { api_path: ePath.trim(), failure_threshold: parseInt(eFail) || 5, recovery_timeout_sec: parseInt(eRec) || 30, half_open_max: parseInt(eHalf) || 3, retry_count: parseInt(eRetry) || 3, retry_delay_ms: parseInt(eDelay) || 100, timeout_ms: parseInt(eTo) || 5000 });
    setEditId(null);
  }, [editId, ePath, eFail, eRec, eHalf, eRetry, eDelay, eTo, updateCB]);

  const handleCreate = useCallback(async () => {
    if (!path.trim()) { notifyError("API path is required"); return; }
    await createCB({ api_path: path.trim(), failure_threshold: parseInt(fail) || 5, recovery_timeout_sec: parseInt(rec) || 30, half_open_max: parseInt(half) || 3, retry_count: parseInt(retry) || 3, retry_delay_ms: parseInt(delay) || 100, timeout_ms: parseInt(to) || 5000 });
    setPath(""); setFail("5"); setRec("30"); setHalf("3"); setRetry("3"); setDelay("100"); setTo("5000"); setShow(false);
  }, [path, fail, rec, half, retry, delay, to, createCB, notifyError]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div><h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t("Circuit Breakers", "熔断器")}</h2><p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t("Configure failure thresholds, recovery timeouts, and retry policies per API path.", "按 API 路径配置故障阈值、恢复超时和重试策略。")}</p></div>
        {canWrite && <button className={btnPrimary} onClick={() => setShow(!show)} disabled={busy}><Plus className="w-4 h-4 mr-1" />{t("Create", "创建")}</button>}
      </div>
      {canWrite && show && (
        <div className={`${cardClass} space-y-4`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div><label className={labelClass}>{t("API Path", "API 路径")} <span className="text-red-500">*</span></label><input className={inputClass} value={path} onChange={e => setPath(e.target.value)} placeholder="/admin/v1/users" /></div>
            <div><label className={labelClass}>{t("Failure Threshold", "故障阈值")}</label><input className={inputClass} type="number" value={fail} onChange={e => setFail(e.target.value)} /></div>
            <div><label className={labelClass}>{t("Recovery Timeout (sec)", "恢复超时（秒）")}</label><input className={inputClass} type="number" value={rec} onChange={e => setRec(e.target.value)} /></div>
            <div><label className={labelClass}>{t("Half-Open Max", "半开最大数")}</label><input className={inputClass} type="number" value={half} onChange={e => setHalf(e.target.value)} /></div>
            <div><label className={labelClass}>{t("Retry Count", "重试次数")}</label><input className={inputClass} type="number" value={retry} onChange={e => setRetry(e.target.value)} /></div>
            <div><label className={labelClass}>{t("Retry Delay (ms)", "重试间隔（毫秒）")}</label><input className={inputClass} type="number" value={delay} onChange={e => setDelay(e.target.value)} /></div>
            <div><label className={labelClass}>{t("Timeout (ms)", "超时（毫秒）")}</label><input className={inputClass} type="number" value={to} onChange={e => setTo(e.target.value)} /></div>
          </div>
          <div className="flex gap-2"><button className={btnPrimary} onClick={handleCreate} disabled={busy}>{busy ? t("Creating…", "创建中…") : t("Save Circuit Breaker", "保存熔断器")}</button><button className={btnSecondary} onClick={() => setShow(false)}>{t("Cancel", "取消")}</button></div>
        </div>
      )}
      {cbs.length === 0 ? (
        <div className={`${cardClass} text-center py-10 text-gray-400`}><AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-40" /><p className="text-sm">{t("No items found", "暂无数据")}</p></div>
      ) : (
        <div className={`${cardClass} p-0 overflow-hidden`}>
          <div className="overflow-x-auto"><table className="w-full text-sm resp-table"><thead className="bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-800"><tr>{[t("API Path", "API 路径"), t("Fail Thr.", "故障阈值"), t("Recovery", "恢复"), t("Retries", "重试"), t("Timeout", "超时"), t("Status", "状态"), ...(canWrite ? [t("Actions", "操作")] : [])].map(h => th(h))}</tr></thead>
          <tbody className="divide-y dark:divide-gray-800">
            {cbs.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition">
                {editId === c.id ? (
                  <>{td(<input className={inputClass} value={ePath} onChange={e => setEPath(e.target.value)} />, "", t("API Path", "API 路径"))}{td(<input className={inputClass} type="number" value={eFail} onChange={e => setEFail(e.target.value)} />, "", t("Fail Thr.", "故障阈值"))}{td(<input className={inputClass} type="number" value={eRec} onChange={e => setERec(e.target.value)} />, "", t("Recovery", "恢复"))}{td(<input className={inputClass} type="number" value={eRetry} onChange={e => setERetry(e.target.value)} />, "", t("Retries", "重试"))}{td(<input className={inputClass} type="number" value={eTo} onChange={e => setETo(e.target.value)} />, "", t("Timeout", "超时"))}{td(statusBadge(c.status, t), "", t("Status", "状态"))}{td(<div className="flex gap-1"><button className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg" onClick={saveEdit}><Check className="w-3.5 h-3.5" /></button><button className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg" onClick={() => setEditId(null)}><X className="w-3.5 h-3.5" /></button></div>, "", t("Actions", "操作"))}</>
                ) : (
                  <>{td(<span className="font-mono text-xs text-gray-900 dark:text-gray-100">{c.api_path}</span>, "", t("API Path", "API 路径"))}{td(<span className="font-semibold">{c.failure_threshold}</span>, "", t("Fail Thr.", "故障阈值"))}{td(<span className="text-gray-600 dark:text-gray-400">{c.recovery_timeout_sec}s</span>, "", t("Recovery", "恢复"))}{td(<span className="text-gray-600 dark:text-gray-400">{c.retry_count} × {c.retry_delay_ms}ms</span>, "", t("Retries", "重试"))}{td(<span className="text-gray-600 dark:text-gray-400">{c.timeout_ms}ms</span>, "", t("Timeout", "超时"))}{td(statusBadge(c.status, t), "", t("Status", "状态"))}{canWrite && td(<div className="flex items-center gap-1"><button className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition" onClick={() => startEdit(c)}><Edit3 className="w-3.5 h-3.5" /></button><button className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition" onClick={() => deleteCB(c.id)} disabled={busy}><Trash2 className="w-3.5 h-3.5" /></button></div>, "", t("Actions", "操作"))}</>
                )}
              </tr>
            ))}
          </tbody>
        </table></div>
        </div>
      )}
    </div>
  );
}
