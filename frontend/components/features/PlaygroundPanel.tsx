"use client";

import { useState } from "react";
import {
  Play, RotateCcw, Database, Share2, Code2, Terminal, ListFilter, X,
  CheckCircle2, XCircle, Loader2, Copy, ChevronDown, ChevronRight, Trash2,
  Zap, Braces, Activity, FlaskConical,
} from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary, btnSecondary } from "@/lib/constants";
import type { PlaygroundEntry, RuleSummary } from "@/lib/types";

interface PlaygroundPanelProps {
  pgEntries: PlaygroundEntry[];
  forceVar: string;
  selectedRuleId: string;
  busy: boolean;
  rules: RuleSummary[];
  expr: string;
  exprIn: string;
  exprOut: string;
  setPgEntries: (v: PlaygroundEntry[] | ((prev: PlaygroundEntry[]) => PlaygroundEntry[])) => void;
  setForceVar: (v: string) => void;
  setSelectedRuleId: (v: string) => void;
  addEntry: () => void;
  removeEntry: (id: number) => void;
  onBatchTransform: () => void;
  setExpr: (v: string) => void;
  setExprIn: (v: string) => void;
  onTestExpr: () => void;
  onTransformEntry: (entry: PlaygroundEntry, idx: number) => Promise<void>;
  canExecute: boolean;
  notifyError: (m: string) => void;
  notifySucc: (m: string) => void;
  t: <T>(en: T, zh: T) => T;
}

function fmtOutput(raw: unknown): string {
  if (typeof raw === "string") {
    try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
  }
  return JSON.stringify(raw, null, 2);
}

