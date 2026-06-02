"use client";

import { useEffect, useState, useCallback } from "react";
import { UserCircle, Shield, Monitor, History, QrCode, Settings } from "lucide-react";
import { useUserProfile, useSessions, useLoginHistory, useTotp, usePreferences } from "@/hooks/useUserProfile";
import { useTheme } from "@/app/theme";
import { useI18n } from "@/app/i18n";
import UserProfileTab from "./UserProfileTab";
import UserSecurityTab from "./UserSecurityTab";
import UserTotpTab from "./UserTotpTab";
import UserSessionsTab from "./UserSessionsTab";
import UserLoginHistoryTab from "./UserLoginHistoryTab";
import UserPreferencesTab from "./UserPreferencesTab";

interface UserCenterPanelProps {
  accessToken?: string;
  notifyError: (msg: string) => void;
  notifySucc: (msg: string) => void;
  t: <T>(en: T, zh: T) => T;
}

export default function UserCenterPanel({
  accessToken, notifyError, notifySucc, t,
}: UserCenterPanelProps) {
  const [activeTab, setActiveTabRaw] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("user_center_tab") || "profile";
    }
    return "profile";
  });
  const setActiveTab = useCallback((tab: string) => {
    setActiveTabRaw(tab);
    localStorage.setItem("user_center_tab", tab);
  }, []);
  const { profile, profileBusy, loadProfile, updateProfile, changePassword } =
    useUserProfile(accessToken, notifyError, notifySucc);
  const { sessions, loadSessions, revokeSession } = useSessions(accessToken, notifyError, notifySucc);
  const { loginHistory, loadLoginHistory } = useLoginHistory(accessToken);
  const { totpBusy, totpSecret, totpQrUrl, totpEnabled, setupTotp, verifyTotp, disableTotp, checkTotpStatus } =
    useTotp(accessToken, notifyError, notifySucc);
  const { prefs, loadPreferences, savePreferences } = usePreferences(accessToken, notifySucc);
  const { setTheme } = useTheme();
  const { setLang } = useI18n();

  const applyThemeLang = useCallback((theme: string, lang: string) => {
    setTheme((theme === "auto" ? "system" : theme) as "system" | "light" | "dark");
    if (lang) setLang(lang as "en" | "zh");
  }, [setTheme, setLang]);

  const [editEmail, setEditEmail] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [prefTheme, setPrefTheme] = useState("system");
  const [prefLang, setPrefLang] = useState("zh");
  const [prefEmailRuleChanges, setPrefEmailRuleChanges] = useState(true);
  const [prefEmailSecurity, setPrefEmailSecurity] = useState(true);
  const [prefEmailProductUpdates, setPrefEmailProductUpdates] = useState(true);
  const [prefInAppApprovals, setPrefInAppApprovals] = useState(true);
  const [prefInAppAudit, setPrefInAppAudit] = useState(false);
  const [prefInAppProductUpdates, setPrefInAppProductUpdates] = useState(true);
  const [prefInAppInfrastructure, setPrefInAppInfrastructure] = useState(false);
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
    const theme = prefs.theme === "auto" ? "system" : prefs.theme;
    if (theme) {
      setPrefTheme(theme);
      applyThemeLang(theme, prefs.lang || "zh");
    }
    if (prefs.lang) setPrefLang(prefs.lang);
    if (prefs.notifications?.email) {
      setPrefEmailRuleChanges(prefs.notifications.email.rule_changes ?? true);
      setPrefEmailSecurity(prefs.notifications.email.security_alerts ?? true);
      setPrefEmailProductUpdates(prefs.notifications.email.product_updates ?? true);
    }
    if (prefs.notifications?.in_app) {
      setPrefInAppApprovals(prefs.notifications.in_app.approvals ?? true);
      setPrefInAppAudit(prefs.notifications.in_app.audit ?? false);
      setPrefInAppProductUpdates(prefs.notifications.in_app.product_updates ?? true);
      setPrefInAppInfrastructure(prefs.notifications.in_app.infrastructure ?? false);
    }
  }, [prefs, setTheme, setLang, applyThemeLang]);

  const handleUpdateProfile = async () => {
    await updateProfile({
      email: editEmail || undefined,
      display_name: editDisplayName || undefined,
      avatar_url: editAvatarUrl || undefined,
    });
  };

  const handlePreferenceChange = (key: string, value: boolean) => {
    let emailRule = prefEmailRuleChanges;
    let emailSecurity = prefEmailSecurity;
    let emailProduct = prefEmailProductUpdates;
    let inAppApprovals = prefInAppApprovals;
    let inAppAudit = prefInAppAudit;
    let inAppProduct = prefInAppProductUpdates;
    let inAppInfra = prefInAppInfrastructure;
    switch (key) {
      case "email.rule_changes": emailRule = value; setPrefEmailRuleChanges(value); break;
      case "email.security_alerts": emailSecurity = value; setPrefEmailSecurity(value); break;
      case "email.product_updates": emailProduct = value; setPrefEmailProductUpdates(value); break;
      case "in_app.approvals": inAppApprovals = value; setPrefInAppApprovals(value); break;
      case "in_app.audit": inAppAudit = value; setPrefInAppAudit(value); break;
      case "in_app.product_updates": inAppProduct = value; setPrefInAppProductUpdates(value); break;
      case "in_app.infrastructure": inAppInfra = value; setPrefInAppInfrastructure(value); break;
    }
    savePreferences({
      notifications: {
        email: { rule_changes: emailRule, security_alerts: emailSecurity, product_updates: emailProduct },
        in_app: { approvals: inAppApprovals, audit: inAppAudit, product_updates: inAppProduct, infrastructure: inAppInfra },
      },
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
    { id: "totp", icon: QrCode, en: "2FA", zh: "两步验证" },
    { id: "sessions", icon: Monitor, en: "Sessions", zh: "会话管理" },
    { id: "history", icon: History, en: "History", zh: "登录历史" },
    { id: "preferences", icon: Settings, en: "Preferences", zh: "偏好设置" },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">{t("User Center", "用户中心")}</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">{t("Manage your profile, security, and sessions.", "管理您的个人资料、安全和会话。")}</p>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-gray-200 dark:border-gray-800 pb-px">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap border-b-2 -mb-px ${
                active
                  ? "border-blue-600 text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/30"
              }`}
            >
              <tab.icon className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{t(tab.en, tab.zh)}</span>
            </button>
          );
        })}
      </div>

      {activeTab === "profile" && (
        <UserProfileTab
          profile={profile}
          profileBusy={profileBusy}
          editDisplayName={editDisplayName}
          setEditDisplayName={setEditDisplayName}
          editEmail={editEmail}
          setEditEmail={setEditEmail}
          editAvatarUrl={editAvatarUrl}
          setEditAvatarUrl={setEditAvatarUrl}
          onSave={handleUpdateProfile}
          t={t}
        />
      )}

      {activeTab === "security" && (
        <UserSecurityTab
          currentPassword={currentPassword}
          setCurrentPassword={setCurrentPassword}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          confirmPassword={confirmPassword}
          setConfirmPassword={setConfirmPassword}
          profileBusy={profileBusy}
          onChangePassword={handleChangePassword}
          t={t}
        />
      )}

      {activeTab === "totp" && (
        <UserTotpTab
          totpEnabled={totpEnabled}
          totpSecret={totpSecret}
          totpQrUrl={totpQrUrl}
          totpBusy={totpBusy}
          totpCode={totpCode}
          setTotpCode={setTotpCode}
          setupTotp={setupTotp}
          verifyTotp={verifyTotp}
          disableTotp={disableTotp}
          t={t}
        />
      )}

      {activeTab === "sessions" && (
        <UserSessionsTab sessions={sessions} revokeSession={revokeSession} t={t} />
      )}

      {activeTab === "history" && (
        <UserLoginHistoryTab loginHistory={loginHistory} t={t} />
      )}

      {activeTab === "preferences" && (
        <UserPreferencesTab
          prefTheme={prefTheme}
          setPrefTheme={setPrefTheme}
          prefLang={prefLang}
          setPrefLang={setPrefLang}
          prefEmailRuleChanges={prefEmailRuleChanges}
          prefEmailSecurity={prefEmailSecurity}
          prefEmailProductUpdates={prefEmailProductUpdates}
          prefInAppApprovals={prefInAppApprovals}
          prefInAppAudit={prefInAppAudit}
          prefInAppProductUpdates={prefInAppProductUpdates}
          prefInAppInfrastructure={prefInAppInfrastructure}
          onPreferenceChange={handlePreferenceChange}
          onSaveThemeLang={(theme, lang) => { savePreferences({ theme, lang }); applyThemeLang(theme, lang); }}
          t={t}
        />
      )}

    </div>
  );
}
