"use client";

import {
  Activity,
  ArrowLeftRight,
  BookOpen,
  Check,
  Code2,
  FileText,
  Key,
  LayoutDashboard,
  Network,
  Settings,
  Share2,
  ShieldAlert,
  SlidersHorizontal,
  TerminalSquare,
  UserCircle,
  Users,
} from "lucide-react";

import { canAccessMenu, type Role } from "@/lib/permissions";

interface SidebarProps {
  activeMenu: string;
  onMenuSelect: (menu: string) => void;
  role: Role | null;
  metrics: {
    total_rules?: number;
    total_audit_events?: number;
    preview_success_24h?: number;
  } | null;
  t: <T>(en: T, zh: T) => T;
}

const menuItems = [
  { id: "dashboard", icon: LayoutDashboard, en: "Dashboard", zh: "概览面板" },
  { id: "rules", icon: SlidersHorizontal, en: "Rule Management", zh: "规则管理" },
  { id: "versions", icon: ArrowLeftRight, en: "Versions & Diff", zh: "版本与对比" },
  { id: "playground", icon: TerminalSquare, en: "Playground", zh: "模拟工作台" },
  { id: "api-builder", icon: Code2, en: "API Builder", zh: "API 构建器" },
  { id: "openapi", icon: FileText, en: "OpenAPI", zh: "OpenAPI" },
  { id: "apikeys", icon: Key, en: "API Keys", zh: "API 密钥" },
  { id: "approvals", icon: Check, en: "Approvals", zh: "审批管理" },
  { id: "analytics", icon: Share2, en: "Analytics", zh: "分析仪表板" },
  { id: "ratelimits", icon: Activity, en: "Rate Limits", zh: "限流管理" },
  { id: "audit", icon: ShieldAlert, en: "Audit Logs", zh: "审计日志" },
  { id: "llmgateway", icon: Network, en: "AI Gateway", zh: "AI 网关" },
  { id: "advanced", icon: Settings, en: "Advanced", zh: "高级功能" },
  { id: "portal", icon: BookOpen, en: "Dev Portal", zh: "开发者门户" },
  { id: "manual", icon: BookOpen, en: "User Manual", zh: "用户手册" },
  { id: "user-center", icon: UserCircle, en: "User Center", zh: "用户中心" },
  { id: "user-management", icon: Users, en: "User Management", zh: "用户管理" },
  { id: "system-settings", icon: Settings, en: "System Settings", zh: "系统设置" },
];

export default function Sidebar({ activeMenu, onMenuSelect, role, metrics, t }: SidebarProps) {
  const visibleItems = menuItems.filter((m) => canAccessMenu(role, m.id));
  return (
    <aside className="w-64 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-black/20 p-4 space-y-1">
      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-2 mt-4">
        {t("Menu", "菜单")}
      </div>
      {visibleItems.map((m) => (
        <button
          key={m.id}
          onClick={() => onMenuSelect(m.id)}
          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            activeMenu === m.id
              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
              : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          }`}
        >
          <m.icon className="w-4 h-4" /> <span>{t(m.en, m.zh)}</span>
        </button>
      ))}

      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-2 mt-8">
        {t("Quick Stats", "快速统计")}
      </div>
      <div className="px-3 gap-y-2 flex flex-col text-sm text-gray-600 dark:text-gray-400">
        <div className="flex justify-between">
          <span>{t("Rules Defined", "已定义规则")}</span>
          <span className="font-mono text-gray-900 dark:text-gray-100">
            {metrics?.total_rules ?? 0}
          </span>
        </div>
        <div className="flex justify-between">
          <span>{t("Audit Elements", "审计条目")}</span>
          <span className="font-mono text-gray-900 dark:text-gray-100">
            {metrics?.total_audit_events ?? 0}
          </span>
        </div>
        <div className="flex justify-between">
          <span>{t("Traffic (24h)", "24小时流量")}</span>
          <span className="font-mono text-gray-900 dark:text-gray-100">
            {metrics?.preview_success_24h ?? 0}
          </span>
        </div>
      </div>
    </aside>
  );
}
