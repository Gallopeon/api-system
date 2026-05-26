"use client";

import { Plus, X, Crown } from "lucide-react";
import { inputClass } from "@/lib/constants";

export interface TierForm {
  name: string; rate_limit_rps: string;
  quota_daily: string; quota_monthly: string;
}

export function emptyTier(): TierForm {
  return { name: "", rate_limit_rps: "", quota_daily: "", quota_monthly: "" };
}

interface Props {
  tiers: TierForm[];
  onUpdate: (tiers: TierForm[]) => void;
  t: <T>(en: T, zh: T) => T;
}

const LABELS = [
  { key: "name" as const, labelEn: "Name", labelZh: "名称", placeholder: "Free/Pro/Enterprise", required: true },
  { key: "rate_limit_rps" as const, labelEn: "RPS Limit", labelZh: "RPS 限制", placeholder: "10", type: "number" },
  { key: "quota_daily" as const, labelEn: "Daily Quota", labelZh: "日配额", placeholder: "1000", type: "number" },
  { key: "quota_monthly" as const, labelEn: "Monthly Quota", labelZh: "月配额", placeholder: "10000", type: "number" },
];

export default function PricingTierEditor({ tiers, onUpdate, t }: Props) {
  const addTier = () => onUpdate([...tiers, emptyTier()]);
  const removeTier = (idx: number) => onUpdate(tiers.filter((_, i) => i !== idx));
  const updateField = (idx: number, field: keyof TierForm, value: string) => {
    onUpdate(tiers.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <Crown className="w-3.5 h-3.5" />{t("Limit Tiers", "限制方案")}
        </span>
        <button type="button" onClick={addTier} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">
          <Plus className="w-3 h-3" />{t("Add Tier", "添加方案")}
        </button>
      </div>
      {tiers.map((tier, i) => (
        <div key={i} className="relative bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t("Tier", "方案")} #{i + 1}</span>
            {tiers.length > 1 && (
              <button type="button" onClick={() => removeTier(i)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition shrink-0" title={t("Remove", "删除")}>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {LABELS.map(({ key, labelEn, labelZh, placeholder, type, required }) => (
              <div key={key}>
                <label className="text-[10px] text-gray-400 uppercase font-medium block mb-1">
                  {t(labelEn, labelZh)} {required && <span className="text-red-400">*</span>}
                </label>
                <input
                  className={inputClass}
                  type={type || "text"}
                  value={tier[key]}
                  onChange={e => updateField(i, key, e.target.value)}
                  placeholder={placeholder}
                  min={type === "number" ? "0" : undefined}
                  step="1"
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
