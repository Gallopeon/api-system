import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";

export function useOpenApi(
  notifyError: (msg: string) => void,
  notifySucc: (msg: string) => void,
) {
  const [openApiFilter, setOpenApiFilter] = useState("");
  const [openApiOverlay, setOpenApiOverlay] = useState("");
  const [openApiSpec, setOpenApiSpec] = useState("");
  const [openApiBusy, setOpenApiBusy] = useState(false);
  const [importSpec, setImportSpec] = useState("");
  const [importBusy, setImportBusy] = useState(false);

  const generateSpec = useCallback(
    async (t: <T>(en: T, zh: T) => T) => {
      setOpenApiBusy(true);
      try {
        const params = new URLSearchParams();
        if (openApiFilter) params.set("api_path", openApiFilter);
        if (openApiOverlay) params.set("overlay", openApiOverlay);
        const qs = params.toString();
        const r = await apiFetch(`/admin/v1/openapi.json${qs ? "?" + qs : ""}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const text = await r.text();
        setOpenApiSpec(text);
        notifySucc(t("OpenAPI spec generated!", "OpenAPI 规范已生成！"));
      } catch (e) {
        notifyError((e as Error).message);
      } finally {
        setOpenApiBusy(false);
      }
    },
    [openApiFilter, openApiOverlay, notifyError, notifySucc],
  );

  const handleImport = useCallback(
    async (
      t: <T>(en: T, zh: T) => T,
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
      },
    ) => {
      setImportBusy(true);
      try {
        const spec = JSON.parse(importSpec);
        const paths = spec.paths || {};
        const pathEntries = Object.entries(paths) as Array<[string, unknown]>;
        if (pathEntries.length === 0) throw new Error(t("No paths found in spec", "规范中未找到路径"));

        const [apiPath, pathItem] = pathEntries[0];
        const methods = Object.keys(pathItem as Record<string, unknown>).filter(
          (k) => k !== "parameters" && k !== "summary" && k !== "description" && k !== "servers",
        );
        if (methods.length === 0) throw new Error(t("No methods found in first path", "第一个路径中未找到方法"));

        const method = methods[0];
        const methodObj = (pathItem as Record<string, Record<string, unknown>>)[method];
        const responses = (methodObj?.responses || {}) as Record<string, Record<string, unknown>>;
        const okCode = Object.keys(responses).find((k) => k.startsWith("2")) || "200";
        const respObj = responses[okCode];
        const content = (respObj?.content || {}) as Record<string, Record<string, unknown>>;
        const jsonContent = content?.["application/json"];
        const schemaRef = (jsonContent?.schema || {}) as Record<string, unknown>;
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
      } finally {
        setImportBusy(false);
      }
    },
    [importSpec, notifyError, notifySucc],
  );

  return {
    openApiFilter,
    openApiOverlay,
    openApiSpec,
    openApiBusy,
    importSpec,
    importBusy,
    setOpenApiFilter,
    setOpenApiOverlay,
    setImportSpec,
    generateSpec,
    handleImport,
  };
}
