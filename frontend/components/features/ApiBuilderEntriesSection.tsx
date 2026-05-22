"use client";

import { useState } from "react";
import { Database, ListFilter, Play, RotateCcw, Copy, Trash2, Plus, X, Upload, CheckCircle2, Loader2, ChevronDown, ChevronRight, Zap } from "lucide-react";
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

export default function ApiBuilderEntriesSection(props: ApiBuilderEntriesSectionProps) {
  const {
    abEntries, abEntryCounter, abPresets, abWhitelist,
    setAbEntries, setAbEntryCounter,
    saveAbPreset, loadAbPreset, deleteAbPreset,
    abEntryToJson, transformAbEntry, batchTransformAb,
    notifySucc, t,
  } = props;

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const toggleCollapse = (id: number) => setCollapsed((prev) => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const doneCount = abEntries.filter((e) => e.output).length;

  const handleBulkImport = () => {
    if (!importText.trim()) return;
    try {
      const parsed = JSON.parse(importText);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const newEntries: AbEntry[] = arr.map((item: Record<string, unknown>, i: number) => {
        const fields = Object.entries(item).map(([key, value]) => ({
          key,
          value: typeof value === "string" ? value : JSON.stringify(value),
        }));
        return {
          id: abEntryCounter + i,
          name: `import-${i + 1}`,
          fields: fields.length > 0 ? fields : [{ key: "", value: "" }],
          output: "",
          busy: false,
        };
      });
      setAbEntryCounter((c) => c + newEntries.length);
      setAbEntries((prev) => [...prev, ...newEntries]);
      setImportText("");
      setImportOpen(false);
      notifySucc(t(`Imported ${newEntries.length} entries`, `已导入 ${newEntries.length} 个条目`));
    } catch {
      notifySucc(t("Invalid JSON. Paste a JSON object or array.", "JSON 格式无效，请粘贴 JSON 对象或数组。") as string);
    }
  };

  return (
    <div className="space-y-5">
      {/* Section Header */}
      <div className="border-t border-gray-200 dark:border-zinc-800 pt-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t("Test Data Entries", "测试数据条目")}</h2>
            <span className="text-xs text-gray-400">({abEntries.length})</span>
            {doneCount > 0 && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />{doneCount} {t("done", "已完成")}
              </span>
            )}
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Presets */}
            {Object.keys(abPresets).length > 0 && (
              <select
                className={`${inputClass} !w-28 text-xs !py-1.5`}
                defaultValue=""
                onChange={(e) => { if (e.target.value) { loadAbPreset(e.target.value); e.target.value = ""; } }}
              >
                <option value="">{t("Load...", "加载预设")}</option>
                {Object.keys(abPresets).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
            <button
              onClick={() => { const name = window.prompt(t("Preset name:", "预设名称:") as string); if (name) saveAbPreset(name); }}
              className={`${btnSecondary} !text-xs !py-1.5`}
            >
              <Database className="w-3.5 h-3.5 mr-1" />{t("Save", "保存预设")}
            </button>

            {/* Bulk Import */}
            <button onClick={() => setImportOpen(!importOpen)} className={`${btnSecondary} !text-xs !py-1.5`}>
              <Upload className="w-3.5 h-3.5 mr-1" />{t("Import JSON", "导入 JSON")}
            </button>

            <div className="h-5 w-px bg-gray-300 dark:bg-zinc-700" />

            <button onClick={() => setAbEntries([])} className={`${btnSecondary} !text-xs !py-1.5`}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" />{t("Clear", "清空")}
            </button>
            <button
              onClick={() => {
                const newId = Math.max(...abEntries.map((e) => e.id), 0) + 1;
                setAbEntryCounter(newId + 1);
                const fields = abWhitelist.length > 0
                  ? abWhitelist.map((f) => ({ key: f, value: "" }))
                  : [{ key: "", value: "" }];
                setAbEntries((prev) => [...prev, { id: newId, name: "", fields, output: "", busy: false }]);
              }}
              className={`${btnPrimary} !bg-emerald-600 hover:!bg-emerald-700 !text-xs !py-1.5`}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />{t("Add Entry", "添加条目")}
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Import Panel */}
      {importOpen && (
        <div className={`${cardClass} !border-l-4 !border-l-purple-500 !p-4`}>
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Upload className="w-4 h-4 text-purple-500" />
              {t("Bulk Import JSON", "批量导入 JSON")}
            </span>
            <button onClick={() => setImportOpen(false)} className={iconBtn}>
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            {t("Paste a JSON object or array. Each key becomes a field. For arrays, each item becomes a separate entry.", "粘贴 JSON 对象或数组。每个键对应一个字段。数组将拆分为多个独立条目。")}
          </p>
          <textarea
            className={`${inputClass} font-mono text-xs`}
            rows={8}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={'[{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]'}
          />
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => { setImportOpen(false); setImportText(""); }} className={btnSecondary}>
              {t("Cancel", "取消")}
            </button>
            <button onClick={handleBulkImport} disabled={!importText.trim()} className={`${btnPrimary} !bg-purple-600 hover:!bg-purple-700`}>
              <Upload className="w-4 h-4 mr-1.5" />{t("Import", "导入")}
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {abEntries.length === 0 && (
        <div className={`${cardClass} text-center py-16 text-gray-400`}>
          <Database className="w-14 h-14 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">{t("No entries yet", "暂无数据条目")}</p>
          <p className="text-sm mt-1">{t("Click 'Add Entry' or 'Import JSON' to get started.", "点击「添加条目」或「导入 JSON」开始构建测试数据。")}</p>
        </div>
      )}

      {/* Entry Cards */}
      <div className="space-y-4">
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
                    <p className="text-center text-gray-400 text-sm py-4">{t("No fields. Add fields or import data.", "无字段。请添加字段或导入数据。")}</p>
                  )}

                  {/* Add field button */}
                  <button
                    onClick={() => setAbEntries((prev) => prev.map((en) => en.id === entry.id ? { ...en, fields: [...en.fields, { key: "", value: "" }] } : en))}
                    className="inline-flex items-center gap-1 text-xs font-medium rounded-lg px-2.5 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 transition-colors"
                  >
                    <Plus className="w-3 h-3" />{t("Add Field", "添加字段")}
                  </button>

                  {/* Output */}
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col gap-2 shrink-0">
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
                        className="text-xs text-gray-400 hover:text-blue-500 flex items-center gap-1 transition-colors"
                      >
                        <Copy className="w-3 h-3" />{t("Copy JSON", "复制 JSON")}
                      </button>
                      {abEntries.length > 1 && (
                        <button
                          onClick={() => setAbEntries((prev) => prev.filter((e) => e.id !== entry.id))}
                          className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />{t("Remove", "删除")}
                        </button>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-400 mb-1">{t("Output", "输出结果")}</div>
                      <pre className="bg-zinc-900 dark:bg-black border border-zinc-700 text-emerald-400 p-3 rounded-xl text-xs font-mono overflow-auto max-h-48 min-h-[3rem] whitespace-pre-wrap leading-relaxed">
                        {entry.output || "// " + t("Click Transform to see result", "点击「转换」查看结果")}
                      </pre>
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
    </div>
  );
}
