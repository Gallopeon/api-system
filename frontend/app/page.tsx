"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useI18n } from "./i18n";
import LoginPage from "@/components/features/LoginPage";

// ---- Foundation ----
import { getDefaultExpiry } from "@/lib/utils";
import { canAccessMenu } from "@/lib/permissions";
import { setAuthErrorHandler } from "@/lib/api";

// ---- Hooks ----
import { useNotification } from "@/hooks/useNotification";
import { useRules } from "@/hooks/useRules";
import { usePlayground } from "@/hooks/usePlayground";
import { useApiKeys } from "@/hooks/useApiKeys";
import { useRateLimits } from "@/hooks/useRateLimits";
import { useApiBuilder } from "@/hooks/useApiBuilder";
import { useDashboard, useAuditLog, useApprovals, useAnalytics } from "@/hooks/useDashboard";
import { usePortal } from "@/hooks/usePortal";

// ---- Layout ----
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import Toast from "@/components/ui/Toast";
import MainContentRouter from "@/components/layout/MainContentRouter";

// ================================================================
export default function APIControlCenter() {
  const { lang, setLang } = useI18n();
  const t = useCallback(<T,>(en: T, zh: T): T => (lang === "zh" ? zh : en), [lang]);
  const { data: session, status } = useSession();
  const userGroup = ((session?.user as any)?.userGroup as string) || "admin_group";
  const permissions: string[] = (session as any)?.permissions || [];
  const hasPerm = useCallback((perm: string) => permissions.includes(perm) || userGroup === "admin_group" && permissions.length === 0, [permissions, userGroup]);
  const [activeMenu, setActiveMenuRaw] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("active_menu") || "";
      if (stored && canAccessMenu(userGroup, stored, permissions)) {
        return stored;
      }
    }
    // fallback to first accessible menu
    const defaults = ["dashboard", "portal", "user-center", "manual"];
    return defaults.find(m => canAccessMenu(userGroup, m, permissions)) || "dashboard";
  });
  const setActiveMenu = useCallback((menu: string) => {
    setActiveMenuRaw(menu);
    localStorage.setItem("active_menu", menu);
  }, []);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // Permissions-based capability flags
  const can = {
    writeRule: hasPerm("rule:write"),
    publishRule: hasPerm("rule:publish"),
    executeTransform: hasPerm("transform:execute"),
    writeApiKey: hasPerm("apikey:write"),
    writeRateLimit: hasPerm("ratelimit:write"),
    reviewApproval: hasPerm("approval:review"),
    writeProducts: hasPerm("products:write"),
    writeCircuitBreakers: hasPerm("circuit_breakers:write"),
    writeProtocols: hasPerm("protocols:write"),
    writeClassifications: hasPerm("classifications:write"),
    writePlugins: hasPerm("plugins:write"),
    writeSystem: hasPerm("system:write"),
    manageUsers: hasPerm("user:manage"),
  };

  const [openApiFilter, setOpenApiFilter] = useState("");

  // ---- Hooks ----
  const { notif, notifyError, notifySucc, clearNotif } = useNotification();
  const dashboardHook = useDashboard(notifyError);
  const auditLogHook = useAuditLog(notifyError);
  const approvalsHook = useApprovals(notifyError, notifySucc);
  const analyticsHook = useAnalytics(notifyError);

  const rulesHook = useRules(notifyError, notifySucc);
  const apiKeysHook = useApiKeys(notifyError, notifySucc);
  const rateLimitsHook = useRateLimits(notifyError, notifySucc);
  const playgroundHook = usePlayground(notifyError, notifySucc);
  const apiBuilderHook = useApiBuilder(
    rulesHook.rules, rulesHook.loadRules, dashboardHook.loadMetrics, auditLogHook.loadAuditLogs,
    notifyError, notifySucc, t,
  );

  const portalHook = usePortal(
    session?.user?.name || "",
    notifyError,
    notifySucc,
  );

  // Expr eval state
  const [expr, setExpr] = useState("vip == true");
  const [exprIn, setExprIn] = useState('{"vip": true}');
  const [exprOut, setExprOut] = useState("-");

  // Register 401 handler
  useEffect(() => {
    setAuthErrorHandler(() => {
      signOut({ redirect: false });
    });
    return () => setAuthErrorHandler(null);
  }, []);

  // Guard: redirect to first accessible menu
  useEffect(() => {
    if (!canAccessMenu(userGroup, activeMenu, permissions)) {
      const fallback = ["dashboard", "portal", "user-center", "manual"].find(m => canAccessMenu(userGroup, m, permissions)) || "dashboard";
      setActiveMenu(fallback);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userGroup, activeMenu]);

  // ---- Init ----
  useEffect(() => {
    if (status !== "authenticated") return;
    dashboardHook.loadHealthStatus();
    if (hasPerm("metrics:read")) dashboardHook.loadMetrics();
    if (hasPerm("approval:read")) { approvalsHook.loadApprovals(); approvalsHook.loadMyPending(); }
    if (hasPerm("rule:read")) rulesHook.loadRules();
    if (hasPerm("audit:read")) auditLogHook.loadAuditLogs();
    if (hasPerm("apikey:read")) apiKeysHook.loadApiKeys();
    if (hasPerm("ratelimit:read")) rateLimitsHook.loadRateLimits();
    if (hasPerm("products:read")) portalHook.loadCatalog();
    portalHook.loadMyApps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, permissions]);

  // Approvals callbacks
  const handleCreateApproval = () => approvalsHook.createApproval(rulesHook.selectedRuleId, rulesHook.rules);
  const handleReviewApproval = async (id: string, action: string) => {
    await approvalsHook.reviewApproval(id, action);
    await rulesHook.loadRules();
    await auditLogHook.loadAuditLogs();
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-gray-100 font-sans">
        <p className="text-gray-500 animate-pulse text-lg">{t("Checking authentication...", "身份验证检查中...")}</p>
      </div>
    );
  }

  if (!session) {
    return <LoginPage t={t} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-gray-100 font-sans flex flex-col">
      <Navbar
        liveState={dashboardHook.liveState}
        readyState={dashboardHook.readyState}
        lang={lang}
        onToggleLang={() => setLang(lang === "zh" ? "en" : "zh")}
        userName={session?.user?.name || ""}
        userEmail={(session?.user as any)?.email || undefined}
        onSignOut={() => signOut()}
        onToggleSidebar={toggleSidebar}
        onMenuSelect={setActiveMenu}
        t={t}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activeMenu={activeMenu}
          onMenuSelect={setActiveMenu}
          userGroup={userGroup}
          permissions={permissions}
          metrics={dashboardHook.metrics}
          t={t}
          open={sidebarOpen}
          onClose={closeSidebar}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 relative">
          <Toast msg={notif.msg} type={notif.type} onClose={clearNotif} />

          <MainContentRouter
            activeMenu={activeMenu}
            t={t}
            session={session}
            can={can}
            hooks={{
              rules: rulesHook,
              apiKeys: apiKeysHook,
              rateLimits: rateLimitsHook,
              playground: playgroundHook,
              apiBuilder: apiBuilderHook,
              portal: portalHook,
              dashboard: dashboardHook,
              auditLog: auditLogHook,
              approvals: approvalsHook,
              analytics: analyticsHook,
            }}
            state={{
              expr, setExpr,
              exprIn, setExprIn,
              exprOut, setExprOut,
              setOpenApiFilter,
              setActiveMenu,
            }}
            handlers={{
              handleCreateApproval,
              handleReviewApproval,
              notifyError,
              notifySucc,
              getDefaultExpiry,
            }}
          />
        </main>
      </div>
    </div>
  );
}
