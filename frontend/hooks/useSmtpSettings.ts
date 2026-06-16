import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";

export interface SmtpSettings {
  host: string;
  port: string;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  encryption: string;
  timeout: string;
}

const KEYS: Record<string, string> = {
  host: "smtp_host", port: "smtp_port", username: "smtp_username",
  password: "smtp_password", from_email: "smtp_from_email",
  from_name: "smtp_from_name", encryption: "smtp_encryption",
  timeout: "smtp_timeout",
};

export function useSmtpSettings(
  accessToken?: string,
  notifySucc?: (msg: string) => void,
  notifyError?: (msg: string) => void,
) {
  const [smtp, setSmtp] = useState<SmtpSettings>({
    host: "", port: "587", username: "", password: "",
    from_email: "", from_name: "", encryption: "starttls", timeout: "30",
  });
  const [smtpBusy, setSmtpBusy] = useState(false);
  const [smtpLoading, setSmtpLoading] = useState(true);

  const loadSmtp = useCallback(async () => {
    setSmtpLoading(true);
    try {
      const r = await apiFetch("/admin/v1/system/settings");
      if (r.ok) {
        const d = await r.json();
        const map: Record<string, string> = {};
        for (const item of (d.items || [])) {
          map[item.key] = item.value || "";
        }
        setSmtp({
          host: map["smtp_host"] || "",
          port: map["smtp_port"] || "587",
          username: map["smtp_username"] || "",
          password: map["smtp_password"] || "",
          from_email: map["smtp_from_email"] || "",
          from_name: map["smtp_from_name"] || "",
          encryption: map["smtp_encryption"] || "starttls",
          timeout: map["smtp_timeout"] || "30",
        });
      }
    } catch (e) {
      console.error("loadSmtp failed:", e);
    } finally {
      setSmtpLoading(false);
    }
  }, [accessToken]);

  /// Batch save — sends all changed settings in one API call instead of N.
  const saveSmtp = useCallback(async (updates: Partial<SmtpSettings>) => {
    setSmtpBusy(true);
    try {
      const settings = Object.entries(updates)
        .filter(([, val]) => val !== undefined)
        .map(([field, val]) => ({
          key: KEYS[field],
          value: String(val),
        }))
        .filter(s => s.key);
      if (settings.length === 0) return;
      const r = await apiFetch("/admin/v1/system/settings/batch", {
        method: "PUT",
        body: JSON.stringify({ settings }),
      }, accessToken);
      if (r.ok) {
        setSmtp(prev => ({ ...prev, ...updates }));
        notifySucc?.("SMTP settings saved");
      } else {
        const d = await r.json().catch(() => ({}));
        notifyError?.(d.message || "Failed to save SMTP settings");
      }
    } catch (e) {
      notifyError?.((e as Error).message);
    } finally {
      setSmtpBusy(false);
    }
  }, [accessToken, notifySucc, notifyError]);

  const testSmtp = useCallback(async () => {
    setSmtpBusy(true);
    try {
      const r = await apiFetch("/admin/v1/system/smtp/test", {
        method: "POST",
        body: JSON.stringify({ to_email: smtp.from_email || undefined }),
      }, accessToken);
      const d = await r.json();
      if (r.ok) {
        notifySucc?.(d.message || "Test email sent");
      } else {
        notifyError?.(d.message || "SMTP test failed");
      }
    } catch (e) {
      notifyError?.((e as Error).message);
    } finally {
      setSmtpBusy(false);
    }
  }, [accessToken, smtp.from_email, notifySucc, notifyError]);

  /// Verify SMTP connectivity without sending an email.
  const verifySmtp = useCallback(async () => {
    setSmtpBusy(true);
    try {
      const r = await apiFetch("/admin/v1/system/smtp/verify", {
        method: "POST",
        body: JSON.stringify({}),
      }, accessToken);
      const d = await r.json();
      if (r.ok) {
        notifySucc?.(d.message || "SMTP connection verified");
      } else {
        notifyError?.(d.message || "SMTP verification failed");
      }
    } catch (e) {
      notifyError?.((e as Error).message);
    } finally {
      setSmtpBusy(false);
    }
  }, [accessToken, notifySucc, notifyError]);

  return { smtp, setSmtp, smtpBusy, smtpLoading, loadSmtp, saveSmtp, testSmtp, verifySmtp };
}
