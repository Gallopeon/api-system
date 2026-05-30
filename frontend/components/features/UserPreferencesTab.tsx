"use client";

import { cardClass, inputClass, labelClass } from "@/lib/constants";

interface Props {
  prefTheme: string;
  setPrefTheme: (v: string) => void;
  prefLang: string;
  setPrefLang: (v: string) => void;
  prefEmailRuleChanges: boolean;
  prefEmailSecurity: boolean;
  prefEmailProductUpdates: boolean;
  prefInAppApprovals: boolean;
  prefInAppAudit: boolean;
  prefInAppProductUpdates: boolean;
  prefInAppInfrastructure: boolean;
  onPreferenceChange: (key: string, value: boolean) => void;
  onSaveThemeLang: (theme: string, lang: string) => void;
  t: <T>(en: T, zh: T) => T;
}

export default function UserPreferencesTab({
  prefTheme, setPrefTheme, prefLang, setPrefLang,
  prefEmailRuleChanges, prefEmailSecurity, prefEmailProductUpdates,
  prefInAppApprovals, prefInAppAudit, prefInAppProductUpdates, prefInAppInfrastructure,
  onPreferenceChange, onSaveThemeLang, t,
}: Props) {
  const cb = (key: string, checked: boolean) => onPreferenceChange(key, checked);
  return (
    <div className="space-y-6">
      <div className={cardClass}>
        <h2 className="text-lg font-semibold mb-4">{t("Appearance", "外观设置")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>{t("Theme", "主题")}</label>
            <label className={labelClass} htmlFor="pref-theme">{t("Theme", "主题")}</label>
            <select id="pref-theme" name="pref-theme" className={inputClass} value={prefTheme} onChange={(e) => {
              setPrefTheme(e.target.value);
              onSaveThemeLang(e.target.value, prefLang);
            }}>
              <option value="system">{t("System", "跟随系统")}</option>
              <option value="light">{t("Light", "浅色")}</option>
              <option value="dark">{t("Dark", "深色")}</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="pref-lang">{t("Language", "语言")}</label>
            <select id="pref-lang" name="pref-lang" className={inputClass} value={prefLang} onChange={(e) => {
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
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{t("Email Notifications", "邮件通知")}</h3>
            <label className="flex items-center gap-3 py-2 cursor-pointer">
              <input id="pref-email-rule-changes" name="pref-email-rule-changes" type="checkbox" className="w-4 h-4 rounded accent-blue-600 cursor-pointer" checked={prefEmailRuleChanges} onChange={(e) => cb("email.rule_changes", e.target.checked)} />
              <span className="text-sm text-gray-700 dark:text-gray-300">{t("Rule change alerts", "规则变更提醒")}</span>
            </label>
            <label className="flex items-center gap-3 py-2 cursor-pointer">
              <input id="pref-email-security" name="pref-email-security" type="checkbox" className="w-4 h-4 rounded accent-blue-600 cursor-pointer" checked={prefEmailSecurity} onChange={(e) => cb("email.security_alerts", e.target.checked)} />
              <span className="text-sm text-gray-700 dark:text-gray-300">{t("Security alerts (API keys, users, passwords)", "安全告警（API密钥、用户、密码）")}</span>
            </label>
            <label className="flex items-center gap-3 py-2 cursor-pointer">
              <input id="pref-email-product-updates" name="pref-email-product-updates" type="checkbox" className="w-4 h-4 rounded accent-blue-600 cursor-pointer" checked={prefEmailProductUpdates} onChange={(e) => cb("email.product_updates", e.target.checked)} />
              <span className="text-sm text-gray-700 dark:text-gray-300">{t("Product & subscription updates", "产品与订阅更新")}</span>
            </label>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{t("In-App Notifications", "站内通知")}</h3>
            <label className="flex items-center gap-3 py-2 cursor-pointer">
              <input id="pref-inapp-approvals" name="pref-inapp-approvals" type="checkbox" className="w-4 h-4 rounded accent-blue-600 cursor-pointer" checked={prefInAppApprovals} onChange={(e) => cb("in_app.approvals", e.target.checked)} />
              <span className="text-sm text-gray-700 dark:text-gray-300">{t("Approval requests", "审批请求")}</span>
            </label>
            <label className="flex items-center gap-3 py-2 cursor-pointer">
              <input id="pref-inapp-product-updates" name="pref-inapp-product-updates" type="checkbox" className="w-4 h-4 rounded accent-blue-600 cursor-pointer" checked={prefInAppProductUpdates} onChange={(e) => cb("in_app.product_updates", e.target.checked)} />
              <span className="text-sm text-gray-700 dark:text-gray-300">{t("Product & subscription changes", "产品与订阅变更")}</span>
            </label>
            <label className="flex items-center gap-3 py-2 cursor-pointer">
              <input id="pref-inapp-infrastructure" name="pref-inapp-infrastructure" type="checkbox" className="w-4 h-4 rounded accent-blue-600 cursor-pointer" checked={prefInAppInfrastructure} onChange={(e) => cb("in_app.infrastructure", e.target.checked)} />
              <span className="text-sm text-gray-700 dark:text-gray-300">{t("Infrastructure changes (rate limits, circuit breakers, LLM)", "基础设施变更（限流、熔断、AI网关）")}</span>
            </label>
            <label className="flex items-center gap-3 py-2 cursor-pointer">
              <input id="pref-inapp-audit" name="pref-inapp-audit" type="checkbox" className="w-4 h-4 rounded accent-blue-600 cursor-pointer" checked={prefInAppAudit} onChange={(e) => cb("in_app.audit", e.target.checked)} />
              <span className="text-sm text-gray-700 dark:text-gray-300">{t("Audit log activity", "审计日志动态")}</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
