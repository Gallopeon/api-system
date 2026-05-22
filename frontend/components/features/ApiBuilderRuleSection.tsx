"use client";

import { AlertTriangle, Check, SlidersHorizontal, Plus, Trash2, X, XCircle, ArrowDownToLine } from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary, btnSecondary, btnDanger } from "@/lib/constants";
import type { RuleSummary } from "@/lib/types";
import type { AbEntry } from "@/hooks/useApiBuilder";

interface ApiBuilderRuleSectionProps {
  rules: RuleSummary[];
  abRuleId: string; abRuleFields: string[];
  abName: string; abApiPath: string; abStatus: string;
  abWhitelist: string[]; abRenamesList: Array<{ from: string; to: string }>;
  abMasked: string[]; abRemoveNulls: boolean; abChangeKind: string;
  setAbRuleId: (v: string) => void; setAbRuleFields: (v: string[]) => void;
  setAbName: (v: string) => void; setAbApiPath: (v: string) => void; setAbStatus: (v: string) => void;
  setAbWhitelist: (v: string[] | ((prev: string[]) => string[])) => void;
  setAbRenamesList: (v: Array<{ from: string; to: string }> | ((prev: Array<{ from: string; to: string }>) => Array<{ from: string; to: string }>)) => void;
  setAbMasked: (v: string[] | ((prev: string[]) => string[])) => void;
  setAbRemoveNulls: (v: boolean) => void; setAbChangeKind: (v: string) => void;
  loadAbRuleFields: (ruleId: string) => Promise<void>; resetAbCrud: () => void;
  abSaveRule: (isCreate: boolean) => Promise<void>; abDeleteRule: () => Promise<void>;
  setAbEntries: (v: AbEntry[] | ((prev: AbEntry[]) => AbEntry[])) => void;
  canWrite: boolean; notifySucc: (msg: string) => void;
  t: <T>(en: T, zh: T) => T;
}

const iconBtn = "p-1.5 rounded-lg transition-colors touch-btn";
const addBtn = "inline-flex items-center gap-1 text-xs font-medium rounded-lg px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 transition-colors";

