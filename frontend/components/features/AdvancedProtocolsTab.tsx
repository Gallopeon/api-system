"use client";

import { useState, useCallback } from "react";
import { Plus, Edit3, Trash2, Check, X, Code2 } from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary, btnSecondary } from "@/lib/constants";
import type { ProtocolConfig } from "@/lib/types";

interface Props {
  protocols: ProtocolConfig[];
  busy: boolean;
  createProtocol: (data: Record<string, unknown>) => Promise<void>;
  updateProtocol: (id: string, data: Record<string, unknown>) => Promise<void>;
  deleteProtocol: (id: string) => Promise<void>;
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

export default function AdvancedProtocolsTab({ protocols, busy, createProtocol, updateProtocol, deleteProtocol, notifyError, t }: Props) {
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [path, setPath] = useState(""); const [proto, setProto] = useState("graphql"); const [json, setJson] = useState("{}");
  const [ePath, setEPath] = useState(""); const [eProto, setEProto] = useState("graphql"); const [eJson, setEJson] = useState("{}");

  const startEdit = (p: ProtocolConfig) => { setEditId(p.id); setEPath(p.api_path); setEProto(p.protocol); setEJson(p.config_json || "{}"); };
  const saveEdit = useCallback(async () => {
    if (!editId) return;
    await updateProtocol(editId, { api_path: ePath.trim(), protocol: eProto, config_json: eJson });
    setEditId(null);
  }, [editId, ePath, eProto, eJson, updateProtocol]);
  const handleCreate = useCallback(async () => {
    if (!path.trim()) { notifyError("API path is required"); return; }
    await createProtocol({ api_path: path.trim(), protocol: proto, config_json: json });
    setPath(""); setProto("graphql"); setJson("{}"); setShow(false);
  }, [path, proto, json, createProtocol, notifyError]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div><h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t("Protocols", "协议扩展")}</h2><p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t("Support GraphQL, gRPC-Web, SSE, and WebSocket protocols per API path.", "按 API 路径支持 GraphQL、gRPC-Web、SSE 和 WebSocket 协议。")}</p></div>
        <button className={btnPrimary} onClick={() => setShow(!show)} disabled={busy}><Plus className="w-4 h-4 mr-1" />{t("Create", "创建")}</button>
      </div>
      {show && (
        <div className={`${cardClass} space-y-4`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={labelClass}>{t("API Path", "API 路径")} <span className="text-red-500">*</span></label><input className={inputClass} value={path} onChange={e => setPath(e.target.value)} placeholder="/admin/v1/graphql" /></div>
            <div><label className={labelClass}>{t("Protocol", "协议")}</label><select className={inputClass} value={proto} onChange={e => setProto(e.target.value)}><option value="graphql">GraphQL</option><option value="grpc">gRPC</option><option value="sse">SSE</option><option value="ws">WebSocket</option><option value="rest">REST</option></select></div>
          </div>
          <div><label className={labelClass}>{t("Config JSON", "配置 JSON")}</label><textarea className={inputClass} rows={4} value={json} onChange={e => setJson(e.target.value)} placeholder='{"key": "value"}' /></div>
          <div className="flex gap-2"><button className={btnPrimary} onClick={handleCreate} disabled={busy}>{busy ? t("Creating…", "创建中…") : t("Save Protocol", "保存协议")}</button><button className={btnSecondary} onClick={() => setShow(false)}>{t("Cancel", "取消")}</button></div>
        </div>
      )}
      {protocols.length === 0 ? (
        <div className={`${cardClass} text-center py-10 text-gray-400`}><Code2 className="w-10 h-10 mx-auto mb-3 opacity-40" /><p className="text-sm">{t("No items found", "暂无数据")}</p></div>
      ) : (
        <div className={`${cardClass} p-0 overflow-hidden`}>
          <table className="w-full text-sm"><thead className="bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-800"><tr>{[t("API Path", "API 路径"), t("Protocol", "协议"), t("Config", "配置"), t("Status", "状态"), t("Created", "创建时间"), t("Actions", "操作")].map(h => th(h))}</tr></thead>
          <tbody className="divide-y dark:divide-gray-800">
            {protocols.map(p => (
              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition">
                {editId === p.id ? (
                  <>{td(<input className={inputClass} value={ePath} onChange={e => setEPath(e.target.value)} />)}{td(<select className={inputClass} value={eProto} onChange={e => setEProto(e.target.value)}><option value="graphql">GraphQL</option><option value="grpc">gRPC</option><option value="sse">SSE</option><option value="ws">WebSocket</option><option value="rest">REST</option></select>)}{td(<textarea className={inputClass} rows={2} value={eJson} onChange={e => setEJson(e.target.value)} />)}{td(statusBadge(p.status, t))}{td(<span className="text-gray-500 text-xs">{new Date(p.created_at).toLocaleDateString()}</span>)}{td(<div className="flex gap-1"><button className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg" onClick={saveEdit}><Check className="w-3.5 h-3.5" /></button><button className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg" onClick={() => setEditId(null)}><X className="w-3.5 h-3.5" /></button></div>)}</>
                ) : (
                  <>{td(<span className="font-mono text-xs text-gray-900 dark:text-gray-100">{p.api_path}</span>)}{td(<span className="text-xs px-2 py-0.5 rounded-full font-medium bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400 uppercase">{p.protocol}</span>)}{td(<code className="text-xs text-gray-500 dark:text-gray-400 max-w-[150px] truncate block">{(p.config_json || "{}").slice(0, 40)}</code>)}{td(statusBadge(p.status, t))}{td(<span className="text-gray-500 text-xs">{new Date(p.created_at).toLocaleDateString()}</span>)}{td(<div className="flex items-center gap-1"><button className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition" onClick={() => startEdit(p)}><Edit3 className="w-3.5 h-3.5" /></button><button className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition" onClick={() => deleteProtocol(p.id)} disabled={busy}><Trash2 className="w-3.5 h-3.5" /></button></div>)}</>
                )}
              </tr>
            ))}
          </tbody></table>
        </div>
      )}
    </div>
  );
}
