"use client";

import {
  AlertTriangle, ArrowLeftRight, Check, Database,
  ListFilter, Play, RotateCcw, SlidersHorizontal,
} from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary, btnSecondary } from "@/lib/constants";
import type { RuleSummary } from "@/lib/types";
import type { AbEntry } from "@/hooks/useApiBuilder";

interface ApiBuilderPanelProps {
  rules: RuleSummary[];
  abRuleId: string;
  abRuleFields: string[];
  abEntryCounter: number;
  abEntries: AbEntry[];
  abPresets: Record<string, AbEntry[]>;
  abName: string;
  abApiPath: string;
  abStatus: string;
  abWhitelist: string[];
  abRenamesList: Array<{ from: string; to: string }>;
  abMasked: string[];
  abRemoveNulls: boolean;
  abChangeKind: string;
  setAbEntries: (v: AbEntry[] | ((prev: AbEntry[]) => AbEntry[])) => void;
  setAbEntryCounter: (v: number | ((prev: number) => number)) => void;
  loadAbRuleFields: (ruleId: string) => Promise<void>;
  setAbRuleId: (v: string) => void;
  setAbRuleFields: (v: string[]) => void;
  setAbName: (v: string) => void;
  setAbApiPath: (v: string) => void;
  setAbStatus: (v: string) => void;
  setAbWhitelist: (v: string[] | ((prev: string[]) => string[])) => void;
  setAbRenamesList: (v: Array<{ from: string; to: string }> | ((prev: Array<{ from: string; to: string }>) => Array<{ from: string; to: string }>)) => void;
  setAbMasked: (v: string[] | ((prev: string[]) => string[])) => void;
  setAbRemoveNulls: (v: boolean) => void;
  setAbChangeKind: (v: string) => void;
  resetAbCrud: () => void;
  saveAbPreset: (name: string) => void;
  loadAbPreset: (name: string) => void;
  deleteAbPreset: (name: string) => void;
  abSaveRule: (isCreate: boolean) => Promise<void>;
  abDeleteRule: () => Promise<void>;
  transformAbEntry: (entry: AbEntry, idx: number) => Promise<void>;
  batchTransformAb: () => Promise<void>;
  abEntryToJson: (entry: AbEntry) => string;
  notifySucc: (msg: string) => void;
  notifyError: (msg: string) => void;
  t: <T>(en: T, zh: T) => T;
}

