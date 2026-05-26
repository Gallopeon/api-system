"use client";

import { inputClass } from "@/lib/constants";
import type { PricingTier } from "@/lib/types";

interface Props {
  value: string;
  onChange: (v: string) => void;
  tiers: PricingTier[];
  t: <T>(en: T, zh: T) => T;
}

export default function SubscriptionPlanSelect({ value, onChange, tiers, t }: Props) {
  if (tiers.length > 0) {
    return (
      <select className={inputClass} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">{t("Select plan…", "选择方案…")}</option>
        {tiers.map(tier => (
          <option key={tier.name} value={tier.name}>
            {tier.name}
          </option>
        ))}
      </select>
    );
  }
  return <input className={inputClass} value={value} onChange={e => onChange(e.target.value)} placeholder={t("Plan name", "方案名称")} />;
}
