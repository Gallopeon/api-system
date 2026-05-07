"use client";

import { useState } from "react";
import { Settings, Lock, Edit3, X, Check } from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary, btnSecondary } from "@/lib/constants";
import { useSystemSettings, type SystemSettingItem } from "@/hooks/useSystemSettings";

interface SystemSettingsPanelProps {
  accessToken?: string;
  canWrite: boolean;
  notifyError: (msg: string) => void;
  notifySucc: (msg: string) => void;
  t: <T>(en: T, zh: T) => T;
}

const LABELS: Record<string, { en: string; zh: string }> = {
  auth_enabled: { en: "Auth Enabled", zh: "启用认证" },
  cache_ttl_seconds: { en: "Cache TTL (seconds)", zh: "缓存 TTL（秒）" },
  jwt_ttl_seconds: { en: "JWT TTL (seconds)", zh: "JWT 有效期（秒）" },
  login_max_attempts: { en: "Max Login Attempts", zh: "最大登录尝试次数" },
  login_lockout_minutes: { en: "Lockout Duration (minutes)", zh: "锁定持续时间（分钟）" },
  password_policy_enforced: { en: "Password Policy", zh: "密码策略" },
  jwt_secret: { en: "JWT Secret", zh: "JWT 密钥" },
  admin_default_password: { en: "Default Admin Password", zh: "默认管理员密码" },
  cors_allowed_origins: { en: "CORS Origins", zh: "跨域来源" },
  rust_log: { en: "Log Level", zh: "日志级别" },
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

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            {t("System Settings", "系统设置")}
          </h1>
          <p className="text-gray-500">
            {t(
              "Runtime configuration — changes are stored in DB and take effect on next deploy.",
              "运行时配置 — 修改保存到数据库，下次部署时生效。",
            )}
          </p>
        </div>
        <button onClick={() => mutate()} className={btnSecondary} disabled={busy}>
          {t("Refresh", "刷新")}
        </button>
      </div>

      <div className={cardClass}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                <th className="py-3 pr-4 font-medium text-gray-500">{t("Setting", "配置项")}</th>
                <th className="py-3 pr-4 font-medium text-gray-500">{t("Value", "值")}</th>
                <th className="py-3 pr-4 font-medium text-gray-500">{t("Description", "说明")}</th>
                {canWrite && <th className="py-3 font-medium text-gray-500 w-24">{t("Actions", "操作")}</th>}
              </tr>
            </thead>
            <tbody>
              {settings.map((s) => {
                const label = LABELS[s.key];
                const displayName = label ? t(label.en, label.zh) : s.key;
                const isEditing = editKey === s.key;

                return (
                  <tr key={s.key} className={`border-b border-gray-100 dark:border-gray-800 ${isEditing ? "bg-blue-50/30 dark:bg-blue-900/10" : "hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}>
                    <td className="py-3 pr-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium font-mono text-xs">{displayName}</span>
                        {!s.editable && <Lock className="w-3 h-3 text-gray-400" />}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      {isEditing ? (
                        <input
                          className={`${inputClass} py-1 text-xs`}
                          value={editVal}
                          onChange={(e) => setEditVal(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                        />
                      ) : (
                        <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{s.value}</code>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-xs text-gray-500">{s.description || "—"}</td>
                    {canWrite && (
                    <td className="py-3">
                      {!s.editable ? (
                        <span className="text-xs text-gray-400">{t("Env-only", "环境变量")}</span>
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
              })}
              {settings.length === 0 && (
                <tr>
                  <td colSpan={canWrite ? 4 : 3} className="py-8 text-center text-gray-400">
                    <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    {t("No settings found", "未找到配置项")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
