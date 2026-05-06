"use client";

import { useEffect, useState } from "react";
import { Network, FileText, Send, Plus, Trash2, Edit3, Check, X, Power, PowerOff, Zap, RefreshCw, Bot, DollarSign, Clock, Hash } from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary, btnSecondary } from "@/lib/constants";
import { useLlmGateway } from "@/hooks/useLlmGateway";
import type { LlmProvider, PromptTemplate } from "@/lib/types";

const TABS = [
  { id: "route", icon: Send, en: "LLM Route", zh: "LLM 路由" },
  { id: "providers", icon: Network, en: "Providers", zh: "提供商", admin: true },
  { id: "templates", icon: FileText, en: "Templates", zh: "模板", admin: true },
];

const PROVIDER_TYPES = ["openai", "anthropic", "azure", "google", "custom"];

interface PanelProps {
  canManage: boolean;
  notifyError: (msg: string) => void;
  notifySucc: (msg: string) => void;
  t: <T>(en: T, zh: T) => T;
  accessToken?: string;
}

export default function LlmGatewayPanel({ canManage, notifyError, notifySucc, t, accessToken }: PanelProps) {
  const [activeTab, setActiveTab] = useState("route");
  const hook = useLlmGateway(notifyError, notifySucc, accessToken);

  useEffect(() => {
    hook.loadProviders();
    hook.loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const st = !canManage && activeTab !== "route" ? "route" : activeTab;

  // ── Shared helpers ──
  const statusBadge = (status: string) => (
    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-yellow-100 text-yellow-700 dark:text-yellow-900/30 dark:text-yellow-400"}`}>{status}</span>
  );

  // ── Route Tab ──
  const routeTab = (
    <div className="space-y-4">
      <div className={`${cardClass} border-l-4 border-l-purple-500`}>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Bot className="w-5 h-5 text-purple-500" /> {t("Send Prompt to LLM", "发送 Prompt 到 LLM")}
        </h2>
        <div className="space-y-3">
          <div>
            <label className={labelClass}>{t("Prompt", "提示词")} *</label>
            <textarea className={inputClass} rows={4} value={hook.rtPrompt} onChange={e => hook.setRtPrompt(e.target.value)} placeholder={t("Enter your prompt...", "输入您的提示词...")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("Model (optional)", "模型（可选）")}</label>
              <input className={inputClass} value={hook.rtModel} onChange={e => hook.setRtModel(e.target.value)} placeholder="gpt-4o" />
            </div>
            <div>
              <label className={labelClass}>{t("Max Tokens", "最大 Token")}</label>
              <input className={inputClass} type="number" value={hook.rtMaxTokens} onChange={e => hook.setRtMaxTokens(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("Temperature", "温度")}</label>
              <input className={inputClass} type="number" step="0.1" min="0" max="2" value={hook.rtTemp} onChange={e => hook.setRtTemp(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t("Use Template (optional)", "使用模板（可选）")}</label>
              <select className={inputClass} value={hook.rtTemplateId} onChange={e => hook.setRtTemplateId(e.target.value)}>
                <option value="">{t("None", "不使用")}</option>
                {hook.templates.map(tmpl => <option key={tmpl.id} value={tmpl.id}>{tmpl.name}</option>)}
              </select>
            </div>
          </div>
          <button onClick={hook.sendRoute} disabled={hook.busy || !hook.rtPrompt.trim()} className={btnPrimary}>
            {hook.busy ? t("Sending...", "发送中...") : <span className="flex items-center gap-2"><Send className="w-4 h-4" />{t("Send to LLM", "发送到 LLM")}</span>}
          </button>
        </div>
      </div>

      {hook.routeResult && (
        <div className={`${cardClass} border-l-4 border-l-green-500`}>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><Check className="w-5 h-5 text-green-500" /> {t("Response", "响应结果")}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-2"><div className="text-gray-500 text-xs">{t("Provider", "提供商")}</div><div className="font-semibold">{hook.routeResult.provider}</div></div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-2"><div className="text-gray-500 text-xs">{t("Model", "模型")}</div><div className="font-semibold truncate">{hook.routeResult.model}</div></div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-2"><div className="text-gray-500 text-xs">{t("Tokens", "Token")}</div><div className="font-semibold">{hook.routeResult.input_tokens}+{hook.routeResult.output_tokens}</div></div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-2"><div className="text-gray-500 text-xs">{t("Cost / Latency", "成本 / 延迟")}</div><div className="font-semibold">${hook.routeResult.cost.toFixed(6)} / {hook.routeResult.latency_ms}ms</div></div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto"><pre className="text-sm whitespace-pre-wrap">{hook.routeResult.response}</pre></div>
        </div>
      )}
    </div>
  );

  // ── Providers Tab ──
  const providerForm = (
    <div className={`${cardClass} border-l-4 border-l-purple-500`}>
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
        {hook.editProvId ? <Edit3 className="w-5 h-5 text-purple-500" /> : <Plus className="w-5 h-5 text-purple-500" />}
        {hook.editProvId ? t("Edit Provider", "编辑提供商") : t("Add Provider", "添加提供商")}
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <div><label className={labelClass}>{t("Name", "名称")} *</label><input className={inputClass} value={hook.pName} onChange={e => hook.setPName(e.target.value)} placeholder="OpenAI" /></div>
        <div>
          <label className={labelClass}>{t("Type", "类型")}</label>
          <select className={inputClass} value={hook.pType} onChange={e => hook.setPType(e.target.value)}>
            {PROVIDER_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
          </select>
        </div>
        <div><label className={labelClass}>{t("Endpoint URL", "端点 URL")} *</label><input className={inputClass} value={hook.pEndpoint} onChange={e => hook.setPEndpoint(e.target.value)} placeholder="https://api.openai.com" /></div>
        <div><label className={labelClass}>{t("Model Name", "模型名称")} *</label><input className={inputClass} value={hook.pModel} onChange={e => hook.setPModel(e.target.value)} placeholder="gpt-4o" /></div>
        <div><label className={labelClass}>{t("API Key Env Var", "API Key 环境变量")}</label><input className={inputClass} value={hook.pKeyEnv} onChange={e => hook.setPKeyEnv(e.target.value)} placeholder="OPENAI_API_KEY" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={labelClass}>{t("Cost/1k In", "输入成本/1k")}</label><input className={inputClass} type="number" step="0.0001" value={hook.pCostIn} onChange={e => hook.setPCostIn(e.target.value)} /></div>
          <div><label className={labelClass}>{t("Cost/1k Out", "输出成本/1k")}</label><input className={inputClass} type="number" step="0.0001" value={hook.pCostOut} onChange={e => hook.setPCostOut(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={labelClass}>{t("Max Tokens", "最大 Token")}</label><input className={inputClass} type="number" value={hook.pMaxTokens} onChange={e => hook.setPMaxTokens(e.target.value)} /></div>
          <div><label className={labelClass}>{t("Priority", "优先级")}</label><input className={inputClass} type="number" value={hook.pPriority} onChange={e => hook.setPPriority(e.target.value)} /></div>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={hook.saveProvider} disabled={hook.busy} className={btnPrimary}>{hook.busy ? t("Saving...", "保存中...") : t("Save Provider", "保存提供商")}</button>
        {hook.editProvId && <button onClick={hook.resetProviderForm} className={btnSecondary}>{t("Cancel", "取消")}</button>}
      </div>
    </div>
  );

  const providersTab = (
    <div className="space-y-4">
      {providerForm}
      <div className="flex justify-end"><button onClick={hook.loadProviders} className={btnSecondary}><RefreshCw className="w-4 h-4 mr-1" />{t("Refresh", "刷新")}</button></div>
      <div className={`${cardClass} p-0 overflow-hidden`}>
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-800 text-gray-500">
            <tr>
              <th className="px-4 py-3">{t("Name / Model", "名称 / 模型")}</th>
              <th className="px-4 py-3">{t("Type", "类型")}</th>
              <th className="px-4 py-3">{t("Cost (In/Out)", "成本 (进/出)")}</th>
              <th className="px-4 py-3">{t("Status", "状态")}</th>
              <th className="px-4 py-3 text-right">{t("Actions", "操作")}</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-800">
            {hook.providers.map(p => (
              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-900 transition">
                <td className="px-4 py-3"><div className="font-semibold">{p.name}</div><div className="text-xs text-gray-400 font-mono">{p.model_name}</div></td>
                <td className="px-4 py-3"><span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{p.provider_type}</span></td>
                <td className="px-4 py-3 font-mono text-xs">${p.cost_per_1k_input.toFixed(4)} / ${p.cost_per_1k_output.toFixed(4)}</td>
                <td className="px-4 py-3">{statusBadge(p.status)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => hook.toggleProvider(p.id, p.status)} className={`p-1.5 rounded-lg transition ${p.status === "active" ? "text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20" : "text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20"}`} title={p.status === "active" ? "Disable" : "Enable"}>
                      {p.status === "active" ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                    </button>
                    <button onClick={() => hook.editProvider(p)} className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"><Edit3 className="w-4 h-4" /></button>
                    <button onClick={() => hook.deleteProvider(p.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {hook.providers.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-500">{t("No providers configured. Add one to enable LLM routing.", "尚未配置提供商，添加一个以启用 LLM 路由。")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Templates Tab ──
  const templateForm = (
    <div className={`${cardClass} border-l-4 border-l-indigo-500`}>
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
        {hook.editTmplId ? <Edit3 className="w-5 h-5 text-indigo-500" /> : <Plus className="w-5 h-5 text-indigo-500" />}
        {hook.editTmplId ? t("Edit Template", "编辑模板") : t("Add Template", "添加模板")}
      </h2>
      <div className="space-y-3 mb-4">
        <div><label className={labelClass}>{t("Name", "名称")} *</label><input className={inputClass} value={hook.tName} onChange={e => hook.setTName(e.target.value)} placeholder={t("e.g. Code Review Assistant", "如：代码审查助手")} /></div>
        <div><label className={labelClass}>{t("Template Text", "模板文本")} *</label><textarea className={inputClass} rows={4} value={hook.tText} onChange={e => hook.setTText(e.target.value)} placeholder={t("You are a helpful assistant. User query: {{prompt}}", "你是一个有用的助手。用户问题：{{prompt}}")} /></div>
        <div><label className={labelClass}>{t("Variables (comma-separated)", "变量（逗号分隔）")}</label><input className={inputClass} value={hook.tVars} onChange={e => hook.setTVars(e.target.value)} placeholder="role, tone" /></div>
      </div>
      <div className="flex gap-2">
        <button onClick={hook.saveTemplate} disabled={hook.busy} className={btnPrimary}>{hook.busy ? t("Saving...", "保存中...") : t("Save Template", "保存模板")}</button>
        {hook.editTmplId && <button onClick={hook.resetTemplateForm} className={btnSecondary}>{t("Cancel", "取消")}</button>}
      </div>
    </div>
  );

  const templatesTab = (
    <div className="space-y-4">
      {templateForm}
      <div className="flex justify-end"><button onClick={hook.loadTemplates} className={btnSecondary}><RefreshCw className="w-4 h-4 mr-1" />{t("Refresh", "刷新")}</button></div>
      <div className={`${cardClass} p-0 overflow-hidden`}>
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-800 text-gray-500">
            <tr>
              <th className="px-4 py-3">{t("Name", "名称")}</th>
              <th className="px-4 py-3">{t("Template Preview", "模板预览")}</th>
              <th className="px-4 py-3">{t("Version", "版本")}</th>
              <th className="px-4 py-3 text-right">{t("Actions", "操作")}</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-800">
            {hook.templates.map(tmpl => (
              <tr key={tmpl.id} className="hover:bg-gray-50 dark:hover:bg-gray-900 transition">
                <td className="px-4 py-3"><div className="font-semibold">{tmpl.name}</div><div className="text-xs text-gray-400">{tmpl.variables?.join(", ") || t("no variables", "无变量")}</div></td>
                <td className="px-4 py-3"><div className="max-w-xs truncate text-xs font-mono text-gray-500">{tmpl.template_text}</div></td>
                <td className="px-4 py-3 font-mono text-xs">v{tmpl.version}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => hook.editTemplate(tmpl)} className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"><Edit3 className="w-4 h-4" /></button>
                    <button onClick={() => hook.deleteTemplate(tmpl.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {hook.templates.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-500">{t("No templates created yet.", "尚未创建模板。")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Info cards (shown on route tab) ──
  const infoCards = (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[
        { title: t("Multi-Model Routing", "多模型路由"), desc: t("Route to the best model by cost, latency, and priority. Automatic failover.", "根据成本、延迟和优先级路由到最佳模型，支持自动故障转移。"), icon: Network, color: "border-t-purple-500", iconColor: "text-purple-500" },
        { title: t("Token Cost Tracking", "Token 成本追踪"), desc: t("Track tokens and cost per request with usage logging.", "追踪每次请求的 Token 和成本并记录使用日志。"), icon: DollarSign, color: "border-t-blue-500", iconColor: "text-blue-500" },
        { title: t("Prompt Governance", "Prompt 治理"), desc: t("Versioned templates with variable substitution for prompt engineering.", "版本化模板支持变量替换，便于 Prompt 工程管理。"), icon: FileText, color: "border-t-green-500", iconColor: "text-green-500" },
      ].map((c, i) => (
        <div key={i} className={`${cardClass} border-t-4 ${c.color}`}>
          <c.icon className={`w-6 h-6 ${c.iconColor} mb-2`} />
          <h3 className="font-bold mb-1">{c.title}</h3>
          <p className="text-sm text-gray-500">{c.desc}</p>
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold">{t("AI / LLM Gateway", "AI / LLM 网关")}</h1>
        <p className="text-gray-500 mt-1">{t("Multi-model routing, prompt governance, and token cost tracking.", "多模型路由、Prompt 治理和 Token 成本追踪。")}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-900 p-1 rounded-xl">
        {TABS.filter(tab => !tab.admin || canManage).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition flex-1 justify-center ${activeTab === tab.id ? "bg-white dark:bg-gray-800 shadow text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}>
            <tab.icon className="w-4 h-4" />{t(tab.en, tab.zh)}
          </button>
        ))}
      </div>

      {st === "route" && routeTab}
      {st === "route" && infoCards}
      {st === "providers" && providersTab}
      {st === "templates" && templatesTab}
    </div>
  );
}
