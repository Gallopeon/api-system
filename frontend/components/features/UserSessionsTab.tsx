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
            <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <Monitor className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="text-sm font-medium">
                    {s.client_ip || t("Unknown IP", "未知 IP")}
                    {s.current && (
                      <span className="ml-2 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                        {t("Current", "当前")}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {s.user_agent ? s.user_agent.substring(0, 60) + (s.user_agent.length > 60 ? "..." : "") : ""}
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
