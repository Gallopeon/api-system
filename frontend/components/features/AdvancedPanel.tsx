"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Edit3, X, Check, Package, RefreshCw, AlertTriangle, Code2, ShieldAlert, Settings } from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary, btnSecondary } from "@/lib/constants";
import { useProducts, useSubscriptions, useCircuitBreakers, useProtocols, useClassifications, usePlugins } from "@/hooks/useAdvanced";
import type { ApiProduct, Subscription, CircuitBreaker, ProtocolConfig, DataClassification, PluginConfig } from "@/lib/types";

interface AdvancedPanelProps {
  accessToken?: string;
  notifyError: (msg: string) => void;
  notifySucc: (msg: string) => void;
  t: <T>(en: T, zh: T) => T;
}

const PROTOCOLS = ["graphql", "grpc", "sse", "ws", "rest"];
const HOOK_POINTS = ["pre_transform", "post_transform", "pre_auth", "post_auth", "pre_cache", "post_cache"];
const DATA_CATEGORIES = ["public", "internal", "confidential", "pii"];
const PLANS = ["free", "pro", "enterprise"];

const tabs = [
  { id: "products", icon: Package, en: "API Products", zh: "API 产品" },
  { id: "subscriptions", icon: RefreshCw, en: "Subscriptions", zh: "订阅管理" },
  { id: "circuit-breakers", icon: AlertTriangle, en: "Circuit Breakers", zh: "熔断器" },
  { id: "protocols", icon: Code2, en: "Protocols", zh: "协议扩展" },
  { id: "classifications", icon: ShieldAlert, en: "Classifications", zh: "数据分类" },
  { id: "plugins", icon: Settings, en: "Plugins", zh: "插件系统" },
];

