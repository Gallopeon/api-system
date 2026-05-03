"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  Edit3,
  X,
  Check,
  Package,
  RefreshCw,
  AlertTriangle,
  Code2,
  ShieldAlert,
  Settings,
} from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary, btnSecondary } from "@/lib/constants";
import {
  useProducts,
  useSubscriptions,
  useCircuitBreakers,
  useProtocols,
  useClassifications,
  usePlugins,
} from "@/hooks/useAdvanced";
import type {
  ApiProduct,
  Subscription,
  CircuitBreaker,
  ProtocolConfig,
  DataClassification,
  PluginConfig,
} from "@/lib/types";

interface AdvancedPanelProps {
  accessToken?: string;
  notifyError: (msg: string) => void;
  notifySucc: (msg: string) => void;
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

const statusBadge = (status: string, t: AdvancedPanelProps["t"]) => {
  const isActive = status === "active";
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
        isActive
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
      }`}
    >
      {isActive ? t("active", "激活") : t("draft", "草稿")}
    </span>
  );
};

const fmtDate = (d: string | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
};

export default function AdvancedPanel({ accessToken, notifyError, notifySucc, t }: AdvancedPanelProps) {
  const [activeTab, setActiveTab] = useState("products");

  // ── Hooks ──
  const {
    products,
    busy: prodBusy,
    loadProducts,
    createProduct,
    updateProduct,
    deleteProduct,
  } = useProducts(accessToken, notifyError, notifySucc);

  const {
    subscriptions,
    busy: subBusy,
    loadSubscriptions,
    createSubscription,
    updateSubscription,
    deleteSubscription,
  } = useSubscriptions(accessToken, notifyError, notifySucc);

  const {
    cbs,
    busy: cbBusy,
    loadCBs,
    createCB,
    updateCB,
    deleteCB,
  } = useCircuitBreakers(accessToken, notifyError, notifySucc);

  const {
    protocols,
    busy: protoBusy,
    loadProtocols,
    createProtocol,
    updateProtocol,
    deleteProtocol,
  } = useProtocols(accessToken, notifyError, notifySucc);

  const {
    classifications,
    busy: clsBusy,
    loadClassifications,
    createClassification,
    updateClassification,
    deleteClassification,
  } = useClassifications(accessToken, notifyError, notifySucc);

  const {
    plugins,
    busy: plgBusy,
    loadPlugins,
    createPlugin,
    updatePlugin,
    deletePlugin,
  } = usePlugins(accessToken, notifyError, notifySucc);

  // ── Load data on mount ──
  useEffect(() => {
    loadProducts();
    loadSubscriptions();
    loadCBs();
    loadProtocols();
    loadClassifications();
    loadPlugins();
  }, [loadProducts, loadSubscriptions, loadCBs, loadProtocols, loadClassifications, loadPlugins]);

  // ══════════════════════════════════════════════════════════════════════
  //  Products tab
  // ══════════════════════════════════════════════════════════════════════
  const [showCreateProd, setShowCreateProd] = useState(false);
  const [editProdId, setEditProdId] = useState<string | null>(null);
  const [prodName, setProdName] = useState("");
  const [prodDesc, setProdDesc] = useState("");
  const [prodRuleIds, setProdRuleIds] = useState("");
  const [editProdName, setEditProdName] = useState("");
  const [editProdDesc, setEditProdDesc] = useState("");
  const [editProdRuleIds, setEditProdRuleIds] = useState("");

  const startEditProd = (p: ApiProduct) => {
    setEditProdId(p.id);
    setEditProdName(p.name);
    setEditProdDesc(p.description || "");
    setEditProdRuleIds((p.rule_ids || []).join(", "));
  };
  const cancelEditProd = () => setEditProdId(null);
  const saveEditProd = useCallback(async () => {
    if (!editProdId) return;
    const body: Record<string, unknown> = { name: editProdName.trim(), description: editProdDesc.trim() };
    if (editProdRuleIds.trim()) {
      body.rule_ids = editProdRuleIds.split(",").map((s) => s.trim()).filter(Boolean);
    }
    await updateProduct(editProdId, body);
    setEditProdId(null);
  }, [editProdId, editProdName, editProdDesc, editProdRuleIds, updateProduct]);

  const handleCreateProduct = useCallback(async () => {
    if (!prodName.trim()) { notifyError("Name is required"); return; }
    await createProduct(
      prodName.trim(),
      prodDesc.trim(),
      prodRuleIds ? prodRuleIds.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
    );
    setProdName(""); setProdDesc(""); setProdRuleIds(""); setShowCreateProd(false);
  }, [prodName, prodDesc, prodRuleIds, createProduct, notifyError]);

  // ══════════════════════════════════════════════════════════════════════
  //  Subscriptions tab
  // ══════════════════════════════════════════════════════════════════════
  const [showCreateSub, setShowCreateSub] = useState(false);
  const [editSubId, setEditSubId] = useState<string | null>(null);
  const [subApiKeyId, setSubApiKeyId] = useState("");
  const [subProductId, setSubProductId] = useState("");
  const [subPlan, setSubPlan] = useState("free");
  const [editSubApiKeyId, setEditSubApiKeyId] = useState("");
  const [editSubProductId, setEditSubProductId] = useState("");
  const [editSubPlan, setEditSubPlan] = useState("free");

  const startEditSub = (s: Subscription) => {
    setEditSubId(s.id);
    setEditSubApiKeyId(s.api_key_id);
    setEditSubProductId(s.product_id);
    setEditSubPlan(s.plan);
  };
  const cancelEditSub = () => setEditSubId(null);
  const saveEditSub = useCallback(async () => {
    if (!editSubId) return;
    await updateSubscription(editSubId, {
      api_key_id: editSubApiKeyId.trim(),
      product_id: editSubProductId.trim(),
      plan: editSubPlan,
    });
    setEditSubId(null);
  }, [editSubId, editSubApiKeyId, editSubProductId, editSubPlan, updateSubscription]);

  const handleCreateSub = useCallback(async () => {
    if (!subApiKeyId.trim() || !subProductId.trim()) {
      notifyError("API Key ID and Product ID are required");
      return;
    }
    await createSubscription(subApiKeyId.trim(), subProductId.trim(), subPlan);
    setSubApiKeyId(""); setSubProductId(""); setSubPlan("free"); setShowCreateSub(false);
  }, [subApiKeyId, subProductId, subPlan, createSubscription, notifyError]);

  // ══════════════════════════════════════════════════════════════════════
  //  Circuit Breakers tab
  // ══════════════════════════════════════════════════════════════════════
  const [showCreateCb, setShowCreateCb] = useState(false);
  const [editCbId, setEditCbId] = useState<string | null>(null);
  const [cbPath, setCbPath] = useState("");
  const [cbFailThresh, setCbFailThresh] = useState("5");
  const [cbRecovery, setCbRecovery] = useState("30");
  const [cbHalfOpen, setCbHalfOpen] = useState("3");
  const [cbRetry, setCbRetry] = useState("3");
  const [cbRetryDelay, setCbRetryDelay] = useState("100");
  const [cbTimeout, setCbTimeout] = useState("5000");
  const [editCbPath, setEditCbPath] = useState("");
  const [editCbFailThresh, setEditCbFailThresh] = useState("");
  const [editCbRecovery, setEditCbRecovery] = useState("");
  const [editCbHalfOpen, setEditCbHalfOpen] = useState("");
  const [editCbRetry, setEditCbRetry] = useState("");
  const [editCbRetryDelay, setEditCbRetryDelay] = useState("");
  const [editCbTimeout, setEditCbTimeout] = useState("");

  const startEditCb = (cb: CircuitBreaker) => {
    setEditCbId(cb.id);
    setEditCbPath(cb.api_path);
    setEditCbFailThresh(String(cb.failure_threshold));
    setEditCbRecovery(String(cb.recovery_timeout_sec));
    setEditCbHalfOpen(String(cb.half_open_max));
    setEditCbRetry(String(cb.retry_count));
    setEditCbRetryDelay(String(cb.retry_delay_ms));
    setEditCbTimeout(String(cb.timeout_ms));
  };
  const cancelEditCb = () => setEditCbId(null);
  const saveEditCb = useCallback(async () => {
    if (!editCbId) return;
    await updateCB(editCbId, {
      api_path: editCbPath.trim(),
      failure_threshold: parseInt(editCbFailThresh) || 5,
      recovery_timeout_sec: parseInt(editCbRecovery) || 30,
      half_open_max: parseInt(editCbHalfOpen) || 3,
      retry_count: parseInt(editCbRetry) || 3,
      retry_delay_ms: parseInt(editCbRetryDelay) || 100,
      timeout_ms: parseInt(editCbTimeout) || 5000,
    });
    setEditCbId(null);
  }, [editCbId, editCbPath, editCbFailThresh, editCbRecovery, editCbHalfOpen, editCbRetry, editCbRetryDelay, editCbTimeout, updateCB]);

  const handleCreateCb = useCallback(async () => {
    if (!cbPath.trim()) { notifyError("API path is required"); return; }
    await createCB({
      api_path: cbPath.trim(),
      failure_threshold: parseInt(cbFailThresh) || 5,
      recovery_timeout_sec: parseInt(cbRecovery) || 30,
      half_open_max: parseInt(cbHalfOpen) || 3,
      retry_count: parseInt(cbRetry) || 3,
      retry_delay_ms: parseInt(cbRetryDelay) || 100,
      timeout_ms: parseInt(cbTimeout) || 5000,
    });
    setCbPath(""); setCbFailThresh("5"); setCbRecovery("30"); setCbHalfOpen("3");
    setCbRetry("3"); setCbRetryDelay("100"); setCbTimeout("5000"); setShowCreateCb(false);
  }, [cbPath, cbFailThresh, cbRecovery, cbHalfOpen, cbRetry, cbRetryDelay, cbTimeout, createCB, notifyError]);

  // ══════════════════════════════════════════════════════════════════════
  //  Protocols tab
  // ══════════════════════════════════════════════════════════════════════
  const [showCreateProto, setShowCreateProto] = useState(false);
  const [editProtoId, setEditProtoId] = useState<string | null>(null);
  const [protoPath, setProtoPath] = useState("");
  const [protoProtocol, setProtoProtocol] = useState("graphql");
  const [protoConfigJson, setProtoConfigJson] = useState("{}");
  const [editProtoPath, setEditProtoPath] = useState("");
  const [editProtoProtocol, setEditProtoProtocol] = useState("graphql");
  const [editProtoConfigJson, setEditProtoConfigJson] = useState("{}");

  const startEditProto = (p: ProtocolConfig) => {
    setEditProtoId(p.id);
    setEditProtoPath(p.api_path);
    setEditProtoProtocol(p.protocol);
    setEditProtoConfigJson(p.config_json || "{}");
  };
  const cancelEditProto = () => setEditProtoId(null);
  const saveEditProto = useCallback(async () => {
    if (!editProtoId) return;
    await updateProtocol(editProtoId, {
      api_path: editProtoPath.trim(),
      protocol: editProtoProtocol,
      config_json: editProtoConfigJson,
    });
    setEditProtoId(null);
  }, [editProtoId, editProtoPath, editProtoProtocol, editProtoConfigJson, updateProtocol]);

  const handleCreateProto = useCallback(async () => {
    if (!protoPath.trim()) { notifyError("API path is required"); return; }
    await createProtocol({ api_path: protoPath.trim(), protocol: protoProtocol, config_json: protoConfigJson });
    setProtoPath(""); setProtoProtocol("graphql"); setProtoConfigJson("{}"); setShowCreateProto(false);
  }, [protoPath, protoProtocol, protoConfigJson, createProtocol, notifyError]);

  // ══════════════════════════════════════════════════════════════════════
  //  Classifications tab
  // ══════════════════════════════════════════════════════════════════════
  const [showCreateCls, setShowCreateCls] = useState(false);
  const [editClsId, setEditClsId] = useState<string | null>(null);
  const [clsPath, setClsPath] = useState("");
  const [clsCategory, setClsCategory] = useState("internal");
  const [clsPii, setClsPii] = useState(false);
  const [clsGdpr, setClsGdpr] = useState(false);
  const [clsRetention, setClsRetention] = useState("365");
  const [clsNotes, setClsNotes] = useState("");
  const [editClsPath, setEditClsPath] = useState("");
  const [editClsCategory, setEditClsCategory] = useState("internal");
  const [editClsPii, setEditClsPii] = useState(false);
  const [editClsGdpr, setEditClsGdpr] = useState(false);
  const [editClsRetention, setEditClsRetention] = useState("");
  const [editClsNotes, setEditClsNotes] = useState("");

  const startEditCls = (c: DataClassification) => {
    setEditClsId(c.id);
    setEditClsPath(c.api_path);
    setEditClsCategory(c.data_category);
    setEditClsPii(c.contains_pii);
    setEditClsGdpr(c.gdpr_relevant);
    setEditClsRetention(String(c.retention_days));
    setEditClsNotes(c.notes || "");
  };
  const cancelEditCls = () => setEditClsId(null);
  const saveEditCls = useCallback(async () => {
    if (!editClsId) return;
    await updateClassification(editClsId, {
      api_path: editClsPath.trim(),
      data_category: editClsCategory,
      contains_pii: editClsPii,
      gdpr_relevant: editClsGdpr,
      retention_days: parseInt(editClsRetention) || 365,
      notes: editClsNotes,
    });
    setEditClsId(null);
  }, [editClsId, editClsPath, editClsCategory, editClsPii, editClsGdpr, editClsRetention, editClsNotes, updateClassification]);

  const handleCreateCls = useCallback(async () => {
    if (!clsPath.trim()) { notifyError("API path is required"); return; }
    await createClassification({
      api_path: clsPath.trim(),
      data_category: clsCategory,
      contains_pii: clsPii,
      gdpr_relevant: clsGdpr,
      retention_days: parseInt(clsRetention) || 365,
      notes: clsNotes,
    });
    setClsPath(""); setClsCategory("internal"); setClsPii(false);
    setClsGdpr(false); setClsRetention("365"); setClsNotes(""); setShowCreateCls(false);
  }, [clsPath, clsCategory, clsPii, clsGdpr, clsRetention, clsNotes, createClassification, notifyError]);

  // ══════════════════════════════════════════════════════════════════════
  //  Plugins tab
  // ══════════════════════════════════════════════════════════════════════
  const [showCreatePlg, setShowCreatePlg] = useState(false);
  const [editPlgId, setEditPlgId] = useState<string | null>(null);
  const [plgName, setPlgName] = useState("");
  const [plgType, setPlgType] = useState("lua");
  const [plgHook, setPlgHook] = useState("pre_transform");
  const [plgConfigJson, setPlgConfigJson] = useState("{}");
  const [plgPriority, setPlgPriority] = useState("10");
  const [editPlgName, setEditPlgName] = useState("");
  const [editPlgType, setEditPlgType] = useState("lua");
  const [editPlgHook, setEditPlgHook] = useState("pre_transform");
  const [editPlgConfigJson, setEditPlgConfigJson] = useState("{}");
  const [editPlgPriority, setEditPlgPriority] = useState("");

  const startEditPlg = (p: PluginConfig) => {
    setEditPlgId(p.id);
    setEditPlgName(p.name);
    setEditPlgType(p.plugin_type);
    setEditPlgHook(p.hook_point);
    setEditPlgConfigJson(p.config_json || "{}");
    setEditPlgPriority(String(p.priority));
  };
  const cancelEditPlg = () => setEditPlgId(null);
  const saveEditPlg = useCallback(async () => {
    if (!editPlgId) return;
    await updatePlugin(editPlgId, {
      name: editPlgName.trim(),
      plugin_type: editPlgType,
      hook_point: editPlgHook,
      config_json: editPlgConfigJson,
      priority: parseInt(editPlgPriority) || 10,
    });
    setEditPlgId(null);
  }, [editPlgId, editPlgName, editPlgType, editPlgHook, editPlgConfigJson, editPlgPriority, updatePlugin]);

  const handleCreatePlg = useCallback(async () => {
    if (!plgName.trim()) { notifyError("Plugin name is required"); return; }
    await createPlugin({
      name: plgName.trim(),
      plugin_type: plgType,
      hook_point: plgHook,
      config_json: plgConfigJson,
      priority: parseInt(plgPriority) || 10,
    });
    setPlgName(""); setPlgType("lua"); setPlgHook("pre_transform");
    setPlgConfigJson("{}"); setPlgPriority("10"); setShowCreatePlg(false);
  }, [plgName, plgType, plgHook, plgConfigJson, plgPriority, createPlugin, notifyError]);

  // ──────────────────────────────────────────────────────────────────────
  //  Shared render helpers
  // ──────────────────────────────────────────────────────────────────────

  const emptyState = (Icon: React.ComponentType<{ className?: string }>) => (
    <div className="text-center py-12 text-gray-400">
      <Icon className="w-10 h-10 mx-auto mb-3 opacity-40" />
      <p className="text-sm">{t("No items found", "暂无数据")}</p>
    </div>
  );

  // ──────────────────────────────────────────────────────────────────────
  //  Tab content renderers
  // ──────────────────────────────────────────────────────────────────────

  const renderProductsTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{t("API Products", "API 产品")}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {t("Package multiple rules into API products for subscription-based access.", "将多个规则打包为 API 产品，支持基于订阅的访问。")}
          </p>
        </div>
        <button className={btnPrimary} onClick={() => setShowCreateProd(!showCreateProd)} disabled={prodBusy}>
          <Plus className="w-4 h-4 mr-1" />{t("Create", "创建")}
        </button>
      </div>

      {showCreateProd && (
        <div className={`${cardClass} animate-in fade-in zoom-in-95 duration-300`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className={labelClass}>{t("Name", "名称")}</label>
              <input className={inputClass} value={prodName} onChange={(e) => setProdName(e.target.value)} placeholder={t("My API Product", "产品名称")} />
            </div>
            <div>
              <label className={labelClass}>{t("Description", "描述")}</label>
              <input className={inputClass} value={prodDesc} onChange={(e) => setProdDesc(e.target.value)} placeholder={t("Optional description", "可选描述")} />
            </div>
            <div>
              <label className={labelClass}>{t("Rule IDs (comma-separated)", "规则 ID（逗号分割）")}</label>
              <input className={inputClass} value={prodRuleIds} onChange={(e) => setProdRuleIds(e.target.value)} placeholder="rule-1, rule-2" />
            </div>
          </div>
          <div className="flex gap-2">
            <button className={btnPrimary} onClick={handleCreateProduct} disabled={prodBusy}>
              {prodBusy ? t("Creating…", "创建中…") : t("Save Product", "保存产品")}
            </button>
            <button className={btnSecondary} onClick={() => setShowCreateProd(false)}>{t("Cancel", "取消")}</button>
          </div>
        </div>
      )}

      {products.length === 0 ? (
        emptyState(Package)
      ) : (
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-800">
                <th className="pb-2 pr-4">{t("Name", "名称")}</th>
                <th className="pb-2 pr-4">{t("Description", "描述")}</th>
                <th className="pb-2 pr-4">{t("Status", "状态")}</th>
                <th className="pb-2 pr-4">{t("Created", "创建时间")}</th>
                <th className="pb-2">{t("Actions", "操作")}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 dark:border-gray-800/50">
                  {editProdId === p.id ? (
                    <>
                      <td className="py-2 pr-2"><input className={inputClass} value={editProdName} onChange={(e) => setEditProdName(e.target.value)} /></td>
                      <td className="py-2 pr-2"><input className={inputClass} value={editProdDesc} onChange={(e) => setEditProdDesc(e.target.value)} /></td>
                      <td className="py-2 pr-2">{statusBadge(p.status, t)}</td>
                      <td className="py-2 pr-2 text-gray-500">{fmtDate(p.created_at)}</td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button className="p-1 text-emerald-600 hover:text-emerald-800" onClick={saveEditProd} title={t("Save", "保存")}><Check className="w-4 h-4" /></button>
                          <button className="p-1 text-gray-500 hover:text-gray-700" onClick={cancelEditProd} title={t("Cancel", "取消")}><X className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 pr-4 font-medium">{p.name}</td>
                      <td className="py-2 pr-4 text-gray-500">{p.description || "—"}</td>
                      <td className="py-2 pr-4">{statusBadge(p.status, t)}</td>
                      <td className="py-2 pr-4 text-gray-500">{fmtDate(p.created_at)}</td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button className="p-1 text-blue-600 hover:text-blue-800" onClick={() => startEditProd(p)} title={t("Edit", "编辑")}><Edit3 className="w-4 h-4" /></button>
                          <button className="p-1 text-red-500 hover:text-red-700" onClick={() => deleteProduct(p.id)} disabled={prodBusy} title={t("Delete", "删除")}><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderSubscriptionsTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{t("Subscriptions", "订阅管理")}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {t("Manage API product subscriptions with tiered plans.", "管理 API 产品订阅，支持分层套餐。")}
          </p>
        </div>
        <button className={btnPrimary} onClick={() => setShowCreateSub(!showCreateSub)} disabled={subBusy}>
          <Plus className="w-4 h-4 mr-1" />{t("Create", "创建")}
        </button>
      </div>

      {showCreateSub && (
        <div className={`${cardClass} animate-in fade-in zoom-in-95 duration-300`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className={labelClass}>{t("API Key ID", "API Key ID")}</label>
              <input className={inputClass} value={subApiKeyId} onChange={(e) => setSubApiKeyId(e.target.value)} placeholder="key-abc123" />
            </div>
            <div>
              <label className={labelClass}>{t("Product ID", "产品 ID")}</label>
              <input className={inputClass} value={subProductId} onChange={(e) => setSubProductId(e.target.value)} placeholder="prod-xyz" />
            </div>
            <div>
              <label className={labelClass}>{t("Plan", "套餐")}</label>
              <select className={inputClass} value={subPlan} onChange={(e) => setSubPlan(e.target.value)}>
                <option value="free">{t("Free", "免费")}</option>
                <option value="pro">{t("Pro", "专业")}</option>
                <option value="enterprise">{t("Enterprise", "企业")}</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button className={btnPrimary} onClick={handleCreateSub} disabled={subBusy}>
              {subBusy ? t("Creating…", "创建中…") : t("Save Subscription", "保存订阅")}
            </button>
            <button className={btnSecondary} onClick={() => setShowCreateSub(false)}>{t("Cancel", "取消")}</button>
          </div>
        </div>
      )}

      {subscriptions.length === 0 ? (
        emptyState(RefreshCw)
      ) : (
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-800">
                <th className="pb-2 pr-4">{t("API Key ID", "API Key ID")}</th>
                <th className="pb-2 pr-4">{t("Product ID", "产品 ID")}</th>
                <th className="pb-2 pr-4">{t("Plan", "套餐")}</th>
                <th className="pb-2 pr-4">{t("Status", "状态")}</th>
                <th className="pb-2 pr-4">{t("Created", "创建时间")}</th>
                <th className="pb-2">{t("Actions", "操作")}</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((s) => (
                <tr key={s.id} className="border-b border-gray-100 dark:border-gray-800/50">
                  {editSubId === s.id ? (
                    <>
                      <td className="py-2 pr-2"><input className={inputClass} value={editSubApiKeyId} onChange={(e) => setEditSubApiKeyId(e.target.value)} /></td>
                      <td className="py-2 pr-2"><input className={inputClass} value={editSubProductId} onChange={(e) => setEditSubProductId(e.target.value)} /></td>
                      <td className="py-2 pr-2">
                        <select className={inputClass} value={editSubPlan} onChange={(e) => setEditSubPlan(e.target.value)}>
                          <option value="free">{t("Free", "免费")}</option>
                          <option value="pro">{t("Pro", "专业")}</option>
                          <option value="enterprise">{t("Enterprise", "企业")}</option>
                        </select>
                      </td>
                      <td className="py-2 pr-2">{statusBadge(s.status, t)}</td>
                      <td className="py-2 pr-2 text-gray-500">{fmtDate(s.created_at)}</td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button className="p-1 text-emerald-600 hover:text-emerald-800" onClick={saveEditSub} title={t("Save", "保存")}><Check className="w-4 h-4" /></button>
                          <button className="p-1 text-gray-500 hover:text-gray-700" onClick={cancelEditSub} title={t("Cancel", "取消")}><X className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 pr-4 font-mono text-xs">{s.api_key_id}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{s.product_id}</td>
                      <td className="py-2 pr-4 capitalize">{s.plan}</td>
                      <td className="py-2 pr-4">{statusBadge(s.status, t)}</td>
                      <td className="py-2 pr-4 text-gray-500">{fmtDate(s.created_at)}</td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button className="p-1 text-blue-600 hover:text-blue-800" onClick={() => startEditSub(s)} title={t("Edit", "编辑")}><Edit3 className="w-4 h-4" /></button>
                          <button className="p-1 text-red-500 hover:text-red-700" onClick={() => deleteSubscription(s.id)} disabled={subBusy} title={t("Delete", "删除")}><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderCircuitBreakersTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{t("Circuit Breakers", "熔断器")}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {t("Configure failure thresholds, recovery timeouts, and retry policies per API path.", "按 API 路径配置故障阈值、恢复超时和重试策略。")}
          </p>
        </div>
        <button className={btnPrimary} onClick={() => setShowCreateCb(!showCreateCb)} disabled={cbBusy}>
          <Plus className="w-4 h-4 mr-1" />{t("Create", "创建")}
        </button>
      </div>

      {showCreateCb && (
        <div className={`${cardClass} animate-in fade-in zoom-in-95 duration-300`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className={labelClass}>{t("API Path", "API 路径")}</label>
              <input className={inputClass} value={cbPath} onChange={(e) => setCbPath(e.target.value)} placeholder="/admin/v1/users" />
            </div>
            <div>
              <label className={labelClass}>{t("Failure Threshold", "故障阈值")}</label>
              <input className={inputClass} type="number" value={cbFailThresh} onChange={(e) => setCbFailThresh(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t("Recovery Timeout (sec)", "恢复超时（秒）")}</label>
              <input className={inputClass} type="number" value={cbRecovery} onChange={(e) => setCbRecovery(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t("Half-Open Max", "半开最大数")}</label>
              <input className={inputClass} type="number" value={cbHalfOpen} onChange={(e) => setCbHalfOpen(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t("Retry Count", "重试次数")}</label>
              <input className={inputClass} type="number" value={cbRetry} onChange={(e) => setCbRetry(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t("Retry Delay (ms)", "重试间隔（毫秒）")}</label>
              <input className={inputClass} type="number" value={cbRetryDelay} onChange={(e) => setCbRetryDelay(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t("Timeout (ms)", "超时（毫秒）")}</label>
              <input className={inputClass} type="number" value={cbTimeout} onChange={(e) => setCbTimeout(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <button className={btnPrimary} onClick={handleCreateCb} disabled={cbBusy}>
              {cbBusy ? t("Creating…", "创建中…") : t("Save Circuit Breaker", "保存熔断器")}
            </button>
            <button className={btnSecondary} onClick={() => setShowCreateCb(false)}>{t("Cancel", "取消")}</button>
          </div>
        </div>
      )}

      {cbs.length === 0 ? (
        emptyState(AlertTriangle)
      ) : (
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-800">
                <th className="pb-2 pr-4">{t("API Path", "API 路径")}</th>
                <th className="pb-2 pr-4">{t("Failure Threshold", "故障阈值")}</th>
                <th className="pb-2 pr-4">{t("Recovery Timeout", "恢复超时")}</th>
                <th className="pb-2 pr-4">{t("Status", "状态")}</th>
                <th className="pb-2">{t("Actions", "操作")}</th>
              </tr>
            </thead>
            <tbody>
              {cbs.map((cb) => (
                <tr key={cb.id} className="border-b border-gray-100 dark:border-gray-800/50">
                  {editCbId === cb.id ? (
                    <>
                      <td className="py-2 pr-2"><input className={inputClass} value={editCbPath} onChange={(e) => setEditCbPath(e.target.value)} /></td>
                      <td className="py-2 pr-2"><input className={inputClass} type="number" value={editCbFailThresh} onChange={(e) => setEditCbFailThresh(e.target.value)} /></td>
                      <td className="py-2 pr-2"><input className={inputClass} type="number" value={editCbRecovery} onChange={(e) => setEditCbRecovery(e.target.value)} /></td>
                      <td className="py-2 pr-2">{statusBadge(cb.status, t)}</td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button className="p-1 text-emerald-600 hover:text-emerald-800" onClick={saveEditCb} title={t("Save", "保存")}><Check className="w-4 h-4" /></button>
                          <button className="p-1 text-gray-500 hover:text-gray-700" onClick={cancelEditCb} title={t("Cancel", "取消")}><X className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 pr-4 font-mono text-xs">{cb.api_path}</td>
                      <td className="py-2 pr-4">{cb.failure_threshold}</td>
                      <td className="py-2 pr-4">{cb.recovery_timeout_sec}s</td>
                      <td className="py-2 pr-4">{statusBadge(cb.status, t)}</td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button className="p-1 text-blue-600 hover:text-blue-800" onClick={() => startEditCb(cb)} title={t("Edit", "编辑")}><Edit3 className="w-4 h-4" /></button>
                          <button className="p-1 text-red-500 hover:text-red-700" onClick={() => deleteCB(cb.id)} disabled={cbBusy} title={t("Delete", "删除")}><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderProtocolsTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{t("Protocols", "协议扩展")}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {t("Support GraphQL, gRPC-Web, SSE, and WebSocket protocols per API path.", "按 API 路径支持 GraphQL、gRPC-Web、SSE 和 WebSocket 协议。")}
          </p>
        </div>
        <button className={btnPrimary} onClick={() => setShowCreateProto(!showCreateProto)} disabled={protoBusy}>
          <Plus className="w-4 h-4 mr-1" />{t("Create", "创建")}
        </button>
      </div>

      {showCreateProto && (
        <div className={`${cardClass} animate-in fade-in zoom-in-95 duration-300`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className={labelClass}>{t("API Path", "API 路径")}</label>
              <input className={inputClass} value={protoPath} onChange={(e) => setProtoPath(e.target.value)} placeholder="/admin/v1/graphql" />
            </div>
            <div>
              <label className={labelClass}>{t("Protocol", "协议")}</label>
              <select className={inputClass} value={protoProtocol} onChange={(e) => setProtoProtocol(e.target.value)}>
                <option value="graphql">GraphQL</option>
                <option value="grpc">gRPC</option>
                <option value="sse">SSE</option>
                <option value="ws">WebSocket</option>
                <option value="rest">REST</option>
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className={labelClass}>{t("Config JSON", "配置 JSON")}</label>
            <textarea className={inputClass} rows={4} value={protoConfigJson} onChange={(e) => setProtoConfigJson(e.target.value)} placeholder='{"key": "value"}' />
          </div>
          <div className="flex gap-2">
            <button className={btnPrimary} onClick={handleCreateProto} disabled={protoBusy}>
              {protoBusy ? t("Creating…", "创建中…") : t("Save Protocol", "保存协议")}
            </button>
            <button className={btnSecondary} onClick={() => setShowCreateProto(false)}>{t("Cancel", "取消")}</button>
          </div>
        </div>
      )}

      {protocols.length === 0 ? (
        emptyState(Code2)
      ) : (
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-800">
                <th className="pb-2 pr-4">{t("API Path", "API 路径")}</th>
                <th className="pb-2 pr-4">{t("Protocol", "协议")}</th>
                <th className="pb-2 pr-4">{t("Status", "状态")}</th>
                <th className="pb-2 pr-4">{t("Created", "创建时间")}</th>
                <th className="pb-2">{t("Actions", "操作")}</th>
              </tr>
            </thead>
            <tbody>
              {protocols.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 dark:border-gray-800/50">
                  {editProtoId === p.id ? (
                    <>
                      <td className="py-2 pr-2"><input className={inputClass} value={editProtoPath} onChange={(e) => setEditProtoPath(e.target.value)} /></td>
                      <td className="py-2 pr-2">
                        <select className={inputClass} value={editProtoProtocol} onChange={(e) => setEditProtoProtocol(e.target.value)}>
                          <option value="graphql">GraphQL</option>
                          <option value="grpc">gRPC</option>
                          <option value="sse">SSE</option>
                          <option value="ws">WebSocket</option>
                          <option value="rest">REST</option>
                        </select>
                      </td>
                      <td className="py-2 pr-2">{statusBadge(p.status, t)}</td>
                      <td className="py-2 pr-2 text-gray-500">{fmtDate(p.created_at)}</td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button className="p-1 text-emerald-600 hover:text-emerald-800" onClick={saveEditProto} title={t("Save", "保存")}><Check className="w-4 h-4" /></button>
                          <button className="p-1 text-gray-500 hover:text-gray-700" onClick={cancelEditProto} title={t("Cancel", "取消")}><X className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 pr-4 font-mono text-xs">{p.api_path}</td>
                      <td className="py-2 pr-4">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400 uppercase">{p.protocol}</span>
                      </td>
                      <td className="py-2 pr-4">{statusBadge(p.status, t)}</td>
                      <td className="py-2 pr-4 text-gray-500">{fmtDate(p.created_at)}</td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button className="p-1 text-blue-600 hover:text-blue-800" onClick={() => startEditProto(p)} title={t("Edit", "编辑")}><Edit3 className="w-4 h-4" /></button>
                          <button className="p-1 text-red-500 hover:text-red-700" onClick={() => deleteProtocol(p.id)} disabled={protoBusy} title={t("Delete", "删除")}><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderClassificationsTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{t("Data Classifications", "数据分类")}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {t("Classify API data categories, track PII and GDPR relevance per path.", "分类 API 数据，按路径追踪 PII 和 GDPR 相关性。")}
          </p>
        </div>
        <button className={btnPrimary} onClick={() => setShowCreateCls(!showCreateCls)} disabled={clsBusy}>
          <Plus className="w-4 h-4 mr-1" />{t("Create", "创建")}
        </button>
      </div>

      {showCreateCls && (
        <div className={`${cardClass} animate-in fade-in zoom-in-95 duration-300`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className={labelClass}>{t("API Path", "API 路径")}</label>
              <input className={inputClass} value={clsPath} onChange={(e) => setClsPath(e.target.value)} placeholder="/admin/v1/users" />
            </div>
            <div>
              <label className={labelClass}>{t("Data Category", "数据类别")}</label>
              <select className={inputClass} value={clsCategory} onChange={(e) => setClsCategory(e.target.value)}>
                <option value="public">{t("Public", "公共")}</option>
                <option value="internal">{t("Internal", "内部")}</option>
                <option value="confidential">{t("Confidential", "机密")}</option>
                <option value="pii">{t("PII", "个人信息")}</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("Retention (days)", "保留天数")}</label>
              <input className={inputClass} type="number" value={clsRetention} onChange={(e) => setClsRetention(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-6 mb-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={clsPii} onChange={(e) => setClsPii(e.target.checked)} className="rounded" />
              {t("Contains PII", "包含 PII")}
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={clsGdpr} onChange={(e) => setClsGdpr(e.target.checked)} className="rounded" />
              {t("GDPR Relevant", "GDPR 相关")}
            </label>
          </div>
          <div className="mb-4">
            <label className={labelClass}>{t("Notes", "备注")}</label>
            <textarea className={inputClass} rows={3} value={clsNotes} onChange={(e) => setClsNotes(e.target.value)} placeholder={t("Optional notes", "可选备注")} />
          </div>
          <div className="flex gap-2">
            <button className={btnPrimary} onClick={handleCreateCls} disabled={clsBusy}>
              {clsBusy ? t("Creating…", "创建中…") : t("Save Classification", "保存分类")}
            </button>
            <button className={btnSecondary} onClick={() => setShowCreateCls(false)}>{t("Cancel", "取消")}</button>
          </div>
        </div>
      )}

      {classifications.length === 0 ? (
        emptyState(ShieldAlert)
      ) : (
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-800">
                <th className="pb-2 pr-4">{t("API Path", "API 路径")}</th>
                <th className="pb-2 pr-4">{t("Category", "类别")}</th>
                <th className="pb-2 pr-4">{t("PII", "PII")}</th>
                <th className="pb-2 pr-4">{t("GDPR", "GDPR")}</th>
                <th className="pb-2 pr-4">{t("Retention (d)", "保留天数")}</th>
                <th className="pb-2 pr-4">{t("Notes", "备注")}</th>
                <th className="pb-2">{t("Actions", "操作")}</th>
              </tr>
            </thead>
            <tbody>
              {classifications.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 dark:border-gray-800/50">
                  {editClsId === c.id ? (
                    <>
                      <td className="py-2 pr-2"><input className={inputClass} value={editClsPath} onChange={(e) => setEditClsPath(e.target.value)} /></td>
                      <td className="py-2 pr-2">
                        <select className={inputClass} value={editClsCategory} onChange={(e) => setEditClsCategory(e.target.value)}>
                          <option value="public">{t("Public", "公共")}</option>
                          <option value="internal">{t("Internal", "内部")}</option>
                          <option value="confidential">{t("Confidential", "机密")}</option>
                          <option value="pii">{t("PII", "个人信息")}</option>
                        </select>
                      </td>
                      <td className="py-2 pr-2"><input type="checkbox" checked={editClsPii} onChange={(e) => setEditClsPii(e.target.checked)} /></td>
                      <td className="py-2 pr-2"><input type="checkbox" checked={editClsGdpr} onChange={(e) => setEditClsGdpr(e.target.checked)} /></td>
                      <td className="py-2 pr-2"><input className={inputClass} type="number" value={editClsRetention} onChange={(e) => setEditClsRetention(e.target.value)} /></td>
                      <td className="py-2 pr-2"><input className={inputClass} value={editClsNotes} onChange={(e) => setEditClsNotes(e.target.value)} /></td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button className="p-1 text-emerald-600 hover:text-emerald-800" onClick={saveEditCls} title={t("Save", "保存")}><Check className="w-4 h-4" /></button>
                          <button className="p-1 text-gray-500 hover:text-gray-700" onClick={cancelEditCls} title={t("Cancel", "取消")}><X className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 pr-4 font-mono text-xs">{c.api_path}</td>
                      <td className="py-2 pr-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          c.data_category === "pii" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" :
                          c.data_category === "confidential" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400" :
                          c.data_category === "internal" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" :
                          "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        }`}>
                          {c.data_category}
                        </span>
                      </td>
                      <td className="py-2 pr-4">{c.contains_pii ? t("Yes", "是") : t("No", "否")}</td>
                      <td className="py-2 pr-4">{c.gdpr_relevant ? t("Yes", "是") : t("No", "否")}</td>
                      <td className="py-2 pr-4">{c.retention_days}</td>
                      <td className="py-2 pr-4 text-gray-500 max-w-[150px] truncate">{c.notes || "—"}</td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button className="p-1 text-blue-600 hover:text-blue-800" onClick={() => startEditCls(c)} title={t("Edit", "编辑")}><Edit3 className="w-4 h-4" /></button>
                          <button className="p-1 text-red-500 hover:text-red-700" onClick={() => deleteClassification(c.id)} disabled={clsBusy} title={t("Delete", "删除")}><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderPluginsTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{t("Plugins", "插件系统")}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {t("Register custom plugins at hook points in the transform pipeline.", "在转换管线的钩子点注册自定义插件。")}
          </p>
        </div>
        <button className={btnPrimary} onClick={() => setShowCreatePlg(!showCreatePlg)} disabled={plgBusy}>
          <Plus className="w-4 h-4 mr-1" />{t("Create", "创建")}
        </button>
      </div>

      {showCreatePlg && (
        <div className={`${cardClass} animate-in fade-in zoom-in-95 duration-300`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className={labelClass}>{t("Name", "名称")}</label>
              <input className={inputClass} value={plgName} onChange={(e) => setPlgName(e.target.value)} placeholder={t("My Plugin", "插件名称")} />
            </div>
            <div>
              <label className={labelClass}>{t("Plugin Type", "插件类型")}</label>
              <input className={inputClass} value={plgType} onChange={(e) => setPlgType(e.target.value)} placeholder="lua" />
            </div>
            <div>
              <label className={labelClass}>{t("Hook Point", "钩子点")}</label>
              <select className={inputClass} value={plgHook} onChange={(e) => setPlgHook(e.target.value)}>
                <option value="pre_transform">{t("pre_transform", "pre_transform")}</option>
                <option value="post_transform">{t("post_transform", "post_transform")}</option>
                <option value="pre_auth">{t("pre_auth", "pre_auth")}</option>
                <option value="post_auth">{t("post_auth", "post_auth")}</option>
                <option value="pre_cache">{t("pre_cache", "pre_cache")}</option>
                <option value="post_cache">{t("post_cache", "post_cache")}</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("Priority", "优先级")}</label>
              <input className={inputClass} type="number" value={plgPriority} onChange={(e) => setPlgPriority(e.target.value)} />
            </div>
          </div>
          <div className="mb-4">
            <label className={labelClass}>{t("Config JSON", "配置 JSON")}</label>
            <textarea className={inputClass} rows={4} value={plgConfigJson} onChange={(e) => setPlgConfigJson(e.target.value)} placeholder='{"key": "value"}' />
          </div>
          <div className="flex gap-2">
            <button className={btnPrimary} onClick={handleCreatePlg} disabled={plgBusy}>
              {plgBusy ? t("Creating…", "创建中…") : t("Save Plugin", "保存插件")}
            </button>
            <button className={btnSecondary} onClick={() => setShowCreatePlg(false)}>{t("Cancel", "取消")}</button>
          </div>
        </div>
      )}

      {plugins.length === 0 ? (
        emptyState(Settings)
      ) : (
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-800">
                <th className="pb-2 pr-4">{t("Name", "名称")}</th>
                <th className="pb-2 pr-4">{t("Type", "类型")}</th>
                <th className="pb-2 pr-4">{t("Hook Point", "钩子点")}</th>
                <th className="pb-2 pr-4">{t("Priority", "优先级")}</th>
                <th className="pb-2 pr-4">{t("Status", "状态")}</th>
                <th className="pb-2">{t("Actions", "操作")}</th>
              </tr>
            </thead>
            <tbody>
              {plugins.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 dark:border-gray-800/50">
                  {editPlgId === p.id ? (
                    <>
                      <td className="py-2 pr-2"><input className={inputClass} value={editPlgName} onChange={(e) => setEditPlgName(e.target.value)} /></td>
                      <td className="py-2 pr-2"><input className={inputClass} value={editPlgType} onChange={(e) => setEditPlgType(e.target.value)} /></td>
                      <td className="py-2 pr-2">
                        <select className={inputClass} value={editPlgHook} onChange={(e) => setEditPlgHook(e.target.value)}>
                          <option value="pre_transform">pre_transform</option>
                          <option value="post_transform">post_transform</option>
                          <option value="pre_auth">pre_auth</option>
                          <option value="post_auth">post_auth</option>
                          <option value="pre_cache">pre_cache</option>
                          <option value="post_cache">post_cache</option>
                        </select>
                      </td>
                      <td className="py-2 pr-2"><input className={inputClass} type="number" value={editPlgPriority} onChange={(e) => setEditPlgPriority(e.target.value)} /></td>
                      <td className="py-2 pr-2">{statusBadge(p.status, t)}</td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button className="p-1 text-emerald-600 hover:text-emerald-800" onClick={saveEditPlg} title={t("Save", "保存")}><Check className="w-4 h-4" /></button>
                          <button className="p-1 text-gray-500 hover:text-gray-700" onClick={cancelEditPlg} title={t("Cancel", "取消")}><X className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 pr-4 font-medium">{p.name}</td>
                      <td className="py-2 pr-4">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400 uppercase">{p.plugin_type}</span>
                      </td>
                      <td className="py-2 pr-4">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400">{p.hook_point}</span>
                      </td>
                      <td className="py-2 pr-4">{p.priority}</td>
                      <td className="py-2 pr-4">{statusBadge(p.status, t)}</td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button className="p-1 text-blue-600 hover:text-blue-800" onClick={() => startEditPlg(p)} title={t("Edit", "编辑")}><Edit3 className="w-4 h-4" /></button>
                          <button className="p-1 text-red-500 hover:text-red-700" onClick={() => deletePlugin(p.id)} disabled={plgBusy} title={t("Delete", "删除")}><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ──────────────────────────────────────────────────────────────────────
  //  Main render
  // ──────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div>
        <h1 className="text-3xl font-bold">{t("Advanced Features", "高级功能")}</h1>
        <p className="text-gray-500 mt-1">
          {t(
            "API Products, circuit breakers, protocol extensions, compliance, and plugin system.",
            "API 产品化、熔断器、协议扩展、合规管理和插件系统。",
          )}
        </p>
      </div>

      {/* ── Sub-Tab Bar ── */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-800 pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg transition ${
                isActive
                  ? "text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-b-2 border-blue-600 -mb-[2px]"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t(tab.en, tab.zh)}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ── */}
      <div>
        {activeTab === "products" && renderProductsTab()}
        {activeTab === "subscriptions" && renderSubscriptionsTab()}
        {activeTab === "circuit-breakers" && renderCircuitBreakersTab()}
        {activeTab === "protocols" && renderProtocolsTab()}
        {activeTab === "classifications" && renderClassificationsTab()}
        {activeTab === "plugins" && renderPluginsTab()}
      </div>
    </div>
  );
}
