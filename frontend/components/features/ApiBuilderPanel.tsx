"use client";

import { Code2, CheckCircle2, Circle } from "lucide-react";
import ApiBuilderPresetsBar from "./ApiBuilderPresetsBar";
import ApiBuilderRuleSection from "./ApiBuilderRuleSection";
import ApiBuilderEntriesSection from "./ApiBuilderEntriesSection";
import type { RuleSummary } from "@/lib/types";
import type { AbEntry } from "@/hooks/useApiBuilder";

interface ApiBuilderPanelProps {
  rules: RuleSummary[];
  abRuleId: string;
  abRuleFields: string[];
  abEntryCounter: number;
  abEntries: AbEntry[];
  abPresets: Record<string, AbEntry[]>;
  abName: string; abApiPath: string; abStatus: string;
  abWhitelist: string[]; abRenamesList: Array<{ from: string; to: string }>;
  abMasked: string[]; abRemoveNulls: boolean; abChangeKind: string;
  setAbEntries: (v: AbEntry[] | ((prev: AbEntry[]) => AbEntry[])) => void;
  setAbEntryCounter: (v: number | ((prev: number) => number)) => void;
  loadAbRuleFields: (ruleId: string) => Promise<void>;
  setAbRuleId: (v: string) => void; setAbRuleFields: (v: string[]) => void;
  setAbName: (v: string) => void; setAbApiPath: (v: string) => void; setAbStatus: (v: string) => void;
  setAbWhitelist: (v: string[] | ((prev: string[]) => string[])) => void;
  setAbRenamesList: (v: Array<{ from: string; to: string }> | ((prev: Array<{ from: string; to: string }>) => Array<{ from: string; to: string }>)) => void;
  setAbMasked: (v: string[] | ((prev: string[]) => string[])) => void;
  setAbRemoveNulls: (v: boolean) => void; setAbChangeKind: (v: string) => void;
  resetAbCrud: () => void; saveAbPreset: (name: string) => void;
  loadAbPreset: (name: string) => void; deleteAbPreset: (name: string) => void;
  abSaveRule: (isCreate: boolean) => Promise<void>; abDeleteRule: () => Promise<void>;
  transformAbEntry: (entry: AbEntry, idx: number) => Promise<void>;
  batchTransformAb: () => Promise<void>; abEntryToJson: (entry: AbEntry) => string;
  canWrite: boolean; notifySucc: (msg: string) => void; notifyError: (msg: string) => void;
  t: <T>(en: T, zh: T) => T;
}

type StepState = "pending" | "active" | "done";

export default function ApiBuilderPanel(props: ApiBuilderPanelProps) {
  const { abPresets, loadAbPreset, deleteAbPreset, abName, abApiPath, abRuleId, abEntries, t } = props;

  // Compute workflow progress
  const hasRule = !!(abName && abApiPath) || !!abRuleId;
  const hasEntries = abEntries.length > 0;
  const hasOutput = abEntries.some((e) => !!e.output);

  const steps: { label: string; zh: string; state: StepState }[] = [
    { label: "Configure Rule", zh: "配置规则", state: hasRule ? "done" : "active" },
    { label: "Add Test Data", zh: "添加测试数据", state: hasOutput ? "done" : hasRule ? "active" : "pending" },
    { label: "Transform & Verify", zh: "转换验证", state: hasOutput ? "done" : hasEntries ? "active" : "pending" },
  ];

  const stepStyle: Record<StepState, string> = {
    active:  "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-sm",
    done:    "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800",
    pending: "bg-gray-50 dark:bg-zinc-800/50 text-gray-400 dark:text-zinc-500 border border-gray-100 dark:border-zinc-700/50",
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Code2 className="w-7 h-7 text-blue-500" />
          {t("API Builder", "API 构建器")}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-sm max-w-2xl">
          {t("Visually configure rules and test them with editable data entries. Import JSON, manage presets, and preview transforms — all without writing code.", "可视化配置规则并用可编辑的数据条目进行测试。支持 JSON 导入、预设管理和转换预览，无需编写代码。")}
        </p>
      </div>

      {/* Workflow steps — dynamic */}
      <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-medium flex-wrap">
        {steps.map((step, i) => (
          <span key={i} className="flex items-center gap-1.5 sm:gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-300 ${stepStyle[step.state]}`}>
              {step.state === "done" ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : step.state === "active" ? (
                <Circle className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Circle className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">{i + 1}.</span> {t(step.label, step.zh)}
            </span>
            {i < steps.length - 1 && (
              <span className={`hidden sm:inline transition-colors duration-300 ${
                step.state === "done" ? "text-emerald-400" : "text-gray-300 dark:text-zinc-600"
              }`}>→</span>
            )}
          </span>
        ))}
      </div>

      <ApiBuilderPresetsBar abPresets={abPresets} loadAbPreset={loadAbPreset} deleteAbPreset={deleteAbPreset} t={t} />

      <ApiBuilderRuleSection {...props} />

      <ApiBuilderEntriesSection {...props} />
    </div>
  );
}