export default function ApiBuilderPanel(props: ApiBuilderPanelProps) {
  const {
    rules, abRuleId, abRuleFields, abEntries, abPresets,
    abName, abApiPath, abStatus, abWhitelist, abRenamesList, abMasked, abRemoveNulls, abChangeKind,
    setAbEntries, setAbEntryCounter,
    loadAbRuleFields, setAbRuleId, setAbRuleFields,
    setAbName, setAbApiPath, setAbStatus, setAbWhitelist, setAbRenamesList, setAbMasked,
    setAbRemoveNulls, setAbChangeKind,
    resetAbCrud, saveAbPreset, loadAbPreset, deleteAbPreset,
    abSaveRule, abDeleteRule, transformAbEntry, batchTransformAb, abEntryToJson,
    notifySucc, t,
  } = props;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold">{t("API Builder", "API 构建器")}</h1>
        <p className="text-gray-500 mt-1">{t("No-code CRUD & data builder — create, edit, delete rules, and test with visual field entries.", "无代码 CRUD 与数据构建器 —— 创建、编辑、删除规则，并使用可视化字段条目进行测试。")}</p>
      </div>

      {/* Saved Presets Tags */}
      {Object.keys(abPresets).length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500">{t("Saved presets:", "已存预设:")}</span>
          {Object.keys(abPresets).map((p) => (
            <span key={p} className="inline-flex items-center gap-1 text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800">
              <button onClick={() => loadAbPreset(p)} className="hover:underline font-mono">{p}</button>
              <button onClick={() => deleteAbPreset(p)} className="text-red-400 hover:text-red-600 ml-0.5">&times;</button>
            </span>
          ))}
        </div>
      )}

      {/* Rules Configuration */}
      <div className="flex items-center gap-2 mb-4">
        <SlidersHorizontal className="w-5 h-5 text-blue-500" />
        <h2 className="text-lg font-bold">{t("Rules Configuration", "规则配置")}</h2>
      </div>

      {/* Rule Selector */}
      <div className={cardClass}>
        <label className={labelClass}>{t("Select API Rule from Library", "从规则库选择 API 规则")}</label>
        <div className="flex items-center space-x-3">
          <select className={`${inputClass} font-mono flex-1`} value={abRuleId} onChange={(e) => loadAbRuleFields(e.target.value)}>
            <option value="">-- {t("choose a rule, or edit config below to create new", "选择规则，或在下方编辑配置以新建")} --</option>
            {rules.map((r) => <option key={r.id} value={r.id}>{r.name} — {r.api_path} (v{r.current_version})</option>)}
          </select>
          {abRuleId && (
            <button onClick={() => { setAbRuleId(""); setAbRuleFields([]); resetAbCrud(); }} className="text-sm text-gray-500 hover:text-red-500">
              {t("Clear", "清除")}
            </button>
          )}
        </div>
        {abWhitelist.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-500">{t("Rule fields:", "规则字段:")}</span>
            {abWhitelist.map((f) => (
              <span key={f} className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-mono">{f}</span>
            ))}
            <button
              onClick={() => {
                setAbEntries((prev) => prev.map((en) => ({ ...en, fields: abWhitelist.map((f) => en.fields.find((ef) => ef.key === f) || { key: f, value: "" }) })));
                notifySucc(t("All entries synced to rule fields", "所有条目已同步至规则字段"));
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 transition-colors ml-2 shrink-0"
            >
              <ArrowLeftRight className="w-3 h-3" />
              {t("Sync All Entries", "同步到所有条目")}
            </button>
          </div>
        )}
      </div>

      {/* Rule CRUD Form */}
      <div className={`${cardClass} border-l-4 border-l-blue-500`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-blue-500" />
            {abRuleId ? t("Edit Rule Configuration", "编辑规则配置") : t("New Rule Configuration", "新规则配置")}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div><label className={labelClass}>{t("Rule Name *", "规则名称 *")}</label><input className={inputClass} value={abName} onChange={(e) => setAbName(e.target.value)} placeholder={t("e.g. user-api-v1", "例如 user-api-v1")} /></div>
          <div><label className={labelClass}>{t("API Path Route *", "API 路径路由 *")}</label><input className={inputClass} value={abApiPath} onChange={(e) => setAbApiPath(e.target.value)} placeholder={t("e.g. /api/v1/users", "例如 /api/v1/users")} /></div>
          <div><label className={labelClass}>{t("Status", "状态")}</label><select className={inputClass} value={abStatus} onChange={(e) => setAbStatus(e.target.value)}><option value="draft">{t("Draft", "草稿")}</option><option value="published">{t("Published", "已发布")}</option><option value="paused">{t("Paused", "已暂停")}</option></select></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelClass}>{t("Whitelist Fields", "白名单字段")}</label>
              <button onClick={() => setAbWhitelist((prev) => [...prev, ""])} className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium">+ {t("Add", "添加")}</button>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {abWhitelist.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input className={`${inputClass} !py-1.5 font-mono text-xs`} value={f} onChange={(e) => setAbWhitelist((prev) => prev.map((w, j) => j === i ? e.target.value : w))} placeholder="field_name" />
                  <button onClick={() => setAbWhitelist((prev) => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 shrink-0">&times;</button>
                </div>
              ))}
              {abWhitelist.length === 0 && <p className="text-xs text-gray-400 py-2">{t("No whitelist fields", "无白名单字段")}</p>}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelClass}>{t("Field Renames", "字段重命名")}</label>
              <button onClick={() => setAbRenamesList((prev) => [...prev, { from: "", to: "" }])} className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium">+ {t("Add", "添加")}</button>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {abRenamesList.map((r, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input className={`${inputClass} !py-1.5 font-mono text-xs flex-1`} value={r.from} onChange={(e) => setAbRenamesList((prev) => prev.map((rn, j) => j === i ? { ...rn, from: e.target.value } : rn))} placeholder="from" />
                  <span className="text-gray-400 text-xs shrink-0">&rarr;</span>
                  <input className={`${inputClass} !py-1.5 font-mono text-xs flex-1`} value={r.to} onChange={(e) => setAbRenamesList((prev) => prev.map((rn, j) => j === i ? { ...rn, to: e.target.value } : rn))} placeholder="to" />
                  <button onClick={() => setAbRenamesList((prev) => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 shrink-0">&times;</button>
                </div>
              ))}
              {abRenamesList.length === 0 && <p className="text-xs text-gray-400 py-2">{t("No renames", "无重命名")}</p>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelClass}>{t("Mask Fields", "脱敏字段")}</label>
              <button onClick={() => setAbMasked((prev) => [...prev, ""])} className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium">+ {t("Add", "添加")}</button>
            </div>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {abMasked.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input className={`${inputClass} !py-1.5 font-mono text-xs`} value={f} onChange={(e) => setAbMasked((prev) => prev.map((m, j) => j === i ? e.target.value : m))} placeholder="field_name" />
                  <button onClick={() => setAbMasked((prev) => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 shrink-0">&times;</button>
                </div>
              ))}
              {abMasked.length === 0 && <p className="text-xs text-gray-400 py-2">{t("No mask fields", "无脱敏字段")}</p>}
            </div>
          </div>
          <div className="space-y-4">
            <label className="flex items-center space-x-2 text-sm cursor-pointer">
              <input type="checkbox" checked={abRemoveNulls} onChange={(e) => setAbRemoveNulls(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
              <span>{t("Auto-strip null values from output", "自动删除输出中的 null 值")}</span>
            </label>
            {abRuleId && (
              <div>
                <label className={labelClass}>{t("Change Kind", "变更类型")}</label>
                <select className={inputClass} value={abChangeKind} onChange={(e) => setAbChangeKind(e.target.value)}>
                  <option value="non_breaking">{t("Non-Breaking", "非破坏性变更")}</option>
                  <option value="breaking">{t("Breaking", "破坏性变更")}</option>
                  <option value="minor">{t("Minor", "小幅调整")}</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          {abRuleId && (
            <button onClick={abDeleteRule} className="inline-flex items-center justify-center rounded-lg px-4 py-2 font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 border border-transparent hover:border-red-200 transition" disabled={!!abRuleId && !abName}>
              <AlertTriangle className="w-4 h-4 mr-2" />{t("Delete Rule", "删除规则")}
            </button>
          )}
          <button onClick={() => abSaveRule(!abRuleId)} className={btnPrimary} disabled={!abName || !abApiPath}>
            {abRuleId ? <><Check className="w-4 h-4 mr-2" />{t("Update Rule", "更新规则")}</> : <><Check className="w-4 h-4 mr-2" />{t("Create New Rule", "创建新规则")}</>}
          </button>
        </div>
      </div>

      {/* Data Entries */}
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
                <label className={labelClass}>{t("Output", "输出结果")}</label>
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
