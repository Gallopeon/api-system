import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type { ApiProduct } from "@/lib/types";

export function useProducts(
  accessToken: string | undefined,
  notifyError: (msg: string) => void,
  notifySucc: (msg: string) => void,
) {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [busy, setBusy] = useState(false);

  const loadProducts = useCallback(async (search?: string) => {
    try {
      const qs = search ? `?limit=50&search=${encodeURIComponent(search)}` : "?limit=50";
      const r = await apiFetch(`/admin/v1/products${qs}`, {}, accessToken);
      if (r.ok) {
        const d = await r.json();
        setProducts((d as { items?: ApiProduct[] }).items || []);
      }
    } catch { /* ignore */ }
  }, [accessToken]);

  const createProduct = useCallback(async (data: Record<string, unknown>) => {
    if (!(data.name as string)?.trim()) { notifyError?.("Name is required"); return; }
    setBusy(true);
    try {
      const r = await apiFetch("/admin/v1/products", { method: "POST", body: JSON.stringify(data) }, accessToken);
      if (!r.ok) throw new Error((await r.json())?.message || `HTTP ${r.status}`);
      notifySucc?.("Product created!");
      await loadProducts();
    } catch (e) { notifyError?.((e as Error).message); }
    finally { setBusy(false); }
  }, [accessToken, loadProducts, notifyError, notifySucc]);

  const updateProduct = useCallback(async (id: string, data: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await apiFetch(`/admin/v1/products/${id}`, { method: "PUT", body: JSON.stringify(data) }, accessToken);
      if (!r.ok) throw new Error((await r.json())?.message || `HTTP ${r.status}`);
      notifySucc?.("Product updated!");
      await loadProducts();
    } catch (e) { notifyError?.((e as Error).message); }
    finally { setBusy(false); }
  }, [accessToken, loadProducts, notifyError, notifySucc]);

  const toggleProductStatus = useCallback(async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    setBusy(true);
    try {
      const r = await apiFetch(`/admin/v1/products/${id}`, { method: "PUT", body: JSON.stringify({ status: newStatus }) }, accessToken);
      if (!r.ok) throw new Error((await r.json())?.message || `HTTP ${r.status}`);
      notifySucc?.(newStatus === "active" ? "Product activated" : "Product deactivated");
      await loadProducts();
    } catch (e) { notifyError?.((e as Error).message); }
    finally { setBusy(false); }
  }, [accessToken, loadProducts, notifyError, notifySucc]);

  const deleteProduct = useCallback(async (id: string) => {
    if (!confirm("Delete this product? All active subscriptions will be cancelled.")) return;
    setBusy(true);
    try {
      const r = await apiFetch(`/admin/v1/products/${id}`, { method: "DELETE" }, accessToken);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      notifySucc?.("Product deleted");
      await loadProducts();
    } catch (e) { notifyError?.((e as Error).message); }
    finally { setBusy(false); }
  }, [accessToken, loadProducts, notifyError, notifySucc]);

  return { products, busy, loadProducts, createProduct, updateProduct, toggleProductStatus, deleteProduct };
}
