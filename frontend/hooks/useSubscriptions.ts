import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type { Subscription, SubscriptionUsage, ApiKeyItem, ApiProduct } from "@/lib/types";

export function useSubscriptions(
  accessToken: string | undefined,
  notifyError: (msg: string) => void,
  notifySucc: (msg: string) => void,
) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [productsList, setProductsList] = useState<ApiProduct[]>([]);
  const [usageMap, setUsageMap] = useState<Record<string, SubscriptionUsage>>({});
  const [busy, setBusy] = useState(false);

  const loadSubscriptions = useCallback(async () => {
    try {
      const r = await apiFetch("/admin/v1/subscriptions?limit=100", {}, accessToken);
      if (r.ok) {
        const d = await r.json();
        setSubscriptions((d as { items?: Subscription[] }).items || []);
      }
    } catch (e) { notifyError?.("Failed to load subscriptions"); console.error("loadSubscriptions failed:", e); }
  }, [accessToken, notifyError]);

  const loadApiKeys = useCallback(async () => {
    try {
      const r = await apiFetch("/admin/v1/api-keys?limit=100", {}, accessToken);
      if (r.ok) {
        const d = await r.json();
        setApiKeys((d as { items?: ApiKeyItem[] }).items || []);
      }
    } catch (e) { notifyError?.("Failed to load API keys"); console.error("loadApiKeys failed:", e); }
  }, [accessToken, notifyError]);

  const loadProducts = useCallback(async () => {
    try {
      const r = await apiFetch("/admin/v1/products?limit=100", {}, accessToken);
      if (r.ok) {
        const d = await r.json();
        setProductsList((d as { items?: ApiProduct[] }).items || []);
      }
    } catch (e) { notifyError?.("Failed to load products"); console.error("loadProducts failed:", e); }
  }, [accessToken, notifyError]);

  const createSubscription = useCallback(async (data: Record<string, unknown>) => {
    if (!(data.api_key_id as string)?.trim() || !(data.product_id as string)?.trim()) {
      notifyError?.("API Key and Product are required"); return;
    }
    setBusy(true);
    try {
      const r = await apiFetch("/admin/v1/subscriptions", { method: "POST", body: JSON.stringify(data) }, accessToken);
      if (!r.ok) throw new Error((await r.json())?.message || `HTTP ${r.status}`);
      notifySucc?.("Subscription created!");
      await loadSubscriptions();
    } catch (e) { notifyError?.((e as Error).message); }
    finally { setBusy(false); }
  }, [accessToken, loadSubscriptions, notifyError, notifySucc]);

  const updateSubscription = useCallback(async (id: string, data: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await apiFetch(`/admin/v1/subscriptions/${id}`, { method: "PUT", body: JSON.stringify(data) }, accessToken);
      if (!r.ok) throw new Error((await r.json())?.message || `HTTP ${r.status}`);
      notifySucc?.("Subscription updated!");
      await loadSubscriptions();
    } catch (e) { notifyError?.((e as Error).message); }
    finally { setBusy(false); }
  }, [accessToken, loadSubscriptions, notifyError, notifySucc]);

  const upgradeSubscription = useCallback(async (id: string, plan: string) => {
    setBusy(true);
    try {
      const r = await apiFetch(`/admin/v1/subscriptions/${id}/upgrade`, { method: "POST", body: JSON.stringify({ plan }) }, accessToken);
      if (!r.ok) throw new Error((await r.json())?.message || `HTTP ${r.status}`);
      notifySucc?.(`Plan upgraded to ${plan}!`);
      await loadSubscriptions();
    } catch (e) { notifyError?.((e as Error).message); }
    finally { setBusy(false); }
  }, [accessToken, loadSubscriptions, notifyError, notifySucc]);

  const cancelSubscription = useCallback(async (id: string) => {
    if (!confirm("Cancel this subscription? This cannot be undone.")) return;
    setBusy(true);
    try {
      const r = await apiFetch(`/admin/v1/subscriptions/${id}/cancel`, { method: "POST" }, accessToken);
      if (!r.ok) throw new Error((await r.json())?.message || `HTTP ${r.status}`);
      notifySucc?.("Subscription cancelled");
      await loadSubscriptions();
    } catch (e) { notifyError?.((e as Error).message); }
    finally { setBusy(false); }
  }, [accessToken, loadSubscriptions, notifyError, notifySucc]);

  const renewSubscription = useCallback(async (id: string, expiresAt: string) => {
    setBusy(true);
    try {
      const r = await apiFetch(`/admin/v1/subscriptions/${id}/renew`, { method: "POST", body: JSON.stringify({ expires_at: expiresAt }) }, accessToken);
      if (!r.ok) throw new Error((await r.json())?.message || `HTTP ${r.status}`);
      notifySucc?.("Subscription renewed!");
      await loadSubscriptions();
    } catch (e) { notifyError?.((e as Error).message); }
    finally { setBusy(false); }
  }, [accessToken, loadSubscriptions, notifyError, notifySucc]);

  const getUsage = useCallback(async (id: string) => {
    try {
      const r = await apiFetch(`/admin/v1/subscriptions/${id}/usage`, {}, accessToken);
      if (r.ok) {
        const d = (await r.json()) as SubscriptionUsage;
        setUsageMap((prev) => ({ ...prev, [id]: d }));
        return d;
      }
    } catch (e) { notifyError?.("Failed to load usage"); console.error("getUsage failed:", e); }
    return null;
  }, [accessToken]);

  const deleteSubscription = useCallback(async (id: string) => {
    if (!confirm("Delete this subscription?")) return;
    setBusy(true);
    try {
      const r = await apiFetch(`/admin/v1/subscriptions/${id}`, { method: "DELETE" }, accessToken);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      notifySucc?.("Subscription deleted");
      await loadSubscriptions();
    } catch (e) { notifyError?.((e as Error).message); }
    finally { setBusy(false); }
  }, [accessToken, loadSubscriptions, notifyError, notifySucc]);

  return {
    subscriptions, busy, apiKeys, products: productsList, usageMap,
    loadSubscriptions, loadApiKeys, loadProductsList: loadProducts,
    createSubscription, updateSubscription,
    upgradeSubscription, cancelSubscription, renewSubscription,
    getSubscriptionUsage: getUsage, deleteSubscription,
  };
}
