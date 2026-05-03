
import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type { LlmProvider, PromptTemplate, LlmRouteResponse } from "@/lib/types";

export function useLlmGateway(
  notifyError: (msg: string) => void,
  notifySucc: (msg: string) => void,
) {
  const [providers, setProviders] = useState<LlmProvider[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [busy, setBusy] = useState(false);

  // Provider form
  const [pName, setPName] = useState("");
  const [pType, setPType] = useState("openai");
  const [pEndpoint, setPEndpoint] = useState("");
  const [pModel, setPModel] = useState("");
  const [pKeyEnv, setPKeyEnv] = useState("");
  const [pCostIn, setPCostIn] = useState("0");
  const [pCostOut, setPCostOut] = useState("0");
  const [pMaxTokens, setPMaxTokens] = useState("4096");
  const [pPriority, setPPriority] = useState("10");
  const [editProvId, setEditProvId] = useState<string | null>(null);

  // Template form
  const [tName, setTName] = useState("");
  const [tText, setTText] = useState("");
  const [tVars, setTVars] = useState("");
  const [editTmplId, setEditTmplId] = useState<string | null>(null);

  // Route form
  const [rtPrompt, setRtPrompt] = useState("");
  const [rtModel, setRtModel] = useState("");
  const [rtMaxTokens, setRtMaxTokens] = useState("1024");
  const [rtTemp, setRtTemp] = useState("0.7");
  const [rtTemplateId, setRtTemplateId] = useState("");
  const [routeResult, setRouteResult] = useState<LlmRouteResponse | null>(null);

  const resetProviderForm = useCallback(() => {
    setPName(""); setPType("openai"); setPEndpoint(""); setPModel("");
    setPKeyEnv(""); setPCostIn("0"); setPCostOut("0"); setPMaxTokens("4096");
    setPPriority("10"); setEditProvId(null);
  }, []);

  const resetTemplateForm = useCallback(() => {
    setTName(""); setTText(""); setTVars(""); setEditTmplId(null);
  }, []);

  const loadProviders = useCallback(async () => {
    try {
      const r = await apiFetch("/api/v1/llm/providers");
      if (r.ok) { const d = await r.json(); setProviders(d.items || []); }
    } catch { /* ignore */ }
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const r = await apiFetch("/api/v1/llm/prompt-templates");
      if (r.ok) { const d = await r.json(); setTemplates(d.items || []); }
    } catch { /* ignore */ }
  }, []);

  const saveProvider = useCallback(async () => {
    if (!pName.trim() || !pEndpoint.trim() || !pModel.trim()) {
      notifyError("Name, endpoint URL, and model are required"); return;
    }
    setBusy(true);
    const body: Record<string, unknown> = {
      name: pName.trim(), provider_type: pType, endpoint_url: pEndpoint.trim(),
      model_name: pModel.trim(), api_key_env: pKeyEnv.trim() || null,
      cost_per_1k_input: parseFloat(pCostIn) || 0, cost_per_1k_output: parseFloat(pCostOut) || 0,
      max_tokens: parseInt(pMaxTokens) || 4096, priority: parseInt(pPriority) || 10, actor: "panel",
    };
    try {
      const method = editProvId ? "PUT" : "POST";
      const url = editProvId ? `/api/v1/llm/providers/${editProvId}` : "/api/v1/llm/providers";
      const r = await apiFetch(url, { method, body: JSON.stringify(body) });
      if (r.ok) {
        notifySucc(editProvId ? "Provider updated" : "Provider created");
        resetProviderForm(); await loadProviders();
      } else {
        const e = await r.json().catch(() => ({}));
        notifyError((e as any).message || "Failed to save provider");
      }
    } catch { notifyError("Network error"); }
    finally { setBusy(false); }
  }, [pName, pType, pEndpoint, pModel, pKeyEnv, pCostIn, pCostOut, pMaxTokens, pPriority, editProvId, notifyError, notifySucc, loadProviders, resetProviderForm]);

  const editProvider = useCallback((p: LlmProvider) => {
    setEditProvId(p.id); setPName(p.name); setPType(p.provider_type);
    setPEndpoint(p.endpoint_url); setPModel(p.model_name); setPKeyEnv(p.api_key_env || "");
    setPCostIn(String(p.cost_per_1k_input)); setPCostOut(String(p.cost_per_1k_output));
    setPMaxTokens(String(p.max_tokens)); setPPriority(String(p.priority));
  }, []);

  const toggleProvider = useCallback(async (id: string, status: string) => {
    try {
      const r = await apiFetch(`/api/v1/llm/providers/${id}`, { method: "PUT", body: JSON.stringify({ status: status === "active" ? "inactive" : "active" }) });
      if (r.ok) { notifySucc("Provider toggled"); await loadProviders(); }
      else notifyError("Failed to toggle provider");
    } catch { notifyError("Network error"); }
  }, [loadProviders, notifyError, notifySucc]);

  const deleteProvider = useCallback(async (id: string) => {
    try {
      const r = await apiFetch(`/api/v1/llm/providers/${id}`, { method: "DELETE" });
      if (r.ok) { notifySucc("Provider deleted"); await loadProviders(); }
      else notifyError("Failed to delete provider");
    } catch { notifyError("Network error"); }
  }, [loadProviders, notifyError, notifySucc]);

  const saveTemplate = useCallback(async () => {
    if (!tName.trim() || !tText.trim()) { notifyError("Name and template text are required"); return; }
    setBusy(true);
    const vars = tVars.trim() ? tVars.split(",").map(s => s.trim()).filter(Boolean) : null;
    const body: Record<string, unknown> = { name: tName.trim(), template_text: tText.trim(), variables: vars, actor: "panel" };
    try {
      const method = editTmplId ? "PUT" : "POST";
      const url = editTmplId ? `/api/v1/llm/prompt-templates/${editTmplId}` : "/api/v1/llm/prompt-templates";
      const r = await apiFetch(url, { method, body: JSON.stringify(body) });
      if (r.ok) {
        notifySucc(editTmplId ? "Template updated" : "Template created");
        resetTemplateForm(); await loadTemplates();
      } else {
        const e = await r.json().catch(() => ({}));
        notifyError((e as any).message || "Failed to save template");
      }
    } catch { notifyError("Network error"); }
    finally { setBusy(false); }
  }, [tName, tText, tVars, editTmplId, notifyError, notifySucc, loadTemplates, resetTemplateForm]);

  const editTemplate = useCallback((t: PromptTemplate) => {
    setEditTmplId(t.id); setTName(t.name); setTText(t.template_text);
    setTVars(t.variables?.join(", ") || "");
  }, []);

  const deleteTemplate = useCallback(async (id: string) => {
    try {
      const r = await apiFetch(`/api/v1/llm/prompt-templates/${id}`, { method: "DELETE" });
      if (r.ok) { notifySucc("Template deleted"); await loadTemplates(); }
      else notifyError("Failed to delete template");
    } catch { notifyError("Network error"); }
  }, [loadTemplates, notifyError, notifySucc]);

  const sendRoute = useCallback(async () => {
    if (!rtPrompt.trim()) { notifyError("Prompt is required"); return; }
    setBusy(true); setRouteResult(null);
    const body: Record<string, unknown> = { prompt: rtPrompt.trim(), max_tokens: parseInt(rtMaxTokens) || 1024, temperature: parseFloat(rtTemp) || 0.7 };
    if (rtModel.trim()) body.model = rtModel.trim();
    if (rtTemplateId) body.prompt_template_id = rtTemplateId;
    try {
      const r = await apiFetch("/api/v1/llm/route", { method: "POST", body: JSON.stringify(body) });
      if (r.ok) {
        const d = (await r.json()) as LlmRouteResponse;
        setRouteResult(d); notifySucc("LLM responded");
      } else {
        const e = await r.json().catch(() => ({}));
        notifyError((e as any).message || "LLM route failed");
      }
    } catch { notifyError("Network error"); }
    finally { setBusy(false); }
  }, [rtPrompt, rtModel, rtMaxTokens, rtTemp, rtTemplateId, notifyError, notifySucc]);

  return {
    providers, loadProviders, toggleProvider, deleteProvider,
    pName, setPName, pType, setPType, pEndpoint, setPEndpoint, pModel, setPModel,
    pKeyEnv, setPKeyEnv, pCostIn, setPCostIn, pCostOut, setPCostOut,
    pMaxTokens, setPMaxTokens, pPriority, setPPriority,
    editProvId, saveProvider, editProvider, resetProviderForm,
    templates, loadTemplates, saveTemplate, editTemplate, deleteTemplate,
    tName, setTName, tText, setTText, tVars, setTVars, editTmplId, resetTemplateForm,
    rtPrompt, setRtPrompt, rtModel, setRtModel, rtMaxTokens, setRtMaxTokens,
    rtTemp, setRtTemp, rtTemplateId, setRtTemplateId,
    busy, routeResult, sendRoute, clearRouteResult: () => setRouteResult(null),
  };
}
