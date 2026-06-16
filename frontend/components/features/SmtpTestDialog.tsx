"use client";

import { useState } from "react";
import { X, Mail, Loader2, Send } from "lucide-react";
import { inputClass, btnPrimary, btnSecondary } from "@/lib/constants";
import { apiFetch } from "@/lib/api";

interface SmtpTestDialogProps {
  accessToken?: string;
  defaultToEmail: string;
  notifyError: (msg: string) => void;
  notifySucc: (msg: string) => void;
  t: <T>(en: T, zh: T) => T;
  onClose: () => void;
}

export default function SmtpTestDialog({
  accessToken,
  defaultToEmail,
  notifyError,
  notifySucc,
  t,
  onClose,
}: SmtpTestDialogProps) {
  const [toEmail, setToEmail] = useState(defaultToEmail);
  const [subject, setSubject] = useState(t("SMTP Test — API Control Plane", "SMTP 测试 — API Control Plane"));
  const [body, setBody] = useState(t(
    "This is a test email from your API Control Plane instance. SMTP is configured correctly.",
    "这是一封来自 API Control Plane 的测试邮件，SMTP 配置正确。"
  ));
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!toEmail.trim()) {
      notifyError(t("Recipient email is required", "请输入收件人邮箱"));
      return;
    }
    setSending(true);
    try {
      const r = await apiFetch("/admin/v1/system/smtp/test", {
        method: "POST",
        body: JSON.stringify({
          to_email: toEmail.trim(),
          subject: subject.trim() || undefined,
          body: body.trim() || undefined,
        }),
      }, accessToken);
      const d = await r.json();
      if (r.ok) {
        notifySucc(d.message || t("Test email sent", "测试邮件已发送"));
        onClose();
      } else {
        notifyError(d.message || t("SMTP test failed", "SMTP 测试失败"));
      }
    } catch (e) {
      notifyError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t("Send Test Email", "发送测试邮件")}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t("Recipient Email", "收件人邮箱")} <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              className={inputClass}
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="admin@example.com"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t("Subject", "邮件主题")}
            </label>
            <input
              className={inputClass}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="SMTP Test"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t("Body", "邮件正文")}
            </label>
            <textarea
              className={inputClass + " min-h-[120px] resize-y"}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Email body..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-950/30">
          <button onClick={onClose} className={btnSecondary} disabled={sending}>
            {t("Cancel", "取消")}
          </button>
          <button onClick={send} className={btnPrimary} disabled={sending}>
            {sending ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-1.5" />{t("Sending...", "发送中...")}</>
            ) : (
              <><Send className="w-4 h-4 mr-1.5" />{t("Send", "发送")}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
