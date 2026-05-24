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
  X,
} from "lucide-react";

import { canAccessMenu } from "@/lib/permissions";

interface SidebarProps {
  activeMenu: string;
  onMenuSelect: (menu: string) => void;
  userGroup: string | null;
  metrics: {
    total_rules?: number;
    total_audit_events?: number;
    preview_success_24h?: number;
  } | null;
  t: <T>(en: T, zh: T) => T;
  open: boolean;
  onClose: () => void;
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
  { id: "permission-templates", icon: ShieldAlert, en: "Permission Templates", zh: "权限模板" },
  { id: "system-settings", icon: Settings, en: "System Settings", zh: "系统设置" },
];

const USER_GROUP_MENUS = new Set(["portal", "user-center", "manual", "dashboard"]);

function SidebarContent({
  activeMenu,
  onMenuSelect,
  userGroup,
  metrics,
  t,
  onClose,
}: Omit<SidebarProps, "open">) {
  const visibleItems = menuItems.filter((m) => canAccessMenu(userGroup, m.id));

  const handleMenuSelect = (menu: string) => {
    onMenuSelect(menu);
    onClose();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header - only visible on mobile drawer */}
      <div className="flex items-center justify-between px-4 py-3 lg:hidden border-b border-gray-200 dark:border-zinc-800">
        <span className="font-bold tracking-tight text-lg">
          {t("API Control Center", "API 控制中心")}
        </span>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors touch-btn"
          aria-label={t("Close menu", "关闭菜单")}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">
          {t("Menu", "菜单")}
        </div>
        {visibleItems.map((m) => (
          <button
            key={m.id}
            onClick={() => handleMenuSelect(m.id)}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 touch-btn ${
              activeMenu === m.id
                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200 shadow-sm"
                : "text-gray-600 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            <m.icon className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{t(m.en, m.zh)}</span>
          </button>
        ))}

        {/* Quick Stats */}
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2 pt-4">
          {t("Quick Stats", "快速统计")}
        </div>
        <div className="px-3 space-y-2 text-sm text-gray-600 dark:text-zinc-400">
          <div className="flex justify-between items-center">
            <span>{t("Rules", "规则数")}</span>
            <span className="font-mono font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
              {metrics?.total_rules ?? 0}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span>{t("Audit", "审计")}</span>
            <span className="font-mono font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
              {metrics?.total_audit_events ?? 0}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span>{t("24h Traffic", "24h流量")}</span>
            <span className="font-mono font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
              {metrics?.preview_success_24h ?? 0}
            </span>
          </div>
        </div>
      </nav>
    </div>
  );
}

export default function Sidebar(props: SidebarProps) {
  const { open, onClose } = props;

  return (
    <>
      {/* Desktop sidebar — always visible */}
      <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 border-r border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60">
        <SidebarContent {...props} />
      </aside>

      {/* Mobile/tablet overlay */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
            onClick={onClose}
            aria-hidden="true"
          />
          {/* Drawer */}
          <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-white dark:bg-zinc-950 border-r border-gray-200 dark:border-zinc-800 shadow-2xl animate-slide-in-left">
            <SidebarContent {...props} />
          </aside>
        </div>
      )}
    </>
  );
}
