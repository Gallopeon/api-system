"use client";

import { useEffect } from "react";
import { usePermissionTemplates } from "@/hooks/usePermissionTemplates";
import { useNotification } from "@/hooks/useNotification";
import { useI18n } from "@/app/i18n";
import { PERMISSIONS } from "@/lib/permissions";
import { Shield, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import Toast from "@/components/ui/Toast";

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export default function UserManagementPermissionsTab() {
  const { lang } = useI18n();
  const t = <T,>(en: T, zh: T): T => (lang === "zh" ? zh : en);
  const { notif, notifyError, notifySucc, clearNotif } = useNotification();
  const {
    templates, busy,
    editId, editName, editDescription, editPermissions,
    setEditId, setEditName, setEditDescription, setEditPermissions,
    loadTemplates, createTemplate, updateTemplate, deleteTemplate,
  } = usePermissionTemplates(notifyError, notifySucc);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const startEdit = (tpl: typeof templates[0]) => {
    setEditId(tpl.id);
    setEditName(tpl.name);
    setEditDescription(tpl.description || "");
    setEditPermissions([...tpl.permissions]);
  };

  const cancelEdit = () => {
    setEditId("");
    setEditName("");
    setEditDescription("");
    setEditPermissions([]);
  };

  const togglePerm = (perm: string) => {
    setEditPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  };

  const isEditing = !!editId;

  return (
    <div className="space-y-6">
      <Toast msg={notif.msg} type={notif.type} onClose={clearNotif} />

      <p className="text-gray-500 dark:text-gray-400 text-sm">
        {t("Define reusable permission sets to assign to users.", "定义可复用的权限集，分配给用户。")}
      </p>

      {/* Create / Edit form */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("Name", "名称")}</label>
            <input
              className="w-full border rounded-md px-3 py-2 dark:bg-slate-700 dark:border-slate-600"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder={t("Template name", "模板名称") as string}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("Description", "描述")}</label>
            <input
              className="w-full border rounded-md px-3 py-2 dark:bg-slate-700 dark:border-slate-600"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder={t("Optional description", "可选描述") as string}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">{t("Permissions", "权限")}</label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-64 overflow-y-auto border rounded-md p-3 dark:border-slate-600">
            {ALL_PERMISSIONS.map((perm) => (
              <label key={perm} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 rounded px-1">
                <input
                  type="checkbox"
                  checked={editPermissions.includes(perm)}
                  onChange={() => togglePerm(perm)}
                  className="rounded"
                />
                <span className="truncate" title={perm}>{perm}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button
                onClick={updateTemplate}
                disabled={busy}
                className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <Check className="w-4 h-4" /> {t("Save", "保存")}
              </button>
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1 px-4 py-2 border rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <X className="w-4 h-4" /> {t("Cancel", "取消")}
              </button>
            </>
          ) : (
            <button
              onClick={createTemplate}
              disabled={busy}
              className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> {t("Create Template", "创建模板")}
            </button>
          )}
        </div>
      </div>

      {/* Templates list */}
      <div className="space-y-3">
        {templates.map((tpl) => (
          <div
            key={tpl.id}
            className={`bg-white dark:bg-slate-800 rounded-lg border p-4 ${
              tpl.is_builtin
                ? "border-amber-200 dark:border-amber-700"
                : "border-slate-200 dark:border-slate-700"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">{tpl.name}</h3>
                  {tpl.is_builtin && (
                    <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                      {t("Built-in", "内置")}
                    </span>
                  )}
                </div>
                {tpl.description && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{tpl.description}</p>
                )}
                <div className="flex flex-wrap gap-1">
                  {tpl.permissions.map((p) => (
                    <span
                      key={p}
                      className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
              {!tpl.is_builtin && (
                <div className="flex items-center gap-1 ml-4">
                  <button
                    onClick={() => startEdit(tpl)}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                    title={t("Edit", "编辑") as string}
                  >
                    <Pencil className="w-4 h-4 text-slate-500" />
                  </button>
                  <button
                    onClick={() => deleteTemplate(tpl.id)}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                    title={t("Delete", "删除") as string}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {templates.length === 0 && !busy && (
          <div className="text-center text-slate-500 py-8">
            {t("No permission templates found.", "暂无权限模板。")}
          </div>
        )}
      </div>
    </div>
  );
}
