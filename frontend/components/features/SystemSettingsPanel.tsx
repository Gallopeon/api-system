"use client";

import { useState } from "react";
import {
  Settings, Lock, Edit3, X, Check, Mail,
  Server, Shield, FileText, ChevronDown, Send,
} from "lucide-react";
import { cardClass, inputClass, btnSecondary } from "@/lib/constants";
import { useSystemSettings, type SystemSettingItem } from "@/hooks/useSystemSettings";
import SmtpTestDialog from "./SmtpTestDialog";

interface SystemSettingsPanelProps {
  accessToken?: string;
  canWrite: boolean;
  notifyError: (msg: string) => void;
  notifySucc: (msg: string) => void;
  t: <T>(en: T, zh: T) => T;
}

const LABELS: Record<string, { en: string; zh: string }> = {
  cache_ttl_seconds: { en: "Cache TTL (seconds)", zh: "缓存 TTL（秒）" },
  jwt_ttl_seconds: { en: "JWT TTL (seconds)", zh: "JWT 有效期（秒）" },
  login_max_attempts: { en: "Max Login Attempts", zh: "最大登录尝试次数" },
  login_lockout_minutes: { en: "Lockout Duration (minutes)", zh: "锁定持续时间（分钟）" },
  password_policy_enforced: { en: "Password Policy", zh: "密码策略" },
  jwt_secret: { en: "JWT Secret", zh: "JWT 密钥" },
  admin_default_password: { en: "Default Admin Password", zh: "默认管理员密码" },
  cors_allowed_origins: { en: "CORS Origins", zh: "跨域来源" },
  rust_log: { en: "Log Level", zh: "日志级别" },
  smtp_host: { en: "SMTP Host", zh: "SMTP 服务器" },
  smtp_port: { en: "SMTP Port", zh: "SMTP 端口" },
  smtp_encryption: { en: "SMTP Encryption", zh: "SMTP 加密方式" },
  smtp_username: { en: "SMTP Username", zh: "SMTP 用户名" },
  smtp_password: { en: "SMTP Password", zh: "SMTP 密码" },
  smtp_from_email: { en: "From Email", zh: "发件人邮箱" },
  smtp_from_name: { en: "From Name", zh: "发件人名称" },
};

type SettingGroup = {
  key: string;
  icon: React.ReactNode;
  title: { en: string; zh: string };
  keys: string[];
};

const GENERAL_GROUPS: SettingGroup[] = [
  {
    key: "security",
    icon: <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
    title: { en: "Security", zh: "安全" },
    keys: ["jwt_secret", "jwt_ttl_seconds", "login_max_attempts", "login_lockout_minutes", "password_policy_enforced"],
  },
  {
    key: "infra",
    icon: <Server className="w-5 h-5 text-violet-600 dark:text-violet-400" />,
    title: { en: "Infrastructure", zh: "基础设施" },
    keys: ["rust_log", "cors_allowed_origins", "cache_ttl_seconds"],
  },
];

