import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { parseJson } from "@/lib/utils";
import type { PlaygroundEntry, PreviewResponse } from "@/lib/types";

export function usePlayground(
  notifyError: (msg: string) => void,
  notifySucc: (msg: string) => void,
) {
  const [pgEntryCounter, setPgEntryCounter] = useState(2);
  const [pgEntries, setPgEntries] = useState<PlaygroundEntry[]>([
    {
      id: 1,
      name: "",
      body: '{"data": [{"id": 1, "vip": true}]}',
      traffic: '{"user_id": "u-1"}',
      output: "",
      busy: false,
    },
  ]);
  const [forceVar, setForceVar] = useState("");
  const [selectedRuleId, setSelectedRuleId] = useState("");
  const [busy, setBusy] = useState(false);

  const addEntry = useCallback(() => {
    const newId = pgEntryCounter;
    setPgEntryCounter((c) => c + 1);
    setPgEntries((prev) => [
      ...prev,
      {
        id: newId,
        name: "",
        body: '{"data": []}',
        traffic: "{}",
        output: "",
        busy: false,
      },
    ]);
  }, [pgEntryCounter]);

  const removeEntry = useCallback((id: number) => {
    setPgEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const transformEntry = useCallback(
    async (entry: PlaygroundEntry, idx: number) => {
      setPgEntries((prev) =>
        prev.map((en) => (en.id === entry.id ? { ...en, busy: true } : en)),
      );
      try {
        const body = {
          input: parseJson(entry.body, {}),
          traffic_context: parseJson(entry.traffic, null),
          actor: "panel",
          rule_id: selectedRuleId || undefined,
          force_variant: forceVar.trim() || undefined,
        };
        const r = await apiFetch("/admin/v1/transform/preview", {
          method: "POST",
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error("Transform failed");
        const d = (await r.json()) as PreviewResponse;
        setPgEntries((prev) =>
          prev.map((en) =>
            en.id === entry.id
              ? { ...en, output: JSON.stringify(d, null, 2), busy: false }
              : en,
          ),
        );
        notifySucc(
          `Entry "${entry.name || `#${idx + 1}`}" OK`,
        );
      } catch (e) {
        notifyError((e as Error).message);
        setPgEntries((prev) =>
          prev.map((en) =>
            en.id === entry.id ? { ...en, busy: false } : en,
          ),
        );
      }
    },
    [selectedRuleId, forceVar, notifyError, notifySucc],
  );

  const batchTransform = useCallback(async () => {
    setPgEntries((prev) => prev.map((en) => ({ ...en, busy: true })));
    setBusy(true);
    let ok = 0;
    let fail = 0;
    for (const entry of pgEntries) {
      try {
        const body = {
          input: parseJson(entry.body, {}),
          traffic_context: parseJson(entry.traffic, null),
          actor: "panel",
          rule_id: selectedRuleId || undefined,
          force_variant: forceVar.trim() || undefined,
        };
        const r = await apiFetch("/admin/v1/transform/preview", {
          method: "POST",
          body: JSON.stringify(body),
        });
        if (r.ok) {
          const d = (await r.json()) as PreviewResponse;
          setPgEntries((prev) =>
            prev.map((en) =>
              en.id === entry.id
                ? { ...en, output: JSON.stringify(d, null, 2), busy: false }
                : en,
            ),
          );
          ok++;
        } else {
          fail++;
          setPgEntries((prev) =>
            prev.map((en) =>
              en.id === entry.id ? { ...en, busy: false } : en,
            ),
          );
        }
      } catch {
        fail++;
        setPgEntries((prev) =>
          prev.map((en) =>
            en.id === entry.id ? { ...en, busy: false } : en,
          ),
        );
      }
    }
    setBusy(false);
    if (fail === 0) notifySucc(`All ${ok} entries OK`);
    else notifyError(`${ok} ok, ${fail} failed`);
  }, [pgEntries, selectedRuleId, forceVar, notifyError, notifySucc]);

  return {
    pgEntries,
    forceVar,
    selectedRuleId,
    busy,
    setPgEntries,
    setForceVar,
    setSelectedRuleId,
    addEntry,
    removeEntry,
    transformEntry,
    batchTransform,
  };
}
