"use client";

import { Loader2, Mail, Send } from "lucide-react";
import { cardClass, inputClass, labelClass, btnPrimary } from "@/lib/constants";
import type { SmtpSettings } from "@/hooks/useSmtpSettings";

interface Props {
  smtp: SmtpSettings;
  smtpBusy: boolean;
  smtpLoading: boolean;
  saveSmtp: (updates: Partial<SmtpSettings>) => void;
  testSmtp: () => void;
  t: <T>(en: T, zh: T) => T;
}

export default function SmtpSettingsTab({ smtp, smtpBusy, smtpLoading, saveSmtp, testSmtp, t }: Props) {
  if (smtpLoading) {
    return (
      <div className={cardClass}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className={cardClass}>
      <h2 className="text-lg font-semibold mb-1">{t("SMTP Configuration", "SMTP 邮件服务配置")}</h2>
      <p className="text-sm text-gray-500 mb-5">{t("Configure the outgoing mail server for email notifications.", "配置外发邮件服务器以启用邮件通知。")}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>{t("SMTP Host", "SMTP 服务器")}</label>
          <input className={inputClass} placeholder="smtp.example.com" value={smtp.host}
            onChange={(e) => saveSmtp({ host: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>{t("Port", "端口")}</label>
          <input className={inputClass} placeholder="587" value={smtp.port}
            onChange={(e) => saveSmtp({ port: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>{t("Encryption", "加密方式")}</label>
          <select className={inputClass} value={smtp.encryption}
            onChange={(e) => saveSmtp({ encryption: e.target.value })}>
            <option value="tls">TLS</option>
            <option value="starttls">STARTTLS</option>
            <option value="none">{t("None", "无")}</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("Username", "用户名")}</label>
          <input className={inputClass} placeholder={t("SMTP username", "SMTP 用户名")} value={smtp.username}
            onChange={(e) => saveSmtp({ username: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>{t("Password", "密码")}</label>
          <input className={inputClass} type="password" placeholder="••••••••" value={smtp.password}
            onChange={(e) => saveSmtp({ password: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>{t("From Email", "发件人邮箱")}</label>
          <input className={inputClass} placeholder="noreply@example.com" value={smtp.from_email}
            onChange={(e) => saveSmtp({ from_email: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>{t("From Name", "发件人名称")}</label>
          <input className={inputClass} placeholder="API Control Plane" value={smtp.from_name}
            onChange={(e) => saveSmtp({ from_name: e.target.value })} />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button onClick={testSmtp} disabled={smtpBusy || !smtp.host || !smtp.from_email}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-black/30 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
          {smtpBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {t("Send Test Email", "发送测试邮件")}
        </button>
      </div>
    </div>
  );
}