export default function SystemSettingsPanel({
  accessToken,
  canWrite,
  notifyError,
  notifySucc,
  t,
}: SystemSettingsPanelProps) {
  const { settings, busy, updateSetting, mutate } =
    useSystemSettings(accessToken, notifyError, notifySucc);
  const [editKey, setEditKey] = useState("");
  const [editVal, setEditVal] = useState("");
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const startEdit = (s: SystemSettingItem) => {
    setEditKey(s.key);
    setEditVal(s.value);
  };

  const cancelEdit = () => {
    setEditKey("");
    setEditVal("");
  };

  const saveEdit = async () => {
    await updateSetting(editKey, editVal);
    setEditKey("");
    setEditVal("");
  };

  const fromEmail = settings.find(s => s.key === "smtp_from_email")?.value || "";

  const smtpSettings = settings.filter(s => s.key.startsWith("smtp_"));
  const smtpKeys = new Set(smtpSettings.map(s => s.key));
  const otherSettings = settings.filter(s => !s.key.startsWith("smtp_"));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            {t("System Settings", "系统设置")}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {t("Runtime configuration — changes take effect immediately.", "运行时配置 — 修改即时生效。")}
          </p>
        </div>
        <button onClick={() => mutate()} className={btnSecondary} disabled={busy}>
          {t("Refresh", "刷新")}
        </button>
      </div>

      {/* ===== SMTP Mail Section ===== */}
      <div className={cardClass + " relative overflow-hidden"}>
        {/* Header accent bar */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-cyan-400" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pt-1">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40">
              <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t("SMTP Mail Configuration", "SMTP 邮件服务配置")}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {t("Configure outgoing mail server for notifications and alerts", "配置外发邮件服务器用于通知和告警")}
              </p>
            </div>
          </div>

          {canWrite && (
            <button
              onClick={() => setShowTestDialog(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-950/50 hover:border-blue-300 dark:hover:border-blue-700 transition-all shadow-sm"
            >
              <Send className="w-4 h-4" />
              {t("Send Test Email", "发送测试邮件")}
            </button>
          )}
        </div>

        {/* SMTP Form Grid */}
        {smtpSettings.length === 0 ? (
          <p className="text-center text-gray-400 py-4 text-sm">
            {t("No SMTP settings found", "未找到 SMTP 配置")}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {smtpSettings.map(s => (
              <div key={s.key} className="group flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  {!s.editable && <Lock className="w-3 h-3 text-gray-400 shrink-0" />}
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                    {LABELS[s.key] ? t(LABELS[s.key].en, LABELS[s.key].zh) : s.key}
                  </span>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  {editKey === s.key ? (
                    <input
                      className={`${inputClass} py-1 text-xs w-44`}
                      value={editVal}
                      onChange={(e) => setEditVal(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                    />
                  ) : (
                    <code className={`text-xs px-2 py-1 rounded max-w-[180px] truncate ${
                      s.key.includes("password") ? "bg-gray-100 dark:bg-gray-800 text-gray-400 italic" : "text-gray-600 dark:text-gray-400"
                    }`}>
                      {s.key.includes("password") ? "••••••••" : (s.value || <span className="text-gray-300 dark:text-zinc-600">—</span>)}
                    </code>
                  )}
                  {canWrite && s.editable && (
                    editKey === s.key ? (
                      <div className="flex gap-0.5">
                        <button onClick={saveEdit} className="text-green-500 hover:text-green-700 p-1 rounded" title={t("Save", "保存") as string}>
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 p-1 rounded" title={t("Cancel", "取消") as string}>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(s)} disabled={busy} className="text-gray-400 hover:text-blue-500 p-1 rounded opacity-0 group-hover:opacity-100 transition-all" title={t("Edit", "编辑") as string}>
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )
                  )}
                  {s.editable === false && (
                    <span className="text-xs text-gray-400">{t("Read-only", "只读")}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== General Settings Section ===== */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t("General Settings", "通用设置")}
          </h2>
        </div>

        {GENERAL_GROUPS.map(group => {
          const groupSettings = otherSettings.filter(s => group.keys.includes(s.key));
          if (groupSettings.length === 0) return null;
          const isCollapsed = collapsedGroups.has(group.key);
          return (
            <div key={group.key} className={cardClass + " relative"}>
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group.key)}
                className="w-full flex items-center gap-3 -m-1 p-1 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-zinc-800/60">
                  {group.icon}
                </div>
                <span className="text-base font-semibold text-gray-800 dark:text-gray-200">
                  {t(group.title.en, group.title.zh)}
                </span>
                <span className="text-xs text-gray-400 ml-auto">
                  {groupSettings.length} {t("items", "项")}
                </span>
                <div className={`transition-transform duration-200 ${isCollapsed ? "" : "rotate-180"}`}>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </div>
              </button>

              {!isCollapsed && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-zinc-800 space-y-1">
                  {groupSettings.map(s => (
                    <div key={s.key} className="group flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {!s.editable && <Lock className="w-3 h-3 text-gray-400 shrink-0" />}
                        <div className="min-w-0">
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            {LABELS[s.key] ? t(LABELS[s.key].en, LABELS[s.key].zh) : s.key}
                          </span>
                          {s.description && (
                            <p className="text-[11px] text-gray-400 truncate mt-0.5">{s.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        {editKey === s.key ? (
                          <input
                            className={`${inputClass} py-1 text-xs w-44`}
                            value={editVal}
                            onChange={(e) => setEditVal(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                          />
                        ) : (
                          <code className={`text-xs px-2 py-1 rounded max-w-[180px] truncate ${
                            s.key.includes("password") || s.key.includes("secret") ? "bg-gray-100 dark:bg-gray-800 text-gray-400 italic" : "text-gray-600 dark:text-gray-400"
                          }`}>
                            {s.key.includes("password") || s.key.includes("secret") ? "••••••••" : (s.value || <span className="text-gray-300 dark:text-zinc-600">—</span>)}
                          </code>
                        )}
                        {canWrite && s.editable && (
                          editKey === s.key ? (
                            <div className="flex gap-0.5">
                              <button onClick={saveEdit} className="text-green-500 hover:text-green-700 p-1 rounded" title={t("Save", "保存") as string}>
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 p-1 rounded" title={t("Cancel", "取消") as string}>
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => startEdit(s)} disabled={busy} className="text-gray-400 hover:text-blue-500 p-1 rounded opacity-0 group-hover:opacity-100 transition-all" title={t("Edit", "编辑") as string}>
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                        {s.editable === false && (
                          <span className="text-xs text-gray-400">{t("Read-only", "只读")}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Ungrouped settings */}
        {(() => {
          const groupedKeys = GENERAL_GROUPS.flatMap(g => g.keys);
          const ungrouped = otherSettings.filter(s => !groupedKeys.includes(s.key));
          if (ungrouped.length === 0) return null;
          return (
            <div className={cardClass}>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {t("Other", "其他")}
                </h3>
              </div>
              <div className="space-y-1">
                {ungrouped.map(s => (
                  <div key={s.key} className="group flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {!s.editable && <Lock className="w-3 h-3 text-gray-400 shrink-0" />}
                      <div className="min-w-0">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          {LABELS[s.key] ? t(LABELS[s.key].en, LABELS[s.key].zh) : s.key}
                        </span>
                        {s.description && (
                          <p className="text-[11px] text-gray-400 truncate mt-0.5">{s.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      {editKey === s.key ? (
                        <input
                          className={`${inputClass} py-1 text-xs w-44`}
                          value={editVal}
                          onChange={(e) => setEditVal(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                        />
                      ) : (
                        <code className={`text-xs px-2 py-1 rounded max-w-[180px] truncate ${
                          s.key.includes("password") || s.key.includes("secret") ? "bg-gray-100 dark:bg-gray-800 text-gray-400 italic" : "text-gray-600 dark:text-gray-400"
                        }`}>
                          {s.key.includes("password") || s.key.includes("secret") ? "••••••••" : (s.value || <span className="text-gray-300 dark:text-zinc-600">—</span>)}
                        </code>
                      )}
                      {canWrite && s.editable && (
                        editKey === s.key ? (
                          <div className="flex gap-0.5">
                            <button onClick={saveEdit} className="text-green-500 hover:text-green-700 p-1 rounded" title={t("Save", "保存") as string}>
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 p-1 rounded" title={t("Cancel", "取消") as string}>
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(s)} disabled={busy} className="text-gray-400 hover:text-blue-500 p-1 rounded opacity-0 group-hover:opacity-100 transition-all" title={t("Edit", "编辑") as string}>
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )
                      )}
                      {s.editable === false && (
                        <span className="text-xs text-gray-400">{t("Read-only", "只读")}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* SMTP Test Dialog */}
      {showTestDialog && (
        <SmtpTestDialog
          accessToken={accessToken}
          defaultToEmail={fromEmail}
          notifyError={notifyError}
          notifySucc={notifySucc}
          t={t}
          onClose={() => setShowTestDialog(false)}
        />
      )}
    </div>
  );
}
