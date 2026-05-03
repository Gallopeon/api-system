"use client";

import { Network, FileText } from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary } from "@/lib/constants";

interface LlmGatewayPanelProps {
  notifySucc: (msg: string) => void;
  t: <T>(en: T, zh: T) => T;
}

export default function LlmGatewayPanel({ notifySucc, t }: LlmGatewayPanelProps) {
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold">{t("AI / LLM Gateway", "AI / LLM 网关")}</h1>
        <p className="text-gray-500 mt-1">{t("Multi-model routing, prompt governance, and token cost tracking.", "多模型路由、Prompt 治理和 Token 成本追踪。")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LLM Route */}
        <div className={`${cardClass} border-l-4 border-l-purple-500`}>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Network className="w-5 h-5 text-purple-500" /> {t("Route LLM Request", "LLM 请求路由")}
          </h2>
          <div className="space-y-3">
            <div><label className={labelClass}>{t("Prompt", "提示词")} *</label><textarea className={inputClass} rows={4} placeholder={t("Enter your prompt...", "输入您的提示词...")} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelClass}>{t("Model (optional)", "模型（可选）")}</label><input className={inputClass} placeholder="gpt-4o" /></div>
              <div><label className={labelClass}>{t("Max Tokens", "最大 Token")}</label><input className={inputClass} type="number" defaultValue="1024" /></div>
            </div>
            <button className={btnPrimary} onClick={() => notifySucc(t("LLM routing active — configure providers via API", "LLM 路由已激活 — 通过 API 配置提供商"))}>{t("Send to LLM", "发送到 LLM")}</button>
          </div>
        </div>

        {/* Prompt Templates */}
        <div className={`${cardClass} border-l-4 border-l-indigo-500`}>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-500" /> {t("Prompt Templates", "Prompt 模板")}
          </h2>
          <p className="text-sm text-gray-500 mb-3">{t("Create reusable prompt templates with variable substitution. Use {{prompt}} as placeholder for user input.", "创建可复用的 Prompt 模板，支持变量替换。使用 {{prompt}} 作为用户输入占位符。")}</p>
          <div className="space-y-3">
            <div><label className={labelClass}>{t("Template Name", "模板名称")}</label><input className={inputClass} placeholder={t("e.g. Code Review Assistant", "如：代码审查助手")} /></div>
            <div><label className={labelClass}>{t("Template Text", "模板文本")}</label><textarea className={inputClass} rows={3} placeholder={t("You are a helpful assistant. User query: {{prompt}}", "你是一个有用的助手。用户问题：{{prompt}}")} /></div>
            <button className={btnPrimary} onClick={() => notifySucc(t("Create via API: POST /api/v1/llm/prompt-templates", "通过 API 创建：POST /api/v1/llm/prompt-templates"))}>{t("Save Template", "保存模板")}</button>
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: t("Multi-Model Routing", "多模型路由"), desc: t("Route requests to the best available model based on cost, latency, and priority.", "根据成本、延迟和优先级将请求路由到最佳可用模型。"), color: "purple" },
          { title: t("Token Cost Tracking", "Token 成本追踪"), desc: t("Track input/output tokens and compute real-time costs per request per API key.", "追踪输入/输出 Token 并计算每个请求每个 API Key 的实时成本。"), color: "blue" },
          { title: t("Prompt Governance", "Prompt 治理"), desc: t("Version-controlled prompt templates with injection protection and content guardrails.", "具有注入防护和内容护栏的版本控制 Prompt 模板。"), color: "green" },
        ].map((c, i) => (
          <div key={i} className={`${cardClass} border-t-4 border-t-${c.color}-500`}>
            <h3 className="font-bold mb-2">{c.title}</h3>
            <p className="text-sm text-gray-500">{c.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
