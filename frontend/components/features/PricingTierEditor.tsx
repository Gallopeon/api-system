"use client";

import { Plus, X } from "lucide-react";
import { inputClass } from "@/lib/constants";

export interface TierForm {
  name: string; price_monthly: string; rate_limit_rps: string;
  quota_daily: string; quota_monthly: string;
}

export function emptyTier(): TierForm {
  return { name: "", price_monthly: "", rate_limit_rps: "", quota_daily: "", quota_monthly: "" };
}

interface Props {
  tiers: TierForm[];
  onUpdate: (tiers: TierForm[]) => void;
  t: <T>(en: T, zh: T) => T;
}

export default function PricingTierEditor({ tiers, onUpdate, t }: Props) {
  const addTier = () => onUpdate([...tiers, emptyTier()]);
  const removeTier = (idx: number) => onUpdate(tiers.filter((_, i) => i !== idx));
  const updateField = (idx: number, field: keyof TierForm, value: string) => {
    onUpdate(tiers.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t("Pricing Tiers", "定价方案")}</span>
        <button type="button" onClick={addTier} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
          <Plus className="w-3 h-3" />{t("Add Tier", "添加方案")}
        </button>
      </div>
      {tiers.map((tier, i) => (
        <div key={i} className="grid grid-cols-2 md:grid-cols-5 gap-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800">
          <div>
            <label className="text-[10px] text-gray-400 uppercase">{t("Name", "名称")} <span className="text-red-400">*</span></label>
            <input className={`${inputClass} py-1.5 text-xs`} value={tier.name} onChange={e => updateField(i, "name", e.target.value)} placeholder={t("Free/Pro/Enterprise", "免费/专业/企业")} />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 uppercase">{t("Price/mo", "月费")}</label>
            <input className={`${inputClass} py-1.5 text-xs`} type="number" value={tier.price_monthly} onChange={e => updateField(i, "price_monthly", e.target.value)} placeholder="0" min="0" />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 uppercase">{t("RPS", "RPS")}</label>
            <input className={`${inputClass} py-1.5 text-xs`} type="number" value={tier.rate_limit_rps} onChange={e => updateField(i, "rate_limit_rps", e.target.value)} placeholder="10" min="0" />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 uppercase">{t("Daily Qty", "日配额")}</label>
            <input className={`${inputClass} py-1.5 text-xs`} type="number" value={tier.quota_daily} onChange={e => updateField(i, "quota_daily", e.target.value)} placeholder="1000" min="0" />
          </div>
          <div className="flex items-end gap-1">
            <div className="flex-1">
              <label className="text-[10px] text-gray-400 uppercase">{t("Monthly Qty", "月配额")}</label>
              <input className={`${inputClass} py-1.5 text-xs`} type="number" value={tier.quota_monthly} onChange={e => updateField(i, "quota_monthly", e.target.value)} placeholder="10000" min="0" />
            </div>
            {tiers.length > 1 && (
              <button type="button" onClick={() => removeTier(i)} className="p-1 text-red-400 hover:text-red-600 shrink-0"><X className="w-4 h-4" /></button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
