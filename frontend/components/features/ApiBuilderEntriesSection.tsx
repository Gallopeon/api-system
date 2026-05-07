"use client";

import { Database, ListFilter, Play, RotateCcw } from "lucide-react";
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

export default function ApiBuilderEntriesSection(props: ApiBuilderEntriesSectionProps) {
  const {
    abEntries, abEntryCounter, abPresets, abWhitelist,
    setAbEntries, setAbEntryCounter,
    saveAbPreset, loadAbPreset, deleteAbPreset,
    abEntryToJson, transformAbEntry, batchTransformAb,
    notifySucc, t,
  } = props;

  return (
    <div className="space-y-6">
      {/* Data Entries Header */}
      <div className="border-t border-gray-200 dark:border-gray-800 pt-6 mt-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-500" />
            <h2 className="text-lg font-bold">{t("Data Entries", "数据条目")}</h2>
            <span className="text-xs text-gray-400 ml-1">({abEntries.length})</span>
          </div>
          <div className="flex items-center gap-2">
            {Object.keys(abPresets).length > 0 && (
              <select className={`${inputClass} !w-28 text-xs`} defaultValue="" onChange={(e) => { if (e.target.value) loadAbPreset(e.target.value); e.target.value = ""; }}>
                <option value="">{t("Load...", "加载...")}</option>
                {Object.keys(abPresets).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
            <button onClick={() => { const name = prompt(t("Enter preset name:", "输入预设名称:")); if (name) saveAbPreset(name); }} className={btnSecondary} title={t("Save current entries as preset", "将当前条目保存为预设")}>
              <Database className="w-4 h-4 mr-2" />{t("Save Preset", "保存预设")}
            </button>
            {Object.keys(abPresets).length > 0 && (
              <button onClick={() => { const names = Object.keys(abPresets); const name = prompt(t("Delete preset: " + names.join(", "), "删除预设: " + names.join(", "))); if (name && abPresets[name]) deleteAbPreset(name); }}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 transition-colors">
                {t("Del", "删预")}
              </button>
            )}
            <div className="h-5 w-px bg-gray-300 dark:bg-gray-700"></div>
            <button onClick={() => setAbEntries([])} className={btnSecondary}><RotateCcw className="w-4 h-4 mr-2" />{t("Clear All", "清空全部")}</button>
            <button onClick={() => {
              const newId = Math.max(...abEntries.map((e) => e.id), 0) + 1;
              setAbEntryCounter(newId + 1);
              const fields = abWhitelist.length > 0 ? abWhitelist.map((f) => ({ key: f, value: "" })) : [{ key: "", value: "" }];
              setAbEntries((prev) => [...prev, { id: newId, name: "", fields, output: "", busy: false }]);
            }} className={`${btnPrimary} bg-emerald-600 hover:bg-emerald-700`}>
              <ListFilter className="w-4 h-4 mr-2" />{t("Add Entry", "添加条目")}
            </button>
          </div>
        </div>
      </div>

      {/* Entries List */}
      <div className="space-y-6">
        {abEntries.length === 0 && (
          <div className={`${cardClass} text-center text-gray-500 py-12`}>
            <Database className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p>{t('No entries yet. Click "Add Entry" to start.', '暂无条目。点击 "添加条目" 开始构建。')}</p>
          </div>
        )}

        {abEntries.map((entry, idx) => (
          <div key={entry.id} className={`${cardClass} relative border-l-4 border-l-emerald-500`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded">#{idx + 1}</span>
                <input className={`${inputClass} !w-56 text-sm`} value={entry.name} onChange={(e) => setAbEntries((prev) => prev.map((en) => en.id === entry.id ? { ...en, name: e.target.value } : en))} placeholder={t("Entry name", "条目名称")} />
              </div>
              <div className="flex items-center space-x-2">
                <button onClick={() => { setAbEntries((prev) => prev.map((en) => en.id === entry.id ? { ...en, fields: [...en.fields, { key: "", value: "" }] } : en)); }}
                  className="inline-flex items-center gap-1 text-xs font-medium rounded-lg px-2.5 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 transition-colors">
                  + {t("Field", "字段")}
                </button>
                {abEntries.length > 1 && (
                  <button onClick={() => setAbEntries((prev) => prev.filter((e) => e.id !== entry.id))}
                    className="inline-flex items-center gap-1 text-xs font-medium rounded-lg px-2.5 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 transition-colors">
                    {t("Delete", "删除")}
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500">
                    <th className="text-left py-2 px-2 font-medium w-1/3">{t("Field Key", "字段名")}</th>
                    <th className="text-left py-2 px-2 font-medium">{t("Field Value", "字段值")}</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {entry.fields.map((f, fi) => (
                    <tr key={fi} className="border-b border-gray-100 dark:border-gray-800/50">
                      <td className="py-1.5 px-2">
                        <input className={`${inputClass} !py-1.5 font-mono text-xs`} value={f.key}
                          onChange={(e) => setAbEntries((prev) => prev.map((en) => en.id === entry.id ? { ...en, fields: en.fields.map((ef, i) => i === fi ? { ...ef, key: e.target.value } : ef) } : en))}
                          placeholder="field_name" />
                      </td>
                      <td className="py-1.5 px-2">
                        <input className={`${inputClass} !py-1.5 font-mono text-xs`} value={f.value}
                          onChange={(e) => setAbEntries((prev) => prev.map((en) => en.id === entry.id ? { ...en, fields: en.fields.map((ef, i) => i === fi ? { ...ef, value: e.target.value } : ef) } : en))}
                          placeholder="value" />
                      </td>
                      <td className="py-1.5 text-center">
                        <button onClick={() => setAbEntries((prev) => prev.map((en) => en.id === entry.id ? { ...en, fields: en.fields.filter((_, i) => i !== fi) } : en))}
                          className="text-red-400 hover:text-red-600 text-xs" title={t("Remove field", "删除字段")}>&times;</button>
                      </td>
                    </tr>
                  ))}
                  {entry.fields.length === 0 && (
                    <tr><td colSpan={3} className="py-4 text-center text-gray-400 text-sm">{t('No fields. Click "+ Field" to add.', '无字段。点击 "+ 字段" 添加。')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex flex-col space-y-2 shrink-0">
                <button onClick={() => transformAbEntry(entry, idx)} disabled={entry.busy || entry.fields.length === 0}
                  className={`${btnPrimary} bg-emerald-600 hover:bg-emerald-700`}>
                  <Play className="w-4 h-4 mr-2" />{entry.busy ? t("Running...", "执行中...") : t("Transform", "转换")}
                </button>
                <button onClick={() => { navigator.clipboard.writeText(abEntryToJson(entry)).then(() => notifySucc(t("Copied!", "已复制!"))); }}
                  className="text-xs text-gray-500 hover:text-blue-600">{t("Copy JSON", "复制 JSON")}</button>
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-500 block mb-1">{t("Output", "输出结果")}</label>
                <pre className="bg-gray-900 border border-gray-800 text-yellow-300 p-3 rounded-lg text-xs font-mono overflow-auto max-h-36 min-h-[3rem]">
                  {entry.output || t("// Click Transform", "// 点击转换")}
                </pre>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Batch Transform */}
      {abEntries.length > 1 && (
        <div className="flex justify-end">
          <button onClick={batchTransformAb} className={btnPrimary}>
            <RotateCcw className="w-4 h-4 mr-2" />{t("Batch Transform All", "批量转换全部")}
          </button>
        </div>
      )}
    </div>
  );
}
