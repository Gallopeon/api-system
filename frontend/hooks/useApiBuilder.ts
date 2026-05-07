import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { parseJson } from "@/lib/utils";
import type { RuleDetail, RuleSummary, PreviewResponse } from "@/lib/types";

export interface AbEntry {
  id: number;
  name: string;
  fields: Array<{ key: string; value: string }>;
  output: string;
  busy: boolean;
}

export function useApiBuilder(
  rules: RuleSummary[],
  loadRules: () => Promise<RuleSummary[] | null>,
  loadMetrics: () => Promise<void>,
  loadAuditLogs: () => Promise<void>,
  notifyError: (msg: string) => void,
  notifySucc: (msg: string) => void,
  t: <T>(en: T, zh: T) => T,
) {
  // Rule selector
  const [abRuleId, setAbRuleId] = useState("");
  const [abRuleFields, setAbRuleFields] = useState<string[]>([]);
  const [abEntryCounter, setAbEntryCounter] = useState(2);
  const [abEntries, setAbEntries] = useState<AbEntry[]>([
    {
      id: 1, name: "", fields: [{ key: "id", value: "1" }, { key: "name", value: "" }],
      output: "", busy: false,
    },
  ]);

  // Rule CRUD form
  const [abName, setAbName] = useState("");
  const [abApiPath, setAbApiPath] = useState("");
  const [abStatus, setAbStatus] = useState("draft");
  const [abWhitelist, setAbWhitelist] = useState<string[]>([]);
  const [abRenamesList, setAbRenamesList] = useState<Array<{ from: string; to: string }>>([]);
  const [abMasked, setAbMasked] = useState<string[]>([]);
  const [abRemoveNulls, setAbRemoveNulls] = useState(false);
  const [abChangeKind, setAbChangeKind] = useState("non_breaking");

  // Presets
  const AB_STORAGE = "apibuilder_presets";
  const [abPresets, setAbPresets] = useState<Record<string, AbEntry[]>>({});

  // Load presets from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AB_STORAGE);
      if (saved) setAbPresets(JSON.parse(saved));
    } catch (e) { console.error("Failed to load presets from localStorage:", e); }
  }, []);

  // Auto-save to localStorage
  useEffect(() => {
    try { localStorage.setItem(AB_STORAGE, JSON.stringify(abPresets)); } catch (e) { console.error("Failed to save presets to localStorage:", e); }
  }, [abPresets, AB_STORAGE]);

  const resetAbCrud = useCallback(() => {
    setAbName(""); setAbApiPath(""); setAbStatus("draft");
    setAbWhitelist([]); setAbRenamesList([]); setAbMasked([]);
    setAbRemoveNulls(false); setAbChangeKind("non_breaking");
  }, []);

  const saveAbPreset = useCallback((name: string) => {
    if (!name.trim()) { notifyError(t("Preset name required", "预设名称不能为空")); return; }
    const clean = abEntries.map((en) => ({ ...en, busy: false }));
    setAbPresets((prev) => ({ ...prev, [name.trim()]: clean }));
    notifySucc(t(`Preset "${name.trim()}" saved`, `预设 "${name.trim()}" 已保存`));
  }, [abEntries, notifyError, notifySucc, t]);

  const loadAbPreset = useCallback((name: string) => {
    const preset = abPresets[name];
    if (!preset) return;
    const maxId = Math.max(...preset.map((e) => e.id), 0);
    setAbEntryCounter(maxId + 1);
    setAbEntries(preset);
    notifySucc(t(`Preset "${name}" loaded`, `预设 "${name}" 已加载`));
  }, [abPresets, notifySucc, t]);

  const deleteAbPreset = useCallback((name: string) => {
    setAbPresets((prev) => { const n = { ...prev }; delete n[name]; return n; });
    notifySucc(t(`Preset "${name}" deleted`, `预设 "${name}" 已删除`));
  }, [notifySucc, t]);

  const loadAbRuleFields = useCallback(async (ruleId: string) => {
    setAbRuleId(ruleId);
    if (!ruleId) { setAbRuleFields([]); resetAbCrud(); return; }
    try {
      const res = await apiFetch(`/admin/v1/rules/${ruleId}`);
      if (!res.ok) throw new Error(`Fetch rule failed (${res.status})`);
      const d = (await res.json()) as RuleDetail;
      const c = d.config || {};
      const fields = c.whitelist_fields || [];
      const loadedRenames: Array<{ from: string; to: string }> = [];
      if (c.renames && typeof c.renames === "object") {
        for (const [from, to] of Object.entries(c.renames)) {
          if (from) loadedRenames.push({ from, to: String(to ?? "") });
        }
      }
      setAbRuleFields(fields);
      setAbName(d.name); setAbApiPath(d.api_path); setAbStatus(d.status);
      setAbWhitelist(fields);
      setAbMasked(c.masked_fields || []);
      setAbRenamesList(loadedRenames);
      setAbRemoveNulls(!!c.remove_nulls);
      // Auto-populate first entry with rule fields
      if (fields.length > 0) {
        setAbEntries((prev) =>
          prev.map((en, i) =>
            i === 0
              ? { ...en, fields: fields.map((f) => en.fields.find((ef) => ef.key === f) || { key: f, value: "" }) }
              : en,
          ),
        );
      }
      notifySucc(t(`Loaded rule "${d.name}"`, `已加载规则 "${d.name}"`));
    } catch (e) { notifyError((e as Error).message); }
  }, [resetAbCrud, notifyError, notifySucc, t]);

  const abSaveRule = useCallback(async (isCreate: boolean) => {
    if (!abName || !abApiPath) { notifyError(t("Name and API Path are required", "规则名称和 API 路径为必填项")); return; }
    try {
      const config = {
        whitelist_fields: abWhitelist,
        renames: Object.fromEntries(abRenamesList.filter((r) => r.from && r.to).map((r) => [r.from, r.to])),
        masked_fields: abMasked,
        computed_literals: {},
        conditional_rules: [],
        gray_release: null,
        remove_nulls: abRemoveNulls,
      };
      const payload: Record<string, unknown> = {
        name: abName, api_path: abApiPath, status: abStatus,
        actor: "panel", note: `${isCreate ? "Created" : "Updated"} via API Builder`, change_kind: abChangeKind,
        config,
      };
      const r = await apiFetch(isCreate ? "/admin/v1/rules" : `/admin/v1/rules/${abRuleId}`, {
        method: isCreate ? "POST" : "PUT", body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error((await r.json())?.message || t(`Failed (${r.status})`, `失败 (${r.status})`));
      notifySucc(isCreate ? t("Rule created!", "规则已创建！") : t("Rule updated!", "规则已更新！"));
      await loadRules();
      await loadMetrics();
      await loadAuditLogs();
      if (isCreate) {
        const d = (await r.json()) as { id: string };
        setAbRuleId(d.id);
      }
    } catch (e) { notifyError((e as Error).message); }
  }, [abName, abApiPath, abStatus, abWhitelist, abRenamesList, abMasked, abRemoveNulls, abChangeKind, abRuleId, loadRules, loadMetrics, loadAuditLogs, notifyError, notifySucc, t]);

  const abDeleteRule = useCallback(async () => {
    if (!abRuleId) return;
    if (!confirm(t("Delete this rule?", "确定删除此规则？"))) return;
    try {
      const r = await apiFetch(`/admin/v1/rules/${abRuleId}`, { method: "DELETE" });
      if (!r.ok) throw new Error(t("Delete failed", "删除失败"));
      notifySucc(t("Rule deleted!", "规则已删除！"));
      setAbRuleId(""); setAbRuleFields([]); resetAbCrud();
      await loadRules(); await loadMetrics(); await loadAuditLogs();
    } catch (e) { notifyError((e as Error).message); }
  }, [abRuleId, resetAbCrud, loadRules, loadMetrics, loadAuditLogs, notifyError, notifySucc, t]);

  const abEntryToJson = useCallback((entry: AbEntry) => {
    const obj: Record<string, string> = {};
    entry.fields.forEach((f) => { if (f.key.trim()) obj[f.key.trim()] = f.value; });
    return JSON.stringify(obj);
  }, []);

  const transformAbEntry = useCallback(async (entry: AbEntry, idx: number) => {
    setAbEntries((prev) => prev.map((en) => (en.id === entry.id ? { ...en, busy: true } : en)));
    try {
      const body = { input: parseJson(abEntryToJson(entry), {}), traffic_context: null, actor: "panel", rule_id: abRuleId || undefined };
      const r = await apiFetch("/admin/v1/transform/preview", { method: "POST", body: JSON.stringify(body) });
      if (!r.ok) throw new Error(t("Transform failed", "转换失败"));
      const d = (await r.json()) as PreviewResponse;
      setAbEntries((prev) => prev.map((en) => en.id === entry.id ? { ...en, output: JSON.stringify(d, null, 2), busy: false } : en));
      notifySucc(t(`Entry "${entry.name || `#${idx + 1}`}" OK`, `条目 "${entry.name || `#${idx + 1}`}" 完成`));
    } catch (e) {
      notifyError((e as Error).message);
      setAbEntries((prev) => prev.map((en) => en.id === entry.id ? { ...en, busy: false } : en));
    }
  }, [abRuleId, abEntryToJson, notifyError, notifySucc, t]);

  const batchTransformAb = useCallback(async () => {
    setAbEntries((prev) => prev.map((en) => ({ ...en, busy: true })));
    let ok = 0; let fail = 0;
    for (const entry of abEntries) {
      if (entry.fields.length === 0) { fail++; continue; }
      try {
        const body = { input: parseJson(abEntryToJson(entry), {}), traffic_context: null, actor: "panel", rule_id: abRuleId || undefined };
        const r = await apiFetch("/admin/v1/transform/preview", { method: "POST", body: JSON.stringify(body) });
        if (r.ok) {
          const d = (await r.json()) as PreviewResponse;
          setAbEntries((prev) => prev.map((en) => en.id === entry.id ? { ...en, output: JSON.stringify(d, null, 2), busy: false } : en));
          ok++;
        } else { fail++; setAbEntries((prev) => prev.map((en) => en.id === entry.id ? { ...en, busy: false } : en)); }
      } catch (e) { fail++; setAbEntries((prev) => prev.map((en) => en.id === entry.id ? { ...en, busy: false } : en)); console.error("batch transform entry failed:", e); }
    }
    if (fail === 0) notifySucc(t(`All ${ok} entries OK`, `全部 ${ok} 个条目成功`));
    else notifyError(t(`${ok} ok, ${fail} failed`, `${ok} 成功, ${fail} 失败`));
  }, [abEntries, abRuleId, abEntryToJson, notifyError, notifySucc, t]);

  return {
    abRuleId, abRuleFields, abEntryCounter, abEntries, abPresets,
    abName, abApiPath, abStatus, abWhitelist, abRenamesList, abMasked, abRemoveNulls, abChangeKind,
    setAbRuleId, setAbRuleFields, setAbEntryCounter, setAbEntries,
    setAbName, setAbApiPath, setAbStatus, setAbWhitelist, setAbRenamesList, setAbMasked, setAbRemoveNulls, setAbChangeKind,
    resetAbCrud, saveAbPreset, loadAbPreset, deleteAbPreset,
    loadAbRuleFields, abSaveRule, abDeleteRule, abEntryToJson,
    transformAbEntry, batchTransformAb,
  };
}
