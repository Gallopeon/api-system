import { useState, useCallback, useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api";
import type { NotificationItem } from "@/lib/types";

export function useNotifications(accessToken?: string) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const loadUnreadCount = useCallback(async () => {
    try {
      const r = await apiFetch("/admin/v1/users/me/notifications/unread-count");
      if (r.ok) {
        const d = await r.json();
        setUnreadCount(d.unread_count || 0);
      }
    } catch {
      // silent
    }
  }, [accessToken]);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch("/admin/v1/users/me/notifications?limit=30");
      if (r.ok) {
        const d = await r.json();
        setNotifications(d.items || []);
        setUnreadCount(d.unread_count || 0);
      }
    } catch (e) {
      console.error("loadNotifications failed:", e);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const markAllRead = useCallback(async () => {
    try {
      await apiFetch("/admin/v1/users/me/notifications/read", {
        method: "POST",
        body: JSON.stringify({}),
      }, accessToken);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error("markAllRead failed:", e);
    }
  }, [accessToken]);

  // Poll unread count every 60s
  useEffect(() => {
    loadUnreadCount();
    pollRef.current = setInterval(loadUnreadCount, 60_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadUnreadCount]);

  return { notifications, unreadCount, loading, loadNotifications, markAllRead, loadUnreadCount };
}