export default function ApiBuilderRuleSection(props: ApiBuilderRuleSectionProps) {
  const {
    rules, abRuleId, abRuleFields, abName, abApiPath, abStatus,
    abWhitelist, abRenamesList, abMasked, abRemoveNulls, abChangeKind,
    setAbRuleId, setAbRuleFields, setAbName, setAbApiPath, setAbStatus,
    setAbWhitelist, setAbRenamesList, setAbMasked, setAbRemoveNulls, setAbChangeKind,
    loadAbRuleFields, resetAbCrud, abSaveRule, abDeleteRule, setAbEntries, canWrite, notifySucc, t,
  } = props;

  return (
    <div className="space-y-5">
      {/* Rule Selector */}
      <div className={`${cardClass} !p-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="text-sm font-medium text-gray-500 dark:text-gray-400 shrink-0 flex items-center gap-1.5">
            <SlidersHorizontal className="w-4 h-4" />
            {t("Rule Source", "规则来源")}
          </label>
          <select
            className={`${inputClass} sm:max-w-sm`}
            value={abRuleId}
            onChange={(e) => loadAbRuleFields(e.target.value)}
          >
            <option value="">— {t("Create new rule, or select existing", "新建规则，或选择已有规则")} —</option>
            {rules.map((r) => <option key={r.id} value={r.id}>{r.name} — {r.api_path} (v{r.current_version})</option>)}
          </select>
          {abRuleId && (
            <button
              onClick={() => { setAbRuleId(""); setAbRuleFields([]); resetAbCrud(); }}
              className="inline-flex items-center gap-1 text-xs font-medium rounded-lg px-3 py-1.5 bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 border border-gray-200 dark:border-zinc-700 transition-colors shrink-0"
            >
              <XCircle className="w-3.5 h-3.5" />
              {t("Detach & Reset", "解除并重置")}
            </button>
          )}
        </div>
        {abRuleFields.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100 dark:border-zinc-800">
            <span className="text-xs text-gray-400">{t("Detected fields:", "已识别字段:")}</span>
            {abRuleFields.map((f) => (
              <span key={f} className="text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-mono border border-blue-100 dark:border-blue-900/30">{f}</span>
            ))}
            <button
              onClick={() => {
                setAbWhitelist(abRuleFields);
                notifySucc(t("Whitelist synced from rule fields", "已从规则字段同步到白名单"));
              }}
              className="inline-flex items-center gap-1 text-[10px] font-medium rounded-lg px-2 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 border border-purple-200 dark:border-purple-800 transition-colors ml-1 shrink-0"
            >
              <ArrowDownToLine className="w-3 h-3" />
              {t("Sync to Editor", "同步到编辑器")}
            </button>
          </div>
        )}
      </div>

      {/* Rule CRUD Form */}
      {canWrite && (
      <div className={`${cardClass} !border-l-4 !border-l-blue-500 !p-0 overflow-hidden`}>
        <div className="px-5 py-4 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/30">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-blue-500" />
            {abRuleId ? t("Edit Rule", "编辑规则") : t("Create New Rule", "创建新规则")}
          </h2>
        </div>

        <div className="p-5 space-y-5">
          {/* Basic fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>{t("Rule Name", "规则名称")} <span className="text-red-500">*</span></label>
              <input className={inputClass} value={abName} onChange={(e) => setAbName(e.target.value)} placeholder="user-api-v1" />
            </div>
            <div>
              <label className={labelClass}>{t("API Path", "API 路径")} <span className="text-red-500">*</span></label>
              <input className={inputClass} value={abApiPath} onChange={(e) => setAbApiPath(e.target.value)} placeholder="/api/v1/users" />
            </div>
            <div>
              <label className={labelClass}>{t("Status", "状态")}</label>
              <select className={inputClass} value={abStatus} onChange={(e) => setAbStatus(e.target.value)}>
                <option value="draft">{t("Draft", "草稿")}</option>
                <option value="published">{t("Published", "已发布")}</option>
                <option value="paused">{t("Paused", "已暂停")}</option>
              </select>
            </div>
          </div>

          {/* Whitelist + Renames */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Whitelist */}
            <div className="border border-gray-100 dark:border-zinc-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t("Whitelist Fields", "白名单字段")}</span>
                <button onClick={() => setAbWhitelist((prev) => [...prev, ""])} className={addBtn}>
                  <Plus className="w-3 h-3" />{t("Add", "添加")}
                </button>
              </div>
              {abWhitelist.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">{t("No whitelist — all fields pass through", "无白名单 — 所有字段原样通过")}</p>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {abWhitelist.map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5 group">
                      <span className="text-[10px] text-gray-400 w-5 text-right shrink-0">{i + 1}.</span>
                      <input className={`${inputClass} !py-1.5 font-mono text-xs`} value={f} onChange={(e) => setAbWhitelist((prev) => prev.map((w, j) => j === i ? e.target.value : w))} placeholder="field_name" />
                      <button onClick={() => setAbWhitelist((prev) => prev.filter((_, j) => j !== i))} className={`${iconBtn} text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100`}><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Renames */}
            <div className="border border-gray-100 dark:border-zinc-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t("Field Renames", "字段重命名")}</span>
                <button onClick={() => setAbRenamesList((prev) => [...prev, { from: "", to: "" }])} className={addBtn}>
                  <Plus className="w-3 h-3" />{t("Add", "添加")}
                </button>
              </div>
              {abRenamesList.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">{t("No renames configured", "未配置重命名")}</p>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {abRenamesList.map((r, i) => (
                    <div key={i} className="flex items-center gap-1.5 group">
                      <span className="text-[10px] text-gray-400 w-5 text-right shrink-0">{i + 1}.</span>
                      <input className={`${inputClass} !py-1.5 font-mono text-xs flex-1`} value={r.from} onChange={(e) => setAbRenamesList((prev) => prev.map((rn, j) => j === i ? { ...rn, from: e.target.value } : rn))} placeholder="from" />
                      <span className="text-gray-400 shrink-0 text-xs">→</span>
                      <input className={`${inputClass} !py-1.5 font-mono text-xs flex-1`} value={r.to} onChange={(e) => setAbRenamesList((prev) => prev.map((rn, j) => j === i ? { ...rn, to: e.target.value } : rn))} placeholder="to" />
                      <button onClick={() => setAbRenamesList((prev) => prev.filter((_, j) => j !== i))} className={`${iconBtn} text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100`}><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Mask + Options */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Mask */}
            <div className="border border-gray-100 dark:border-zinc-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t("Mask Fields", "脱敏字段")}</span>
                <button onClick={() => setAbMasked((prev) => [...prev, ""])} className={addBtn}>
                  <Plus className="w-3 h-3" />{t("Add", "添加")}
                </button>
              </div>
              {abMasked.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">{t("No fields masked", "无脱敏字段")}</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {abMasked.map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5 group">
                      <span className="text-[10px] text-gray-400 w-5 text-right shrink-0">{i + 1}.</span>
                      <input className={`${inputClass} !py-1.5 font-mono text-xs`} value={f} onChange={(e) => setAbMasked((prev) => prev.map((m, j) => j === i ? e.target.value : m))} placeholder="field_name" />
                      <button onClick={() => setAbMasked((prev) => prev.filter((_, j) => j !== i))} className={`${iconBtn} text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100`}><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Options */}
            <div className="space-y-4 p-4 border border-gray-100 dark:border-zinc-800 rounded-xl">
              <div>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 block mb-3">{t("Options", "选项")}</span>
                <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                  <input type="checkbox" checked={abRemoveNulls} onChange={(e) => setAbRemoveNulls(e.target.checked)} className="rounded w-4 h-4 text-blue-600 focus:ring-blue-500" />
                  <span className="text-gray-600 dark:text-gray-400">{t("Auto-strip null values from output", "自动移除输出中的 null 值")}</span>
                </label>
              </div>
              {abRuleId && (
                <div>
                  <label className={labelClass}>{t("Change Kind", "变更类型")}</label>
                  <select className={inputClass} value={abChangeKind} onChange={(e) => setAbChangeKind(e.target.value)}>
                    <option value="non_breaking">{t("Non-Breaking", "兼容变更")}</option>
                    <option value="breaking">{t("Breaking", "破坏性变更")}</option>
                    <option value="minor">{t("Minor", "小幅调整")}</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-4 border-t border-gray-100 dark:border-zinc-800">
            {abRuleId && (
              <button onClick={abDeleteRule} className={btnDanger} disabled={!abName}>
                <Trash2 className="w-4 h-4 mr-1.5" />{t("Delete Rule", "删除规则")}
              </button>
            )}
            <button onClick={() => abSaveRule(!abRuleId)} className={btnPrimary} disabled={!abName || !abApiPath}>
              {abRuleId
                ? <><Check className="w-4 h-4 mr-1.5" />{t("Update Rule", "更新规则")}</>
                : <><Check className="w-4 h-4 mr-1.5" />{t("Create Rule", "创建规则")}</>}
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
