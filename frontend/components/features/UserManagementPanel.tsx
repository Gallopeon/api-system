"use client";

import { useState, useCallback } from "react";
import { Users, Shield } from "lucide-react";
import UserManagementUsersTab from "./UserManagementUsersTab";
import UserManagementPermissionsTab from "./UserManagementPermissionsTab";

interface Props {
  canManage: boolean;
  notifyError: (msg: string) => void;
  notifySucc: (msg: string) => void;
  t: <T>(en: T, zh: T) => T;
}

const tabs = [
  { id: "users", icon: Users, en: "Users", zh: "用户管理" },
  { id: "templates", icon: Shield, en: "Permission Templates", zh: "权限模板" },
];

export default function UserManagementPanel({ canManage, notifyError, notifySucc, t }: Props) {
  const [activeTab, setActiveTabRaw] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("usermgmt_tab") || "users";
    }
    return "users";
  });
  const setActiveTab = useCallback((tab: string) => {
    setActiveTabRaw(tab);
    localStorage.setItem("usermgmt_tab", tab);
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
          {t("User Management", "用户管理")}
        </h1>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-gray-200 dark:border-gray-800 pb-px">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap border-b-2 -mb-px ${
                active
                  ? "border-blue-600 text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/30"
              }`}
            >
              <tab.icon className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{t(tab.en, tab.zh)}</span>
            </button>
          );
        })}
      </div>

      {activeTab === "users" && (
        <UserManagementUsersTab
          canManage={canManage}
          notifyError={notifyError}
          notifySucc={notifySucc}
          t={t}
        />
      )}

      {activeTab === "templates" && <UserManagementPermissionsTab />}
    </div>
  );
}
