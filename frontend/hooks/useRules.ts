import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type {
  RuleSummary,
  RuleDetail,
  RuleListResponse,
  RuleVersionsResponse,
  RuleVersion,
  TransformRuleConfig,
} from "@/lib/types";
import { parseArray, parseRenames, formatRenames, parseJson } from "@/lib/utils";

export function useRules(
  notifyError: (msg: string) => void,
  notifySucc: (msg: string) => void,
) {
  const [rules, setRules] = useState<RuleSummary[]>([]);
  const [busy, setBusy] = useState(false);

  // Rule editor form state
  const [selectedRuleId, setSelectedRuleId] = useState("");
  const [ruleName, setRuleName] = useState("");
  const [apiPath, setApiPath] = useState("");
  const [ruleStatus, setRuleStatus] = useState("draft");
  const [whitelist, setWhitelist] = useState("");
  const [renames, setRenames] = useState("");
  const [masked, setMasked] = useState("");
  const [computed, setComputed] = useState("{}");
  const [conditional, setConditional] = useState("[]");
  const [gray, setGray] = useState("{}");
  const [removeNulls, setRemoveNulls] = useState(false);
  const [changeKind, setChangeKind] = useState("breaking");

  // Version state
  const [versions, setVersions] = useState<RuleVersion[]>([]);
  const [fromVer, setFromVer] = useState("");
  const [toVer, setToVer] = useState("");
  const [rollbackVer, setRollbackVer] = useState("");
  const [diffJson, setDiffJson] = useState("{}");

  const loadRules = useCallback(async () => {
    try {
      const r = await apiFetch("/admin/v1/rules?limit=50&offset=0");
      if (r.ok) {
        const d = (await r.json()) as RuleListResponse;
        setRules(d.items || []);
        return d.items;
      }
    } catch {
      /* ignore */
    }
    return null;
  }, []);

  const selectRule = useCallback(async (id: string) => {
    setSelectedRuleId(id);
    if (!id) return;
    try {
      const res = await apiFetch(`/admin/v1/rules/${id}`);
      if (res.ok) {
        const d = (await res.json()) as RuleDetail;
        setRuleName(d.name);
        setApiPath(d.api_path);
        setRuleStatus(d.status);
        const c = d.config || {};
        setWhitelist((c.whitelist_fields || []).join(", "));
        setRenames(formatRenames(c.renames));
        setMasked((c.masked_fields || []).join(", "));
        setComputed(JSON.stringify(c.computed_literals || {}, null, 2));
        setConditional(JSON.stringify(c.conditional_rules || [], null, 2));
        setGray(
          c.gray_release
            ? JSON.stringify(c.gray_release, null, 2)
            : '{\n  "enabled": false,\n  "bucket_field": "",\n  "variants": []\n}',
        );
        setRemoveNulls(!!c.remove_nulls);
      }
      const vRes = await apiFetch(`/admin/v1/rules/${id}/versions`);
      if (vRes.ok) {
        const v = (await vRes.json()) as RuleVersionsResponse;
        setVersions(v.items || []);
        if (v.items?.length > 0) {
          setFromVer(String(v.items[0].version));
          setRollbackVer(String(v.items[0].version));
          if (v.items.length > 1) setToVer(String(v.items[1].version));
          else setToVer(String(v.items[0].version));
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const buildConfig = useCallback((): TransformRuleConfig => {
    return {
      whitelist_fields: parseArray(whitelist),
      renames: parseRenames(renames),
      masked_fields: parseArray(masked),
      computed_literals: parseJson(computed, {}),
      conditional_rules: parseJson(conditional, []),
      gray_release: parseJson(gray, null),
      remove_nulls: removeNulls,
      request_validation: null,
      response_validation: null,
      cache_config: null,
    };
  }, [whitelist, renames, masked, computed, conditional, gray, removeNulls]);

  const saveRule = useCallback(
    async (isCreate: boolean) => {
      setBusy(true);
      try {
        const payload = {
          name: ruleName,
          api_path: apiPath,
          status: isCreate ? "draft" : ruleStatus,
          actor: "panel",
          note: `${isCreate ? "Create" : "Update"} from visual panel`,
          change_kind: changeKind,
          config: buildConfig(),
        };
        const r = await apiFetch(
          isCreate ? "/admin/v1/rules" : `/admin/v1/rules/${selectedRuleId}`,
          { method: isCreate ? "POST" : "PUT", body: JSON.stringify(payload) },
        );
        if (!r.ok) {
          throw new Error(
            (await r.json())?.message || `Failed (${r.status})`,
          );
        }
        notifySucc(
          isCreate ? "Rule created successfully!" : "Rule updated successfully!",
        );
        await loadRules();
        if (isCreate) {
          const d = (await r.json()) as { id: string };
          selectRule(d.id);
        } else {
          selectRule(selectedRuleId);
        }
      } catch (e) {
        notifyError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [
      ruleName, apiPath, ruleStatus, changeKind, selectedRuleId,
      buildConfig, loadRules, selectRule, notifyError, notifySucc,
    ],
  );

  const deleteRule = useCallback(async () => {
    if (!selectedRuleId) return;
    if (!confirm("Are you sure you want to delete this rule?")) return;
    setBusy(true);
    try {
      const r = await apiFetch(`/admin/v1/rules/${selectedRuleId}`, {
        method: "DELETE",
      });
      if (!r.ok) throw new Error("Delete failed");
      notifySucc("Rule deleted successfully!");
      setSelectedRuleId("");
      setRuleName("");
      setApiPath("");
      setRuleStatus("draft");
      setWhitelist("");
      setRenames("");
      setMasked("");
      setComputed("{}");
      setConditional("[]");
      setGray("{}");
      await loadRules();
    } catch (e) {
      notifyError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [selectedRuleId, loadRules, notifyError, notifySucc]);

  const computeDiff = useCallback(async () => {
    if (!selectedRuleId || !fromVer || !toVer) {
      notifyError("Select versions first");
      return;
    }
    try {
      const r = await apiFetch(
        `/admin/v1/rules/${selectedRuleId}/diff?from=${fromVer}&to=${toVer}`,
      );
      if (!r.ok) throw new Error("Diff failed");
      const d = await r.json();
      setDiffJson(JSON.stringify(d, null, 2));
      notifySucc(
        `Diff loaded: ${(d as { changes_count: number }).changes_count} changes`,
      );
    } catch (e) {
      notifyError((e as Error).message);
    }
  }, [selectedRuleId, fromVer, toVer, notifyError, notifySucc]);

  const rollback = useCallback(async () => {
    if (!selectedRuleId || !rollbackVer) return;
    try {
      const r = await apiFetch(
        `/admin/v1/rules/${selectedRuleId}/rollback`,
        {
          method: "POST",
          body: JSON.stringify({
            version: Number(rollbackVer),
            actor: "panel",
            note: "Rollback via Panel",
          }),
        },
      );
      if (!r.ok) throw new Error("Rollback failed");
      notifySucc(`Rolled back to v${rollbackVer}`);
      loadRules();
      selectRule(selectedRuleId);
    } catch (e) {
      notifyError((e as Error).message);
    }
  }, [selectedRuleId, rollbackVer, loadRules, selectRule, notifyError, notifySucc]);

  const resetForm = useCallback(() => {
    setSelectedRuleId("");
    setRuleName("");
    setApiPath("");
    setRuleStatus("draft");
    setWhitelist("");
    setRenames("");
    setMasked("");
    setComputed("{}");
    setConditional("[]");
    setGray("{}");
  }, []);

  return {
    // Data
    rules,
    busy,
    // Rule form
    selectedRuleId,
    ruleName,
    apiPath,
    ruleStatus,
    whitelist,
    renames,
    masked,
    computed,
    conditional,
    gray,
    removeNulls,
    changeKind,
    // Version
    versions,
    fromVer,
    toVer,
    rollbackVer,
    diffJson,
    // Setters
    setRules,
    setSelectedRuleId,
    setRuleName,
    setApiPath,
    setRuleStatus,
    setWhitelist,
    setRenames,
    setMasked,
    setComputed,
    setConditional,
    setGray,
    setRemoveNulls,
    setChangeKind,
    setFromVer,
    setToVer,
    setRollbackVer,
    // Actions
    loadRules,
    selectRule,
    saveRule,
    deleteRule,
    computeDiff,
    rollback,
    resetForm,
  };
}
