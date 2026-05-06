import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type {
  CircuitBreaker,
  ProtocolConfig,
  DataClassification,
  PluginConfig,
} from "@/lib/types";

export { useProducts } from "./useProducts";
export { useSubscriptions } from "./useSubscriptions";

// ─── useCircuitBreakers ───────────────────────────────────────────────────────

export function useCircuitBreakers(
  accessToken: string | undefined,
  notifyError: (msg: string) => void,
  notifySucc: (msg: string) => void,
) {
  const [cbs, setCbs] = useState<CircuitBreaker[]>([]);
  const [busy, setBusy] = useState(false);

  const loadCBs = useCallback(async () => {
    try {
      const r = await apiFetch(
        "/admin/v1/circuit-breakers?limit=50",
        {},
        accessToken,
      );
      if (r.ok) {
        const d = await r.json();
        setCbs((d as { items?: CircuitBreaker[] }).items || []);
      }
    } catch {
      /* ignore */
    }
  }, [accessToken]);

  const createCB = useCallback(
    async (data: Record<string, unknown>) => {
      setBusy(true);
      try {
        const r = await apiFetch(
          "/admin/v1/circuit-breakers",
          { method: "POST", body: JSON.stringify(data) },
          accessToken,
        );
        if (!r.ok)
          throw new Error(
            (await r.json())?.message || `HTTP ${r.status}`,
          );
        notifySucc?.("Circuit breaker created!");
        await loadCBs();
      } catch (e) {
        notifyError?.((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [accessToken, loadCBs, notifyError, notifySucc],
  );

  const updateCB = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      setBusy(true);
      try {
        const r = await apiFetch(
          `/admin/v1/circuit-breakers/${id}`,
          { method: "PUT", body: JSON.stringify(data) },
          accessToken,
        );
        if (!r.ok)
          throw new Error(
            (await r.json())?.message || `HTTP ${r.status}`,
          );
        notifySucc?.("Circuit breaker updated!");
        await loadCBs();
      } catch (e) {
        notifyError?.((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [accessToken, loadCBs, notifyError, notifySucc],
  );

  const deleteCB = useCallback(
    async (id: string) => {
      if (!confirm("Delete this circuit breaker?")) return;
      setBusy(true);
      try {
        const r = await apiFetch(
          `/admin/v1/circuit-breakers/${id}`,
          { method: "DELETE" },
          accessToken,
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        notifySucc?.("Circuit breaker deleted");
        await loadCBs();
      } catch (e) {
        notifyError?.((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [accessToken, loadCBs, notifyError, notifySucc],
  );

  return { cbs, busy, loadCBs, createCB, updateCB, deleteCB };
}

// ─── useProtocols ─────────────────────────────────────────────────────────────

export function useProtocols(
  accessToken: string | undefined,
  notifyError: (msg: string) => void,
  notifySucc: (msg: string) => void,
) {
  const [protocols, setProtocols] = useState<ProtocolConfig[]>([]);
  const [busy, setBusy] = useState(false);

  const loadProtocols = useCallback(async () => {
    try {
      const r = await apiFetch("/admin/v1/protocols?limit=50", {}, accessToken);
      if (r.ok) {
        const d = await r.json();
        setProtocols((d as { items?: ProtocolConfig[] }).items || []);
      }
    } catch {
      /* ignore */
    }
  }, [accessToken]);

  const createProtocol = useCallback(
    async (data: Record<string, unknown>) => {
      setBusy(true);
      try {
        const r = await apiFetch(
          "/admin/v1/protocols",
          { method: "POST", body: JSON.stringify(data) },
          accessToken,
        );
        if (!r.ok)
          throw new Error(
            (await r.json())?.message || `HTTP ${r.status}`,
          );
        notifySucc?.("Protocol created!");
        await loadProtocols();
      } catch (e) {
        notifyError?.((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [accessToken, loadProtocols, notifyError, notifySucc],
  );

  const updateProtocol = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      setBusy(true);
      try {
        const r = await apiFetch(
          `/admin/v1/protocols/${id}`,
          { method: "PUT", body: JSON.stringify(data) },
          accessToken,
        );
        if (!r.ok)
          throw new Error(
            (await r.json())?.message || `HTTP ${r.status}`,
          );
        notifySucc?.("Protocol updated!");
        await loadProtocols();
      } catch (e) {
        notifyError?.((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [accessToken, loadProtocols, notifyError, notifySucc],
  );

  const deleteProtocol = useCallback(
    async (id: string) => {
      if (!confirm("Delete this protocol?")) return;
      setBusy(true);
      try {
        const r = await apiFetch(
          `/admin/v1/protocols/${id}`,
          { method: "DELETE" },
          accessToken,
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        notifySucc?.("Protocol deleted");
        await loadProtocols();
      } catch (e) {
        notifyError?.((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [accessToken, loadProtocols, notifyError, notifySucc],
  );

  return { protocols, busy, loadProtocols, createProtocol, updateProtocol, deleteProtocol };
}

// ─── useClassifications ───────────────────────────────────────────────────────

export function useClassifications(
  accessToken: string | undefined,
  notifyError: (msg: string) => void,
  notifySucc: (msg: string) => void,
) {
  const [classifications, setClassifications] = useState<DataClassification[]>([]);
  const [busy, setBusy] = useState(false);

  const loadClassifications = useCallback(async () => {
    try {
      const r = await apiFetch(
        "/admin/v1/data-classifications?limit=50",
        {},
        accessToken,
      );
      if (r.ok) {
        const d = await r.json();
        setClassifications(
          (d as { items?: DataClassification[] }).items || [],
        );
      }
    } catch {
      /* ignore */
    }
  }, [accessToken]);

  const createClassification = useCallback(
    async (data: Record<string, unknown>) => {
      setBusy(true);
      try {
        const r = await apiFetch(
          "/admin/v1/data-classifications",
          { method: "POST", body: JSON.stringify(data) },
          accessToken,
        );
        if (!r.ok)
          throw new Error(
            (await r.json())?.message || `HTTP ${r.status}`,
          );
        notifySucc?.("Data classification created!");
        await loadClassifications();
      } catch (e) {
        notifyError?.((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [accessToken, loadClassifications, notifyError, notifySucc],
  );

  const updateClassification = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      setBusy(true);
      try {
        const r = await apiFetch(
          `/admin/v1/data-classifications/${id}`,
          { method: "PUT", body: JSON.stringify(data) },
          accessToken,
        );
        if (!r.ok)
          throw new Error(
            (await r.json())?.message || `HTTP ${r.status}`,
          );
        notifySucc?.("Data classification updated!");
        await loadClassifications();
      } catch (e) {
        notifyError?.((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [accessToken, loadClassifications, notifyError, notifySucc],
  );

  const deleteClassification = useCallback(
    async (id: string) => {
      if (!confirm("Delete this data classification?")) return;
      setBusy(true);
      try {
        const r = await apiFetch(
          `/admin/v1/data-classifications/${id}`,
          { method: "DELETE" },
          accessToken,
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        notifySucc?.("Data classification deleted");
        await loadClassifications();
      } catch (e) {
        notifyError?.((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [accessToken, loadClassifications, notifyError, notifySucc],
  );

  return {
    classifications,
    busy,
    loadClassifications,
    createClassification,
    updateClassification,
    deleteClassification,
  };
}

// ─── usePlugins ───────────────────────────────────────────────────────────────

export function usePlugins(
  accessToken: string | undefined,
  notifyError: (msg: string) => void,
  notifySucc: (msg: string) => void,
) {
  const [plugins, setPlugins] = useState<PluginConfig[]>([]);
  const [busy, setBusy] = useState(false);

  const loadPlugins = useCallback(async () => {
    try {
      const r = await apiFetch("/admin/v1/plugins?limit=50", {}, accessToken);
      if (r.ok) {
        const d = await r.json();
        setPlugins((d as { items?: PluginConfig[] }).items || []);
      }
    } catch {
      /* ignore */
    }
  }, [accessToken]);

  const createPlugin = useCallback(
    async (data: Record<string, unknown>) => {
      setBusy(true);
      try {
        const r = await apiFetch(
          "/admin/v1/plugins",
          { method: "POST", body: JSON.stringify(data) },
          accessToken,
        );
        if (!r.ok)
          throw new Error(
            (await r.json())?.message || `HTTP ${r.status}`,
          );
        notifySucc?.("Plugin created!");
        await loadPlugins();
      } catch (e) {
        notifyError?.((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [accessToken, loadPlugins, notifyError, notifySucc],
  );

  const updatePlugin = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      setBusy(true);
      try {
        const r = await apiFetch(
          `/admin/v1/plugins/${id}`,
          { method: "PUT", body: JSON.stringify(data) },
          accessToken,
        );
        if (!r.ok)
          throw new Error(
            (await r.json())?.message || `HTTP ${r.status}`,
          );
        notifySucc?.("Plugin updated!");
        await loadPlugins();
      } catch (e) {
        notifyError?.((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [accessToken, loadPlugins, notifyError, notifySucc],
  );

  const deletePlugin = useCallback(
    async (id: string) => {
      if (!confirm("Delete this plugin?")) return;
      setBusy(true);
      try {
        const r = await apiFetch(
          `/admin/v1/plugins/${id}`,
          { method: "DELETE" },
          accessToken,
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        notifySucc?.("Plugin deleted");
        await loadPlugins();
      } catch (e) {
        notifyError?.((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [accessToken, loadPlugins, notifyError, notifySucc],
  );

  return { plugins, busy, loadPlugins, createPlugin, updatePlugin, deletePlugin };
}
