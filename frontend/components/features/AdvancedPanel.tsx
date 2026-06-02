"use client";

import { useState, useEffect, useCallback } from "react";
import { Package, RefreshCw, AlertTriangle, Code2, ShieldAlert, Settings } from "lucide-react";
import {
  useProducts, useSubscriptions, useCircuitBreakers,
  useProtocols, useClassifications, usePlugins,
} from "@/hooks/useAdvanced";

import AdvancedProductsTab from "./AdvancedProductsTab";
import AdvancedSubscriptionsTab from "./AdvancedSubscriptionsTab";
import AdvancedCircuitBreakersTab from "./AdvancedCircuitBreakersTab";
import AdvancedProtocolsTab from "./AdvancedProtocolsTab";
import AdvancedClassificationsTab from "./AdvancedClassificationsTab";
import AdvancedPluginsTab from "./AdvancedPluginsTab";

interface AdvancedPanelProps {
  accessToken?: string;
  notifyError: (msg: string) => void;
  notifySucc: (msg: string) => void;
  canWriteProducts: boolean;
  canWriteCircuitBreakers: boolean;
  canWriteProtocols: boolean;
  canWriteClassifications: boolean;
  canWritePlugins: boolean;
  t: <T>(en: T, zh: T) => T;
}

const tabs = [
  { id: "products", icon: Package, en: "API Products", zh: "API 产品" },
  { id: "subscriptions", icon: RefreshCw, en: "Subscriptions", zh: "订阅管理" },
  { id: "circuit-breakers", icon: AlertTriangle, en: "Circuit Breakers", zh: "熔断器" },
  { id: "protocols", icon: Code2, en: "Protocols", zh: "协议扩展" },
  { id: "classifications", icon: ShieldAlert, en: "Classifications", zh: "数据分类" },
  { id: "plugins", icon: Settings, en: "Plugins", zh: "插件系统" },
];

export default function AdvancedPanel({ accessToken, notifyError, notifySucc, canWriteProducts, canWriteCircuitBreakers, canWriteProtocols, canWriteClassifications, canWritePlugins, t }: AdvancedPanelProps) {
  const [activeTab, setActiveTabRaw] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("advanced_tab") || "products";
    }
    return "products";
  });
  const setActiveTab = useCallback((tab: string) => {
    setActiveTabRaw(tab);
    localStorage.setItem("advanced_tab", tab);
  }, []);

  const prod = useProducts(accessToken, notifyError, notifySucc);
  const sub  = useSubscriptions(accessToken, notifyError, notifySucc);
  const cb   = useCircuitBreakers(accessToken, notifyError, notifySucc);
  const proto = useProtocols(accessToken, notifyError, notifySucc);
  const cls  = useClassifications(accessToken, notifyError, notifySucc);
  const plg  = usePlugins(accessToken, notifyError, notifySucc);

  useEffect(() => {
    prod.loadProducts(); sub.loadSubscriptions(); cb.loadCBs();
    proto.loadProtocols(); cls.loadClassifications(); plg.loadPlugins();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          {t("Advanced Features", "高级功能")}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-sm">
          {t("API Products, circuit breakers, protocol extensions, compliance, and plugin system.", "API 产品化、熔断器、协议扩展、合规管理和插件系统。")}
        </p>
      </div>

      {/* Sub-tab bar */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-800 pb-0.5">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium rounded-t-lg transition border-b-2 -mb-[2px] ${
                active ? "text-blue-600 border-blue-600 bg-blue-50/50 dark:bg-blue-900/20" : "text-gray-500 border-transparent hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300"
              }`}>
              <Icon className="w-4 h-4" />{t(tab.en, tab.zh)}
            </button>
          );
        })}
      </div>

      {activeTab === "products" && (
        <AdvancedProductsTab products={prod.products} rules={prod.rules} busy={prod.busy} createProduct={prod.createProduct} updateProduct={prod.updateProduct} toggleProductStatus={prod.toggleProductStatus} deleteProduct={prod.deleteProduct} loadProducts={prod.loadProducts} loadRules={prod.loadRules} canWrite={canWriteProducts} notifyError={notifyError} t={t} />
      )}
      {activeTab === "subscriptions" && (
        <AdvancedSubscriptionsTab subscriptions={sub.subscriptions} busy={sub.busy} apiKeys={sub.apiKeys} productsList={sub.products} usageMap={sub.usageMap} loadSubscriptions={sub.loadSubscriptions} loadApiKeys={sub.loadApiKeys} loadProductsList={sub.loadProductsList} createSubscription={sub.createSubscription} updateSubscription={sub.updateSubscription} upgradeSubscription={sub.upgradeSubscription} cancelSubscription={sub.cancelSubscription} renewSubscription={sub.renewSubscription} getSubscriptionUsage={sub.getSubscriptionUsage} deleteSubscription={sub.deleteSubscription} canWrite={canWriteProducts} notifyError={notifyError} t={t} />
      )}
      {activeTab === "circuit-breakers" && (
        <AdvancedCircuitBreakersTab cbs={cb.cbs} busy={cb.busy} createCB={cb.createCB} updateCB={cb.updateCB} deleteCB={cb.deleteCB} canWrite={canWriteCircuitBreakers} notifyError={notifyError} t={t} />
      )}
      {activeTab === "protocols" && (
        <AdvancedProtocolsTab protocols={proto.protocols} busy={proto.busy} createProtocol={proto.createProtocol} updateProtocol={proto.updateProtocol} deleteProtocol={proto.deleteProtocol} canWrite={canWriteProtocols} notifyError={notifyError} t={t} />
      )}
      {activeTab === "classifications" && (
        <AdvancedClassificationsTab classifications={cls.classifications} busy={cls.busy} createClassification={cls.createClassification} updateClassification={cls.updateClassification} deleteClassification={cls.deleteClassification} canWrite={canWriteClassifications} notifyError={notifyError} t={t} />
      )}
      {activeTab === "plugins" && (
        <AdvancedPluginsTab plugins={plg.plugins} busy={plg.busy} createPlugin={plg.createPlugin} updatePlugin={plg.updatePlugin} deletePlugin={plg.deletePlugin} canWrite={canWritePlugins} notifyError={notifyError} t={t} />
      )}
    </div>
  );
}
