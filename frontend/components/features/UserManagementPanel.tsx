"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Plus, Trash2, Edit3, UserCircle, Users } from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary, btnSecondary } from "@/lib/constants";
import { useUsers } from "@/hooks/useUsers";
import type { UserResponse } from "@/lib/types";

interface UserManagementPanelProps {
  canManage: boolean;
  notifyError: (msg: string) => void;
  notifySucc: (msg: string) => void;
  t: <T>(en: T, zh: T) => T;
}

const ROLES = ["admin", "reviewer", "editor", "viewer"];
const STATUSES = ["active", "disabled"];

export default function UserManagementPanel({
  canManage,
  notifyError,
  notifySucc,
  t,
}: UserManagementPanelProps) {
  const [showCreate, setShowCreate] = useState(false);
  const usersHook = useUsers(notifyError, notifySucc);

  useEffect(() => {
    usersHook.loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    await usersHook.createUser();
    setShowCreate(false);
  };

  const startEdit = (u: UserResponse) => {
    usersHook.setEditUserId(u.id);
    usersHook.setEditRole(u.role);
    usersHook.setEditStatus(u.status);
    usersHook.setEditDisplayName(u.display_name || "");
  };

  const cancelEdit = () => {
    usersHook.setEditUserId("");
    usersHook.setEditRole("");
    usersHook.setEditStatus("");
    usersHook.setEditDisplayName("");
  };

  const roleLabel = (role: string) => {
    const m: Record<string, string> = {
      admin: t("Admin", "管理员"),
      reviewer: t("Reviewer", "审核者"),
      editor: t("Editor", "编辑者"),
      viewer: t("Viewer", "观察者"),
    };
    return m[role] || role;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            {t("User Management", "用户管理")}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {t("Manage users, roles, and access control.", "管理用户、角色和访问控制。")}
          </p>
        </div>
        {canManage && (
          <button onClick={() => setShowCreate(!showCreate)} className={btnPrimary}>
            <Plus className="w-4 h-4 mr-2" /> {t("Create User", "创建用户")}
          </button>
        )}
      </div>

      {/* Create User Form */}
      {showCreate && (
        <div className={`${cardClass} border-l-4 border-l-blue-500`}>
          <h3 className="font-semibold mb-3">{t("New User", "新建用户")}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t("Username", "用户名")} *</label>
              <input className={inputClass} value={usersHook.newUsername} onChange={(e) => usersHook.setNewUsername(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t("Password", "密码")} *</label>
              <input className={inputClass} type="password" value={usersHook.newPassword} onChange={(e) => usersHook.setNewPassword(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t("Email", "邮箱")}</label>
              <input className={inputClass} type="email" value={usersHook.newEmail} onChange={(e) => usersHook.setNewEmail(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t("Display Name", "显示名称")}</label>
              <input className={inputClass} value={usersHook.newDisplayName} onChange={(e) => usersHook.setNewDisplayName(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t("Role", "角色")}</label>
              <select className={inputClass} value={usersHook.newRole} onChange={(e) => usersHook.setNewRole(e.target.value)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{roleLabel(r)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleCreate} disabled={usersHook.busy} className={btnPrimary}>
              {t("Create", "创建")}
            </button>
            <button onClick={() => setShowCreate(false)} className={btnSecondary}>
              {t("Cancel", "取消")}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          className={`${inputClass} max-w-xs`}
          placeholder={t("Search username / email...", "搜索用户名 / 邮箱...")}
          value={usersHook.search}
          onChange={(e) => usersHook.setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && usersHook.loadUsers()}
        />
        <select className={`${inputClass} max-w-[140px]`} value={usersHook.filterRole} onChange={(e) => { usersHook.setFilterRole(e.target.value); setTimeout(() => usersHook.loadUsers(), 0); }}>
          <option value="">{t("All Roles", "全部角色")}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{roleLabel(r)}</option>
          ))}
        </select>
        <select className={`${inputClass} max-w-[140px]`} value={usersHook.filterStatus} onChange={(e) => { usersHook.setFilterStatus(e.target.value); setTimeout(() => usersHook.loadUsers(), 0); }}>
          <option value="">{t("All Status", "全部状态")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s === "active" ? t("Active", "活跃") : t("Disabled", "禁用")}</option>
          ))}
        </select>
        <button onClick={usersHook.loadUsers} className={btnSecondary}>
          {t("Search", "搜索")}
        </button>
      </div>

      {/* User Table */}
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm resp-table">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
              <th className="py-3 pr-4 font-medium text-gray-500">{t("User", "用户")}</th>
              <th className="py-3 pr-4 font-medium text-gray-500">{t("Email", "邮箱")}</th>
              <th className="py-3 pr-4 font-medium text-gray-500">{t("Role", "角色")}</th>
              <th className="py-3 pr-4 font-medium text-gray-500">{t("Status", "状态")}</th>
              <th className="py-3 pr-4 font-medium text-gray-500">{t("Last Login", "最后登录")}</th>
              <th className="py-3 font-medium text-gray-500">{t("Actions", "操作")}</th>
            </tr>
          </thead>
          <tbody>
            {usersHook.users.map((u) =>
              usersHook.editUserId === u.id ? (
                <tr key={u.id} className="border-b border-gray-100 dark:border-gray-800 bg-blue-50/30 dark:bg-blue-900/10">
                  <td className="py-3 pr-4" data-label={t("User", "用户")}>
                    <div className="flex items-center space-x-2">
                      {u.avatar_url ? (
                        <Image src={u.avatar_url} width={32} height={32} className="w-8 h-8 rounded-full" alt="" unoptimized />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                          <UserCircle className="w-4 h-4 text-gray-500" />
                        </div>
                      )}
                      <span className="font-medium">{u.username}</span>
                    </div>
                    <input
                      className={`${inputClass} mt-1 text-xs`}
                      value={usersHook.editDisplayName}
                      onChange={(e) => usersHook.setEditDisplayName(e.target.value)}
                      placeholder={t("Display name", "显示名称")}
                    />
                  </td>
                  <td className="py-3 pr-4 text-gray-500" data-label={t("Email", "邮箱")}>{u.email || "—"}</td>
                  <td className="py-3 pr-4" data-label={t("Role", "角色")}>
                    <select className={`${inputClass} text-xs py-1`} value={usersHook.editRole} onChange={(e) => usersHook.setEditRole(e.target.value)}>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{roleLabel(r)}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 pr-4" data-label={t("Status", "状态")}>
                    <select className={`${inputClass} text-xs py-1`} value={usersHook.editStatus} onChange={(e) => usersHook.setEditStatus(e.target.value)}>
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s === "active" ? t("Active", "活跃") : t("Disabled", "禁用")}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 pr-4 text-gray-500 text-xs" data-label={t("Last Login", "最后登录")}>
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : t("Never", "从未")}
                  </td>
                  <td className="py-3" data-label={t("Actions", "操作")}>
                    <div className="flex space-x-1">
                      {canManage && (
                        <button onClick={() => usersHook.updateUser(u.id)} disabled={usersHook.busy} className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1">
                          {t("Save", "保存")}
                        </button>
                      )}
                      <button onClick={cancelEdit} className="text-xs text-gray-500 hover:text-gray-700 font-medium px-2 py-1">
                        {t("Cancel", "取消")}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={u.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-3 pr-4" data-label={t("User", "用户")}>
                    <div className="flex items-center space-x-2">
                      {u.avatar_url ? (
                        <Image src={u.avatar_url} width={32} height={32} className="w-8 h-8 rounded-full" alt="" unoptimized />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                          <UserCircle className="w-4 h-4 text-gray-500" />
                        </div>
                      )}
                      <div>
                        <span className="font-medium">{u.username}</span>
                        {u.display_name && (
                          <span className="text-xs text-gray-500 block">{u.display_name}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-gray-500" data-label={t("Email", "邮箱")}>{u.email || "—"}</td>
                  <td className="py-3 pr-4" data-label={t("Role", "角色")}>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.role === "admin"
                        ? "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300"
                        : u.role === "editor"
                        ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                    }`}>
                      {roleLabel(u.role)}
                    </span>
                  </td>
                  <td className="py-3 pr-4" data-label={t("Status", "状态")}>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.status === "active"
                        ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                        : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                    }`}>
                      {u.status === "active" ? t("Active", "活跃") : t("Disabled", "禁用")}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-gray-500 text-xs" data-label={t("Last Login", "最后登录")}>
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : t("Never", "从未")}
                  </td>
                  <td className="py-3" data-label={t("Actions", "操作")}>
                    {canManage && (
                      <div className="flex space-x-1">
                        <button onClick={() => startEdit(u)} className="text-blue-500 hover:text-blue-700 p-1" title={t("Edit", "编辑") as string}>
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {u.username !== "admin" && (
                          <button onClick={() => usersHook.deleteUser(u.id)} className="text-red-500 hover:text-red-700 p-1" title={t("Delete", "删除") as string}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ),
            )}
            {usersHook.users.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-400">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  {t("No users found", "未找到用户")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
