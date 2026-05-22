"use client";

import { FileText, Upload } from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary, btnSecondary } from "@/lib/constants";
import { useOpenApi } from "@/hooks/useOpenApi";

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
  canWrite: boolean;
  notifyError: (msg: string) => void;
  notifySucc: (msg: string) => void;
  t: <T>(en: T, zh: T) => T;
}

export default function OpenApiPanel({ ruleForImport, canWrite, notifyError, notifySucc, t }: OpenApiPanelProps) {
  const {
    openApiFilter, openApiOverlay, openApiSpec, openApiBusy,
    importSpec, importBusy,
    setOpenApiFilter, setOpenApiOverlay, setImportSpec,
    generateSpec, handleImport,
  } = useOpenApi(notifyError, notifySucc);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("OpenAPI Spec Generator", "OpenAPI 规范生成器")}</h1>
      <p className="text-gray-500 dark:text-gray-400 -mt-2 text-sm">{t("Auto-generate OpenAPI 3.1 specifications from rule configurations, and import OpenAPI specs to create rules.", "从规则配置自动生成 OpenAPI 3.1 规范，以及导入 OpenAPI 规范创建规则。")}</p>

      {/* Generate Section */}
      <div className={`${cardClass} border-l-4 border-l-blue-500`}>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-500" />
          {t("Generate OpenAPI Spec", "生成 OpenAPI 规范")}
        </h2>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className={labelClass}>{t("Filter by API Path (optional)", "按 API 路径过滤（可选）")}</label>
            <input className={inputClass} value={openApiFilter} onChange={(e) => setOpenApiFilter(e.target.value)} placeholder={t("/admin/v1/users", "/admin/v1/users")} />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className={labelClass}>{t("Overlay Base URL (optional)", "Overlay 基础 URL（可选）")}</label>
            <input className={inputClass} value={openApiOverlay} onChange={(e) => setOpenApiOverlay(e.target.value)} placeholder={t("https://staging.example.com", "https://staging.example.com")} />
          </div>
          <button className={btnPrimary} disabled={openApiBusy} onClick={() => generateSpec(t)}>
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
      {canWrite && (
      <div className={`${cardClass} border-l-4 border-l-emerald-500`}>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5 text-emerald-500" />
          {t("Import OpenAPI Spec → Generate Rule", "导入 OpenAPI 规范 → 生成规则")}
        </h2>
        <p className="text-sm text-gray-500 mb-4">{t("Paste an OpenAPI 3.x JSON spec and extract the first path/method to create a new rule configuration with whitelist fields.", "粘贴 OpenAPI 3.x JSON 规范，提取第一个路径/方法以创建包含白名单字段的新规则配置。")}</p>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>{t("OpenAPI JSON Spec", "OpenAPI JSON 规范")}</label>
            <textarea className={`${inputClass} font-mono text-xs`} rows={12} value={importSpec} onChange={(e) => setImportSpec(e.target.value)} placeholder={'{"openapi":"3.1.0","paths":{"/admin/v1/users":{"get":{"responses":{"200":{"content":{"application/json":{"schema":{"properties":{"id":{"type":"string"},"name":{"type":"string"}}}}}}}}}}}'} />
          </div>
          <button className={btnPrimary} disabled={importBusy || !importSpec.trim()} onClick={() => handleImport(t, ruleForImport)}>
            {importBusy ? t("Importing...", "导入中...") : t("Import & Fill Rule Form", "导入并填充规则表单")}
          </button>
        </div>
      </div>
      )}
    </div>
  );
}
