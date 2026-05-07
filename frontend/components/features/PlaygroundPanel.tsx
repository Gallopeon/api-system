"use client";

import { ListFilter, Play, RotateCcw, Database, Share2, Code2, TerminalSquare } from "lucide-react";
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

export default function PlaygroundPanel({
  pgEntries, forceVar, selectedRuleId, busy, rules,
  expr, exprIn, exprOut,
  setPgEntries, setForceVar, setSelectedRuleId,
  addEntry, removeEntry, onBatchTransform, onTransformEntry,
  setExpr, setExprIn, onTestExpr,
  canExecute, notifyError, notifySucc, t,
}: PlaygroundPanelProps) {

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("Simulator & Playground", "测试与工作台")}</h1>
          <p className="text-gray-500 mt-1">{t("Select a rule and test transform pipelines with flexible data entries.", "选择规则并使用弹性数据条目测试转换管道。")}</p>
        </div>
        <button onClick={addEntry} className={btnSecondary}>
          <ListFilter className="w-4 h-4 mr-2" />{t("Add Entry", "添加条目")}
        </button>
      </div>

      <div className={cardClass}>
        <label className={labelClass}>{t("Link Rule from Library (Optional)", "关联规则库规则 (可选)")}</label>
        <select className={`${inputClass} font-mono`} value={selectedRuleId} onChange={(e) => setSelectedRuleId(e.target.value)}>
          <option value="">-- {t("select a rule to load its API interface", "选择规则加载其 API 接口")} --</option>
          {rules.map((r) => (
            <option key={r.id} value={r.id}>{r.name} — {r.api_path} (v{r.current_version})</option>
          ))}
        </select>
        {selectedRuleId && (
          <div className="mt-3 flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400">
            <Share2 className="w-4 h-4" />
            <span>{t("Active rule loaded. Configure data entries below.", "已加载活动规则。请在下方配置数据条目。")}</span>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {pgEntries.length === 0 && (
          <div className={`${cardClass} text-center text-gray-500 py-12`}>
            <Database className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p>{t('No data entries yet. Click "Add Entry" to start building.', '暂无数据条目。点击"添加条目"开始构建。')}</p>
          </div>
        )}
        {pgEntries.map((entry, idx) => (
          <div key={entry.id} className={`${cardClass} relative border-l-4 border-l-blue-500`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <span className="font-bold text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">#{idx + 1}</span>
                <input className={`${inputClass} !w-48 text-sm`} value={entry.name}
                  onChange={(e) => setPgEntries((prev) => prev.map((en) => en.id === entry.id ? { ...en, name: e.target.value } : en))}
                  placeholder={t("Entry name", "条目名称")} />
              </div>
              {pgEntries.length > 1 && (
                <button onClick={() => removeEntry(entry.id)} className="text-red-500 hover:text-red-600 text-sm font-medium">{t("Remove", "移除")}</button>
              )}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
              <div>
                <label className={labelClass}>{t("Mock Body (JSON)", "模拟响应体 (JSON)")}</label>
                <textarea className={`${inputClass} font-mono text-xs`} rows={5} value={entry.body}
                  onChange={(e) => setPgEntries((prev) => prev.map((en) => en.id === entry.id ? { ...en, body: e.target.value } : en))} />
              </div>
              <div>
                <label className={labelClass}>{t("Traffic Context (JSON)", "流量上下文 (JSON)")}</label>
                <textarea className={`${inputClass} font-mono text-xs`} rows={5} value={entry.traffic}
                  onChange={(e) => setPgEntries((prev) => prev.map((en) => en.id === entry.id ? { ...en, traffic: e.target.value } : en))} />
              </div>
              <div>
                <label className={labelClass}>{t("Force Variant", "强制变体")}</label>
                <input className={inputClass} value={forceVar} onChange={(e) => setForceVar(e.target.value)} placeholder="e.g. expA" />
                {canExecute && (
                <button onClick={() => onTransformEntry(entry, idx)} disabled={entry.busy}
                  className={`${btnPrimary} bg-emerald-600 hover:bg-emerald-700 w-full mt-2`}>
                  <Play className="w-4 h-4 mr-2" />
                  {entry.busy ? t("Running...", "执行中...") : t("Transform", "转换")}
                </button>
                )}
              </div>
            </div>
            {entry.output && (
              <div>
                <label className={labelClass}>{t("Output", "输出结果")}</label>
                <pre className="bg-gray-900 border border-gray-800 text-yellow-300 p-4 rounded-lg text-xs font-mono overflow-auto max-h-48">{entry.output}</pre>
              </div>
            )}
          </div>
        ))}
      </div>

      {canExecute && pgEntries.length > 1 && (
        <div className="flex justify-end">
          <button onClick={onBatchTransform} disabled={busy} className={btnPrimary}>
            <RotateCcw className={`w-4 h-4 mr-2 ${busy ? "animate-spin" : ""}`} />
            {t("Batch Transform All", "批量转换全部")}
          </button>
        </div>
      )}

      <div className="border-t border-gray-200 dark:border-gray-800 pt-6 mt-6">
        <div className={`${cardClass} flex flex-col space-y-4`}>
          <div className="flex items-center space-x-2 border-b pb-2">
            <TerminalSquare className="text-purple-500 w-5 h-5" />
            <h3 className="font-bold">{t("RhAI Expression Evaluator", "RhAI 表达式评估器")}</h3>
          </div>
          <div>
            <label className={labelClass}>{t("Logic Expression", "逻辑表达式")}</label>
            <input className={`${inputClass} font-mono text-purple-600 dark:text-purple-400 text-lg`} value={expr} onChange={(e) => setExpr(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>{t("Mock Input Object (JSON)", "模拟输入对象(JSON)")}</label>
            <textarea className={`${inputClass} font-mono text-xs`} rows={4} value={exprIn} onChange={(e) => setExprIn(e.target.value)} />
          </div>
          <button onClick={onTestExpr} className={`${btnPrimary} bg-purple-600 hover:bg-purple-700`}>
            <Code2 className="w-4 h-4 mr-2" /> {t("Evaluate RhAI Script", "计算 RhAI 脚本")}
          </button>
          <div className="mt-4 p-6 bg-gray-50 border rounded-xl flex items-center justify-between dark:bg-black/30">
            <span className="font-bold text-gray-500">{t("Evaluation Result:", "评估结果:")}</span>
            <span className={`text-2xl font-black ${exprOut === "TRUE" ? "text-green-500" : exprOut === "FALSE" ? "text-red-500" : "text-gray-400"}`}>
              {exprOut === "TRUE" ? t("TRUE", "真") : exprOut === "FALSE" ? t("FALSE", "假") : exprOut}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
