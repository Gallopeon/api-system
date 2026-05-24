import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type { PermissionTemplate, PermissionTemplateListResponse } from "@/lib/types";

export function usePermissionTemplates(
  notifyError?: (msg: string) => void,
  notifySucc?: (msg: string) => void,
) {
  const [templates, setTemplates] = useState<PermissionTemplate[]>([]);
  const [busy, setBusy] = useState(false);

  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPermissions, setEditPermissions] = useState<string[]>([]);

  const loadTemplates = useCallback(async () => {
    setBusy(true);
    try {
      const r = await apiFetch("/admin/v1/permission-templates");
      if (r.ok) {
        const d = (await r.json()) as PermissionTemplateListResponse;
        setTemplates(d.items || []);
      }
    } catch (e) {
      notifyError?.("Failed to load permission templates");
      console.error(e);
    } finally {
      setBusy(false);
    }
  }, [notifyError]);

  const createTemplate = useCallback(async () => {
    if (!editName || editPermissions.length === 0) {
      notifyError?.("Name and at least one permission are required");
      return;
    }
    setBusy(true);
    try {
      const r = await apiFetch("/admin/v1/permission-templates", {
        method: "POST",
        body: JSON.stringify({
          name: editName,
          description: editDescription || undefined,
          permissions: editPermissions,
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.message || `Create failed (${r.status})`);
      }
      notifySucc?.("Permission template created");
      setEditName("");
      setEditDescription("");
      setEditPermissions([]);
      await loadTemplates();
    } catch (e) {
      notifyError?.((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [editName, editDescription, editPermissions, loadTemplates, notifyError, notifySucc]);

  const updateTemplate = useCallback(async () => {
    if (!editId) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = {};
      if (editName) body.name = editName;
      if (editDescription) body.description = editDescription;
      if (editPermissions.length > 0) body.permissions = editPermissions;
      const r = await apiFetch(`/admin/v1/permission-templates/${editId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.message || `Update failed (${r.status})`);
      }
      notifySucc?.("Permission template updated");
      setEditId("");
      setEditName("");
      setEditDescription("");
      setEditPermissions([]);
      await loadTemplates();
    } catch (e) {
      notifyError?.((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [editId, editName, editDescription, editPermissions, loadTemplates, notifyError, notifySucc]);

  const deleteTemplate = useCallback(async (id: string) => {
    if (!confirm("Delete this permission template?")) return;
    setBusy(true);
    try {
      const r = await apiFetch(`/admin/v1/permission-templates/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.message || `Delete failed (${r.status})`);
      }
      notifySucc?.("Permission template deleted");
      await loadTemplates();
    } catch (e) {
      notifyError?.((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [loadTemplates, notifyError, notifySucc]);

  return {
    templates, busy,
    editId, editName, editDescription, editPermissions,
    setEditId, setEditName, setEditDescription, setEditPermissions,
    loadTemplates, createTemplate, updateTemplate, deleteTemplate,
  };
}
