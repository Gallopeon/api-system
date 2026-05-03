"use client";

import { ArrowLeftRight, BookOpen, Code2, Database, EyeOff, FileText, LayoutDashboard, RotateCcw, ShieldAlert, SlidersHorizontal, TerminalSquare } from "lucide-react";
import { cardClass } from "@/lib/constants";

interface ManualPanelProps { t: <T>(en: T, zh: T) => T; }

export default function ManualPanel({ t }: ManualPanelProps) {
  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center gap-3 mb-2">
        <BookOpen className="w-8 h-8 text-blue-500" />
        <div>
          <h1 className="text-3xl font-bold">{t("User Manual", "系统使用手册")}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{t("Complete reference for API Control Plane — rule parameters, expression syntax, and workflow guides.", "API 控制平面完整参考 — 规则参数详解、表达式语法与工作流指南。")}</p>
        </div>
      </div>

      {/* ========== 1. Dashboard ========== */}
      <div className={`${cardClass} border-l-4 border-l-blue-500`}>
        <div className="flex items-center gap-2 mb-4">
          <LayoutDashboard className="w-5 h-5 text-blue-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t("1. Dashboard", "1. 概览面板")}</h2>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">{t("The dashboard provides a real-time overview of the API governance system health and key metrics.", "概览面板提供 API 治理系统健康状况和关键指标的实时总览。")}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { en: "Uptime", zh: "运行时间", enD: "Total duration the gateway/routing core has survived without failure.", zhD: "网关核心路由组件无故障持续运行的时长。" },
            { en: "Active Rules", zh: "生效规则", enD: "Number of rules currently in published status and active in production.", zhD: "当前处于已发布状态且运行于线上的规则总数。" },
            { en: "Versions Tracked", zh: "版本记录", enD: "Total historical snapshots of all rules for traceability.", zhD: "所有规则的历史快照总数，用于追溯变更。" },
            { en: "Audit Traits", zh: "审计条目", enD: "All configuration changes and admin actions recorded.", zhD: "管理员执行的所有配置操作和请求的追踪日志。" },
          ].map((m, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
              <span className="w-7 h-7 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
              <div><div className="font-semibold text-sm text-gray-900 dark:text-gray-100">{t(m.en, m.zh)}</div><div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t(m.enD, m.zhD)}</div></div>
            </div>
          ))}
        </div>
      </div>

      {/* ========== 2. Rule Configuration — Parameter Reference ========== */}
      <div className={`${cardClass} border-l-4 border-l-purple-500`}>
        <div className="flex items-center gap-2 mb-4">
          <SlidersHorizontal className="w-5 h-5 text-purple-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t("2. Rule Configuration — Parameter Reference", "2. 规则配置 — 参数详解")}</h2>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">{t("A Transform Rule defines how HTTP API response bodies are reshaped in transit. Below is a complete reference for every parameter, its type, behavior, and usage examples.", "Transform Rule 定义了如何在传输过程中重塑 HTTP API 响应体。以下是每个参数的完整参考，包括类型、行为和使用示例。")}</p>

        {/* 2.1 Basic Identity */}
        <div className="mb-8">
          <h3 className="font-bold text-base text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2"><span className="w-1.5 h-5 rounded-full bg-purple-400"></span>{t("2.1 Basic Identity", "2.1 基本信息")}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead><tr className="bg-gray-50 dark:bg-gray-900/50"><th className="text-left py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 w-32">{t("Parameter", "参数")}</th><th className="text-left py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 w-20">{t("Type", "类型")}</th><th className="text-left py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">{t("Description", "描述")}</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {[
                  { p: "name", t: "String", d: "Unique human-readable identifier for the rule.", zd: "规则的唯一可读标识符。" },
                  { p: "api_path", t: "String", d: "The API route this rule applies to (e.g. /api/v1/users).", zd: "此规则应用的 API 路由（如 /api/v1/users）。" },
                  { p: "status", t: "Enum", d: "Rule lifecycle state: draft / published / paused.", zd: "规则生命周期状态：draft（草稿）/ published（已发布）/ paused（已暂停）。" },
                ].map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30"><td className="py-2.5 px-3 font-mono text-xs font-semibold text-purple-600 dark:text-purple-400">{r.p}</td><td className="py-2.5 px-3"><span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded font-mono">{r.t}</span></td><td className="py-2.5 px-3 text-xs text-gray-600 dark:text-gray-400">{t(r.d, r.zd)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 2.2 Whitelist Fields */}
        <div className="mb-8">
          <h3 className="font-bold text-base text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2"><span className="w-1.5 h-5 rounded-full bg-emerald-400"></span>{t("2.2 Whitelist Fields", "2.2 白名单字段")}</h3>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 mb-3 border border-gray-100 dark:border-gray-800">
            <div className="flex items-start gap-3"><span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded shrink-0">whitelist_fields</span><span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded font-mono shrink-0">String[]</span></div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{t("Specifies which top-level fields to retain. All fields NOT listed are discarded. If empty, all fields pass through unchanged.", "指定响应中保留哪些顶级字段。未列出的所有字段将被丢弃。如果为空，所有字段原样通过。")}</p>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><div className="text-xs font-semibold text-gray-500 mb-1">{t("Input", "输入")}</div><pre className="bg-gray-900 text-green-400 p-2.5 rounded text-xs font-mono overflow-x-auto">{'{"id":1,"name":"Alice","email":"a@x.com","internal_id":"x-99"}'}</pre></div>
              <div><div className="text-xs font-semibold text-gray-500 mb-1">{t("Config: id, name, email", "配置: id, name, email")}</div><pre className="bg-gray-900 text-yellow-300 p-2.5 rounded text-xs font-mono overflow-x-auto">{'{"id":1,"name":"Alice","email":"a@x.com"}'}</pre></div>
            </div>
          </div>
        </div>

        {/* 2.3 Field Renaming */}
        <div className="mb-8">
          <h3 className="font-bold text-base text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2"><span className="w-1.5 h-5 rounded-full bg-cyan-400"></span>{t("2.3 Field Renaming", "2.3 字段重命名")}</h3>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 mb-3 border border-gray-100 dark:border-gray-800">
            <div className="flex items-start gap-3"><span className="font-mono text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/20 px-2 py-0.5 rounded shrink-0">renames</span><span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded font-mono shrink-0">{t("Record<String,String>", "键值对")}</span></div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{t("Maps old field names to new field names. Each entry is source:target. Renaming happens after whitelist extraction.", "将旧字段名映射为新字段名。每行为 原字段名:新字段名 格式。重命名在白名单提取之后进行。")}</p>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><div className="text-xs font-semibold text-gray-500 mb-1">{t("Input", "输入")}</div><pre className="bg-gray-900 text-green-400 p-2.5 rounded text-xs font-mono overflow-x-auto">{'{"user_id":1,"user_name":"Bob"}'}</pre></div>
              <div><div className="text-xs font-semibold text-gray-500 mb-1">{t("Config: user_id:id, user_name:name", "配置: user_id:id, user_name:name")}</div><pre className="bg-gray-900 text-yellow-300 p-2.5 rounded text-xs font-mono overflow-x-auto">{'{"id":1,"name":"Bob"}'}</pre></div>
            </div>
          </div>
        </div>

        {/* 2.4 Mask Fields */}
        <div className="mb-8">
          <h3 className="font-bold text-base text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2"><span className="w-1.5 h-5 rounded-full bg-orange-400"></span>{t("2.4 Mask Fields", "2.4 脱敏字段")}</h3>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 mb-3 border border-gray-100 dark:border-gray-800">
            <div className="flex items-start gap-3"><span className="font-mono text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded shrink-0">masked_fields</span><span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded font-mono shrink-0">String[]</span></div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{t("Fields whose values will be automatically replaced with ****. Useful for PII like passwords, credit card numbers.", "字段值将被自动替换为 ****。适用于密码、信用卡号等 PII。")}</p>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><div className="text-xs font-semibold text-gray-500 mb-1">{t("Input", "输入")}</div><pre className="bg-gray-900 text-green-400 p-2.5 rounded text-xs font-mono overflow-x-auto">{'{"user":"alice","password":"s3cret!","phone":"555-0100"}'}</pre></div>
              <div><div className="text-xs font-semibold text-gray-500 mb-1">{t("Config: password, phone", "配置: password, phone")}</div><pre className="bg-gray-900 text-yellow-300 p-2.5 rounded text-xs font-mono overflow-x-auto">{'{"user":"alice","password":"****","phone":"****"}'}</pre></div>
            </div>
          </div>
        </div>

        {/* 2.5 Computed Literals */}
        <div className="mb-8">
          <h3 className="font-bold text-base text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2"><span className="w-1.5 h-5 rounded-full bg-pink-400"></span>{t("2.5 Computed Literals", "2.5 计算字面量")}</h3>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 mb-3 border border-gray-100 dark:border-gray-800">
            <div className="flex items-start gap-3"><span className="font-mono text-xs font-bold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/20 px-2 py-0.5 rounded shrink-0">computed_literals</span><span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded font-mono shrink-0">{t("Record<String,JSON>", "JSON键值对")}</span></div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{t("Injects static JSON values into every response object. Existing fields with the same key are overwritten.", "向每个响应对象中注入静态 JSON 值。同名字段会被覆盖。")}</p>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><div className="text-xs font-semibold text-gray-500 mb-1">{t("Input", "输入")}</div><pre className="bg-gray-900 text-green-400 p-2.5 rounded text-xs font-mono overflow-x-auto">{'{"id":1}'}</pre></div>
              <div><div className="text-xs font-semibold text-gray-500 mb-1">{t('Config: {"version":"v2","meta":{"region":"us-east"}}', '配置: {"version":"v2","meta":{"region":"us-east"}}')}</div><pre className="bg-gray-900 text-yellow-300 p-2.5 rounded text-xs font-mono overflow-x-auto">{'{"id":1,"version":"v2","meta":{"region":"us-east"}}'}</pre></div>
            </div>
          </div>
        </div>

        {/* 2.6 Remove Nulls */}
        <div className="mb-8">
          <h3 className="font-bold text-base text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2"><span className="w-1.5 h-5 rounded-full bg-gray-400"></span>{t("2.6 Remove Nulls", "2.6 移除空值")}</h3>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 mb-3 border border-gray-100 dark:border-gray-800">
            <div className="flex items-start gap-3"><span className="font-mono text-xs font-bold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded shrink-0">remove_nulls</span><span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded font-mono shrink-0">Boolean</span></div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{t("When enabled, recursively strips all keys whose value is null from the output. Applied as the final step in the transform pipeline.", "启用后，递归删除输出中所有值为 null 的键。作为转换管线的最后一步执行。")}</p>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><div className="text-xs font-semibold text-gray-500 mb-1">{t("Input", "输入")}</div><pre className="bg-gray-900 text-green-400 p-2.5 rounded text-xs font-mono overflow-x-auto">{'{"id":1,"email":null,"name":"Ada"}'}</pre></div>
              <div><div className="text-xs font-semibold text-gray-500 mb-1">{t("Config: remove_nulls = true", "配置: remove_nulls = true")}</div><pre className="bg-gray-900 text-yellow-300 p-2.5 rounded text-xs font-mono overflow-x-auto">{'{"id":1,"name":"Ada"}'}</pre></div>
            </div>
          </div>
        </div>

        {/* 2.7 Conditional Rules */}
        <div className="mb-8">
          <h3 className="font-bold text-base text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2"><span className="w-1.5 h-5 rounded-full bg-indigo-400"></span>{t("2.7 Conditional Rules", "2.7 条件规则")}</h3>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 mb-3 border border-gray-100 dark:border-gray-800">
            <div className="flex items-start gap-3 flex-wrap"><span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded shrink-0">conditional_rules</span><span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded font-mono shrink-0">ConditionalRule[]</span></div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{t("An ordered array of conditional blocks. Each block has a when expression; if it evaluates to true, the block's actions are applied.", "一个有序的条件块数组。每个块包含一个 when 表达式；如果计算结果为 true，则应用该块的操作。")}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead><tr className="bg-gray-50 dark:bg-gray-900/50"><th className="text-left py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 w-36">{t("Field", "字段")}</th><th className="text-left py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 w-24">{t("Type", "类型")}</th><th className="text-left py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">{t("Description", "描述")}</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {[
                  { f: "when", t: "String", d: "Boolean expression evaluated against each object.", zd: "对每个对象求值的布尔表达式。" },
                  { f: "add_literals", t: "Object", d: "Key-value pairs injected when the expression matches.", zd: "表达式匹配时注入的键值对。" },
                  { f: "remove_fields", t: "String[]", d: "Field names to delete when the expression matches.", zd: "表达式匹配时删除的字段名列表。" },
                  { f: "mask_fields", t: "String[]", d: "Fields replaced with **** when the expression matches.", zd: "表达式匹配时替换为 **** 的字段。" },
                  { f: "rename_fields", t: "Object", d: "Old→New field mappings applied when the expression matches.", zd: "表达式匹配时应用的旧→新字段名映射。" },
                  { f: "stop_after_match", t: "Boolean", d: "If true, stops evaluating subsequent rules after this block matches.", zd: "如果为 true，此块匹配后停止评估后续规则。" },
                ].map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30"><td className="py-2.5 px-3 font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">{r.f}</td><td className="py-2.5 px-3"><span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded font-mono">{r.t}</span></td><td className="py-2.5 px-3 text-xs text-gray-600 dark:text-gray-400">{t(r.d, r.zd)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-100 dark:border-gray-800">
            <div className="text-xs font-semibold text-gray-500 mb-2">{t("Example", "示例")}</div>
            <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono overflow-x-auto">{`// conditional_rules = [{ "when": "vip == true", "add_literals": {"tier": "premium"}, "stop_after_match": true }]
// Input:  {"id":1, "vip":true}   →  Output: {"id":1, "vip":true, "tier":"premium"}
// Input:  {"id":2, "vip":false}  →  Output: {"id":2, "vip":false}  (no change)`}</pre>
          </div>
        </div>

        {/* 2.8 Gray Release */}
        <div className="mb-8">
          <h3 className="font-bold text-base text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2"><span className="w-1.5 h-5 rounded-full bg-amber-400"></span>{t("2.8 Gray Release (A/B Testing)", "2.8 灰度发布（A/B 测试）")}</h3>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 mb-3 border border-gray-100 dark:border-gray-800">
            <div className="flex items-start gap-3"><span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded shrink-0">gray_release</span><span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded font-mono shrink-0">GrayReleaseConfig | null</span></div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{t("Enables hash-based traffic splitting for A/B testing. Each variant can override the base rule config independently.", "启用基于哈希的流量分割以实现 A/B 测试。每个变体可以独立覆盖基础规则配置。")}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead><tr className="bg-gray-50 dark:bg-gray-900/50"><th className="text-left py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 w-36">{t("Field", "字段")}</th><th className="text-left py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 w-24">{t("Type", "类型")}</th><th className="text-left py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">{t("Description", "描述")}</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {[
                  { f: "enabled", t: "Boolean", d: "Master switch. When false, all traffic uses the base rule config.", zd: "总开关。为 false 时所有流量使用基础规则配置。" },
                  { f: "bucket_field", t: "String", d: "The traffic context field used as the hash key. Default: user_id.", zd: "流量上下文中用作哈希键的字段。默认：user_id。" },
                  { f: "variants", t: "GrayVariant[]", d: "Array of variant definitions: name, weight (%), and optional override_config.", zd: "变体定义数组：name, weight (%), 和可选的 override_config。" },
                ].map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30"><td className="py-2.5 px-3 font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">{r.f}</td><td className="py-2.5 px-3"><span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded font-mono">{r.t}</span></td><td className="py-2.5 px-3 text-xs text-gray-600 dark:text-gray-400">{t(r.d, r.zd)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-100 dark:border-gray-800">
            <div className="text-xs font-semibold text-gray-500 mb-2">{t("GrayReleaseConfig structure", "GrayReleaseConfig 结构")}</div>
            <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono overflow-x-auto">{`{
  "enabled": true,
  "bucket_field": "user_id",
  "variants": [
    { "name": "control", "weight": 70 },
    { "name": "experiment", "weight": 30,
      "override_config": { "renames": {"old_name": "new_name"} }
    }
  ]
}`}</pre>
          </div>
        </div>

        {/* 2.9 Pagination */}
        <div className="mb-6">
          <h3 className="font-bold text-base text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2"><span className="w-1.5 h-5 rounded-full bg-teal-400"></span>{t("2.9 Pagination", "2.9 分页配置")}</h3>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 mb-3 border border-gray-100 dark:border-gray-800">
            <div className="flex items-start gap-3"><span className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 px-2 py-0.5 rounded shrink-0">pagination</span><span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded font-mono shrink-0">PaginationTemplate | null</span></div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{t("Maps upstream pagination field names to a standardized format. Extracts data from data_key, wraps it, and adds total/page/page_size metadata.", "将上游分页字段名映射到标准化格式。从 data_key 提取数据、包装后添加 total/page/page_size 元数据字段。")}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead><tr className="bg-gray-50 dark:bg-gray-900/50"><th className="text-left py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 w-36">{t("Field", "字段")}</th><th className="text-left py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 w-24">{t("Default", "默认值")}</th><th className="text-left py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">{t("Description", "描述")}</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {[
                  { f: "data_key", dflt: "data", d: "The key in the upstream response that contains the array of records.", zd: "上游响应中包含记录数组的键名。" },
                  { f: "total_field", dflt: "total", d: "The key for the total record count.", zd: "总记录数的键名。" },
                  { f: "page_field", dflt: "page", d: "The key for the current page number.", zd: "当前页码的键名。" },
                  { f: "page_size_field", dflt: "page_size", d: "The key for the page size.", zd: "每页大小的键名。" },
                ].map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30"><td className="py-2.5 px-3 font-mono text-xs font-semibold text-teal-600 dark:text-teal-400">{r.f}</td><td className="py-2.5 px-3 font-mono text-xs text-gray-500">{r.dflt}</td><td className="py-2.5 px-3 text-xs text-gray-600 dark:text-gray-400">{t(r.d, r.zd)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========== 3. Expression Syntax ========== */}
      <div className={`${cardClass} border-l-4 border-l-violet-500`}>
        <div className="flex items-center gap-2 mb-4">
          <Code2 className="w-5 h-5 text-violet-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t("3. Expression Syntax Reference", "3. 表达式语法参考")}</h2>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">{t("Conditional rules and the Expression Evaluator use a sandboxed boolean expression language.", "条件规则和表达式评估器使用沙盒化的布尔表达式语言。")}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-100 dark:border-gray-800">
            <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200 mb-3">{t("Operators", "运算符")}</h4>
            <div className="space-y-2">
              {[
                { op: "&&", en: "Logical AND", zh: "逻辑与" }, { op: "||", en: "Logical OR", zh: "逻辑或" },
                { op: "==", en: "Equality (type-sensitive)", zh: '等于（类型敏感：1 != "1"）' }, { op: "!=", en: "Not equal", zh: "不等于" },
                { op: ">=, <=, >, <", en: "Numeric / string comparison", zh: "数值 / 字符串比较" },
              ].map((r, i) => (
                <div key={i} className="flex items-start gap-3 text-xs">
                  <code className="bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded font-mono font-bold shrink-0 w-24 text-center">{r.op}</code>
                  <span className="text-gray-600 dark:text-gray-400">{t(r.en, r.zh)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-100 dark:border-gray-800">
            <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200 mb-3">{t("Built-in Functions", "内置函数")}</h4>
            <div className="space-y-3">
              <div><code className="text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded font-mono font-bold">exists(path)</code><p className="text-xs text-gray-500 mt-1">{t("Returns true if the field at path exists (even if null). Supports nested dot notation.", "路径上的字段存在则返回 true（即使为 null）。支持嵌套点符号。")}</p></div>
              <div><code className="text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded font-mono font-bold">contains(path, value)</code><p className="text-xs text-gray-500 mt-1">{t("Returns true if the string/number at path contains the given value.", "路径处的字符串/数字包含给定值则返回 true。")}</p></div>
            </div>
          </div>
        </div>
        <div className="mt-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-100 dark:border-gray-800">
          <div className="text-xs font-semibold text-gray-500 mb-2">{t("Expression Examples", "表达式示例")}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {[
              { expr: 'vip == true', desc: "Boolean field match", zh: "布尔字段匹配" },
              { expr: 'role == "admin"', desc: "String equality", zh: "字符串相等" },
              { expr: 'level >= 5', desc: "Numeric comparison", zh: "数值比较" },
              { expr: 'age >= 18 && verified == true', desc: "Multi-condition AND", zh: "多条件与" },
              { expr: 'role == "admin" || role == "mod"', desc: "Multi-condition OR", zh: "多条件或" },
              { expr: 'exists(email) && email != ""', desc: "Existence + value check", zh: "存在性 + 值检查" },
              { expr: 'contains(tags, "vip")', desc: "Substring/contains check", zh: "子串/包含检查" },
              { expr: '(vip == true || level >= 10) && status != "banned"', desc: "Nested logic", zh: "嵌套逻辑" },
            ].map((r, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded bg-white dark:bg-black/20 border border-gray-100 dark:border-gray-800">
                <code className="font-mono text-violet-600 dark:text-violet-400 font-bold shrink-0">{r.expr}</code>
                <span className="text-gray-400 shrink-0">—</span>
                <span className="text-gray-500">{t(r.desc, r.zh)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ========== 4. Versions & Diff ========== */}
      <div className={`${cardClass} border-l-4 border-l-rose-500`}>
        <div className="flex items-center gap-2 mb-4">
          <ArrowLeftRight className="w-5 h-5 text-rose-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t("4. Versions & Diff", "4. 版本与对比")}</h2>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">{t("Every rule update creates an immutable version snapshot, enabling full audit trails, visual diff comparison, and instant rollback.", "每次规则更新都会创建一个不可变版本快照，支持完整审计追踪、可视化差异对比以及即时回滚。")}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-rose-50 dark:bg-rose-900/10 rounded-lg p-4 border border-rose-100 dark:border-rose-900/30">
            <div className="flex items-center gap-2 mb-2"><RotateCcw className="w-4 h-4 text-rose-500" /><h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200">{t("Rollback Machine", "回归机器")}</h4></div>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1.5 list-disc pl-4">
              <li>{t("View all historical versions with timestamps and change type labels.", "查看所有历史版本，包含时间戳和变更类型标签。")}</li>
              <li>{t("Each version is labeled: breaking (red), non_breaking (green), minor (gray), rollback (yellow).", "每个版本标注变更类型。")}</li>
              <li>{t("Select any version and click Revert to instantly restore that configuration.", "选择任一版本并点击回退按钮立即恢复。")}</li>
            </ul>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-4 border border-blue-100 dark:border-blue-900/30">
            <div className="flex items-center gap-2 mb-2"><ArrowLeftRight className="w-4 h-4 text-blue-500" /><h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200">{t("Diff Visualizer", "对比视图")}</h4></div>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1.5 list-disc pl-4">
              <li>{t("Compare any two versions side-by-side with recursive JSON diff.", "对比任意两个版本的递归 JSON 差异。")}</li>
              <li>{t("Changes are shown with path, change_type (added/removed/modified), from, and to values.", "每个变更显示路径、变更类型、旧值和新值。")}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ========== 5. Playground & Transform Pipeline ========== */}
      <div className={`${cardClass} border-l-4 border-l-emerald-500`}>
        <div className="flex items-center gap-2 mb-4">
          <TerminalSquare className="w-5 h-5 text-emerald-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t("5. Playground & Transform Pipeline", "5. 工作台与转换管线")}</h2>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">{t("The Playground lets you safely test transform rules offline with mock data before publishing to production. The Expression Evaluator helps debug conditional logic in isolation.", "工作台允许您使用模拟数据离线安全测试转换规则，确认无误后再发布上线。表达式评估器帮助单独调试条件逻辑。")}</p>
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-100 dark:border-gray-800 mb-4">
          <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200 mb-2">{t("Transform Pipeline Order", "转换管线执行顺序")}</h4>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-gray-600 dark:text-gray-400">
            {[
              { step: "1.", en: "Whitelist", zh: "仅提取白名单字段" }, { step: "2.", en: "Rename", zh: "应用字段重命名" },
              { step: "3.", en: "Mask", zh: "脱敏敏感字段" }, { step: "4.", en: "Conditionals", zh: "按序评估条件规则" },
              { step: "5.", en: "Literals", zh: "注入计算字面量" }, { step: "6.", en: "Pagination", zh: "包装分页元数据" },
              { step: "7.", en: "Remove Nulls", zh: "删除 null 值" },
            ].map((s, i) => (
              <span key={i} className="flex items-center gap-1.5 bg-white dark:bg-black/20 border border-gray-200 dark:border-gray-700 px-2 py-1 rounded">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{s.step}</span><span className="text-gray-400">|</span><span>{t(s.en, s.zh)}</span>
                {i < 6 && <span className="text-gray-300 dark:text-gray-600 ml-1">→</span>}
              </span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200 mb-2">{t("Data Entry Fields", "数据条目字段")}</h4>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-disc pl-4">
              <li><strong>{t("Entry Name:", "条目名称：")}</strong> {t("Optional label for organizing multiple test cases.", "可选标签，用于组织多个测试用例。")}</li>
              <li><strong>{t("Mock Body (JSON):", "模拟响应体 (JSON)：")}</strong> {t("The simulated upstream API response to transform.", "待转换的模拟上游 API 响应。")}</li>
              <li><strong>{t("Traffic Context (JSON):", "流量上下文 (JSON)：")}</strong> {t("Simulated request metadata used by conditional rules and gray release.", "模拟请求元数据，用于条件规则和灰度分桶。")}</li>
              <li><strong>{t("Force Variant:", "强制变体：")}</strong> {t("Override gray release variant selection for deterministic testing.", "覆盖灰度发布变体选择以进行确定性测试。")}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200 mb-2">{t("Expression Evaluator", "表达式评估器")}</h4>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-disc pl-4">
              <li>{t("Test boolean expressions in isolation without a full transform.", "无需完整转换即可单独测试布尔表达式。")}</li>
              <li>{t("Provide a logic expression and a mock input JSON object.", "提供逻辑表达式和模拟输入 JSON 对象。")}</li>
              <li>{t("Returns TRUE (green) or FALSE (red) — useful for debugging when clauses.", "返回 TRUE（绿色）或 FALSE（红色）— 在编写完整条件规则前调试 when 子句非常有用。")}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ========== 6. API Builder ========== */}
      <div className={`${cardClass} border-l-4 border-l-cyan-500`}>
        <div className="flex items-center gap-2 mb-4">
          <Code2 className="w-5 h-5 text-cyan-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t("6. API Builder", "6. API 构建器")}</h2>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">{t("A no-code visual interface for building rules and testing them with field-based data entries.", "无代码可视化界面，用于构建规则并使用基于字段的数据条目进行测试。")}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-4 border border-blue-100 dark:border-blue-900/30">
            <div className="flex items-center gap-2 mb-2"><SlidersHorizontal className="w-4 h-4 text-blue-500" /><h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200">{t("Rules Configuration", "规则配置")}</h4></div>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1.5 list-disc pl-4">
              <li>{t("Select from existing rules or create a new one with the visual form.", "从现有规则中选择或使用可视化表单创建新规则。")}</li>
              <li>{t("Interactive editors for whitelist fields, renames, and mask fields.", "白名单字段、重命名和脱敏字段的交互式编辑器。")}</li>
              <li>{t("Create or Update / Delete actions at the bottom of the form.", "表单底部的创建/更新、删除操作按钮。")}</li>
            </ul>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-lg p-4 border border-emerald-100 dark:border-emerald-900/30">
            <div className="flex items-center gap-2 mb-2"><Database className="w-4 h-4 text-emerald-500" /><h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200">{t("Data Entries", "数据条目")}</h4></div>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1.5 list-disc pl-4">
              <li>{t("Add multiple data entries, each with its own set of key-value fields.", "添加多个数据条目，每个条目有自己的一组键值字段。")}</li>
              <li>{t("Click Transform on an entry to preview the rule output.", "点击条目的转换按钮预览该数据的规则输出。")}</li>
              <li>{t("Use Batch Transform to run all entries at once.", "使用批量转换一次性运行所有条目。")}</li>
              <li>{t("Save/Load presets to persist entry configurations across sessions.", "保存/加载预设以跨会话持久化和重用条目配置。")}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ========== 7. Audit Logs ========== */}
      <div className={`${cardClass} border-l-4 border-l-slate-500`}>
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="w-5 h-5 text-slate-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t("7. Audit Logs", "7. 审计日志")}</h2>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">{t("Every configuration change is recorded with full details for security compliance and operational traceability.", "每次配置变更都会被完整记录，以满足安全合规和操作可追溯性要求。")}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead><tr className="bg-gray-50 dark:bg-gray-900/50"><th className="text-left py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 w-32">{t("Column", "列名")}</th><th className="text-left py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">{t("Description", "描述")}</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {[
                { c: "Timestamp", zh: "时间戳", d: "When the action occurred (UTC).", zd: "操作发生的时间（UTC）。" },
                { c: "Actor", zh: "操作人", d: "Who performed the action.", zd: "执行操作的人员。" },
                { c: "Action", zh: "操作", d: "The operation type: create, update, delete, rollback, preview, expr_eval.", zd: "操作类型：create / update / delete / rollback / preview / expr_eval。" },
                { c: "Rule ID", zh: "规则 ID", d: "The target rule UUID, or dash if not applicable.", zd: "目标规则 UUID，不适用时显示 -。" },
                { c: "Status", zh: "状态", d: "SUCCESS (green) or FAILED (red).", zd: "SUCCESS（成功，绿色）或 FAILED（失败，红色）。" },
              ].map((r, i) => (
                <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30"><td className="py-2.5 px-3 font-semibold text-xs text-gray-700 dark:text-gray-300">{t(r.c, r.zh)}</td><td className="py-2.5 px-3 text-xs text-gray-600 dark:text-gray-400">{t(r.d, r.zd)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
