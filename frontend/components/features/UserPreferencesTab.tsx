"use client";

import { cardClass, inputClass, labelClass } from "@/lib/constants";

interface Props {
  prefTheme: string;
  setPrefTheme: (v: string) => void;
  prefLang: string;
  setPrefLang: (v: string) => void;
  prefEmailRuleChanges: boolean;
  prefEmailSecurity: boolean;
  prefInAppApprovals: boolean;
  prefInAppAudit: boolean;
  onPreferenceChange: (key: string, value: boolean) => void;
  onSaveThemeLang: (theme: string, lang: string) => void;
  t: <T>(en: T, zh: T) => T;
}

export default function UserPreferencesTab({
  prefTheme, setPrefTheme, prefLang, setPrefLang,
  prefEmailRuleChanges, prefEmailSecurity, prefInAppApprovals, prefInAppAudit,
  onPreferenceChange, onSaveThemeLang, t,
}: Props) {
  return (
    <div className="space-y-6">
      <div className={cardClass}>
        <h2 className="text-lg font-semibold mb-4">{t("Appearance", "外观设置")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>{t("Theme", "主题")}</label>
            <select className={inputClass} value={prefTheme} onChange={(e) => {
              setPrefTheme(e.target.value);
              onSaveThemeLang(e.target.value, prefLang);
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
              onSaveThemeLang(prefTheme, e.target.value);
            }}>
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <h2 className="text-lg font-semibold mb-4">{t("Notification Settings", "通知设置")}</h2>
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">{t("Email Notifications", "邮件通知")}</h3>
            <label className="flex items-center space-x-3 py-2 cursor-pointer">
              <input type="checkbox" className="rounded" checked={prefEmailRuleChanges} onChange={(e) => onPreferenceChange("email.rule_changes", e.target.checked)} />
              <span className="text-sm">{t("Rule change alerts", "规则变更提醒")}</span>
            </label>
            <label className="flex items-center space-x-3 py-2 cursor-pointer">
              <input type="checkbox" className="rounded" checked={prefEmailSecurity} onChange={(e) => onPreferenceChange("email.security_alerts", e.target.checked)} />
              <span className="text-sm">{t("Security alerts", "安全告警")}</span>
            </label>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">{t("In-App Notifications", "站内通知")}</h3>
            <label className="flex items-center space-x-3 py-2 cursor-pointer">
              <input type="checkbox" className="rounded" checked={prefInAppApprovals} onChange={(e) => onPreferenceChange("in_app.approvals", e.target.checked)} />
              <span className="text-sm">{t("Approval requests", "审批请求")}</span>
            </label>
            <label className="flex items-center space-x-3 py-2 cursor-pointer">
              <input type="checkbox" className="rounded" checked={prefInAppAudit} onChange={(e) => onPreferenceChange("in_app.audit", e.target.checked)} />
              <span className="text-sm">{t("Audit log activity", "审计日志动态")}</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
