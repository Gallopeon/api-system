import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type { UserResponse, SessionResponse, LoginHistoryItem } from "@/lib/types";

export function useUserProfile(
  accessToken?: string,
  notifyError?: (msg: string) => void,
  notifySucc?: (msg: string) => void,
) {
  const [profile, setProfile] = useState<UserResponse | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const r = await apiFetch("/admin/v1/users/me", undefined, accessToken);
      if (r.ok) {
        setProfile(await r.json());
      }
    } catch (e) {
      notifyError?.("Failed to load profile");
      console.error("loadProfile failed:", e);
    }
  }, [accessToken, notifyError]);

  const updateProfile = useCallback(
    async (data: { email?: string; display_name?: string; avatar_url?: string }) => {
      setProfileBusy(true);
      try {
        const r = await apiFetch("/admin/v1/users/me", {
          method: "PUT",
          body: JSON.stringify(data),
        }, accessToken);
        if (!r.ok) throw new Error((await r.json())?.message || "Update failed");
        const updated = await r.json();
        setProfile(updated);
        notifySucc?.("Profile updated");
      } catch (e) {
        notifyError?.((e as Error).message);
      } finally {
        setProfileBusy(false);
      }
    },
    [accessToken, notifyError, notifySucc],
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      setProfileBusy(true);
      try {
        const r = await apiFetch("/admin/v1/users/me/password", {
          method: "PUT",
          body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
        }, accessToken);
        if (!r.ok) throw new Error((await r.json())?.message || "Password change failed");
        notifySucc?.("Password changed successfully");
        return true;
      } catch (e) {
        notifyError?.((e as Error).message);
        return false;
      } finally {
        setProfileBusy(false);
      }
    },
    [accessToken, notifyError, notifySucc],
  );

  return { profile, profileBusy, loadProfile, updateProfile, changePassword };
}

export function useSessions(
  accessToken?: string,
  notifyError?: (msg: string) => void,
  notifySucc?: (msg: string) => void,
) {
  const [sessions, setSessions] = useState<SessionResponse[]>([]);

  const loadSessions = useCallback(async () => {
    try {
      const r = await apiFetch("/admin/v1/users/me/sessions", undefined, accessToken);
      if (r.ok) {
        const d = await r.json();
        setSessions(d.items || []);
      }
    } catch (e) {
      notifyError?.("Failed to load sessions");
      console.error("loadSessions failed:", e);
    }
  }, [accessToken, notifyError]);

  const revokeSession = useCallback(
    async (sessionId: string) => {
      try {
        const r = await apiFetch(`/admin/v1/users/me/sessions/${sessionId}`, {
          method: "DELETE",
        }, accessToken);
        if (!r.ok) throw new Error("Revoke failed");
        notifySucc?.("Session revoked");
        await loadSessions();
      } catch (e) {
        notifyError?.((e as Error).message);
      }
    },
    [accessToken, loadSessions, notifyError, notifySucc],
  );

  return { sessions, loadSessions, revokeSession };
}

export function useLoginHistory(accessToken?: string) {
  const [loginHistory, setLoginHistory] = useState<LoginHistoryItem[]>([]);

  const loadLoginHistory = useCallback(async () => {
    try {
      const r = await apiFetch("/admin/v1/users/me/login-history", undefined, accessToken);
      if (r.ok) {
        const d = await r.json();
        setLoginHistory(d.items || []);
      }
    } catch (e) {
      console.error("loadLoginHistory failed:", e);
    }
  }, [accessToken]);

  return { loginHistory, loadLoginHistory };
}

export function useTotp(
  accessToken?: string,
  notifyError?: (msg: string) => void,
  notifySucc?: (msg: string) => void,
) {
  const [totpBusy, setTotpBusy] = useState(false);
  const [totpSecret, setTotpSecret] = useState("");
  const [totpQrUrl, setTotpQrUrl] = useState("");
  const [totpEnabled, setTotpEnabled] = useState(false);

  const checkTotpStatus = useCallback(async () => {
    try {
      const r = await apiFetch("/admin/v1/users/me/totp");
      if (r.ok) {
        const d = await r.json();
        setTotpEnabled(d.enabled === true);
      }
    } catch (e) {
      notifyError?.("Failed to check TOTP status");
      console.error("checkTotpStatus failed:", e);
    }
  }, [notifyError]);

  const setupTotp = useCallback(async () => {
    setTotpBusy(true);
    try {
      const r = await apiFetch("/admin/v1/users/me/totp/setup", {
        method: "POST",
      }, accessToken);
      if (!r.ok) throw new Error((await r.json())?.message || "Setup failed");
      const d = await r.json();
      setTotpSecret(d.secret);
      setTotpQrUrl(d.qr_code_url);
    } catch (e) {
      notifyError?.((e as Error).message);
    } finally {
      setTotpBusy(false);
    }
  }, [accessToken, notifyError]);

  const verifyTotp = useCallback(
    async (code: string) => {
      setTotpBusy(true);
      try {
        const r = await apiFetch("/admin/v1/users/me/totp/verify", {
          method: "POST",
          body: JSON.stringify({ code }),
        }, accessToken);
        if (!r.ok) throw new Error((await r.json())?.message || "Verification failed");
        setTotpEnabled(true);
        setTotpSecret("");
        setTotpQrUrl("");
        notifySucc?.("Two-factor authentication enabled");
      } catch (e) {
        notifyError?.((e as Error).message);
      } finally {
        setTotpBusy(false);
      }
    },
    [accessToken, notifyError, notifySucc],
  );

  const disableTotp = useCallback(async () => {
    if (!confirm("Disable two-factor authentication?")) return;
    setTotpBusy(true);
    try {
      const r = await apiFetch("/admin/v1/users/me/totp", {
        method: "DELETE",
      }, accessToken);
      if (!r.ok) throw new Error((await r.json())?.message || "Disable failed");
      setTotpEnabled(false);
      setTotpSecret("");
      setTotpQrUrl("");
      notifySucc?.("Two-factor authentication disabled");
    } catch (e) {
      notifyError?.((e as Error).message);
    } finally {
      setTotpBusy(false);
    }
  }, [accessToken, notifyError, notifySucc]);

  return { totpBusy, totpSecret, totpQrUrl, totpEnabled, setupTotp, verifyTotp, disableTotp, checkTotpStatus };
}

export function usePreferences(
  accessToken?: string,
  notifySucc?: (msg: string) => void,
) {
  const [prefs, setPrefs] = useState<Record<string, any>>({});

  const loadPreferences = useCallback(async () => {
    try {
      const r = await apiFetch("/admin/v1/users/me/preferences", undefined, accessToken);
      if (r.ok) {
        const d = await r.json();
        setPrefs(d);
      }
    } catch (e) {
      console.error("loadPreferences failed:", e);
    }
  }, [accessToken]);

  const savePreferences = useCallback(
    async (updates: Record<string, any>) => {
      try {
        const r = await apiFetch("/admin/v1/users/me/preferences", {
          method: "PUT",
          body: JSON.stringify(updates),
        }, accessToken);
        if (r.ok) {
          const d = await r.json();
          setPrefs(d);
          notifySucc?.("Preferences saved");
        }
      } catch (e) {
        console.error("savePreferences failed:", e);
      }
    },
    [accessToken, notifySucc],
  );

  return { prefs, loadPreferences, savePreferences };
}
