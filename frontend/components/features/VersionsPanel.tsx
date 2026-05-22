"use client";

import { useState } from "react";
import { RotateCcw, ArrowLeftRight, GitBranch, History, Plus, Minus, Pencil, Clock, AlertTriangle } from "lucide-react";
import { cardClass, inputClass, btnPrimary, btnSecondary, badgeClass } from "@/lib/constants";
import type { RuleVersion, RuleSummary, RuleDiffResponse } from "@/lib/types";

interface VersionsPanelProps {
  selectedRuleId: string;
  rules: RuleSummary[];
  versions: RuleVersion[];
  fromVer: string;
  toVer: string;
  rollbackVer: string;
  diffJson: string;
  diffResult: RuleDiffResponse | null;
  onSelectRule: (id: string) => void;
  onRollback: () => void;
  onComputeDiff: () => void;
  setFromVer: (v: string) => void;
  setToVer: (v: string) => void;
  setRollbackVer: (v: string) => void;
  canPublish: boolean;
  t: <T>(en: T, zh: T) => T;
}

const kindLabel: Record<string, { en: string; zh: string; cls: string }> = {
  breaking:     { en: "Breaking", zh: "破坏性变更", cls: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" },
  non_breaking: { en: "Compatible", zh: "兼容变更", cls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" },
  minor:        { en: "Minor", zh: "小幅调整", cls: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400" },
  rollback:     { en: "Rollback", zh: "回滚恢复", cls: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" },
};

const changeTypeMeta: Record<string, { icon: React.ReactNode; en: string; zh: string; cls: string }> = {
  added:    { icon: <Plus className="w-3.5 h-3.5" />, en: "Added", zh: "新增", cls: "border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20" },
  removed:  { icon: <Minus className="w-3.5 h-3.5" />, en: "Removed", zh: "移除", cls: "border-l-red-500 bg-red-50/50 dark:bg-red-950/20" },
  modified: { icon: <Pencil className="w-3.5 h-3.5" />, en: "Modified", zh: "修改", cls: "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20" },
};

function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  return JSON.stringify(v, null, 1);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function VersionsPanel({
  selectedRuleId, rules, versions, fromVer, toVer, rollbackVer, diffJson, diffResult,
  onSelectRule, onRollback, onComputeDiff,
  setFromVer, setToVer, setRollbackVer, canPublish, t,
}: VersionsPanelProps) {
  const [confirmRollback, setConfirmRollback] = useState(false);

  const selectedRule = rules.find((r) => r.id === selectedRuleId);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          {t("Version History & Diff", "版本历史与差异对比")}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-sm">
          {t("Browse rule versions, compare changes side-by-side, and rollback with one click.", "浏览规则的历史版本，对比差异，一键回滚。")}
        </p>
      </div>

      {/* Rule Selector */}
      <div className={`${cardClass} !p-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="text-sm font-medium text-gray-500 dark:text-gray-400 shrink-0 flex items-center gap-1.5">
            <GitBranch className="w-4 h-4" />
            {t("Target Rule", "目标规则")}
          </label>
          <select
            className={`${inputClass} sm:max-w-sm`}
            value={selectedRuleId}
            onChange={(e) => onSelectRule(e.target.value)}
          >
            <option value="">— {t("Select a rule to begin", "请选择一条规则")} —</option>
            {rules.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} — {r.api_path} (v{r.current_version})
              </option>
            ))}
          </select>
        </div>
      </div>

      {!selectedRuleId ? (
        <div className={`${cardClass} text-center py-16 text-gray-400`}>
          <History className="w-14 h-14 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">{t("No rule selected", "未选择规则")}</p>
          <p className="text-sm mt-1">{t("Pick a rule above to explore its version history.", "在上方选择一条规则以查看其版本历史。")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Left: Version Timeline ── */}
          <div className={`${cardClass} !p-0 overflow-hidden`}>
            <div className="px-5 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-500" />
                  {t("Version Timeline", "版本时间线")}
                </h2>
                {selectedRule && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {selectedRule.name} · {t("current", "当前")}: v{selectedRule.current_version}
                  </p>
                )}
              </div>
              <span className="text-xs text-gray-400 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                {versions.length} {t("versions", "个版本")}
              </span>
            </div>

            <div className="px-5 py-2 max-h-[60vh] overflow-y-auto">
              {/* Rollback selector */}
              {canPublish && versions.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-2 mb-4 mt-2">
                  <select
                    className={`${inputClass} text-sm`}
                    value={rollbackVer}
                    onChange={(e) => { setRollbackVer(e.target.value); setConfirmRollback(false); }}
                  >
                    {versions.map((v) => (
                      <option key={v.version} value={v.version}>
                        v{v.version} — {fmtDate(v.created_at)}
                      </option>
                    ))}
                  </select>
                  {!confirmRollback ? (
                    <button onClick={() => setConfirmRollback(true)} className={`${btnPrimary} !bg-amber-600 hover:!bg-amber-700 shrink-0 whitespace-nowrap`}>
                      <RotateCcw className="w-4 h-4 mr-1.5" />
                      {t("Rollback", "回滚")}
                    </button>
                  ) : (
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => { onRollback(); setConfirmRollback(false); }} className={`${btnPrimary} !bg-red-600 hover:!bg-red-700 whitespace-nowrap`}>
                        <AlertTriangle className="w-4 h-4 mr-1.5" />
                        {t("Confirm", "确认回滚")}
                      </button>
                      <button onClick={() => setConfirmRollback(false)} className={btnSecondary}>
                        {t("Cancel", "取消")}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Timeline */}
              {versions.length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">{t("No version history yet.", "暂无版本历史。")}</p>
              ) : (
                <div className="relative ml-1">
                  {/* Vertical line */}
                  <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gray-200 dark:bg-zinc-700" />

                  <div className="space-y-1">
                    {versions.map((v, i) => {
                      const k = kindLabel[v.change_kind] || kindLabel.minor;
                      const isCurrent = v.version === (selectedRule?.current_version || 0);
                      const isOldest = i === versions.length - 1;

                      return (
                        <div key={v.version} className="relative flex items-start gap-3 py-2 pl-7 group">
                          {/* Dot */}
                          <div className={`absolute left-0 top-3 w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center z-10 ${
                            isCurrent
                              ? "border-blue-500 bg-blue-100 dark:bg-blue-900/40"
                              : "border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900"
                          }`}>
                            <div className={`w-2.5 h-2.5 rounded-full ${isCurrent ? "bg-blue-500" : "bg-gray-300 dark:bg-zinc-500"}`} />
                          </div>

                          {/* Content */}
                          <div className={`flex-1 min-w-0 rounded-lg p-3 border transition-colors ${
                            isCurrent
                              ? "border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20"
                              : "border-transparent hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                          }`}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-gray-900 dark:text-gray-100 font-mono">
                                v{v.version}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${k.cls}`}>
                                {t(k.en, k.zh)}
                              </span>
                              {isCurrent && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                                  {t("Current", "当前")}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
                              <Clock className="w-3 h-3" />
                              {fmtDate(v.created_at)}
                            </div>
                            {v.note && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{v.note}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Diff Visualizer ── */}
          <div className={`${cardClass} !p-0 overflow-hidden flex flex-col`}>
            <div className="px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
              <h2 className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-purple-500" />
                {t("Diff Comparison", "差异对比")}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {t("Select two versions and compare their differences.", "选择两个版本进行差异对比。")}
              </p>
            </div>

            <div className="p-5 space-y-4 flex-1">
              {/* Version selectors */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <select className={inputClass} value={fromVer} onChange={(e) => setFromVer(e.target.value)}>
                  {versions.map((v) => <option key={v.version} value={v.version}>v{v.version}</option>)}
                </select>
                <ArrowLeftRight className="w-4 h-4 text-gray-400 hidden sm:block shrink-0 mx-1" />
                <select className={inputClass} value={toVer} onChange={(e) => setToVer(e.target.value)}>
                  {versions.map((v) => <option key={v.version} value={v.version}>v{v.version}</option>)}
                </select>
                <button onClick={onComputeDiff} className={`${btnPrimary} shrink-0`}>
                  <ArrowLeftRight className="w-4 h-4 mr-1.5" />
                  {t("Compare", "开始对比")}
                </button>
              </div>

              {/* Diff result */}
              {diffResult ? (
                <div className="space-y-3">
                  {/* Summary */}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {t("Result", "对比结果")}
                    </span>
                    <span className="text-xs text-gray-400">
                      v{diffResult.from} → v{diffResult.to}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-auto ${
                      diffResult.changes_count === 0
                        ? "bg-gray-100 dark:bg-zinc-800 text-gray-500"
                        : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                    }`}>
                      {diffResult.changes_count === 0
                        ? t("Identical", "无差异")
                        : `${diffResult.changes_count} ${t("changes", "处变更")}`}
                    </span>
                  </div>

                  {diffResult.changes_count === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-3">
                        <ArrowLeftRight className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-medium">{t("No differences", "完全一致")}</p>
                      <p className="text-xs mt-1">{t("These two versions have identical configurations.", "两个版本的配置完全相同。")}</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                      {diffResult.changes.map((ch, i) => {
                        const meta = changeTypeMeta[ch.change_type] || changeTypeMeta.modified;
                        return (
                          <div key={i} className={`border-l-4 rounded-r-lg p-3 ${meta.cls}`}>
                            <div className="flex items-center gap-1.5 mb-2">
                              <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                                ch.change_type === "added"
                                  ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                                  : ch.change_type === "removed"
                                  ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400"
                                  : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
                              }`}>
                                {meta.icon}
                                {t(meta.en, meta.zh)}
                              </span>
                              <code className="text-xs font-bold text-gray-700 dark:text-gray-300 bg-white/60 dark:bg-black/20 px-1.5 py-0.5 rounded">{ch.path}</code>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {ch.change_type !== "added" && (
                                <div>
                                  <div className="text-gray-400 mb-0.5">{t("Before", "变更前")}</div>
                                  <pre className="bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/30 rounded-lg p-2 font-mono text-red-700 dark:text-red-300 overflow-x-auto max-h-24 whitespace-pre-wrap text-[11px] leading-relaxed">{fmtValue(ch.from)}</pre>
                                </div>
                              )}
                              {ch.change_type !== "removed" && (
                                <div className={ch.change_type === "modified" ? "" : "col-span-2"}>
                                  <div className="text-gray-400 mb-0.5">{t("After", "变更后")}</div>
                                  <pre className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30 rounded-lg p-2 font-mono text-emerald-700 dark:text-emerald-300 overflow-x-auto max-h-24 whitespace-pre-wrap text-[11px] leading-relaxed">{fmtValue(ch.to)}</pre>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-center text-gray-400 py-8">
                  <div>
                    <ArrowLeftRight className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">{t("No comparison yet", "尚未对比")}</p>
                    <p className="text-xs mt-1">{t("Select two versions and click Compare.", "选择两个版本并点击「开始对比」。")}</p>
                  </div>
                </div>
              )}

              {/* Raw JSON fallback */}
              {diffJson && diffJson !== "{}" && !diffResult && (
                <details className="mt-4">
                  <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">{t("Raw JSON (debug)", "原始 JSON（调试）")}</summary>
                  <pre className="bg-gray-900 text-green-400 p-3 rounded-lg text-xs font-mono overflow-auto max-h-64 mt-2">{diffJson}</pre>
                </details>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
