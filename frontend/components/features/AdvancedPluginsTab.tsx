"use client";

import { useState, useCallback } from "react";
import { Plus, Edit3, Trash2, Check, X, Settings, ChevronDown, ChevronRight, Code2, Shield, Zap, Gauge } from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary, btnSecondary } from "@/lib/constants";
import type { PluginConfig } from "@/lib/types";

interface Props {
  plugins: PluginConfig[];
  busy: boolean;
  createPlugin: (data: Record<string, unknown>) => Promise<void>;
  updatePlugin: (id: string, data: Record<string, unknown>) => Promise<void>;
  deletePlugin: (id: string) => Promise<void>;
  canWrite: boolean;
  notifyError: (m: string) => void;
  t: <T>(en: T, zh: T) => T;
}

const hookMeta: Record<string, { label: string; zh: string; icon: React.ReactNode; color: string }> = {
  pre_auth:      { label: "Pre Auth",      zh: "认证前", icon: <Shield className="w-3.5 h-3.5" />,   color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  post_auth:     { label: "Post Auth",     zh: "认证后", icon: <Shield className="w-3.5 h-3.5" />,   color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  pre_transform: { label: "Pre Transform", zh: "转换前", icon: <Zap className="w-3.5 h-3.5" />,       color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  post_transform:{ label: "Post Transform",zh: "转换后", icon: <Zap className="w-3.5 h-3.5" />,       color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" },
  pre_cache:     { label: "Pre Cache",     zh: "缓存前", icon: <Gauge className="w-3.5 h-3.5" />,     color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  post_cache:    { label: "Post Cache",    zh: "缓存后", icon: <Gauge className="w-3.5 h-3.5" />,     color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
};

function parseDesc(cfg: string): string {
  try { return JSON.parse(cfg).type || ""; } catch { return ""; }
}

const statusBadge = (s: string, t: Props["t"]) => (
  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>
    {s === "active" ? t("active", "激活") : s}
  </span>
);
const th = (t: string) => <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t}</th>;
const td = (c: React.ReactNode, cls = "") => <td className={`px-4 py-3 ${cls}`}>{c}</td>;

export default function AdvancedPluginsTab({ plugins, busy, createPlugin, updatePlugin, deletePlugin, canWrite, notifyError, t }: Props) {
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [name, setName] = useState(""); const [type, setType] = useState("lua"); const [hook, setHook] = useState("pre_transform");
  const [json, setJson] = useState("{}"); const [prio, setPrio] = useState("10");
  const [eName, setEName] = useState(""); const [eType, setEType] = useState("lua"); const [eHook, setEHook] = useState("pre_transform");
  const [eJson, setEJson] = useState("{}"); const [ePrio, setEPrio] = useState("");

  const toggleExpand = (id: string) => setExpanded(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const startEdit = (p: PluginConfig) => { setEditId(p.id); setEName(p.name); setEType(p.plugin_type); setEHook(p.hook_point); setEJson(p.config_json || "{}"); setEPrio(String(p.priority)); };
  const saveEdit = useCallback(async () => {
    if (!editId) return;
    await updatePlugin(editId, { name: eName.trim(), plugin_type: eType, hook_point: eHook, config_json: eJson, priority: parseInt(ePrio) || 10 });
    setEditId(null);
  }, [editId, eName, eType, eHook, eJson, ePrio, updatePlugin]);
  const handleCreate = useCallback(async () => {
    if (!name.trim()) { notifyError("Plugin name is required"); return; }
    await createPlugin({ name: name.trim(), plugin_type: type, hook_point: hook, config_json: json, priority: parseInt(prio) || 10 });
    setName(""); setType("lua"); setHook("pre_transform"); setJson("{}"); setPrio("10"); setShow(false);
  }, [name, type, hook, json, prio, createPlugin, notifyError]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div><h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t("Plugins", "插件系统")}</h2><p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t("Register custom plugins at hook points in the transform pipeline.", "在转换管线的钩子点注册自定义插件。")}</p></div>
        {canWrite && <button className={btnPrimary} onClick={() => setShow(!show)} disabled={busy}><Plus className="w-4 h-4 mr-1" />{t("Create", "创建")}</button>}
      </div>
      {canWrite && show && (
        <div className={`${cardClass} space-y-4`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className={labelClass}>{t("Name", "名称")} <span className="text-red-500">*</span></label><input className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder={t("My Plugin", "插件名称")} /></div>
            <div><label className={labelClass}>{t("Plugin Type", "插件类型")}</label><input className={inputClass} value={type} onChange={e => setType(e.target.value)} placeholder="lua" /></div>
            <div><label className={labelClass}>{t("Hook Point", "钩子点")}</label><select className={inputClass} value={hook} onChange={e => setHook(e.target.value)}><option value="pre_transform">pre_transform</option><option value="post_transform">post_transform</option><option value="pre_auth">pre_auth</option><option value="post_auth">post_auth</option><option value="pre_cache">pre_cache</option><option value="post_cache">post_cache</option></select></div>
            <div><label className={labelClass}>{t("Priority", "优先级")}</label><input className={inputClass} type="number" value={prio} onChange={e => setPrio(e.target.value)} /></div>
          </div>
          <div><label className={labelClass}>{t("Config JSON", "配置 JSON")}</label><textarea className={inputClass} rows={4} value={json} onChange={e => setJson(e.target.value)} placeholder='{"key": "value"}' /></div>
          <div className="flex gap-2"><button className={btnPrimary} onClick={handleCreate} disabled={busy}>{busy ? t("Creating…", "创建中…") : t("Save Plugin", "保存插件")}</button><button className={btnSecondary} onClick={() => setShow(false)}>{t("Cancel", "取消")}</button></div>
        </div>
      )}
      {plugins.length === 0 ? (
        <div className={`${cardClass} text-center py-10 text-gray-400`}><Settings className="w-10 h-10 mx-auto mb-3 opacity-40" /><p className="text-sm">{t("No items found", "暂无数据")}</p></div>
      ) : (
        <div className={`${cardClass} p-0 overflow-auto`}>
          <table className="w-full text-sm table-fixed min-w-[640px]"><thead className="bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-800"><tr>{[t("", ""), t("Name", "名称"), t("Hook Point", "钩子点"), t("Priority", "优先级"), t("Status", "状态"), ...(canWrite ? [t("Actions", "操作")] : [])].map(h => th(h))}</tr></thead>
          <tbody className="divide-y dark:divide-gray-800">
            {plugins.map(p => {
              const hm = hookMeta[p.hook_point] || hookMeta.pre_transform;
              const desc = parseDesc(p.config_json || "");
              const open = expanded.has(p.id);
              const editing = editId === p.id;
              return (<>
                <tr key={p.id} className={`hover:bg-gray-50 dark:hover:bg-gray-900/50 transition ${editing ? "ring-2 ring-inset ring-blue-500/50" : ""}`}>
                  {editing ? (
                    <>
                      {td(<button className="p-1" onClick={() => toggleExpand(p.id)}>{open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>)}
                      {td(<input className={inputClass} value={eName} onChange={e => setEName(e.target.value)} />)}
                      {td(<select className={inputClass} value={eHook} onChange={e => setEHook(e.target.value)}><option value="pre_transform">pre_transform</option><option value="post_transform">post_transform</option><option value="pre_auth">pre_auth</option><option value="post_auth">post_auth</option><option value="pre_cache">pre_cache</option><option value="post_cache">post_cache</option></select>)}
                      {td(<div className="flex gap-1"><input className={inputClass} type="number" value={ePrio} onChange={e => setEPrio(e.target.value)} /></div>)}
                      {td(statusBadge(p.status, t))}
                      {canWrite && td(<div className="flex gap-1"><button className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg" onClick={saveEdit} title={t("Save", "保存")}><Check className="w-3.5 h-3.5" /></button><button className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg" onClick={(e) => { e.stopPropagation(); setEditId(null); }} title={t("Cancel", "取消")}><X className="w-3.5 h-3.5" /></button></div>)}
                    </>
                  ) : (
                    <>
                      {td(<button className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" onClick={() => toggleExpand(p.id)}><ChevronRight className={`w-4 h-4 transition-transform ${open ? "rotate-90" : ""}`} /></button>)}
                      {td(<div><span className="font-semibold text-gray-900 dark:text-gray-100">{p.name}</span>{desc && <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">{desc}</p>}</div>)}
                      {td(<span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${hm.color} max-w-full overflow-hidden`}>{hm.icon}<span className="truncate">{t(hm.label, hm.zh)}</span></span>)}
                      {td(<span className="font-semibold tabular-nums">{p.priority}</span>)}
                      {td(statusBadge(p.status, t))}
                      {canWrite && td(<div className="flex items-center gap-1" onClick={e => e.stopPropagation()}><button className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition" onClick={() => startEdit(p)} title={t("Edit", "编辑")}><Edit3 className="w-3.5 h-3.5" /></button><button className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition" onClick={() => deletePlugin(p.id)} disabled={busy} title={t("Delete", "删除")}><Trash2 className="w-3.5 h-3.5" /></button></div>)}
                    </>
                  )}
                </tr>
                {(open || editing) && (
                  <tr key={`${p.id}-config`} className="bg-gray-50/50 dark:bg-gray-900/50">
                    <td colSpan={canWrite ? 6 : 5} className="px-4 py-3">
                      {editing && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                          <div><label className={labelClass}>{t("Plugin Type", "插件类型")}</label><input className={inputClass} value={eType} onChange={e => setEType(e.target.value)} placeholder="lua" /></div>
                          <div className="flex items-end"><label className="flex items-center gap-2 cursor-pointer text-sm"><input type="checkbox" checked={eJson.includes('"enabled":true')} onChange={e => { const checked = e.target.checked; setEJson(prev => { try { const obj = JSON.parse(prev); obj.enabled = checked; return JSON.stringify(obj, null, 2); } catch { return prev; } }); }} className="rounded" /><span className="text-gray-700 dark:text-gray-300">{t("Enabled", "启用")}</span></label></div>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-400 uppercase tracking-wider mb-1.5"><Code2 className="w-3 h-3" />{t("Plugin Config", "插件配置")}</div>
                      {editing ? (
                        <textarea className={`${inputClass} font-mono text-xs`} rows={8} value={(() => { try { return JSON.stringify(JSON.parse(eJson), null, 2); } catch { return eJson; } })()} onChange={e => { try { JSON.parse(e.target.value); setEJson(e.target.value); } catch { setEJson(e.target.value); } }} />
                      ) : (
                        <pre className="text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg p-3 overflow-x-auto font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">{p.config_json ? (() => { try { return JSON.stringify(JSON.parse(p.config_json), null, 2); } catch { return p.config_json; } })() : "{}"}</pre>
                      )}
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
