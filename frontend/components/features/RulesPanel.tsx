"use client";

import { cardClass, inputClass, labelClass, btnPrimary } from "@/lib/constants";
import type { RuleSummary } from "@/lib/types";

interface RulesPanelProps {
  rules: RuleSummary[];
  selectedRuleId: string;
  ruleName: string;
  apiPath: string;
  ruleStatus: string;
  whitelist: string;
  renames: string;
  masked: string;
  computed: string;
  conditional: string;
  gray: string;
  removeNulls: boolean;
  changeKind: string;
  busy: boolean;
  onRuleSelect: (id: string) => void;
  onCreateBlank: () => void;
  onSaveRule: (isCreate: boolean) => void;
  onDeleteRule: () => void;
  setRuleName: (v: string) => void;
  setApiPath: (v: string) => void;
  setRuleStatus: (v: string) => void;
  setWhitelist: (v: string) => void;
  setRenames: (v: string) => void;
  setMasked: (v: string) => void;
  setComputed: (v: string) => void;
  setConditional: (v: string) => void;
  setGray: (v: string) => void;
  setRemoveNulls: (v: boolean) => void;
  setChangeKind: (v: string) => void;
  canWrite: boolean;
  canPublish: boolean;
  t: <T>(en: T, zh: T) => T;
}

export default function RulesPanel({
  rules, selectedRuleId, ruleName, apiPath, ruleStatus, whitelist, renames,
  masked, computed, conditional, gray, removeNulls, changeKind, busy,
  onRuleSelect, onCreateBlank, onSaveRule, onDeleteRule,
  setRuleName, setApiPath, setRuleStatus, setWhitelist, setRenames,
  setMasked, setComputed, setConditional, setGray, setRemoveNulls, setChangeKind,
  canWrite, canPublish, t,
}: RulesPanelProps) {
  return (
    <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-8 animate-in fade-in duration-300">
      <div className="w-full md:w-1/3 flex flex-col space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">{t("Rule Library", "规则库")}</h2>
        </div>
        <div className={`${cardClass} p-2 flex flex-col overflow-hidden max-h-[70vh]`}>
          <div className="space-y-1 overflow-y-auto">
            {canWrite && (
            <button
              className="w-full text-left p-3 rounded-md border border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 text-sm font-medium text-blue-600"
              onClick={onCreateBlank}
            >
              {t("+ Create Blank Rule", "+ 创建空白规则")}
            </button>
            )}
            {rules.map((r) => (
              <button
                key={r.id}
                onClick={() => onRuleSelect(r.id)}
                className={`w-full text-left p-3 rounded-md border transition-colors ${
                  selectedRuleId === r.id
                    ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800"
                    : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                <div className="flex justify-between items-center font-medium">
                  <span>{r.name}</span>
                  <span className="text-xs bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300">
                    v{r.current_version}
                  </span>
                </div>
                <div className="text-xs text-gray-500 font-mono truncate mt-1">{r.api_path}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`w-full md:w-2/3 ${cardClass} flex flex-col`}>
        <h2 className="text-xl font-bold mb-6">
          {selectedRuleId
            ? `Edit Rule: ${ruleName}`
            : t("New Rule Configuration", "新规则配置")}
        </h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelClass}>{t("Rule Name", "规则名称")}</label>
            <input className={inputClass} value={ruleName} onChange={(e) => setRuleName(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>{t("API Path Route", "API 路径路由")}</label>
            <input className={inputClass} value={apiPath} onChange={(e) => setApiPath(e.target.value)} />
          </div>
          {selectedRuleId && canPublish && (
            <div>
              <label className={labelClass}>{t("Status", "状态")}</label>
              <select className={inputClass} value={ruleStatus} onChange={(e) => setRuleStatus(e.target.value)}>
                <option value="draft">{t("Draft", "草稿")}</option>
                <option value="published">{t("Published", "已发布")}</option>
                <option value="paused">{t("Paused", "已暂停")}</option>
              </select>
            </div>
          )}
          {selectedRuleId && (
            <div>
              <label className={labelClass}>{t("Change Kind", "变更类型")}</label>
              <select className={inputClass} value={changeKind} onChange={(e) => setChangeKind(e.target.value)}>
                <option value="breaking">{t("Breaking", "破坏性变更")}</option>
                <option value="non_breaking">{t("Non-Breaking", "非破坏性变更")}</option>
                <option value="minor">{t("Minor", "小幅调整")}</option>
              </select>
            </div>
          )}
          <div className="col-span-2">
            <label className="flex items-center space-x-2 text-sm">
              <input type="checkbox" checked={removeNulls} onChange={(e) => setRemoveNulls(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
              <span>{t("Automatically strip null values from output", "自动删除输出中的 null 值")}</span>
            </label>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex-1">
          <div>
            <label className={labelClass}>{t("Whitelist Extraction (comma separated)", "白名单提取 (逗号分隔)")}</label>
            <input className={inputClass} value={whitelist} onChange={(e) => setWhitelist(e.target.value)} placeholder={t("id, username, email", "id, username, email")} />
          </div>
          <div>
            <label className={labelClass}>{t("Field Renaming (source:target per line)", "字段重命名 (每行 source:target)")}</label>
            <textarea className={`${inputClass} font-mono`} rows={2} value={renames} onChange={(e) => setRenames(e.target.value)} placeholder="old_name:new_name" />
          </div>
          <div>
            <label className={labelClass}>{t("Mask Targets (comma separated)", "脱敏目标 (逗号分隔)")}</label>
            <input className={inputClass} value={masked} onChange={(e) => setMasked(e.target.value)} placeholder={t("password, credit_card", "password, credit_card")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t("Computed Literals (JSON)", "计算字面量 (JSON)")}</label>
              <textarea className={`${inputClass} font-mono text-xs`} rows={5} value={computed} onChange={(e) => setComputed(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t("Conditional Blocks (JSON Array)", "条件块 (JSON 数组)")}</label>
              <textarea className={`${inputClass} font-mono text-xs`} rows={5} value={conditional} onChange={(e) => setConditional(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelClass}>{t("Gray Release Weights (JSON Object)", "灰度发布权重 (JSON 对象)")}</label>
            <textarea className={`${inputClass} font-mono text-xs`} rows={4} value={gray} onChange={(e) => setGray(e.target.value)} />
          </div>
        </div>

        {canWrite && (
        <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          {selectedRuleId && (
            <button
              onClick={onDeleteRule}
              disabled={busy}
              className="inline-flex items-center justify-center rounded-lg px-4 py-2 font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 transition disabled:opacity-50 border border-transparent hover:border-red-200"
            >
              {busy ? t("Deleting...", "删除中...") : t("Delete Rule", "删除规则")}
            </button>
          )}
          <button
            onClick={() => onSaveRule(!selectedRuleId)}
            disabled={busy || !ruleName || !apiPath}
            className={btnPrimary}
          >
            {busy
              ? t("Saving...", "保存中...")
              : selectedRuleId
                ? t("Commit Update", "提交更新")
                : t("Create New Rule", "创建新规则")}
          </button>
        </div>
        )}
      </div>
    </div>
  );
}