const ExprResult = ({ out, t }: { out: string; t: PlaygroundPanelProps["t"] }) => {
  if (out === "-") return null;
  const ok = out === "TRUE";
  const fail = out === "FALSE";
  const isResult = ok || fail;
  return (
    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border ${
      ok ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800" :
      fail ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800" :
      "bg-gray-50 dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700"
    }`}>
      {isResult && (
        ok ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-red-500" />
      )}
      <span className={`text-lg font-black font-mono ${ok ? "text-emerald-600 dark:text-emerald-400" : fail ? "text-red-600 dark:text-red-400" : "text-gray-600 dark:text-gray-400"}`}>
        {out === "TRUE" ? t("TRUE", "真") : out === "FALSE" ? t("FALSE", "假") : out}
      </span>
    </div>
  );
};

export default function PlaygroundPanel({
  pgEntries, forceVar, selectedRuleId, busy, rules,
  expr, exprIn, exprOut,
  setPgEntries, setForceVar, setSelectedRuleId,
  addEntry, removeEntry, onBatchTransform, onTransformEntry,
  setExpr, setExprIn, onTestExpr,
  canExecute, notifyError, notifySucc, t,
}: PlaygroundPanelProps) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const toggle = (id: number) => setCollapsed((prev) => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const selectedRule = rules.find((r) => r.id === selectedRuleId);
  const doneCount = pgEntries.filter((e) => e.output).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <FlaskConical className="w-7 h-7 text-purple-500" />
            {t("Simulator & Playground", "模拟工作台")}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-sm">
            {t("Test transform rules against mock payloads in a sandboxed environment.", "在沙盒环境中用模拟数据测试转换规则，实时验证规则效果。")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Data Entries (3/5 width) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Rule Selector */}
          <div className={`${cardClass} !p-4`}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400 shrink-0 flex items-center gap-1.5">
                <Share2 className="w-4 h-4" />
                {t("Linked Rule", "关联规则")}
              </label>
              <select
                className={`${inputClass} sm:max-w-sm`}
                value={selectedRuleId}
                onChange={(e) => setSelectedRuleId(e.target.value)}
              >
                <option value="">— {t("Optional — select to activate rule config", "可选 — 选择后启用规则配置")} —</option>
                {rules.map((r) => (
                  <option key={r.id} value={r.id}>{r.name} — {r.api_path} (v{r.current_version})</option>
                ))}
              </select>
              {selectedRule && (
                <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-full font-medium shrink-0">
                  {selectedRule.name} v{selectedRule.current_version}
                </span>
              )}
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t("Test Cases", "测试用例")}
              </span>
              <span className="text-xs text-gray-400 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                {pgEntries.length}
              </span>
              {doneCount > 0 && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />{doneCount} {t("done", "已完成")}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {canExecute && (
                <button onClick={addEntry} className={`${btnSecondary} !text-sm`}>
                  <ListFilter className="w-4 h-4 mr-1.5" />
                  {t("Add Entry", "添加用例")}
                </button>
              )}
              {canExecute && pgEntries.length > 1 && (
                <button onClick={onBatchTransform} disabled={busy} className={btnPrimary}>
                  {busy
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" />{t("Running...", "批量执行中")}</>
                    : <><Zap className="w-4 h-4 mr-1.5" />{t("Run All", "批量执行")}</>}
                </button>
              )}
            </div>
          </div>

          {/* Empty state */}
          {pgEntries.length === 0 && (
            <div className={`${cardClass} text-center py-16 text-gray-400`}>
              <Database className="w-14 h-14 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">{t("No test cases", "暂无测试用例")}</p>
              <p className="text-sm mt-1">{t("Click 'Add Entry' to create a mock payload for testing.", "点击「添加用例」创建模拟数据进行测试。")}</p>
            </div>
          )}

          {/* Entry Cards */}
          <div className="space-y-3">
            {pgEntries.map((entry, idx) => {
              const isCollapsed = collapsed.has(entry.id);
              const hasOutput = !!entry.output;

              return (
                <div key={entry.id} className={`${cardClass} !p-0 overflow-hidden ${entry.busy ? "animate-pulse" : ""}`}>
                  {/* Card Header */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                    onClick={() => toggle(entry.id)}
                  >
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
                      onChange={(e) => setPgEntries((prev) => prev.map((en) => en.id === entry.id ? { ...en, name: e.target.value } : en))}
                      placeholder={t("Untitled", "未命名用例")}
                      onClick={(e) => e.stopPropagation()}
                    />
                    {entry.busy && <Loader2 className="w-4 h-4 animate-spin text-blue-500 shrink-0" />}
                    {hasOutput && !entry.busy && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {canExecute && !entry.busy && (
                        <button
                          onClick={() => onTransformEntry(entry, idx)}
                          className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20 transition-colors"
                          title={t("Run this entry", "执行此用例")}
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      {hasOutput && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(entry.output);
                            notifySucc(t("Copied!", "已复制！"));
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                          title={t("Copy output", "复制输出")}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {pgEntries.length > 1 && (
                        <button
                          onClick={() => removeEntry(entry.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title={t("Remove entry", "移除此用例")}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card Body (collapsible) */}
                  {!isCollapsed && (
                    <div className="px-4 pb-4 space-y-3 border-t border-gray-100 dark:border-zinc-800">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">
                            <Braces className="w-3 h-3 inline mr-1" />
                            {t("Mock Body (JSON)", "模拟响应体 (JSON)")}
                          </label>
                          <textarea
                            className={`${inputClass} font-mono text-xs`}
                            rows={5}
                            value={entry.body}
                            onChange={(e) => setPgEntries((prev) => prev.map((en) => en.id === entry.id ? { ...en, body: e.target.value } : en))}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">
                            <Activity className="w-3 h-3 inline mr-1" />
                            {t("Traffic Context (JSON)", "流量上下文 (JSON)")}
                          </label>
                          <textarea
                            className={`${inputClass} font-mono text-xs`}
                            rows={5}
                            value={entry.traffic}
                            onChange={(e) => setPgEntries((prev) => prev.map((en) => en.id === entry.id ? { ...en, traffic: e.target.value } : en))}
                          />
                        </div>
                      </div>

                      {/* Output */}
                      {entry.output && (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              {t("Transform Result", "转换结果")}
                            </label>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(entry.output);
                                notifySucc(t("Copied!", "已复制！"));
                              }}
                              className="text-xs text-gray-400 hover:text-blue-500 flex items-center gap-1"
                            >
                              <Copy className="w-3 h-3" />
                              {t("Copy", "复制")}
                            </button>
                          </div>
                          <pre className="bg-zinc-900 dark:bg-black border border-zinc-700 text-emerald-400 p-4 rounded-xl text-xs font-mono overflow-auto max-h-56 whitespace-pre-wrap leading-relaxed">
                            {fmtOutput(entry.output)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Controls + Expression Evaluator (2/5 width) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Global settings card */}
          {canExecute && (
            <div className={cardClass}>
              <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-amber-500" />
                {t("Global Settings", "全局设置")}
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">
                    {t("Force Variant", "强制变体")}
                  </label>
                  <input
                    className={inputClass}
                    value={forceVar}
                    onChange={(e) => setForceVar(e.target.value)}
                    placeholder="expA"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    {t("Override gray release variant for deterministic testing. Leave empty for auto-selection.", "覆盖灰度发布变体选择。留空则自动分配。")}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Expression Evaluator */}
          <div className={`${cardClass} !border-l-4 !border-l-purple-500`}>
            <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
              <Terminal className="w-4 h-4 text-purple-500" />
              {t("Expression Evaluator", "表达式评估器")}
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              {t("Test boolean expressions in isolation to verify conditional rule logic.", "独立测试布尔表达式，验证条件规则的逻辑是否正确。")}
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">
                  {t("Expression", "表达式")}
                </label>
                <input
                  className={`${inputClass} font-mono text-purple-600 dark:text-purple-400 font-medium`}
                  value={expr}
                  onChange={(e) => setExpr(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">
                  {t("Mock Input (JSON)", "模拟输入 (JSON)")}
                </label>
                <textarea
                  className={`${inputClass} font-mono text-xs`}
                  rows={4}
                  value={exprIn}
                  onChange={(e) => setExprIn(e.target.value)}
                />
              </div>
              <button onClick={onTestExpr} className={`${btnPrimary} !bg-purple-600 hover:!bg-purple-700 w-full`}>
                <Code2 className="w-4 h-4 mr-1.5" />
                {t("Evaluate", "执行评估")}
              </button>
              <ExprResult out={exprOut} t={t} />
            </div>
          </div>

          {/* Help card */}
          <div className={`${cardClass} !bg-blue-50/50 dark:!bg-blue-950/10 border-blue-100 dark:border-blue-900/30`}>
            <h4 className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-2">
              {t("Tips", "使用提示")}
            </h4>
            <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1.5 leading-relaxed">
              <li>· {t("Add multiple entries to test different scenarios.", "添加多个用例以测试不同场景。")}</li>
              <li>· {t("Link a rule to apply its transform pipeline.", "关联规则以应用其转换管线。")}</li>
              <li>· {t("Use the Expression Evaluator to debug conditional rule logic.", "使用表达式评估器调试条件规则逻辑。")}</li>
              <li>· {t("Output can be copied with one click.", "输出结果支持一键复制。")}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