export default function AdvancedPanel({ accessToken, notifyError, notifySucc, t }: AdvancedPanelProps) {
  const [activeTab, setActiveTab] = useState("products");

  const productsHook = useProducts(accessToken, notifyError, notifySucc);
  const subscriptionsHook = useSubscriptions(accessToken, notifyError, notifySucc);
  const cbHook = useCircuitBreakers(accessToken, notifyError, notifySucc);
  const protoHook = useProtocols(accessToken, notifyError, notifySucc);
  const clHook = useClassifications(accessToken, notifyError, notifySucc);
  const pluginsHook = usePlugins(accessToken, notifyError, notifySucc);

  // Create form toggles
  const [showCreate, setShowCreate] = useState<Record<string, boolean>>({});

  // Create form state — Products
  const [pName, setPName] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pRuleIds, setPRuleIds] = useState("");

  // Create form state — Subscriptions
  const [subKeyId, setSubKeyId] = useState("");
  const [subProductId, setSubProductId] = useState("");
  const [subPlan, setSubPlan] = useState("free");

  // Create form state — Circuit Breakers
  const [cbPath, setCbPath] = useState("");
  const [cbFailThr, setCbFailThr] = useState("5");
  const [cbRecovery, setCbRecovery] = useState("30");
  const [cbHalfOpen, setCbHalfOpen] = useState("3");
  const [cbRetryCnt, setCbRetryCnt] = useState("3");
  const [cbRetryDelay, setCbRetryDelay] = useState("100");
  const [cbTimeout, setCbTimeout] = useState("10000");

  // Create form state — Protocols
  const [ptPath, setPtPath] = useState("");
  const [ptProto, setPtProto] = useState("grpc");
  const [ptConfig, setPtConfig] = useState("");

  // Create form state — Classifications
  const [clPath, setClPath] = useState("");
  const [clCategory, setClCategory] = useState("internal");
  const [clPii, setClPii] = useState(false);
  const [clGdpr, setClGdpr] = useState(false);
  const [clRetention, setClRetention] = useState("365");
  const [clNotes, setClNotes] = useState("");

  // Create form state — Plugins
  const [plName, setPlName] = useState("");
  const [plType, setPlType] = useState("lua");
  const [plHook, setPlHook] = useState("pre_transform");
  const [plJson, setPlJson] = useState("");
  const [plPriority, setPlPriority] = useState("100");

  // Edit state
  const [editId, setEditId] = useState("");
  const [editData, setEditData] = useState<Record<string, string>>({});

  useEffect(() => {
    productsHook.loadProducts();
    subscriptionsHook.loadSubscriptions();
    cbHook.loadCBs();
    protoHook.loadProtocols();
    clHook.loadClassifications();
    pluginsHook.loadPlugins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCreate = (tab: string) =>
    setShowCreate((s) => ({ ...s, [tab]: !s[tab] }));

  const startEdit = (item: Record<string, unknown>) => {
    setEditId(item.id as string);
    const d: Record<string, string> = {};
    for (const [k, v] of Object.entries(item)) {
      if (k === "id" || k === "created_at") continue;
      if (typeof v === "boolean") d[k] = v ? "true" : "false";
      else if (v === null || v === undefined) d[k] = "";
      else d[k] = String(v);
    }
    setEditData(d);
  };

  const cancelEdit = () => {
    setEditId("");
    setEditData({});
  };

  const emptyTable = (msgEn: string, msgZh: string, Icon: React.ComponentType<{ className?: string }>) => (
    <tr><td colSpan={10} className="py-12 text-center text-gray-400">
      <Icon className="w-10 h-10 mx-auto mb-3 opacity-40" />
      <div className="font-medium">{t(msgEn, msgZh)}</div>
    </td></tr>
  );

  const actionBtns = (id: string, onUpdate: (id: string, data: Record<string, unknown>) => Promise<void>, onDelete: (id: string) => Promise<void>) => {
    if (editId === id) {
      return (
        <div className="flex space-x-1">
          <button onClick={async () => {
            const cleaned: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(editData)) {
              if (v === "true") cleaned[k] = true;
              else if (v === "false") cleaned[k] = false;
              else if (v !== "") cleaned[k] = v;
            }
            await onUpdate(id, cleaned);
            cancelEdit();
          }} className="text-green-500 hover:text-green-700 p-1"><Check className="w-4 h-4" /></button>
          <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-4 h-4" /></button>
        </div>
      );
    }
    return (
      <div className="flex space-x-1">
        <button onClick={() => startEdit(id as any)} className="text-blue-500 hover:text-blue-700 p-1"><Edit3 className="w-4 h-4" /></button>
        <button onClick={() => onDelete(id)} disabled={productsHook.busy} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4" /></button>
      </div>
    );
  };

  const editCell = (key: string) => editId ? (
    <input className={`${inputClass} py-1 text-xs`} value={editData[key] || ""} onChange={(e) => setEditData((d) => ({ ...d, [key]: e.target.value }))} />
  ) : null;

  const statusBadge = (status: string) => (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
      status === "active" ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
    }`}>
      {status}
    </span>
  );

  // ================================================================
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">{t("Advanced Features", "高级功能")}</h1>
        <p className="text-gray-500">{t("API Products, circuit breakers, protocol extensions, compliance, and plugin system.", "API 产品化、熔断器、协议扩展、合规管理和插件系统。")}</p>
      </div>

      {/* Sub-Tab Bar */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 space-x-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center space-x-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id ? "border-blue-600 text-blue-700 dark:text-blue-400" : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}>
            <tab.icon className="w-4 h-4" /><span>{t(tab.en, tab.zh)}</span>
          </button>
        ))}
      </div>

      {/* ─── Products ─── */}
      {activeTab === "products" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">{t("API Products", "API 产品")}</h2>
            <button onClick={() => toggleCreate("products")} className={btnPrimary}><Plus className="w-4 h-4 mr-1" />{t("Create", "创建")}</button>
          </div>
          {showCreate.products && (
            <div className={`${cardClass} border-l-4 border-l-emerald-500`}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div><label className={labelClass}>{t("Name", "名称")} *</label><input className={inputClass} value={pName} onChange={(e) => setPName(e.target.value)} /></div>
                <div><label className={labelClass}>{t("Description", "描述")}</label><input className={inputClass} value={pDesc} onChange={(e) => setPDesc(e.target.value)} /></div>
                <div><label className={labelClass}>{t("Rule IDs (comma)", "规则ID (逗号)")}</label><input className={inputClass} value={pRuleIds} onChange={(e) => setPRuleIds(e.target.value)} /></div>
              </div>
              <div className="flex space-x-2 mt-3">
                <button onClick={async () => { await productsHook.createProduct(pName, pDesc, pRuleIds ? pRuleIds.split(",").map((s) => s.trim()).filter(Boolean) : undefined); setPName(""); setPDesc(""); setPRuleIds(""); toggleCreate("products"); }} disabled={productsHook.busy} className={btnPrimary}>{t("Save", "保存")}</button>
                <button onClick={() => toggleCreate("products")} className={btnSecondary}>{t("Cancel", "取消")}</button>
              </div>
            </div>
          )}
          <div className={`${cardClass} overflow-x-auto`}>
            <table className="w-full text-sm"><thead><tr className="border-b border-gray-200 dark:border-gray-700 text-left">
              <th className="py-3 pr-4 font-medium text-gray-500">{t("Name", "名称")}</th><th className="py-3 pr-4 font-medium text-gray-500">{t("Description", "描述")}</th><th className="py-3 pr-4 font-medium text-gray-500">{t("Status", "状态")}</th><th className="py-3 font-medium text-gray-500">{t("Actions", "操作")}</th>
            </tr></thead><tbody>
              {productsHook.products.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-3 pr-4 font-medium">{editId === p.id ? editCell("name") : p.name}</td>
                  <td className="py-3 pr-4 text-gray-500 text-xs">{editId === p.id ? editCell("description") : (p.description || "—")}</td>
                  <td className="py-3 pr-4">{editId === p.id ? editCell("status") : statusBadge(p.status)}</td>
                  <td className="py-3">{actionBtns(p.id, async (id, d) => { await productsHook.updateProduct(id, d); }, productsHook.deleteProduct)}</td>
                </tr>
              ))}
              {productsHook.products.length === 0 && emptyTable("No products yet", "暂无产品", Package)}
            </tbody></table>
          </div>
        </div>
      )}

      {/* ─── Subscriptions ─── */}
      {activeTab === "subscriptions" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">{t("Subscriptions", "订阅管理")}</h2>
            <button onClick={() => toggleCreate("subscriptions")} className={btnPrimary}><Plus className="w-4 h-4 mr-1" />{t("Create", "创建")}</button>
          </div>
          {showCreate.subscriptions && (
            <div className={`${cardClass} border-l-4 border-l-emerald-500`}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div><label className={labelClass}>{t("API Key ID", "API Key ID")} *</label><input className={inputClass} value={subKeyId} onChange={(e) => setSubKeyId(e.target.value)} /></div>
                <div><label className={labelClass}>{t("Product ID", "产品 ID")} *</label><input className={inputClass} value={subProductId} onChange={(e) => setSubProductId(e.target.value)} /></div>
                <div><label className={labelClass}>{t("Plan", "套餐")}</label><select className={inputClass} value={subPlan} onChange={(e) => setSubPlan(e.target.value)}>{PLANS.map((r) => (<option key={r} value={r}>{r}</option>))}</select></div>
              </div>
              <div className="flex space-x-2 mt-3">
                <button onClick={async () => { await subscriptionsHook.createSubscription(subKeyId, subProductId, subPlan); setSubKeyId(""); setSubProductId(""); setSubPlan("free"); toggleCreate("subscriptions"); }} disabled={subscriptionsHook.busy} className={btnPrimary}>{t("Save", "保存")}</button>
                <button onClick={() => toggleCreate("subscriptions")} className={btnSecondary}>{t("Cancel", "取消")}</button>
              </div>
            </div>
          )}
          <div className={`${cardClass} overflow-x-auto`}>
            <table className="w-full text-sm"><thead><tr className="border-b border-gray-200 dark:border-gray-700 text-left">
              <th className="py-3 pr-4 font-medium text-gray-500">{t("API Key ID", "API Key ID")}</th><th className="py-3 pr-4 font-medium text-gray-500">{t("Product ID", "产品 ID")}</th><th className="py-3 pr-4 font-medium text-gray-500">{t("Plan", "套餐")}</th><th className="py-3 pr-4 font-medium text-gray-500">{t("Status", "状态")}</th><th className="py-3 font-medium text-gray-500">{t("Actions", "操作")}</th>
            </tr></thead><tbody>
              {subscriptionsHook.subscriptions.map((s) => (
                <tr key={s.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-3 pr-4 font-mono text-xs">{editId === s.id ? editCell("api_key_id") : s.api_key_id}</td>
                  <td className="py-3 pr-4 font-mono text-xs">{editId === s.id ? editCell("product_id") : s.product_id}</td>
                  <td className="py-3 pr-4">{editId === s.id ? editCell("plan") : <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">{s.plan}</span>}</td>
                  <td className="py-3 pr-4">{editId === s.id ? editCell("status") : statusBadge(s.status)}</td>
                  <td className="py-3">{actionBtns(s.id, async (id, d) => { await subscriptionsHook.updateSubscription(id, d); }, subscriptionsHook.deleteSubscription)}</td>
                </tr>
              ))}
              {subscriptionsHook.subscriptions.length === 0 && emptyTable("No subscriptions yet", "暂无订阅", RefreshCw)}
            </tbody></table>
          </div>
        </div>
      )}

      {/* ─── Circuit Breakers ─── */}
      {activeTab === "circuit-breakers" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">{t("Circuit Breakers", "熔断器")}</h2>
            <button onClick={() => toggleCreate("circuit-breakers")} className={btnPrimary}><Plus className="w-4 h-4 mr-1" />{t("Create", "创建")}</button>
          </div>
          {showCreate["circuit-breakers"] && (
            <div className={`${cardClass} border-l-4 border-l-orange-500`}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><label className={labelClass}>{t("API Path", "API 路径")} *</label><input className={inputClass} value={cbPath} onChange={(e) => setCbPath(e.target.value)} placeholder="/api/v1/users" /></div>
                <div><label className={labelClass}>{t("Failure Threshold", "故障阈值")}</label><input className={inputClass} type="number" value={cbFailThr} onChange={(e) => setCbFailThr(e.target.value)} /></div>
                <div><label className={labelClass}>{t("Recovery (sec)", "恢复时间 (秒)")}</label><input className={inputClass} type="number" value={cbRecovery} onChange={(e) => setCbRecovery(e.target.value)} /></div>
                <div><label className={labelClass}>{t("Half-Open Max", "半开最大")}</label><input className={inputClass} type="number" value={cbHalfOpen} onChange={(e) => setCbHalfOpen(e.target.value)} /></div>
                <div><label className={labelClass}>{t("Retry Count", "重试次数")}</label><input className={inputClass} type="number" value={cbRetryCnt} onChange={(e) => setCbRetryCnt(e.target.value)} /></div>
                <div><label className={labelClass}>{t("Retry Delay (ms)", "重试间隔")}</label><input className={inputClass} type="number" value={cbRetryDelay} onChange={(e) => setCbRetryDelay(e.target.value)} /></div>
                <div><label className={labelClass}>{t("Timeout (ms)", "超时")}</label><input className={inputClass} type="number" value={cbTimeout} onChange={(e) => setCbTimeout(e.target.value)} /></div>
              </div>
              <div className="flex space-x-2 mt-3">
                <button onClick={async () => { await cbHook.createCB({ api_path: cbPath, failure_threshold: Number(cbFailThr), recovery_timeout_sec: Number(cbRecovery), half_open_max: Number(cbHalfOpen), retry_count: Number(cbRetryCnt), retry_delay_ms: Number(cbRetryDelay), timeout_ms: Number(cbTimeout) }); setCbPath(""); toggleCreate("circuit-breakers"); }} disabled={cbHook.busy} className={btnPrimary}>{t("Save", "保存")}</button>
                <button onClick={() => toggleCreate("circuit-breakers")} className={btnSecondary}>{t("Cancel", "取消")}</button>
              </div>
            </div>
          )}
          <div className={`${cardClass} overflow-x-auto`}>
            <table className="w-full text-xs"><thead><tr className="border-b border-gray-200 dark:border-gray-700 text-left">
              <th className="py-3 pr-2 font-medium text-gray-500">{t("API Path", "路径")}</th><th className="py-3 pr-2 font-medium text-gray-500">{t("Fail Thr", "故障阈值")}</th><th className="py-3 pr-2 font-medium text-gray-500">{t("Recovery", "恢复")}</th><th className="py-3 pr-2 font-medium text-gray-500">{t("Status", "状态")}</th><th className="py-3 font-medium text-gray-500">{t("Actions", "操作")}</th>
            </tr></thead><tbody>
              {cbHook.cbs.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-2 pr-2 font-mono text-xs">{editId === c.id ? editCell("api_path") : c.api_path}</td>
                  <td className="py-2 pr-2">{editId === c.id ? editCell("failure_threshold") : c.failure_threshold}</td>
                  <td className="py-2 pr-2">{editId === c.id ? editCell("recovery_timeout_sec") : `${c.recovery_timeout_sec}s`}</td>
                  <td className="py-2 pr-2">{editId === c.id ? editCell("status") : statusBadge(c.status)}</td>
                  <td className="py-2">{actionBtns(c.id, async (id, d) => { await cbHook.updateCB(id, d); }, cbHook.deleteCB)}</td>
                </tr>
              ))}
              {cbHook.cbs.length === 0 && emptyTable("No circuit breakers yet", "暂无熔断器", AlertTriangle)}
            </tbody></table>
          </div>
        </div>
      )}

      {/* ─── Protocols ─── */}
      {activeTab === "protocols" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">{t("Protocol Extensions", "协议扩展")}</h2>
            <button onClick={() => toggleCreate("protocols")} className={btnPrimary}><Plus className="w-4 h-4 mr-1" />{t("Create", "创建")}</button>
          </div>
          {showCreate.protocols && (
            <div className={`${cardClass} border-l-4 border-l-cyan-500`}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div><label className={labelClass}>{t("API Path", "API 路径")} *</label><input className={inputClass} value={ptPath} onChange={(e) => setPtPath(e.target.value)} /></div>
                <div><label className={labelClass}>{t("Protocol", "协议")}</label><select className={inputClass} value={ptProto} onChange={(e) => setPtProto(e.target.value)}>{PROTOCOLS.map((r) => (<option key={r} value={r}>{r}</option>))}</select></div>
                <div><label className={labelClass}>{t("Config JSON", "配置 JSON")}</label><textarea className={inputClass} rows={2} value={ptConfig} onChange={(e) => setPtConfig(e.target.value)} /></div>
              </div>
              <div className="flex space-x-2 mt-3">
                <button onClick={async () => { await protoHook.createProtocol({ api_path: ptPath, protocol: ptProto, config_json: ptConfig || null }); setPtPath(""); setPtConfig(""); toggleCreate("protocols"); }} disabled={protoHook.busy} className={btnPrimary}>{t("Save", "保存")}</button>
                <button onClick={() => toggleCreate("protocols")} className={btnSecondary}>{t("Cancel", "取消")}</button>
              </div>
            </div>
          )}
          <div className={`${cardClass} overflow-x-auto`}>
            <table className="w-full text-sm"><thead><tr className="border-b border-gray-200 dark:border-gray-700 text-left">
              <th className="py-3 pr-4 font-medium text-gray-500">{t("API Path", "路径")}</th><th className="py-3 pr-4 font-medium text-gray-500">{t("Protocol", "协议")}</th><th className="py-3 pr-4 font-medium text-gray-500">{t("Status", "状态")}</th><th className="py-3 font-medium text-gray-500">{t("Actions", "操作")}</th>
            </tr></thead><tbody>
              {protoHook.protocols.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-3 pr-4 font-mono text-xs">{editId === p.id ? editCell("api_path") : p.api_path}</td>
                  <td className="py-3 pr-4">{editId === p.id ? editCell("protocol") : <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">{p.protocol}</span>}</td>
                  <td className="py-3 pr-4">{editId === p.id ? editCell("status") : statusBadge(p.status)}</td>
                  <td className="py-3">{actionBtns(p.id, async (id, d) => { await protoHook.updateProtocol(id, d); }, protoHook.deleteProtocol)}</td>
                </tr>
              ))}
              {protoHook.protocols.length === 0 && emptyTable("No protocols yet", "暂无协议", Code2)}
            </tbody></table>
          </div>
        </div>
      )}

      {/* ─── Classifications ─── */}
      {activeTab === "classifications" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">{t("Data Classifications", "数据分类")}</h2>
            <button onClick={() => toggleCreate("classifications")} className={btnPrimary}><Plus className="w-4 h-4 mr-1" />{t("Create", "创建")}</button>
          </div>
          {showCreate.classifications && (
            <div className={`${cardClass} border-l-4 border-l-red-500`}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div><label className={labelClass}>{t("API Path", "API 路径")} *</label><input className={inputClass} value={clPath} onChange={(e) => setClPath(e.target.value)} /></div>
                <div><label className={labelClass}>{t("Category", "分类")}</label><select className={inputClass} value={clCategory} onChange={(e) => setClCategory(e.target.value)}>{DATA_CATEGORIES.map((r) => (<option key={r} value={r}>{r}</option>))}</select></div>
                <div><label className={labelClass}>{t("Retention (days)", "保留天数")}</label><input className={inputClass} type="number" value={clRetention} onChange={(e) => setClRetention(e.target.value)} /></div>
              </div>
              <div className="flex items-center space-x-6 mt-3">
                <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" className="rounded" checked={clPii} onChange={(e) => setClPii(e.target.checked)} /><span className="text-sm">{t("Contains PII", "包含 PII")}</span></label>
                <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" className="rounded" checked={clGdpr} onChange={(e) => setClGdpr(e.target.checked)} /><span className="text-sm">{t("GDPR Relevant", "涉及 GDPR")}</span></label>
              </div>
              <div className="mt-2"><label className={labelClass}>{t("Notes", "备注")}</label><input className={inputClass} value={clNotes} onChange={(e) => setClNotes(e.target.value)} /></div>
              <div className="flex space-x-2 mt-3">
                <button onClick={async () => { await clHook.createClassification({ api_path: clPath, data_category: clCategory, contains_pii: clPii, gdpr_relevant: clGdpr, retention_days: Number(clRetention), notes: clNotes || null }); setClPath(""); setClNotes(""); toggleCreate("classifications"); }} disabled={clHook.busy} className={btnPrimary}>{t("Save", "保存")}</button>
                <button onClick={() => toggleCreate("classifications")} className={btnSecondary}>{t("Cancel", "取消")}</button>
              </div>
            </div>
          )}
          <div className={`${cardClass} overflow-x-auto`}>
            <table className="w-full text-xs"><thead><tr className="border-b border-gray-200 dark:border-gray-700 text-left">
              <th className="py-3 pr-2 font-medium text-gray-500">{t("API Path", "路径")}</th><th className="py-3 pr-2 font-medium text-gray-500">{t("Category", "分类")}</th><th className="py-3 pr-2 font-medium text-gray-500">PII</th><th className="py-3 pr-2 font-medium text-gray-500">GDPR</th><th className="py-3 pr-2 font-medium text-gray-500">{t("Retention", "保留")}</th><th className="py-3 font-medium text-gray-500">{t("Actions", "操作")}</th>
            </tr></thead><tbody>
              {clHook.classifications.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-2 pr-2 font-mono text-xs">{editId === c.id ? editCell("api_path") : c.api_path}</td>
                  <td className="py-2 pr-2">{editId === c.id ? editCell("data_category") : <span className={`px-2 py-0.5 rounded-full text-xs ${
                    c.data_category === "pii" ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300" :
                    c.data_category === "confidential" ? "bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300" :
                    "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  }`}>{c.data_category}</span>}</td>
                  <td className="py-2 pr-2">{editId === c.id ? editCell("contains_pii") : (c.contains_pii ? "✅" : "—")}</td>
                  <td className="py-2 pr-2">{editId === c.id ? editCell("gdpr_relevant") : (c.gdpr_relevant ? "✅" : "—")}</td>
                  <td className="py-2 pr-2">{editId === c.id ? editCell("retention_days") : `${c.retention_days}d`}</td>
                  <td className="py-2">{actionBtns(c.id, async (id, d) => { await clHook.updateClassification(id, d); }, clHook.deleteClassification)}</td>
                </tr>
              ))}
              {clHook.classifications.length === 0 && emptyTable("No classifications yet", "暂无数据分类", ShieldAlert)}
            </tbody></table>
          </div>
        </div>
      )}

      {/* ─── Plugins ─── */}
      {activeTab === "plugins" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">{t("Plugin System", "插件系统")}</h2>
            <button onClick={() => toggleCreate("plugins")} className={btnPrimary}><Plus className="w-4 h-4 mr-1" />{t("Create", "创建")}</button>
          </div>
          {showCreate.plugins && (
            <div className={`${cardClass} border-l-4 border-l-violet-500`}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div><label className={labelClass}>{t("Name", "名称")} *</label><input className={inputClass} value={plName} onChange={(e) => setPlName(e.target.value)} /></div>
                <div><label className={labelClass}>{t("Type", "类型")}</label><input className={inputClass} value={plType} onChange={(e) => setPlType(e.target.value)} placeholder="lua/js/wasm" /></div>
                <div><label className={labelClass}>{t("Hook Point", "钩子点")}</label><select className={inputClass} value={plHook} onChange={(e) => setPlHook(e.target.value)}>{HOOK_POINTS.map((r) => (<option key={r} value={r}>{r}</option>))}</select></div>
                <div><label className={labelClass}>{t("Priority", "优先级")}</label><input className={inputClass} type="number" value={plPriority} onChange={(e) => setPlPriority(e.target.value)} /></div>
                <div className="md:col-span-2"><label className={labelClass}>{t("Config JSON", "配置 JSON")}</label><textarea className={inputClass} rows={2} value={plJson} onChange={(e) => setPlJson(e.target.value)} /></div>
              </div>
              <div className="flex space-x-2 mt-3">
                <button onClick={async () => { await pluginsHook.createPlugin({ name: plName, plugin_type: plType, hook_point: plHook, config_json: plJson || null, priority: Number(plPriority) }); setPlName(""); setPlJson(""); toggleCreate("plugins"); }} disabled={pluginsHook.busy} className={btnPrimary}>{t("Save", "保存")}</button>
                <button onClick={() => toggleCreate("plugins")} className={btnSecondary}>{t("Cancel", "取消")}</button>
              </div>
            </div>
          )}
          <div className={`${cardClass} overflow-x-auto`}>
            <table className="w-full text-sm"><thead><tr className="border-b border-gray-200 dark:border-gray-700 text-left">
              <th className="py-3 pr-4 font-medium text-gray-500">{t("Name", "名称")}</th><th className="py-3 pr-4 font-medium text-gray-500">{t("Type", "类型")}</th><th className="py-3 pr-4 font-medium text-gray-500">{t("Hook", "钩子")}</th><th className="py-3 pr-4 font-medium text-gray-500">{t("Priority", "优先级")}</th><th className="py-3 pr-4 font-medium text-gray-500">{t("Status", "状态")}</th><th className="py-3 font-medium text-gray-500">{t("Actions", "操作")}</th>
            </tr></thead><tbody>
              {pluginsHook.plugins.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-3 pr-4 font-medium">{editId === p.id ? editCell("name") : p.name}</td>
                  <td className="py-3 pr-4"><span className="px-2 py-0.5 rounded-full text-xs bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300">{editId === p.id ? editCell("plugin_type") : p.plugin_type}</span></td>
                  <td className="py-3 pr-4 text-xs font-mono">{editId === p.id ? editCell("hook_point") : p.hook_point}</td>
                  <td className="py-3 pr-4">{editId === p.id ? editCell("priority") : p.priority}</td>
                  <td className="py-3 pr-4">{editId === p.id ? editCell("status") : statusBadge(p.status)}</td>
                  <td className="py-3">{actionBtns(p.id, async (id, d) => { await pluginsHook.updatePlugin(id, d); }, pluginsHook.deletePlugin)}</td>
                </tr>
              ))}
              {pluginsHook.plugins.length === 0 && emptyTable("No plugins yet", "暂无插件", Settings)}
            </tbody></table>
          </div>
        </div>
      )}
    </div>
  );
}
