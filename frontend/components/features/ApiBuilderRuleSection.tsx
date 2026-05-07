"use client";

import { ArrowLeftRight, AlertTriangle, Check, SlidersHorizontal } from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary } from "@/lib/constants";
import type { RuleSummary } from "@/lib/types";
import type { AbEntry } from "@/hooks/useApiBuilder";

interface ApiBuilderRuleSectionProps {
  rules: RuleSummary[];
  abRuleId: string;
  abRuleFields: string[];
  abName: string;
  abApiPath: string;
  abStatus: string;
  abWhitelist: string[];
  abRenamesList: Array<{ from: string; to: string }>;
  abMasked: string[];
  abRemoveNulls: boolean;
  abChangeKind: string;
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
  loadAbRuleFields: (ruleId: string) => Promise<void>;
  resetAbCrud: () => void;
  abSaveRule: (isCreate: boolean) => Promise<void>;
  abDeleteRule: () => Promise<void>;
  setAbEntries: (v: AbEntry[] | ((prev: AbEntry[]) => AbEntry[])) => void;
  notifySucc: (msg: string) => void;
  t: <T>(en: T, zh: T) => T;
}

export default function ApiBuilderRuleSection(props: ApiBuilderRuleSectionProps) {
  const {
    rules, abRuleId, abRuleFields, abName, abApiPath, abStatus,
    abWhitelist, abRenamesList, abMasked, abRemoveNulls, abChangeKind,
    setAbRuleId, setAbRuleFields, setAbName, setAbApiPath, setAbStatus,
    setAbWhitelist, setAbRenamesList, setAbMasked, setAbRemoveNulls, setAbChangeKind,
    loadAbRuleFields, resetAbCrud, abSaveRule, abDeleteRule, setAbEntries, notifySucc, t,
  } = props;

  return (
    <div className="space-y-6">
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
    </div>
  );
}
