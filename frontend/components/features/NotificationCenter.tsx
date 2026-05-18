"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Check, Loader2, FileText, Shield, Key, Users, ClipboardCheck, Package, Activity, ScrollText, Trash2, X } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";

interface Props {
  accessToken?: string;
  t: <T>(en: T, zh: T) => T;
}

const typeIcon: Record<string, React.ReactNode> = {
  rule_change: <FileText className="w-4 h-4" />,
  security_alert: <Shield className="w-4 h-4" />,
  approval: <ClipboardCheck className="w-4 h-4" />,
  product_change: <Package className="w-4 h-4" />,
  infrastructure_change: <Activity className="w-4 h-4" />,
  audit_event: <ScrollText className="w-4 h-4" />,
  api_key: <Key className="w-4 h-4" />,
  user_event: <Users className="w-4 h-4" />,
};

const typeColor = (t: string) => {
  if (t === "rule_change") return "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400";
  if (t === "security_alert") return "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400";
  if (t === "approval") return "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400";
  if (t === "product_change") return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400";
  if (t === "infrastructure_change") return "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400";
  if (t === "audit_event") return "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400";
  return "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400";
};

function fmtTime(iso: string, t: Props["t"]) {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000) return t("Just now", "刚刚");
    if (diff < 3600_000) return t(Math.floor(diff / 60_000) + "m ago", Math.floor(diff / 60_000) + " 分钟前");
    if (diff < 86400_000) return t(Math.floor(diff / 3600_000) + "h ago", Math.floor(diff / 3600_000) + " 小时前");
    return new Date(iso).toLocaleDateString();
  } catch {
    return "";
  }
}

export default function NotificationCenter({ accessToken, t }: Props) {
  const { notifications, unreadCount, loading, loadNotifications, markAllRead, clearAll, deleteNotification } = useNotifications(accessToken);
  const [open, setOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleToggle = () => {
    if (!open) {
      loadNotifications();
    }
    setOpen(!open);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleToggle}
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full min-w-[18px] h-[18px] px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 max-h-[70vh] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-sm">{t("Notifications", "通知中心")}</h3>
            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 active:scale-95 transition-all"
                >
                  <Check className="w-3 h-3" />
                  {t("Mark all read", "全部已读")}
                </button>
              )}
              {notifications.length > 0 && (
                confirmClear ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">{t("Sure?", "确定？")}</span>
                    <button
                      onClick={async () => { setClearing(true); await clearAll(); setClearing(false); setConfirmClear(false); }}
                      disabled={clearing}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-full bg-red-600 text-white hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {clearing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      {t("Delete", "删除")}
                    </button>
                    <button
                      onClick={() => setConfirmClear(false)}
                      className="inline-flex items-center px-2 py-1 text-[11px] font-medium rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all"
                    >
                      {t("Cancel", "取消")}
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmClear(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-full bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/20 active:scale-95 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                    {t("Clear all", "清空")}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">{t("No notifications", "暂无通知")}</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={"px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group" + (!n.read ? " bg-blue-50/30 dark:bg-blue-950/10" : "")}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={"mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 " + typeColor(n.type)}>
                      {typeIcon[n.type] || <Bell className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                        <p className="text-sm font-medium truncate">{n.title}</p>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{fmtTime(n.created_at, t)}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                      className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition shrink-0"
                      title={t("Delete", "删除")}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
