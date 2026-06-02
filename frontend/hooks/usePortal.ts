import { useState, useCallback, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import { getDefaultExpiry } from "@/lib/utils";
import type { ApiProduct, ApiKeyItem, Subscription, SubscriptionUsage } from "@/lib/types";

export function usePortal(
  userName: string,
  notifyError: (msg: string) => void,
  notifySucc: (msg: string) => void,
) {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [catalogBusy, setCatalogBusy] = useState(false);

  const [myKeys, setMyKeys] = useState<ApiKeyItem[]>([]);
  const [mySubscriptions, setMySubscriptions] = useState<Subscription[]>([]);
  const [usageMap, setUsageMap] = useState<Record<string, SubscriptionUsage>>({});

  const [akName, setAkName] = useState("");
  const [akScopes, setAkScopes] = useState("");
  const [akExpires, setAkExpires] = useState(getDefaultExpiry());
  const [akCreatedKey, setAkCreatedKey] = useState("");
  const [akBusy, setAkBusy] = useState(false);

  const [portalTab, setPortalTabRaw] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("portal_tab") || "catalog";
    }
    return "catalog";
  });
  const setPortalTab = useCallback((tab: string) => {
    setPortalTabRaw(tab);
    if (typeof window !== "undefined") localStorage.setItem("portal_tab", tab);
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [docsProductId, setDocsProductId] = useState<string>("");

  const viewProductDocs = useCallback((productId: string) => {
    setDocsProductId(productId);
    setPortalTab("docs");
  }, []);

  const loadCatalog = useCallback(async () => {
    setCatalogBusy(true);
    try {
      const r = await apiFetch("/admin/v1/products?limit=100");
      if (r.ok) {
        const d = await r.json();
        setProducts((d as { items?: ApiProduct[] }).items || []);
      }
    } catch (e) {
      notifyError("Failed to load API catalog");
      console.error("loadCatalog failed:", e);
    } finally {
      setCatalogBusy(false);
    }
  }, [notifyError]);

  const loadMyApps = useCallback(async () => {
    try {
      const keysR = await apiFetch("/admin/v1/api-keys?limit=100");
      if (!keysR.ok) return;
      const keysD = await keysR.json();
      const allKeys = (keysD as { items?: ApiKeyItem[] }).items || [];
      // Match by created_by; fall back to all active keys if no match
      const mine = userName ? allKeys.filter((k) => k.created_by === userName) : [];
      const visibleKeys = mine.length > 0 ? mine : allKeys.filter((k) => k.status === "active");
      setMyKeys(visibleKeys);

      const subR = await apiFetch("/admin/v1/subscriptions?limit=100");
      if (!subR.ok) return;
      const subD = await subR.json();
      const allSubs = (subD as { items?: Subscription[] }).items || [];
      const myKeyIds = new Set(visibleKeys.map((k) => k.id));
      const mySubs = allSubs.filter((s) => myKeyIds.has(s.api_key_id));
      setMySubscriptions(mySubs);

      for (const sub of mySubs) {
        if (sub.status === "active") {
          apiFetch(`/admin/v1/subscriptions/${sub.id}/usage`).then((uR) => {
            if (uR.ok) uR.json().then((uD: SubscriptionUsage) => {
              setUsageMap((prev) => ({ ...prev, [sub.id]: uD }));
            });
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.error("loadMyApps failed:", e);
    }
  }, [userName]);

  const [subBusy, setSubBusy] = useState(false);

  const subscribeToProduct = useCallback(async (productId: string, apiKeyId: string, plan: string) => {
    setSubBusy(true);
    try {
      const r = await apiFetch("/admin/v1/me/subscriptions", {
        method: "POST",
        body: JSON.stringify({ product_id: productId, api_key_id: apiKeyId, plan }),
      });
      if (!r.ok) throw new Error((await r.json())?.message || `HTTP ${r.status}`);
      notifySucc("Subscription created successfully!");
      await loadMyApps();
    } catch (e) {
      notifyError((e as Error).message);
    } finally {
      setSubBusy(false);
    }
  }, [loadMyApps, notifyError, notifySucc]);

  const createPortalKey = useCallback(async () => {
    if (!akName.trim()) {
      notifyError("Application name is required");
      return;
    }
    setAkBusy(true);
    try {
      const body: Record<string, unknown> = { name: akName.trim(), actor: "portal" };
      if (akScopes.trim()) {
        body.scopes = akScopes.split(",").map((s) => s.trim()).filter(Boolean);
      }
      if (akExpires.trim()) body.expires_at = akExpires;
      const r = await apiFetch("/admin/v1/api-keys", { method: "POST", body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json())?.message || `HTTP ${r.status}`);
      const d = (await r.json()) as { api_key: string; id: string; created: boolean };
      setAkCreatedKey(d.api_key || "");
      notifySucc("API Key created! Copy it now — it won't be shown again.");
      setAkName("");
      setAkScopes("");
      setAkExpires(getDefaultExpiry());
      await loadMyApps();
    } catch (e) {
      notifyError((e as Error).message);
    } finally {
      setAkBusy(false);
    }
  }, [akName, akScopes, akExpires, loadMyApps, notifyError, notifySucc]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  // tags may arrive as a JSON string or an array — normalize
  const normalizeTags = useCallback((t: unknown): string[] => {
    if (!t) return [];
    if (Array.isArray(t)) return t;
    if (typeof t === "string") {
      try { const parsed = JSON.parse(t); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
    }
    return [];
  }, []);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    products.forEach((p) => normalizeTags(p.tags).forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [products, normalizeTags]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (p.status !== "active") return false;
      const ptags = normalizeTags(p.tags);
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q) ||
        ptags.some((t) => t.toLowerCase().includes(q));
      const matchesTags =
        selectedTags.length === 0 || selectedTags.some((t) => ptags.includes(t));
      return matchesSearch && matchesTags;
    });
  }, [products, searchQuery, selectedTags, normalizeTags]);

  const getProduct = useCallback(
    (productId: string) => products.find((p) => p.id === productId) || null,
    [products],
  );

  return {
    products: filteredProducts,
    allProducts: products,
    allTags,
    catalogBusy,
    loadCatalog,
    myKeys,
    mySubscriptions,
    usageMap,
    loadMyApps,
    getProduct,
    akName, setAkName,
    akScopes, setAkScopes,
    akExpires, setAkExpires,
    akCreatedKey, setAkCreatedKey,
    akBusy,
    createPortalKey,
    portalTab, setPortalTab,
    searchQuery, setSearchQuery,
    selectedTags,
    toggleTag,
    docsProductId, setDocsProductId,
    viewProductDocs,
    subscribeToProduct, subBusy,
  };
}
