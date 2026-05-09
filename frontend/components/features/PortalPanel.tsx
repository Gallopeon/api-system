"use client";

import { BookOpen, Layers, Zap } from "lucide-react";
import type { ApiProduct, ApiKeyItem, Subscription, SubscriptionUsage } from "@/lib/types";
import PortalCatalogTab from "./PortalCatalogTab";
import PortalMyAppsTab from "./PortalMyAppsTab";
import PortalDocsTab from "./PortalDocsTab";

export interface PortalPanelProps {
  products: ApiProduct[];
  allTags: string[];
  catalogBusy: boolean;
  searchQuery: string;
  selectedTags: string[];
  onSearchChange: (v: string) => void;
  onTagToggle: (tag: string) => void;
  myKeys: ApiKeyItem[];
  mySubscriptions: Subscription[];
  usageMap: Record<string, SubscriptionUsage>;
  getProduct: (id: string) => ApiProduct | null;
  akName: string; akScopes: string; akExpires: string;
  akCreatedKey: string; akBusy: boolean;
  onAkNameChange: (v: string) => void;
  onAkScopesChange: (v: string) => void;
  onAkExpiresChange: (v: string) => void;
  onAkCreatedKeyChange: (v: string) => void;
  onCreateKey: () => Promise<void>;
  getDefaultExpiry: (h?: number) => string;
  portalTab: string;
  onPortalTabChange: (tab: string) => void;
  onNavigateToMenu: (menu: string) => void;
  onSelectRule: (id: string) => void;
  onSetOpenApiFilter: (v: string) => void;
  canRequestKey: boolean;
  notifySucc: (msg: string) => void;
  t: <T>(en: T, zh: T) => T;
}

const tabClass = (active: boolean) =>
  `px-5 py-2.5 text-sm font-semibold rounded-lg transition ${
    active
      ? "bg-blue-600 text-white shadow-md"
      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
  }`;

export function statusBadge(status: string, t: (en: string, zh: string) => string) {
  const map: Record<string, { en: string; zh: string; cls: string }> = {
    active: { en: "Active", zh: "活跃", cls: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
    disabled: { en: "Disabled", zh: "已禁用", cls: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400" },
    expired: { en: "Expired", zh: "已过期", cls: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" },
    cancelled: { en: "Cancelled", zh: "已取消", cls: "bg-gray-100 dark:bg-gray-800 text-gray-500" },
  };
  const m = map[status] || map.active;
  return <span className={`text-xs px-2 py-0.5 rounded font-semibold ${m.cls}`}>{t(m.en, m.zh)}</span>;
}

export default function PortalPanel(props: PortalPanelProps) {
  const { t, portalTab, onPortalTabChange } = props;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold">{t("Developer Portal", "开发者门户")}</h1>
        <p className="text-gray-500 mt-1">{t("Explore APIs, manage your apps, and monitor usage.", "探索 API、管理您的应用并监控使用情况。")}</p>
      </div>

      <div className="flex gap-2 bg-white dark:bg-black/40 border border-gray-200 dark:border-gray-800 rounded-xl p-1.5 shadow-sm">
        {[
          { id: "catalog", en: "API Catalog", zh: "API 目录", icon: Layers },
          { id: "my-apps", en: "My Apps", zh: "我的应用", icon: Zap },
          { id: "docs", en: "Quick Start", zh: "快速入门", icon: BookOpen },
        ].map((tab) => (
          <button key={tab.id} onClick={() => onPortalTabChange(tab.id)} className={tabClass(portalTab === tab.id)}>
            <tab.icon className="w-4 h-4 mr-2 inline" />
            {t(tab.en, tab.zh)}
          </button>
        ))}
      </div>

      {portalTab === "catalog" && <PortalCatalogTab {...props} />}
      {portalTab === "my-apps" && <PortalMyAppsTab {...props} />}
      {portalTab === "docs" && <PortalDocsTab {...props} />}
    </div>
  );
}
