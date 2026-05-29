"use client";

import { Monitor } from "lucide-react";
import { cardClass } from "@/lib/constants";
import type { SessionResponse } from "@/lib/types";

interface Props {
  sessions: SessionResponse[];
  revokeSession: (id: string) => void;
  t: <T>(en: T, zh: T) => T;
}

export default function UserSessionsTab({ sessions, revokeSession, t }: Props) {
  return (
    <div className={cardClass}>
      <h2 className="text-lg font-semibold mb-4">{t("Active Sessions", "活跃会话")}</h2>
      {sessions.length === 0 ? (
        <p className="text-gray-400">{t("No active sessions", "无活跃会话")}</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-start justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 gap-3">
              <div className="flex items-start space-x-3 min-w-0 flex-1">
                <Monitor className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {s.client_ip || t("Unknown IP", "未知 IP")}
                    {s.current && (
                      <span className="ml-2 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                        {t("Current", "当前")}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 break-all">
                    {s.user_agent || ""}
                  </div>
                  <div className="text-xs text-gray-400">
                    {t("Expires:", "过期：")} {new Date(s.expires_at).toLocaleString()}
                  </div>
                </div>
              </div>
              {!s.current && (
                <button onClick={() => revokeSession(s.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">
                  {t("Revoke", "撤销")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
