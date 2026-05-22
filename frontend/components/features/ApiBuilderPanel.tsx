"use client";

import { Code2 } from "lucide-react";
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

export default function ApiBuilderPanel(props: ApiBuilderPanelProps) {
  const { abPresets, loadAbPreset, deleteAbPreset, t } = props;

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

      {/* Workflow steps indicator */}
      <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
        <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
          1. {t("Configure Rule", "配置规则")}
        </span>
        <span className="text-gray-300 dark:text-zinc-600">→</span>
        <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400">
          2. {t("Add Test Data", "添加测试数据")}
        </span>
        <span className="text-gray-300 dark:text-zinc-600">→</span>
        <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400">
          3. {t("Transform & Verify", "转换验证")}
        </span>
      </div>

      <ApiBuilderPresetsBar abPresets={abPresets} loadAbPreset={loadAbPreset} deleteAbPreset={deleteAbPreset} t={t} />

      <ApiBuilderRuleSection {...props} />

      <ApiBuilderEntriesSection {...props} />
    </div>
  );
}
