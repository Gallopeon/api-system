"use client";

import { useState, useCallback } from "react";
import { Plus, Edit3, Trash2, Check, X, Code2, ChevronRight } from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary, btnSecondary } from "@/lib/constants";
import type { ProtocolConfig } from "@/lib/types";

interface Props {
  protocols: ProtocolConfig[];
  busy: boolean;
  createProtocol: (data: Record<string, unknown>) => Promise<void>;
  updateProtocol: (id: string, data: Record<string, unknown>) => Promise<void>;
  deleteProtocol: (id: string) => Promise<void>;
  canWrite: boolean;
  notifyError: (m: string) => void;
  t: <T>(en: T, zh: T) => T;
}

const protoMeta: Record<string, { color: string }> = {
  graphql: { color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400" },
  grpc:    { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  sse:     { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  ws:      { color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
  rest:    { color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
};

const statusBadge = (s: string, t: Props["t"]) => (
  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>
    {s === "active" ? t("active", "激活") : s}
  </span>
);
const th = (t: string) => <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t}</th>;
const td = (c: React.ReactNode, cls = "") => <td className={`px-4 py-3 ${cls}`}>{c}</td>;

export default function AdvancedProtocolsTab({ protocols, busy, createProtocol, updateProtocol, deleteProtocol, canWrite, notifyError, t }: Props) {
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [descOpen, setDescOpen] = useState<Set<string>>(new Set());
  const [path, setPath] = useState(""); const [proto, setProto] = useState("graphql"); const [desc, setDesc] = useState(""); const [json, setJson] = useState("{}");
  const [ePath, setEPath] = useState(""); const [eProto, setEProto] = useState("graphql"); const [eDesc, setEDesc] = useState(""); const [eJson, setEJson] = useState("{}");

  const toggleExpand = (id: string) => setExpanded(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleDesc = (id: string) => setDescOpen(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const startEdit = (p: ProtocolConfig) => { setEditId(p.id); setEPath(p.api_path); setEProto(p.protocol); setEDesc(p.description || ""); setEJson(p.config_json || "{}"); };
  const saveEdit = useCallback(async () => {
    if (!editId) return;
    await updateProtocol(editId, { api_path: ePath.trim(), protocol: eProto, description: eDesc.trim() || null, config_json: eJson });
    setEditId(null);
  }, [editId, ePath, eProto, eDesc, eJson, updateProtocol]);
  const handleCreate = useCallback(async () => {
    if (!path.trim()) { notifyError("API path is required"); return; }
    await createProtocol({ api_path: path.trim(), protocol: proto, description: desc.trim() || null, config_json: json });
    setPath(""); setProto("graphql"); setDesc(""); setJson("{}"); setShow(false);
  }, [path, proto, desc, json, createProtocol, notifyError]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div><h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t("Protocols", "协议扩展")}</h2><p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t("Support GraphQL, gRPC-Web, SSE, and WebSocket protocols per API path.", "按 API 路径支持 GraphQL、gRPC-Web、SSE 和 WebSocket 协议。")}</p></div>
        {canWrite && <button className={btnPrimary} onClick={() => setShow(!show)} disabled={busy}><Plus className="w-4 h-4 mr-1" />{t("Create", "创建")}</button>}
      </div>
      {canWrite && show && (
        <div className={`${cardClass} space-y-4`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={labelClass}>{t("API Path", "API 路径")} <span className="text-red-500">*</span></label><input className={inputClass} value={path} onChange={e => setPath(e.target.value)} placeholder="/admin/v1/graphql" /></div>
            <div><label className={labelClass}>{t("Protocol", "协议")}</label><select className={inputClass} value={proto} onChange={e => setProto(e.target.value)}><option value="graphql">GraphQL</option><option value="grpc">gRPC</option><option value="sse">SSE</option><option value="ws">WebSocket</option><option value="rest">REST</option></select></div>
          </div>
          <div><label className={labelClass}>{t("Description", "作用说明")}</label><input className={inputClass} value={desc} onChange={e => setDesc(e.target.value)} placeholder={t("What does this protocol config do?", "此协议配置的作用是什么？")} /></div>
          <div><label className={labelClass}>{t("Config JSON", "配置 JSON")}</label><textarea className={inputClass} rows={4} value={json} onChange={e => setJson(e.target.value)} placeholder='{"key": "value"}' /></div>
          <div className="flex gap-2"><button className={btnPrimary} onClick={handleCreate} disabled={busy}>{busy ? t("Creating…", "创建中…") : t("Save Protocol", "保存协议")}</button><button className={btnSecondary} onClick={() => setShow(false)}>{t("Cancel", "取消")}</button></div>
        </div>
      )}
      {protocols.length === 0 ? (
        <div className={`${cardClass} text-center py-10 text-gray-400`}><Code2 className="w-10 h-10 mx-auto mb-3 opacity-40" /><p className="text-sm">{t("No items found", "暂无数据")}</p></div>
      ) : (
        <div className={`${cardClass} p-0 overflow-auto`}>
          <table className="w-full text-sm table-fixed min-w-[640px]"><thead className="bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-800"><tr>{[t("", ""), t("API Path", "API 路径"), t("Protocol", "协议"), t("Status", "状态"), ...(canWrite ? [t("Actions", "操作")] : [])].map(h => th(h))}</tr></thead>
          <tbody className="divide-y dark:divide-gray-800">
            {protocols.map(p => {
              const pm = protoMeta[p.protocol] || protoMeta.rest;
              const open = expanded.has(p.id);
              const editing = editId === p.id;
              return (<>
                <tr key={p.id} className={`hover:bg-gray-50 dark:hover:bg-gray-900/50 transition cursor-pointer ${editing ? "ring-2 ring-inset ring-blue-500/50" : ""}`} onClick={() => !editing && toggleExpand(p.id)}>
                  {editing ? (
                    <>
                      {td(<Code2 className="w-4 h-4 text-gray-400" />)}
                      {td(<input className={inputClass} value={ePath} onChange={e => setEPath(e.target.value)} />)}
                      {td(<select className={inputClass} value={eProto} onChange={e => setEProto(e.target.value)}><option value="graphql">GraphQL</option><option value="grpc">gRPC</option><option value="sse">SSE</option><option value="ws">WebSocket</option><option value="rest">REST</option></select>)}
                      {td(statusBadge(p.status, t))}
                      {canWrite && td(<div className="flex gap-1" onClick={e => e.stopPropagation()}><button className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg" onClick={saveEdit} title={t("Save", "保存")}><Check className="w-3.5 h-3.5" /></button><button className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg" onClick={(e) => { e.stopPropagation(); setEditId(null); }} title={t("Cancel", "取消")}><X className="w-3.5 h-3.5" /></button></div>)}
                    </>
                  ) : (
                    <>
                      {td(<button className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><ChevronRight className={`w-4 h-4 transition-transform ${open ? "rotate-90" : ""}`} /></button>)}
                      {td(<div><div className="flex items-center gap-1.5"><span className="font-mono text-xs text-gray-900 dark:text-gray-100">{p.api_path}</span>{p.description && <button className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 text-[10px] font-bold text-gray-500 dark:text-gray-400 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/40 dark:hover:text-blue-400 leading-none select-none shrink-0 transition-colors" onClick={e => { e.stopPropagation(); toggleDesc(p.id); }}>?</button>}</div>{descOpen.has(p.id) && p.description && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">{p.description}</p>}</div>)}
                      {td(<span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium uppercase ${pm.color}`}>{p.protocol}</span>)}
                      {td(statusBadge(p.status, t))}
                      {canWrite && td(<div className="flex items-center gap-1" onClick={e => e.stopPropagation()}><button className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition" onClick={() => startEdit(p)} title={t("Edit", "编辑")}><Edit3 className="w-3.5 h-3.5" /></button><button className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition" onClick={() => deleteProtocol(p.id)} disabled={busy} title={t("Delete", "删除")}><Trash2 className="w-3.5 h-3.5" /></button></div>)}
                    </>
                  )}
                </tr>
                {(open || editing) && (
                  <tr key={`${p.id}-config`} className="bg-gray-50/50 dark:bg-gray-900/50">
                    <td colSpan={canWrite ? 4 : 3} className="px-4 py-3">
                      {editing && (
                        <div className="grid grid-cols-1 gap-3 mb-3">
                          <div><label className={labelClass}>{t("Description", "作用说明")}</label><input className={inputClass} value={eDesc} onChange={e => setEDesc(e.target.value)} placeholder={t("What does this protocol config do?", "此协议配置的作用是什么？")} /></div>
                          <div><label className={labelClass}>{t("Config JSON", "配置 JSON")}</label><textarea className={`${inputClass} font-mono text-xs`} rows={6} value={(() => { try { return JSON.stringify(JSON.parse(eJson), null, 2); } catch { return eJson; } })()} onChange={e => { try { JSON.parse(e.target.value); setEJson(e.target.value); } catch { setEJson(e.target.value); } }} /></div>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-400 uppercase tracking-wider mb-1.5"><Code2 className="w-3 h-3" />{t("Protocol Config", "协议配置")}</div>
                      <pre className="text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg p-3 overflow-x-auto font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">{p.config_json ? (() => { try { return JSON.stringify(JSON.parse(p.config_json), null, 2); } catch { return p.config_json; } })() : "{}"}</pre>
                    </td>
                  </tr>
                )}
              </>);
            })}
          </tbody></table>
        </div>
      )}
    </div>
  );
}
