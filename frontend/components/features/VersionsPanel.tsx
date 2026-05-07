"use client";

import { RotateCcw, ArrowLeftRight } from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary } from "@/lib/constants";
import type { RuleVersion, RuleSummary } from "@/lib/types";

interface VersionsPanelProps {
  selectedRuleId: string;
  rules: RuleSummary[];
  versions: RuleVersion[];
  fromVer: string;
  toVer: string;
  rollbackVer: string;
  diffJson: string;
  onSelectRule: (id: string) => void;
  onRollback: () => void;
  onComputeDiff: () => void;
  setFromVer: (v: string) => void;
  setToVer: (v: string) => void;
  setRollbackVer: (v: string) => void;
  canPublish: boolean;
  t: <T>(en: T, zh: T) => T;
}

export default function VersionsPanel({
  selectedRuleId, rules, versions, fromVer, toVer, rollbackVer, diffJson,
  onSelectRule, onRollback, onComputeDiff,
  setFromVer, setToVer, setRollbackVer, canPublish, t,
}: VersionsPanelProps) {
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      <h1 className="text-3xl font-bold">
        {t("Rule Versions & Blueprint Diff", "规则版本与蓝图对比")}
      </h1>
      <div className={`${cardClass} flex items-end space-x-4`}>
        <div className="w-1/3">
          <label className={labelClass}>{t("Select Target Rule", "选择目标规则")}</label>
          <select className={inputClass} value={selectedRuleId} onChange={(e) => onSelectRule(e.target.value)}>
            <option value="">-- {t("select rule", "选择规则")} --</option>
            {rules.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} (v{r.current_version})
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedRuleId && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={cardClass}>
            <h3 className="font-bold mb-4">{t("Rollback Machine", "回归机器")}</h3>
            <div className="flex space-x-3 mb-6">
              <select className={inputClass} value={rollbackVer} onChange={(e) => setRollbackVer(e.target.value)}>
                {versions.map((v) => (
                  <option key={v.version} value={v.version}>
                    v{v.version} ({v.change_kind}) - {new Date(v.created_at).toLocaleString()}
                  </option>
                ))}
              </select>
              {canPublish && (
              <button onClick={onRollback} className={`${btnPrimary} bg-red-600 hover:bg-red-700 shrink-0 whitespace-nowrap`}>
                <RotateCcw className="w-4 h-4 mr-2" /> {t("Revert", "回退")}
              </button>
              )}
            </div>
            <ul className="space-y-2">
              {versions.slice(0, 5).map((v) => (
                <li key={v.version} className="text-sm p-3 bg-gray-50 border dark:bg-black/30 rounded-lg flex justify-between">
                  <div className="font-bold">
                    v{v.version}{" "}
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      v.change_kind === "breaking" ? "bg-red-100 text-red-700" :
                      v.change_kind === "non_breaking" ? "bg-green-100 text-green-700" :
                      v.change_kind === "rollback" ? "bg-yellow-100 text-yellow-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {v.change_kind}
                    </span>
                  </div>
                  <div className="text-gray-500">{new Date(v.created_at).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          </div>

          <div className={`${cardClass} flex flex-col`}>
            <h3 className="font-bold mb-4">{t("Diff Visualizer", "对比视图")}</h3>
            <div className="flex space-x-3 mb-4 items-center">
              <select className={inputClass} value={fromVer} onChange={(e) => setFromVer(e.target.value)}>
                {versions.map((v) => <option key={v.version} value={v.version}>v{v.version}</option>)}
              </select>
              <ArrowLeftRight className="text-gray-400" />
              <select className={inputClass} value={toVer} onChange={(e) => setToVer(e.target.value)}>
                {versions.map((v) => <option key={v.version} value={v.version}>v{v.version}</option>)}
              </select>
              <button onClick={onComputeDiff} className={`${btnPrimary} shrink-0 whitespace-nowrap`}>
                {t("Scan Diff", "扫描对比")}
              </button>
            </div>
            <pre className="flex-1 bg-gray-900 border border-gray-800 text-green-400 p-4 rounded-lg text-xs font-mono overflow-auto max-h-96">
              {diffJson}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
