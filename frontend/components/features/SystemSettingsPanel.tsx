"use client";

import { useState, useCallback } from "react";
import { Settings, Lock, Edit3, X, Check, Mail, Loader2 } from "lucide-react";
import { cardClass, inputClass, btnPrimary, btnSecondary } from "@/lib/constants";
import { useSystemSettings, type SystemSettingItem } from "@/hooks/useSystemSettings";
import { apiFetch } from "@/lib/api";

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
  const [smtpTesting, setSmtpTesting] = useState(false);

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

  const testSmtp = useCallback(async () => {
    setSmtpTesting(true);
    try {
      const r = await apiFetch("/admin/v1/system/smtp/test", {
        method: "POST",
        body: JSON.stringify({}),
      }, accessToken);
      const d = await r.json();
      if (r.ok) {
        notifySucc?.(d.message || "Test email sent successfully");
      } else {
        notifyError?.(d.message || "SMTP test failed");
      }
    } catch (e) {
      notifyError?.((e as Error).message);
    } finally {
      setSmtpTesting(false);
    }
  }, [accessToken, notifySucc, notifyError]);

  const smtpSettings = settings.filter(s => s.key.startsWith("smtp_"));
  const otherSettings = settings.filter(s => !s.key.startsWith("smtp_"));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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

      {/* SMTP Section */}
      <div className={cardClass}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold">{t("SMTP Mail Configuration", "SMTP 邮件服务配置")}</h2>
          </div>
          {canWrite && (
            <button
              onClick={testSmtp}
              disabled={smtpTesting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-all disabled:opacity-50"
            >
              {smtpTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              {smtpTesting ? t("Testing...", "测试中...") : t("Send Test Email", "发送测试邮件")}
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm resp-table">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                <th className="py-2 pr-4 font-medium text-gray-500">{t("Setting", "配置项")}</th>
                <th className="py-2 pr-4 font-medium text-gray-500">{t("Value", "值")}</th>
                <th className="py-2 pr-4 font-medium text-gray-500">{t("Description", "说明")}</th>
                {canWrite && <th className="py-2 font-medium text-gray-500 w-24">{t("Actions", "操作")}</th>}
              </tr>
            </thead>
            <tbody>
              {smtpSettings.map((s) => renderRow(s))}
              {smtpSettings.length === 0 && (
                <tr><td colSpan={canWrite ? 4 : 3} className="py-4 text-center text-gray-400">{t("No SMTP settings found", "未找到 SMTP 配置")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* General Settings */}
      <div className={cardClass}>
        <h2 className="text-lg font-semibold mb-3">{t("General Settings", "通用设置")}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm resp-table">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                <th className="py-2 pr-4 font-medium text-gray-500">{t("Setting", "配置项")}</th>
                <th className="py-2 pr-4 font-medium text-gray-500">{t("Value", "值")}</th>
                <th className="py-2 pr-4 font-medium text-gray-500">{t("Description", "说明")}</th>
                {canWrite && <th className="py-2 font-medium text-gray-500 w-24">{t("Actions", "操作")}</th>}
              </tr>
            </thead>
            <tbody>
              {otherSettings.map((s) => renderRow(s))}
              {otherSettings.length === 0 && (
                <tr><td colSpan={canWrite ? 4 : 3} className="py-8 text-center text-gray-400">
                  <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  {t("No settings found", "未找到配置项")}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  function renderRow(s: SystemSettingItem) {
    const label = LABELS[s.key];
    const displayName = label ? t(label.en, label.zh) : s.key;
    const isEditing = editKey === s.key;
    const isSensitive = s.key.includes("password") || s.key.includes("secret");

    return (
      <tr key={s.key} className={`border-b border-gray-100 dark:border-gray-800 ${isEditing ? "bg-blue-50/30 dark:bg-blue-900/10" : "hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}>
        <td className="py-2.5 pr-4" data-label={t("Setting", "配置项")}>
          <div className="flex items-center space-x-2">
            <span className="font-medium text-xs">{displayName}</span>
            {!s.editable && <Lock className="w-3 h-3 text-gray-400" />}
          </div>
        </td>
        <td className="py-2.5 pr-4" data-label={t("Value", "值")}>
          {isEditing ? (
            <input
              className={`${inputClass} py-1 text-xs`}
              value={editVal}
              onChange={(e) => setEditVal(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && saveEdit()}
            />
          ) : (
            <code className={`text-xs px-2 py-1 rounded ${isSensitive ? "bg-gray-100 dark:bg-gray-800 text-gray-400 italic" : ""}`}>
              {isSensitive ? "••••••••" : (s.value || "—")}
            </code>
          )}
        </td>
        <td className="py-2.5 pr-4 text-xs text-gray-500" data-label={t("Description", "说明")}>{s.description || "—"}</td>
        {canWrite && (
        <td className="py-2.5" data-label={t("Actions", "操作")}>
          {!s.editable ? (
            <span className="text-xs text-gray-400">{t("Read-only", "只读")}</span>
          ) : isEditing ? (
            <div className="flex space-x-1">
              <button onClick={saveEdit} className="text-green-500 hover:text-green-700 p-1" title={t("Save", "保存") as string}>
                <Check className="w-4 h-4" />
              </button>
              <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 p-1" title={t("Cancel", "取消") as string}>
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button onClick={() => startEdit(s)} disabled={busy} className="text-blue-500 hover:text-blue-700 p-1" title={t("Edit", "编辑") as string}>
              <Edit3 className="w-4 h-4" />
            </button>
          )}
        </td>
        )}
      </tr>
    );
  }
}
