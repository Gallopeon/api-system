"use client";

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
    rules, abRuleId, abRuleFields, abEntryCounter, abEntries, abPresets,
    abName, abApiPath, abStatus, abWhitelist, abRenamesList, abMasked, abRemoveNulls, abChangeKind,
    setAbEntries, setAbEntryCounter, loadAbRuleFields,
    setAbRuleId, setAbRuleFields, setAbName, setAbApiPath, setAbStatus,
    setAbWhitelist, setAbRenamesList, setAbMasked, setAbRemoveNulls, setAbChangeKind,
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

      <ApiBuilderPresetsBar abPresets={abPresets} loadAbPreset={loadAbPreset} deleteAbPreset={deleteAbPreset} t={t} />

      <ApiBuilderRuleSection
        rules={rules} abRuleId={abRuleId} abRuleFields={abRuleFields}
        abName={abName} abApiPath={abApiPath} abStatus={abStatus}
        abWhitelist={abWhitelist} abRenamesList={abRenamesList} abMasked={abMasked}
        abRemoveNulls={abRemoveNulls} abChangeKind={abChangeKind}
        setAbRuleId={setAbRuleId} setAbRuleFields={setAbRuleFields}
        setAbName={setAbName} setAbApiPath={setAbApiPath} setAbStatus={setAbStatus}
        setAbWhitelist={setAbWhitelist} setAbRenamesList={setAbRenamesList}
        setAbMasked={setAbMasked} setAbRemoveNulls={setAbRemoveNulls} setAbChangeKind={setAbChangeKind}
        loadAbRuleFields={loadAbRuleFields} resetAbCrud={resetAbCrud}
        abSaveRule={abSaveRule} abDeleteRule={abDeleteRule}
        setAbEntries={setAbEntries} notifySucc={notifySucc} t={t}
      />

      <ApiBuilderEntriesSection
        abEntries={abEntries} abEntryCounter={abEntryCounter} abPresets={abPresets}
        abWhitelist={abWhitelist}
        setAbEntries={setAbEntries} setAbEntryCounter={setAbEntryCounter}
        saveAbPreset={saveAbPreset} loadAbPreset={loadAbPreset} deleteAbPreset={deleteAbPreset}
        abEntryToJson={abEntryToJson} transformAbEntry={transformAbEntry}
        batchTransformAb={batchTransformAb} notifySucc={notifySucc} t={t}
      />
    </div>
  );
}
