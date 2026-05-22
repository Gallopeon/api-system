"use client";

import { useState } from "react";
import {
  Database, Play, Copy, Trash2, Plus, X, Upload, CheckCircle2, Loader2,
  ChevronDown, ChevronRight, Zap, FileJson, FileSpreadsheet, FileText,
} from "lucide-react";
import { cardClass, inputClass, btnPrimary, btnSecondary } from "@/lib/constants";
import type { AbEntry } from "@/hooks/useApiBuilder";

interface ApiBuilderEntriesSectionProps {
  abEntries: AbEntry[];
  abEntryCounter: number;
  abPresets: Record<string, AbEntry[]>;
  abWhitelist: string[];
  setAbEntries: (v: AbEntry[] | ((prev: AbEntry[]) => AbEntry[])) => void;
  setAbEntryCounter: (v: number | ((prev: number) => number)) => void;
  saveAbPreset: (name: string) => void;
  loadAbPreset: (name: string) => void;
  deleteAbPreset: (name: string) => void;
  abEntryToJson: (entry: AbEntry) => string;
  transformAbEntry: (entry: AbEntry, idx: number) => Promise<void>;
  batchTransformAb: () => Promise<void>;
  notifySucc: (msg: string) => void;
  t: <T>(en: T, zh: T) => T;
}

const iconBtn = "p-1.5 rounded-lg transition-colors touch-btn";

/* ── Output renderer: recursive tree with syntax highlighting ── */
function valClass(v: unknown): string {
  if (v === null || v === undefined) return "text-zinc-500 italic";
  if (typeof v === "boolean") return v ? "text-emerald-400" : "text-red-400";
  if (typeof v === "number") return "text-amber-300";
  if (typeof v === "string") return "text-sky-300";
  return "text-zinc-300";
}

function fmtVal(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "string") {
    if (v.length > 120) return `"${v.slice(0, 120)}…"`;
    return `"${v}"`;
  }
  if (typeof v === "number") return String(v);
  return JSON.stringify(v);
}

