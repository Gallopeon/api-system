"use client";

import { useEffect, useState } from "react";
import { UserCircle, Shield, Monitor, History, QrCode, Settings } from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary, btnSecondary } from "@/lib/constants";
import { useUserProfile, useSessions, useLoginHistory, useTotp, usePreferences } from "@/hooks/useUserProfile";

interface UserCenterPanelProps {
  accessToken?: string;
  notifyError: (msg: string) => void;
  notifySucc: (msg: string) => void;
  t: <T>(en: T, zh: T) => T;
}

export default function UserCenterPanel({
  accessToken,
  notifyError,
  notifySucc,
  t,
}: UserCenterPanelProps) {
  const [activeTab, setActiveTab] = useState("profile");
  const { profile, profileBusy, loadProfile, updateProfile, changePassword } =
    useUserProfile(accessToken, notifyError, notifySucc);
  const { sessions, loadSessions, revokeSession } =
    useSessions(accessToken, notifyError, notifySucc);
  const { loginHistory, loadLoginHistory } = useLoginHistory(accessToken);
  const { totpBusy, totpSecret, totpQrUrl, totpEnabled, setupTotp, verifyTotp, disableTotp, checkTotpStatus } =
    useTotp(accessToken, notifyError, notifySucc);
  const { prefs, loadPreferences, savePreferences } = usePreferences(accessToken, notifySucc);

  // Profile form
  const [editEmail, setEditEmail] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");

  // TOTP form
  const [totpCode, setTotpCode] = useState("");

  // Preferences form
  const [prefTheme, setPrefTheme] = useState("system");
  const [prefLang, setPrefLang] = useState("zh");
  const [prefEmailRuleChanges, setPrefEmailRuleChanges] = useState(true);
  const [prefEmailSecurity, setPrefEmailSecurity] = useState(true);
  const [prefInAppApprovals, setPrefInAppApprovals] = useState(true);
  const [prefInAppAudit, setPrefInAppAudit] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    loadProfile();
    loadSessions();
    loadLoginHistory();
    checkTotpStatus();
    loadPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (profile) {
      setEditEmail(profile.email || "");
      setEditDisplayName(profile.display_name || "");
      setEditAvatarUrl(profile.avatar_url || "");
    }
  }, [profile]);

  useEffect(() => {
    if (prefs.theme) setPrefTheme(prefs.theme);
    if (prefs.lang) setPrefLang(prefs.lang);
    if (prefs.notifications?.email) {
      setPrefEmailRuleChanges(prefs.notifications.email.rule_changes);
      setPrefEmailSecurity(prefs.notifications.email.security_alerts);
    }
    if (prefs.notifications?.in_app) {
      setPrefInAppApprovals(prefs.notifications.in_app.approvals);
      setPrefInAppAudit(prefs.notifications.in_app.audit);
    }
  }, [prefs]);

  const handleUpdateProfile = async () => {
    await updateProfile({
      email: editEmail || undefined,
      display_name: editDisplayName || undefined,
      avatar_url: editAvatarUrl || undefined,
    });
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      notifyError(t("Passwords do not match", "两次密码不一致"));
      return;
    }
    const ok = await changePassword(currentPassword, newPassword);
    if (ok) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const tabs = [
    { id: "profile", icon: UserCircle, en: "Profile", zh: "个人资料" },
    { id: "security", icon: Shield, en: "Security", zh: "安全设置" },
    { id: "totp", icon: QrCode, en: "Two-Factor Auth", zh: "两步验证" },
    { id: "sessions", icon: Monitor, en: "Sessions", zh: "会话管理" },
    { id: "history", icon: History, en: "Login History", zh: "登录历史" },
    { id: "preferences", icon: Settings, en: "Preferences", zh: "偏好设置" },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          {t("User Center", "用户中心")}
        </h1>
        <p className="text-gray-500">
          {t("Manage your profile, security, and sessions.", "管理您的个人资料、安全和会话。")}
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 space-x-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center space-x-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-700 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{t(tab.en, tab.zh)}</span>
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === "profile" && (
        <div className={cardClass}>
          <h2 className="text-lg font-semibold mb-4">{t("Profile Information", "个人信息")}</h2>
          {!profile ? (
            <p className="text-gray-400">{t("Loading...", "加载中...")}</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center space-x-4 mb-6">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {(profile.display_name || profile.username).charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <div className="font-semibold text-lg">{profile.display_name || profile.username}</div>
                  <div className="text-sm text-gray-500">@{profile.username} · {t("Role:", "角色：")} {profile.role}</div>
                </div>
              </div>
              <div>
                <label className={labelClass}>{t("Display Name", "显示名称")}</label>
                <input className={inputClass} value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>{t("Email", "邮箱")}</label>
                <input className={inputClass} type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>{t("Avatar URL", "头像链接")}</label>
                <input className={inputClass} value={editAvatarUrl} onChange={(e) => setEditAvatarUrl(e.target.value)} placeholder="https://..." />
              </div>
              <button onClick={handleUpdateProfile} disabled={profileBusy} className={btnPrimary}>
                {t("Save Changes", "保存更改")}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Security Tab */}
      {activeTab === "security" && (
        <div className={cardClass}>
          <h2 className="text-lg font-semibold mb-4">{t("Change Password", "修改密码")}</h2>
          <div className="space-y-4 max-w-md">
            <div>
              <label className={labelClass}>{t("Current Password", "当前密码")}</label>
              <input className={inputClass} type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t("New Password", "新密码")}</label>
              <input className={inputClass} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">{t("Min 8 chars, uppercase, lowercase, digit", "至少8位，含大写、小写、数字")}</p>
            </div>
            <div>
              <label className={labelClass}>{t("Confirm New Password", "确认新密码")}</label>
              <input className={inputClass} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <button onClick={handleChangePassword} disabled={profileBusy} className={btnPrimary}>
              {t("Update Password", "更新密码")}
            </button>
          </div>
        </div>
      )}

      {/* Sessions Tab */}
      {activeTab === "sessions" && (
        <div className={cardClass}>
          <h2 className="text-lg font-semibold mb-4">{t("Active Sessions", "活跃会话")}</h2>
          {sessions.length === 0 ? (
            <p className="text-gray-400">{t("No active sessions", "无活跃会话")}</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-3">
                    <Monitor className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium">
                        {s.client_ip || t("Unknown IP", "未知 IP")}
                        {s.current && (
                          <span className="ml-2 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                            {t("Current", "当前")}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {s.user_agent ? s.user_agent.substring(0, 60) + (s.user_agent.length > 60 ? "..." : "") : ""}
                      </div>
                      <div className="text-xs text-gray-400">
                        {t("Expires:", "过期：")} {new Date(s.expires_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  {!s.current && (
                    <button
                      onClick={() => revokeSession(s.id)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      {t("Revoke", "撤销")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Login History Tab */}
      {activeTab === "history" && (
        <div className={cardClass}>
          <h2 className="text-lg font-semibold mb-4">{t("Login History", "登录历史")}</h2>
          {loginHistory.length === 0 ? (
            <p className="text-gray-400">{t("No login history", "无登录记录")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                    <th className="py-2 pr-4 font-medium text-gray-500">{t("Time", "时间")}</th>
                    <th className="py-2 pr-4 font-medium text-gray-500">{t("Username", "用户名")}</th>
                    <th className="py-2 pr-4 font-medium text-gray-500">{t("Status", "状态")}</th>
                    <th className="py-2 font-medium text-gray-500">{t("Reason", "原因")}</th>
                  </tr>
                </thead>
                <tbody>
                  {loginHistory.map((h) => (
                    <tr key={h.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 pr-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {new Date(h.created_at).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4">{h.username_attempt}</td>
                      <td className="py-2 pr-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          h.success
                            ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                            : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                        }`}>
                          {h.success ? t("Success", "成功") : t("Failed", "失败")}
                        </span>
                      </td>
                      <td className="py-2 text-gray-500 text-xs">{h.failure_reason || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TOTP Tab */}
      {activeTab === "totp" && (
        <div className={cardClass}>
          <h2 className="text-lg font-semibold mb-4">{t("Two-Factor Authentication", "两步验证")}</h2>
          {totpEnabled ? (
            <div>
              <div className="flex items-center space-x-2 mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <Shield className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-green-700 dark:text-green-300">
                  {t("2FA is enabled", "两步验证已启用")}
                </span>
              </div>
              <button onClick={disableTotp} disabled={totpBusy} className="text-red-500 hover:text-red-700 font-medium text-sm">
                {t("Disable 2FA", "禁用两步验证")}
              </button>
            </div>
          ) : totpSecret ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {t("Scan this QR code with your authenticator app:", "使用认证器 App 扫描此二维码：")}
                </p>
                {totpQrUrl && (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(totpQrUrl)}`}
                    alt="TOTP QR Code"
                    className="w-45 h-45 border rounded-lg"
                  />
                )}
                <p className="text-xs text-gray-400 mt-2 break-all font-mono">
                  {t("Or enter manually:", "或手动输入密钥：")} {totpSecret}
                </p>
              </div>
              <div className="flex items-center space-x-2 max-w-xs">
                <input
                  className={inputClass}
                  placeholder="000000"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                />
                <button onClick={() => verifyTotp(totpCode)} disabled={totpBusy || totpCode.length !== 6} className={btnPrimary}>
                  {t("Verify", "验证")}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-500 mb-4">
                {t("Add an extra layer of security to your account by enabling two-factor authentication.", "通过启用两步验证为您的账户添加额外安全保护层。")}
              </p>
              <button onClick={setupTotp} disabled={totpBusy} className={btnPrimary}>
                <Shield className="w-4 h-4 mr-2" />
                {t("Set Up 2FA", "设置两步验证")}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Preferences Tab */}
      {activeTab === "preferences" && (
        <div className="space-y-6">
          {/* Theme & Language */}
          <div className={cardClass}>
            <h2 className="text-lg font-semibold mb-4">{t("Appearance", "外观设置")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{t("Theme", "主题")}</label>
                <select className={inputClass} value={prefTheme} onChange={(e) => {
                  setPrefTheme(e.target.value);
                  savePreferences({ theme: e.target.value });
                }}>
                  <option value="system">{t("System", "跟随系统")}</option>
                  <option value="light">{t("Light", "浅色")}</option>
                  <option value="dark">{t("Dark", "深色")}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t("Language", "语言")}</label>
                <select className={inputClass} value={prefLang} onChange={(e) => {
                  setPrefLang(e.target.value);
                  savePreferences({ lang: e.target.value });
                }}>
                  <option value="zh">中文</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className={cardClass}>
            <h2 className="text-lg font-semibold mb-4">{t("Notification Settings", "通知设置")}</h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">{t("Email Notifications", "邮件通知")}</h3>
                <label className="flex items-center space-x-3 py-2 cursor-pointer">
                  <input type="checkbox" className="rounded" checked={prefEmailRuleChanges} onChange={(e) => {
                    setPrefEmailRuleChanges(e.target.checked);
                    savePreferences({ notifications: { email: { rule_changes: e.target.checked, security_alerts: prefEmailSecurity }, in_app: { approvals: prefInAppApprovals, audit: prefInAppAudit } } });
                  }} />
                  <span className="text-sm">{t("Rule change alerts", "规则变更提醒")}</span>
                </label>
                <label className="flex items-center space-x-3 py-2 cursor-pointer">
                  <input type="checkbox" className="rounded" checked={prefEmailSecurity} onChange={(e) => {
                    setPrefEmailSecurity(e.target.checked);
                    savePreferences({ notifications: { email: { rule_changes: prefEmailRuleChanges, security_alerts: e.target.checked }, in_app: { approvals: prefInAppApprovals, audit: prefInAppAudit } } });
                  }} />
                  <span className="text-sm">{t("Security alerts", "安全告警")}</span>
                </label>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">{t("In-App Notifications", "站内通知")}</h3>
                <label className="flex items-center space-x-3 py-2 cursor-pointer">
                  <input type="checkbox" className="rounded" checked={prefInAppApprovals} onChange={(e) => {
                    setPrefInAppApprovals(e.target.checked);
                    savePreferences({ notifications: { email: { rule_changes: prefEmailRuleChanges, security_alerts: prefEmailSecurity }, in_app: { approvals: e.target.checked, audit: prefInAppAudit } } });
                  }} />
                  <span className="text-sm">{t("Approval requests", "审批请求")}</span>
                </label>
                <label className="flex items-center space-x-3 py-2 cursor-pointer">
                  <input type="checkbox" className="rounded" checked={prefInAppAudit} onChange={(e) => {
                    setPrefInAppAudit(e.target.checked);
                    savePreferences({ notifications: { email: { rule_changes: prefEmailRuleChanges, security_alerts: prefEmailSecurity }, in_app: { approvals: prefInAppApprovals, audit: e.target.checked } } });
                  }} />
                  <span className="text-sm">{t("Audit log activity", "审计日志动态")}</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
