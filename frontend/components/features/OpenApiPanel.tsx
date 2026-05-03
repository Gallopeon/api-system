"use client";

import { useState } from "react";
import { FileText, Upload } from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary, btnSecondary } from "@/lib/constants";
import { apiFetch } from "@/lib/api";

interface OpenApiPanelProps {
  ruleForImport: {
    setRuleName: (v: string) => void;
    setApiPath: (v: string) => void;
    setWhitelist: (v: string) => void;
    setRenames: (v: string) => void;
    setMasked: (v: string) => void;
    setComputed: (v: string) => void;
    setConditional: (v: string) => void;
    setGray: (v: string) => void;
    setRemoveNulls: (v: boolean) => void;
    setRuleStatus: (v: string) => void;
    setSelectedRuleId: (v: string) => void;
    setActiveMenu: (v: string) => void;
  };
  notifyError: (msg: string) => void;
  notifySucc: (msg: string) => void;
  t: <T>(en: T, zh: T) => T;
}

export default function OpenApiPanel({ ruleForImport, notifyError, notifySucc, t }: OpenApiPanelProps) {
  const [openApiFilter, setOpenApiFilter] = useState("");
  const [openApiOverlay, setOpenApiOverlay] = useState("");
  const [openApiSpec, setOpenApiSpec] = useState("");
  const [openApiBusy, setOpenApiBusy] = useState(false);
  const [importSpec, setImportSpec] = useState("");
  const [importBusy, setImportBusy] = useState(false);

  const generateSpec = async () => {
    setOpenApiBusy(true);
    try {
      const params = new URLSearchParams();
      if (openApiFilter) params.set("api_path", openApiFilter);
      if (openApiOverlay) params.set("overlay", openApiOverlay);
      const qs = params.toString();
      const r = await apiFetch(`/api/v1/openapi.json${qs ? "?" + qs : ""}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const text = await r.text();
      setOpenApiSpec(text);
      notifySucc(t("OpenAPI spec generated!", "OpenAPI 规范已生成！"));
    } catch (e) {
      notifyError((e as Error).message);
    } finally { setOpenApiBusy(false); }
  };

  const handleImport = async () => {
    setImportBusy(true);
    try {
      const spec = JSON.parse(importSpec);
      const paths = spec.paths || {};
      const pathEntries = Object.entries(paths) as Array<[string, unknown]>;
      if (pathEntries.length === 0) throw new Error(t("No paths found in spec", "规范中未找到路径"));

      const [apiPath, pathItem] = pathEntries[0];
      const methods = Object.keys(pathItem as Record<string, unknown>).filter((k) => k !== "parameters" && k !== "summary" && k !== "description" && k !== "servers");
      if (methods.length === 0) throw new Error(t("No methods found in first path", "第一个路径中未找到方法"));

      const method = methods[0];
      const methodObj = (pathItem as Record<string, Record<string, unknown>>)[method];
      const responses = (methodObj?.responses || {}) as Record<string, Record<string, unknown>>;
      const okCode = Object.keys(responses).find((k) => k.startsWith("2")) || "200";
      const respObj = responses[okCode];
      const content = (respObj?.content || {}) as Record<string, Record<string, unknown>>;
      const jsonContent = content?.["application/json"];
      const schemaRef = ((jsonContent?.schema || {}) as Record<string, unknown>);
      let schema = schemaRef;

      if (typeof schemaRef["$ref"] === "string") {
        const refPath = schemaRef["$ref"] as string;
        const parts = refPath.replace("#/", "").split("/");
        let resolved: unknown = spec;
        for (const p of parts) {
          if (!p) continue;
          resolved = (resolved as Record<string, unknown>)?.[p];
          if (resolved === undefined) break;
        }
        if (resolved) schema = resolved as Record<string, unknown>;
      }

      const props = (schema?.properties || {}) as Record<string, Record<string, string>>;
      const fields = Object.keys(props);
      if (fields.length === 0) throw new Error(t("No properties found in response schema", "响应 schema 中未找到属性"));

      ruleForImport.setRuleName(`Imported: ${((spec.info as Record<string, string>)?.title || apiPath.replace(/\//g, "_"))}`);
      ruleForImport.setApiPath(apiPath);
      ruleForImport.setWhitelist(fields.join(", "));
      ruleForImport.setRenames("");
      ruleForImport.setMasked("");
      ruleForImport.setComputed("{}");
      ruleForImport.setConditional("[]");
      ruleForImport.setGray('{\n  "enabled": false,\n  "bucket_field": "",\n  "variants": []\n}');
      ruleForImport.setRemoveNulls(false);
      ruleForImport.setRuleStatus("draft");
      ruleForImport.setSelectedRuleId("");
      ruleForImport.setActiveMenu("rules");

      notifySucc(t(`Imported ${fields.length} fields from OpenAPI spec`, `已从 OpenAPI 规范导入 ${fields.length} 个字段`));
    } catch (e) {
      notifyError(t("Import failed: ", "导入失败：") + (e as Error).message);
    } finally { setImportBusy(false); }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      <h1 className="text-3xl font-bold">{t("OpenAPI Spec Generator", "OpenAPI 规范生成器")}</h1>
      <p className="text-gray-500 -mt-2">{t("Auto-generate OpenAPI 3.1 specifications from rule configurations, and import OpenAPI specs to create rules.", "从规则配置自动生成 OpenAPI 3.1 规范，以及导入 OpenAPI 规范创建规则。")}</p>

      {/* Generate Section */}
      <div className={`${cardClass} border-l-4 border-l-blue-500`}>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-500" />
          {t("Generate OpenAPI Spec", "生成 OpenAPI 规范")}
        </h2>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className={labelClass}>{t("Filter by API Path (optional)", "按 API 路径过滤（可选）")}</label>
            <input className={inputClass} value={openApiFilter} onChange={(e) => setOpenApiFilter(e.target.value)} placeholder={t("/api/v1/users", "/api/v1/users")} />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className={labelClass}>{t("Overlay Base URL (optional)", "Overlay 基础 URL（可选）")}</label>
            <input className={inputClass} value={openApiOverlay} onChange={(e) => setOpenApiOverlay(e.target.value)} placeholder={t("https://staging.example.com", "https://staging.example.com")} />
          </div>
          <button className={btnPrimary} disabled={openApiBusy} onClick={generateSpec}>
            {openApiBusy ? t("Generating...", "生成中...") : t("Generate Spec", "生成规范")}
          </button>
        </div>
        {openApiSpec && (
          <div className="mt-4">
            <div className="flex justify-end mb-2">
              <button className={btnSecondary} onClick={() => { navigator.clipboard.writeText(openApiSpec); notifySucc(t("Copied to clipboard!", "已复制到剪贴板！")); }}>
                {t("Copy to Clipboard", "复制到剪贴板")}
              </button>
            </div>
            <pre className="bg-gray-900 border border-gray-800 text-green-400 p-4 rounded-lg text-xs font-mono overflow-auto max-h-[60vh] whitespace-pre-wrap">{openApiSpec}</pre>
          </div>
        )}
      </div>

      {/* Import Section */}
      <div className={`${cardClass} border-l-4 border-l-emerald-500`}>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5 text-emerald-500" />
          {t("Import OpenAPI Spec → Generate Rule", "导入 OpenAPI 规范 → 生成规则")}
        </h2>
        <p className="text-sm text-gray-500 mb-4">{t("Paste an OpenAPI 3.x JSON spec and extract the first path/method to create a new rule configuration with whitelist fields.", "粘贴 OpenAPI 3.x JSON 规范，提取第一个路径/方法以创建包含白名单字段的新规则配置。")}</p>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>{t("OpenAPI JSON Spec", "OpenAPI JSON 规范")}</label>
            <textarea className={`${inputClass} font-mono text-xs`} rows={12} value={importSpec} onChange={(e) => setImportSpec(e.target.value)} placeholder={'{"openapi":"3.1.0","paths":{"/api/v1/users":{"get":{"responses":{"200":{"content":{"application/json":{"schema":{"properties":{"id":{"type":"string"},"name":{"type":"string"}}}}}}}}}}}'} />
          </div>
          <button className={btnPrimary} disabled={importBusy || !importSpec.trim()} onClick={handleImport}>
            {importBusy ? t("Importing...", "导入中...") : t("Import & Fill Rule Form", "导入并填充规则表单")}
          </button>
        </div>
      </div>
    </div>
  );
}
