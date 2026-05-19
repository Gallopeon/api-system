"use client";

import { useState } from "react";
import { LayoutList, ArrowUpDown, X } from "lucide-react";
import { inputClass } from "@/lib/constants";
import type { RuleSummary } from "@/lib/types";

const STATUS_OPTIONS = ["active", "inactive", "deprecated", "retired"] as const;
const ZHT: Record<string, string> = { active: "激活", inactive: "未激活", deprecated: "已弃用", retired: "已退役" };

const statusBadgeCls = (s: string) => {
  const map: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    inactive: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    deprecated: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    retired: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  };
  return map[s] || map.inactive;
};

type TFn = <T>(en: T, zh: T) => T;

export function RuleSelector({ rules, selected, onChange, t }: { rules: RuleSummary[]; selected: string[]; onChange: (ids: string[]) => void; t: TFn }) {
  const [open, setOpen] = useState(false);
  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter(x => x !== id));
    else onChange([...selected, id]);
  };
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} className={`${inputClass} w-full text-left flex items-center justify-between`}>
        <span className="truncate text-sm">
          {selected.length === 0 ? t("Select rules…", "选择规则…") : `${selected.length} ${t("selected", "项已选")}`}
        </span>
        <LayoutList className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg text-sm">
            {rules.length === 0 && (
              <div className="px-3 py-2 text-gray-400 text-xs">{t("No rules available", "暂无规则")}</div>
            )}
            {rules.map(r => (
              <label key={r.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition">
                <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-700 dark:text-gray-200 truncate">{r.name}</div>
                  <div className="text-[10px] text-gray-400 font-mono truncate">{r.api_path}</div>
                </div>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function StatusMenu({ current, onChange, t }: { current: string; onChange: (s: string) => void; t: TFn }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} className={`${inputClass} w-full text-left flex items-center justify-between`}>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadgeCls(current)}`}>{current === "active" ? t("Active", ZHT.active) : current === "inactive" ? t("Inactive", ZHT.inactive) : t(current, ZHT[current] || current)}</span>
        <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg text-sm py-1">
            {STATUS_OPTIONS.map(s => (
              <button key={s} type="button" onClick={() => { onChange(s); setOpen(false); }} className={`w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition flex items-center gap-2 ${s === current ? "bg-gray-50 dark:bg-gray-800" : ""}`}>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadgeCls(s)}`}>{s === "active" ? t("Active", ZHT.active) : s === "inactive" ? t("Inactive", ZHT.inactive) : t(s, ZHT[s] || s)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function TagChips({ tags, onRemove }: { tags: string[]; onRemove?: (t: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {tags.map(tg => (
        <span key={tg} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
          {tg}
          {onRemove && <button type="button" onClick={() => onRemove(tg)} className="hover:text-red-500"><X className="w-3 h-3" /></button>}
        </span>
      ))}
    </div>
  );
}
