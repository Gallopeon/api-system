import { useState, useCallback, useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api";
import type { NotificationItem } from "@/lib/types";

const POLL_INTERVAL_MS = 10_000; // poll every 10s for near-real-time updates

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
        const count = d.unread_count || 0;
        setUnreadCount((prev) => {
          // Auto-load notifications when new ones arrive
          if (count > prev) {
            loadNotifications();
          }
          return count;
        });
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
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error("markAllRead failed:", e);
    }
  }, [accessToken]);

  const clearAll = useCallback(async () => {
    try {
      await apiFetch("/admin/v1/users/me/notifications", {
        method: "DELETE",
      }, accessToken);
      setNotifications([]);
      setUnreadCount(0);
    } catch (e) {
      console.error("clearAll failed:", e);
    }
  }, [accessToken]);

  const deleteNotification = useCallback(async (id: string) => {
    try {
      await apiFetch(`/admin/v1/users/me/notifications/${id}`, {
        method: "DELETE",
      }, accessToken);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error("deleteNotification failed:", e);
    }
  }, [accessToken]);

  // Poll unread count on a short interval. When count increases, notifications
  // are automatically loaded so the bell badge and dropdown stay up-to-date
  // without requiring a page refresh.
  useEffect(() => {
    loadUnreadCount();
    pollRef.current = setInterval(loadUnreadCount, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadUnreadCount]);

  return { notifications, unreadCount, loading, loadNotifications, markAllRead, clearAll, deleteNotification, loadUnreadCount };
}