function TreeNode({ label, value, depth }: { label?: string; value: unknown; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const pad = depth * 12;

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <Row label={label} value="{}" cls="text-zinc-500" pad={pad} />;
    return (
      <div>
        <button onClick={() => setOpen(!open)} className="flex items-center gap-1 hover:text-white transition-colors text-left w-full" style={{ paddingLeft: pad }}>
          {open ? <ChevronDown className="w-3 h-3 text-zinc-500 shrink-0" /> : <ChevronRight className="w-3 h-3 text-zinc-500 shrink-0" />}
          {label !== undefined && <span className="text-emerald-400 font-mono text-[11px] shrink-0">{label}:&nbsp;</span>}
          <span className="text-zinc-500 text-[11px]">{open ? "{" : `{${entries.length} keys}`}</span>
        </button>
        {open && (
          <div className="border-l border-zinc-700/50 ml-3 mt-0.5">
            {entries.map(([k, v]) => (
              <TreeNode key={k} label={k} value={v} depth={depth + 1} />
            ))}
            <div style={{ paddingLeft: pad + 12 }} className="text-zinc-500 text-[11px]">{"}"}</div>
          </div>
        )}
      </div>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <Row label={label} value="[]" cls="text-zinc-500" pad={pad} />;
    return (
      <div>
        <button onClick={() => setOpen(!open)} className="flex items-center gap-1 hover:text-white transition-colors text-left w-full" style={{ paddingLeft: pad }}>
          {open ? <ChevronDown className="w-3 h-3 text-zinc-500 shrink-0" /> : <ChevronRight className="w-3 h-3 text-zinc-500 shrink-0" />}
          {label !== undefined && <span className="text-emerald-400 font-mono text-[11px] shrink-0">{label}:&nbsp;</span>}
          <span className="text-zinc-500 text-[11px]">{open ? "[" : `[${value.length} items]`}</span>
        </button>
        {open && (
          <div className="border-l border-zinc-700/50 ml-3 mt-0.5">
            {value.map((item, i) => (
              <TreeNode key={i} label={String(i)} value={item} depth={depth + 1} />
            ))}
            <div style={{ paddingLeft: pad + 12 }} className="text-zinc-500 text-[11px]">{"]"}</div>
          </div>
        )}
      </div>
    );
  }

  return <Row label={label} value={fmtVal(value)} cls={valClass(value)} pad={pad} />;
}

function Row({ label, value, cls, pad }: { label?: string; value: string; cls: string; pad: number }) {
  return (
    <div className="flex items-start py-[1px] hover:bg-zinc-800/30 rounded-sm" style={{ paddingLeft: pad }}>
      {label !== undefined && <span className="text-emerald-400 font-mono text-[11px] shrink-0 mr-1">{label}:</span>}
      <span className={`font-mono text-[11px] break-all leading-relaxed ${cls}`}>{value}</span>
    </div>
  );
}

function OutputView({ raw }: { raw: string }) {
  if (!raw) return <span className="text-zinc-500 text-xs italic">—</span>;
  try {
    const obj = JSON.parse(raw);
    const data = obj.output ?? obj;
    if (typeof data === "object" && data !== null) {
      return (
        <div className="py-1">
          {Object.keys(obj).filter((k) => k !== "output").length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3 pb-2 border-b border-zinc-700/50">
              {obj.rule_id && (
                <span className="text-[10px] text-zinc-500">
                  Rule: <span className="text-zinc-300 font-mono">{String(obj.rule_id).slice(0, 12)}…</span>
                </span>
              )}
              {obj.selected_variant && (
                <span className="text-[10px] text-zinc-500">
                  Variant: <span className="text-purple-400 font-mono">{String(obj.selected_variant)}</span>
                </span>
              )}
            </div>
          )}
          <TreeNode value={data} depth={0} />
        </div>
      );
    }
    return <pre className="text-emerald-400 whitespace-pre-wrap leading-relaxed text-xs">{JSON.stringify(data, null, 2)}</pre>;
  } catch {
    return <pre className="text-emerald-400 whitespace-pre-wrap leading-relaxed text-xs">{raw}</pre>;
  }
}

/* ── Import helpers ── */
function makeEntry(id: number, name: string, kv: Array<{ key: string; value: string }>): AbEntry {
  return { id, name, fields: kv.length > 0 ? kv : [{ key: "", value: "" }], output: "", busy: false };
}

/* ── Component ── */
export default function ApiBuilderEntriesSection(props: ApiBuilderEntriesSectionProps) {
  const {
    abEntries, abEntryCounter, abPresets, abWhitelist,
    setAbEntries, setAbEntryCounter,
    saveAbPreset, loadAbPreset, deleteAbPreset,
    abEntryToJson, transformAbEntry, batchTransformAb,
    notifySucc, t,
  } = props;

  /* ---- Import state ---- */
  const [importTab, setImportTab] = useState<"json" | "csv" | "kv">("json");
  const [importText, setImportText] = useState("");

  /* ---- Collapse state ---- */
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const toggleCollapse = (id: number) => setCollapsed((prev) => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const doneCount = abEntries.filter((e) => e.output).length;

  /* ---- Add single entry ---- */
  const addEntry = () => {
    const newId = Math.max(...abEntries.map((e) => e.id), 0) + 1;
    setAbEntryCounter(newId + 1);
    const fields = abWhitelist.length > 0
      ? abWhitelist.map((f) => ({ key: f, value: "" }))
      : [{ key: "", value: "" }];
    setAbEntries((prev) => [...prev, { id: newId, name: "", fields, output: "", busy: false }]);
  };

  /* ---- Import handlers ---- */
  const doImport = () => {
    if (!importText.trim()) return;
    let newEntries: AbEntry[] = [];
    let nextId = abEntryCounter;

    if (importTab === "json") {
      try {
        const parsed = JSON.parse(importText);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        newEntries = arr.map((item: Record<string, unknown>, i: number) => {
          const fields = Object.entries(item).map(([key, value]) => ({
            key,
            value: typeof value === "string" ? value : JSON.stringify(value),
          }));
          return makeEntry(nextId + i, `import-${i + 1}`, fields);
        });
      } catch {
        notifySucc(t("Invalid JSON format", "JSON 格式无效") as string);
        return;
      }
    } else if (importTab === "csv") {
      const lines = importText.trim().split("\n").filter(Boolean);
      if (lines.length < 2) {
        notifySucc(t("CSV needs at least a header row and one data row", "CSV 至少需要表头行和一行数据") as string);
        return;
      }
      const headers = lines[0].split(",").map((h) => h.trim()).filter(Boolean);
      if (headers.length === 0) {
        notifySucc(t("No valid headers found", "未找到有效表头") as string);
        return;
      }
      newEntries = lines.slice(1).map((line, i) => {
        const values = line.split(",").map((v) => v.trim());
        const fields = headers.map((h, j) => ({ key: h, value: values[j] || "" }));
        return makeEntry(nextId + i, `csv-${i + 1}`, fields);
      });
    } else if (importTab === "kv") {
      const pairs = importText.trim().split("\n").filter(Boolean);
      const fields = pairs.map((line) => {
        const eq = line.indexOf("=");
        if (eq === -1) return { key: line.trim(), value: "" };
        return { key: line.substring(0, eq).trim(), value: line.substring(eq + 1).trim() };
      });
      newEntries = [makeEntry(nextId, "kv-import", fields)];
    }

    if (newEntries.length > 0) {
      setAbEntryCounter((c) => c + newEntries.length);
      setAbEntries((prev) => [...prev, ...newEntries]);
      setImportText("");
      notifySucc(t(`Imported ${newEntries.length} entries`, `已导入 ${newEntries.length} 个条目`));
    }
  };

  const importTabs = [
    { id: "json" as const, icon: FileJson, label: "JSON", desc: t("Object or array", "对象或数组") },
    { id: "csv" as const, icon: FileSpreadsheet, label: "CSV", desc: t("Header + rows", "表头+数据行") },
    { id: "kv" as const, icon: FileText, label: "Key=Value", desc: t("key=value per line", "每行 key=value") },
  ];

  const importPlaceholders: Record<string, string> = {
    json: '[{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]',
    csv: "id,name,email\n1,Alice,alice@x.com\n2,Bob,bob@x.com",
    kv: "id=1\nname=Alice\nemail=alice@x.com",
  };

  return (
    <div className="space-y-6">
      {/* ═══════════ Section 1: Data Entries ═══════════ */}
      <div className="border-t border-gray-200 dark:border-zinc-800 pt-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t("Data Entries", "数据条目")}</h2>
            <span className="text-xs text-gray-400">({abEntries.length})</span>
            {doneCount > 0 && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />{doneCount} {t("done", "已完成")}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {Object.keys(abPresets).length > 0 && (
              <select
                className={`${inputClass} !w-28 text-xs !py-1.5`}
                defaultValue=""
                onChange={(e) => { if (e.target.value) { loadAbPreset(e.target.value); e.target.value = ""; } }}
              >
                <option value="">{t("Load preset", "加载预设")}</option>
                {Object.keys(abPresets).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
            <button
              onClick={() => { const name = window.prompt(t("Preset name:", "预设名称:") as string); if (name) saveAbPreset(name); }}
              className={`${btnSecondary} !text-xs !py-1.5`}
            >
              <Database className="w-3.5 h-3.5 mr-1" />{t("Save Preset", "保存预设")}
            </button>
            {abEntries.length > 0 && (
              <button onClick={() => setAbEntries([])} className={`${btnSecondary} !text-xs !py-1.5 !text-red-500 hover:!bg-red-50 dark:hover:!bg-red-950/20`}>
                <Trash2 className="w-3.5 h-3.5 mr-1" />{t("Clear All", "清空")}
              </button>
            )}
            <button onClick={addEntry} className={`${btnPrimary} !bg-emerald-600 hover:!bg-emerald-700 !text-xs !py-1.5`}>
              <Plus className="w-3.5 h-3.5 mr-1" />{t("Add Entry", "添加条目")}
            </button>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {abEntries.length === 0 && (
        <div className={`${cardClass} text-center py-12 text-gray-400`}>
          <Database className="w-14 h-14 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">{t("No entries yet", "暂无数据条目")}</p>
          <p className="text-sm mt-1">{t("Click 'Add Entry' to create one, or use the Import section below.", "点击「添加条目」创建，或使用下方的导入功能。")}</p>
        </div>
      )}

      {/* Entry Cards */}
      <div className="space-y-3">
        {abEntries.map((entry, idx) => {
          const isCollapsed = collapsed.has(entry.id);
          const hasOutput = !!entry.output;

          return (
            <div key={entry.id} className={`${cardClass} !p-0 overflow-hidden border-l-4 border-l-emerald-500 ${entry.busy ? "animate-pulse" : ""}`}>
              {/* Card header */}
              <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors" onClick={() => toggleCollapse(entry.id)}>
                <button className="shrink-0 text-gray-400">
                  {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  hasOutput ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400" : "bg-gray-100 dark:bg-zinc-800 text-gray-500"
                }`}>
                  #{idx + 1}
                </span>
                <input
                  className="flex-1 text-sm font-medium bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-zinc-600 min-w-0"
                  value={entry.name}
                  onChange={(e) => setAbEntries((prev) => prev.map((en) => en.id === entry.id ? { ...en, name: e.target.value } : en))}
                  placeholder={t("Untitled", "未命名")}
                  onClick={(e) => e.stopPropagation()}
                />
                {entry.busy && <Loader2 className="w-4 h-4 animate-spin text-blue-500 shrink-0" />}
                {hasOutput && !entry.busy && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                <span className="text-xs text-gray-400 shrink-0">{entry.fields.length} {t("fields", "字段")}</span>
                {abEntries.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setAbEntries((prev) => prev.filter((en) => en.id !== entry.id)); }}
                    className={`${iconBtn} text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20`}
                    title={t("Delete entry", "删除此条目") as string}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {!isCollapsed && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-100 dark:border-zinc-800">
                  {/* Fields table */}
                  <div className="pt-3 overflow-x-auto">
                    <table className="w-full text-sm resp-table">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-zinc-800 text-left">
                          <th className="py-2 pr-2 font-medium text-xs text-gray-400 uppercase w-1/3">{t("Field Key", "字段名")}</th>
                          <th className="py-2 pr-2 font-medium text-xs text-gray-400 uppercase">{t("Field Value", "字段值")}</th>
                          <th className="py-2 w-10" />
                        </tr>
                      </thead>
                      <tbody>
                        {entry.fields.map((f, fi) => (
                          <tr key={fi} className="border-b border-gray-50 dark:border-zinc-800/50 group">
                            <td className="py-1.5 pr-2" data-label={t("Field Key", "字段名")}>
                              <input
                                className={`${inputClass} !py-1.5 font-mono text-xs`}
                                value={f.key}
                                onChange={(e) => setAbEntries((prev) => prev.map((en) => en.id === entry.id ? { ...en, fields: en.fields.map((ef, i) => i === fi ? { ...ef, key: e.target.value } : ef) } : en))}
                                placeholder="field_name"
                              />
                            </td>
                            <td className="py-1.5 pr-2" data-label={t("Field Value", "字段值")}>
                              <input
                                className={`${inputClass} !py-1.5 font-mono text-xs`}
                                value={f.value}
                                onChange={(e) => setAbEntries((prev) => prev.map((en) => en.id === entry.id ? { ...en, fields: en.fields.map((ef, i) => i === fi ? { ...ef, value: e.target.value } : ef) } : en))}
                                placeholder="value"
                              />
                            </td>
                            <td className="py-1.5 text-center">
                              <button
                                onClick={() => setAbEntries((prev) => prev.map((en) => en.id === entry.id ? { ...en, fields: en.fields.filter((_, i) => i !== fi) } : en))}
                                className={`${iconBtn} text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100`}
                              ><X className="w-3.5 h-3.5" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {entry.fields.length === 0 && (
                    <p className="text-center text-gray-400 text-sm py-4">{t("No fields. Add fields or import data.", "无字段，请添加字段或导入数据。")}</p>
                  )}

                  <button
                    onClick={() => setAbEntries((prev) => prev.map((en) => en.id === entry.id ? { ...en, fields: [...en.fields, { key: "", value: "" }] } : en))}
                    className="inline-flex items-center gap-1 text-xs font-medium rounded-lg px-2.5 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 transition-colors"
                  >
                    <Plus className="w-3 h-3" />{t("Add Field", "添加字段")}
                  </button>

                  {/* Output */}
                  <div className="space-y-3">
                    {/* Action bar */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => transformAbEntry(entry, idx)}
                        disabled={entry.busy || entry.fields.length === 0}
                        className={`${btnPrimary} !bg-emerald-600 hover:!bg-emerald-700`}
                      >
                        {entry.busy
                          ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" />{t("Running", "执行中")}</>
                          : <><Play className="w-4 h-4 mr-1.5" />{t("Transform", "转换")}</>}
                      </button>
                      <button
                        onClick={() => { navigator.clipboard.writeText(abEntryToJson(entry)); notifySucc(t("Copied!", "已复制！")); }}
                        className="text-xs text-gray-400 hover:text-blue-500 transition-colors px-2"
                      >
                        <Copy className="w-3 h-3 inline mr-1" />{t("Copy Input", "复制输入")}
                      </button>
                    </div>

                    {/* Output panel */}
                    <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-900 dark:bg-black shadow-inner">
                      {/* Output header */}
                      <div className="flex items-center justify-between px-3 py-2 bg-zinc-800/50 dark:bg-zinc-800/30 border-b border-zinc-700/50">
                        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                          {t("Transform Result", "转换结果")}
                        </span>
                        {hasOutput && (
                          <button
                            onClick={() => { navigator.clipboard.writeText(entry.output); notifySucc(t("Copied!", "已复制！")); }}
                            className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" />{t("Copy", "复制")}
                          </button>
                        )}
                      </div>
                      {/* Output body */}
                      <div className="p-3 max-h-72 overflow-auto">
                        {entry.output ? (
                          <OutputView raw={entry.output} />
                        ) : (
                          <div className="flex items-center justify-center py-8">
                            <span className="text-zinc-600 text-xs">{t("Click Transform to preview the rule output", "点击「转换」预览规则输出结果")}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Batch Transform */}
      {abEntries.length > 1 && (
        <div className="flex justify-end">
          <button onClick={batchTransformAb} className={btnPrimary}>
            <Zap className="w-4 h-4 mr-1.5" />{t("Batch Transform All", "批量转换全部")}
          </button>
        </div>
      )}

      {/* ═══════════ Section 2: Data Import ═══════════ */}
      <div className="border-t border-gray-200 dark:border-zinc-800 pt-5">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Upload className="w-5 h-5 text-purple-500" />
            {t("Data Import", "数据导入")}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {t("Import entries from JSON, CSV, or Key-Value format.", "从 JSON、CSV 或 Key-Value 格式导入数据条目。")}
          </p>
        </div>

        <div className={`${cardClass} !border-l-4 !border-l-purple-500 !p-0 overflow-hidden`}>
          {/* Import tabs */}
          <div className="flex border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/30">
            {importTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setImportTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
                  importTab === tab.id
                    ? "border-purple-500 text-purple-700 dark:text-purple-400 bg-white dark:bg-zinc-900"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
                <span className="hidden sm:inline text-gray-400 font-normal">({tab.desc})</span>
              </button>
            ))}
          </div>

          {/* Import body */}
          <div className="p-4 space-y-3">
            <textarea
              className={`${inputClass} font-mono text-xs`}
              rows={8}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={importPlaceholders[importTab]}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setImportText("")} className={btnSecondary}>
                {t("Clear", "清空")}
              </button>
              <button onClick={doImport} disabled={!importText.trim()} className={`${btnPrimary} !bg-purple-600 hover:!bg-purple-700`}>
                <Upload className="w-4 h-4 mr-1.5" />{t("Import", "导入")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
