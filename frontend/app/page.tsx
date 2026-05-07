"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useI18n } from "./i18n";
import LoginPage from "@/components/features/LoginPage";

// ---- Foundation ----
import { getDefaultExpiry } from "@/lib/utils";
import { hasPermission, PERMISSIONS, type Role } from "@/lib/permissions";

// ---- Hooks ----
import { useNotification } from "@/hooks/useNotification";
import { useRules } from "@/hooks/useRules";
import { usePlayground } from "@/hooks/usePlayground";
import { useApiKeys } from "@/hooks/useApiKeys";
import { useRateLimits } from "@/hooks/useRateLimits";
import { useApiBuilder } from "@/hooks/useApiBuilder";
import { useDashboard, useAuditLog, useApprovals, useAnalytics } from "@/hooks/useDashboard";

// ---- Layout ----
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import Toast from "@/components/ui/Toast";
import ErrorBoundary from "@/components/ui/ErrorBoundary";

// ---- Feature Panels (Dynamic Imports) ----
import dynamic from "next/dynamic";

const DashboardPanel = dynamic(() => import("@/components/features/DashboardPanel"), { ssr: false });
const RulesPanel = dynamic(() => import("@/components/features/RulesPanel"), { ssr: false });
const VersionsPanel = dynamic(() => import("@/components/features/VersionsPanel"), { ssr: false });
const PlaygroundPanel = dynamic(() => import("@/components/features/PlaygroundPanel"), { ssr: false });
const ApiKeysPanel = dynamic(() => import("@/components/features/ApiKeysPanel"), { ssr: false });
const RateLimitsPanel = dynamic(() => import("@/components/features/RateLimitsPanel"), { ssr: false });
const ApprovalsPanel = dynamic(() => import("@/components/features/ApprovalsPanel"), { ssr: false });
const AnalyticsPanel = dynamic(() => import("@/components/features/AnalyticsPanel"), { ssr: false });
const AuditLogPanel = dynamic(() => import("@/components/features/AuditLogPanel"), { ssr: false });
const ManualPanel = dynamic(() => import("@/components/features/ManualPanel"), { ssr: false });
const ApiBuilderPanel = dynamic(() => import("@/components/features/ApiBuilderPanel"), { ssr: false });
const OpenApiPanel = dynamic(() => import("@/components/features/OpenApiPanel"), { ssr: false });
const LlmGatewayPanel = dynamic(() => import("@/components/features/LlmGatewayPanel"), { ssr: false });
const AdvancedPanel = dynamic(() => import("@/components/features/AdvancedPanel"), { ssr: false });
const PortalPanel = dynamic(() => import("@/components/features/PortalPanel"), { ssr: false });
const UserCenterPanel = dynamic(() => import("@/components/features/UserCenterPanel"), { ssr: false });
const UserManagementPanel = dynamic(() => import("@/components/features/UserManagementPanel"), { ssr: false });
const SystemSettingsPanel = dynamic(() => import("@/components/features/SystemSettingsPanel"), { ssr: false });

// ================================================================
export default function APIControlCenter() {
  const { lang, setLang } = useI18n();
  const t = useCallback(<T,>(en: T, zh: T): T => (lang === "zh" ? zh : en), [lang]);
  const { data: session, status } = useSession();
  const userRole = (session?.user?.role as Role) || null;
  const [activeMenu, setActiveMenu] = useState("dashboard");

  // Permission flags for role-based UI gating
  const can = {
    writeRule: hasPermission(userRole, PERMISSIONS.RuleWrite),
    publishRule: hasPermission(userRole, PERMISSIONS.RulePublish),
    executeTransform: hasPermission(userRole, PERMISSIONS.TransformExecute),
    writeApiKey: hasPermission(userRole, PERMISSIONS.ApiKeyWrite),
    writeRateLimit: hasPermission(userRole, PERMISSIONS.RateLimitWrite),
    reviewApproval: hasPermission(userRole, PERMISSIONS.ApprovalReview),
    manageLlm: hasPermission(userRole, PERMISSIONS.LlmManage),
    writeProducts: hasPermission(userRole, PERMISSIONS.ProductsWrite),
    writeCircuitBreakers: hasPermission(userRole, PERMISSIONS.CircuitBreakersWrite),
    writeProtocols: hasPermission(userRole, PERMISSIONS.ProtocolsWrite),
    writeClassifications: hasPermission(userRole, PERMISSIONS.ClassificationsWrite),
    writePlugins: hasPermission(userRole, PERMISSIONS.PluginsWrite),
    writeSystem: hasPermission(userRole, PERMISSIONS.SystemWrite),
    manageUsers: hasPermission(userRole, PERMISSIONS.UserManage),
  };

  // Cross-tab state
  const [openApiFilter, setOpenApiFilter] = useState("");

  // ---- Hooks ----
  const { notif, notifyError, notifySucc, clearNotif } = useNotification();
  const { metrics, liveState, readyState, loadHealthStatus, loadMetrics } = useDashboard(notifyError);
  const { auditItems, loadAuditLogs } = useAuditLog(notifyError);
  const { approvals, myApprovals, myPending, approvalFilter, approvalTab, apprBusy,
    approvalRuleId, approvalComment, approvalReviewer,
    setApprovalFilter, setApprovalTab, setApprovalRuleId, setApprovalComment, setApprovalReviewer,
    loadApprovals, loadMyRequests, loadMyPending, createApproval, reviewApproval } =
    useApprovals(notifyError, notifySucc);
  const { analytics, analyticsHours, analyticsBusy, topApis, keyStats,
    setAnalyticsHours, loadAnalytics } = useAnalytics(notifyError);

  const rulesHook = useRules(notifyError, notifySucc);
  const apiKeysHook = useApiKeys(notifyError, notifySucc);
  const rateLimitsHook = useRateLimits(notifyError, notifySucc);
  const playgroundHook = usePlayground(notifyError, notifySucc);
  const apiBuilderHook = useApiBuilder(
    rulesHook.rules, rulesHook.loadRules, loadMetrics, loadAuditLogs,
    notifyError, notifySucc, t,
  );

  // Expr eval state
  const [expr, setExpr] = useState("vip == true");
  const [exprIn, setExprIn] = useState('{"vip": true}');
  const [exprOut, setExprOut] = useState("-");

  // ---- Init ----
  useEffect(() => {
    loadHealthStatus();
    loadMetrics();
    rulesHook.loadRules();
    loadAuditLogs();
    apiKeysHook.loadApiKeys();
    rateLimitsHook.loadRateLimits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Approvals callbacks
  const handleCreateApproval = () => createApproval(rulesHook.selectedRuleId, rulesHook.rules);
  const handleReviewApproval = async (id: string, action: string) => {
    await reviewApproval(id, action);
    await rulesHook.loadRules();
    await loadAuditLogs();
  };

  // ====================== Render ======================
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

  // ====================== Main Dashboard ======================
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-gray-100 font-sans flex flex-col">
      <Navbar
        liveState={liveState}
        readyState={readyState}
        lang={lang}
        onToggleLang={() => setLang(lang === "zh" ? "en" : "zh")}
        userName={session?.user?.name || ""}
        onSignOut={() => signOut()}
        t={t}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeMenu={activeMenu} onMenuSelect={setActiveMenu} role={userRole} metrics={metrics} t={t} />

        <main className="flex-1 overflow-y-auto p-6 lg:p-10 relative">
          <Toast msg={notif.msg} type={notif.type} onClose={clearNotif} />
          <ErrorBoundary>

          {activeMenu === "dashboard" && (
            <DashboardPanel metrics={metrics} onRefresh={loadMetrics} t={t} />
          )}

          {activeMenu === "rules" && (
            <RulesPanel
              rules={rulesHook.rules}
              selectedRuleId={rulesHook.selectedRuleId}
              ruleName={rulesHook.ruleName} apiPath={rulesHook.apiPath} ruleStatus={rulesHook.ruleStatus}
              whitelist={rulesHook.whitelist} renames={rulesHook.renames} masked={rulesHook.masked}
              computed={rulesHook.computed} conditional={rulesHook.conditional} gray={rulesHook.gray}
              removeNulls={rulesHook.removeNulls} changeKind={rulesHook.changeKind} busy={rulesHook.busy}
              onRuleSelect={rulesHook.selectRule} onCreateBlank={rulesHook.resetForm}
              onSaveRule={rulesHook.saveRule} onDeleteRule={rulesHook.deleteRule}
              setRuleName={rulesHook.setRuleName} setApiPath={rulesHook.setApiPath} setRuleStatus={rulesHook.setRuleStatus}
              setWhitelist={rulesHook.setWhitelist} setRenames={rulesHook.setRenames} setMasked={rulesHook.setMasked}
              setComputed={rulesHook.setComputed} setConditional={rulesHook.setConditional} setGray={rulesHook.setGray}
              setRemoveNulls={rulesHook.setRemoveNulls} setChangeKind={rulesHook.setChangeKind}
              canWrite={can.writeRule} canPublish={can.publishRule}
              t={t}
            />
          )}

          {activeMenu === "versions" && (
            <VersionsPanel
              selectedRuleId={rulesHook.selectedRuleId} rules={rulesHook.rules}
              versions={rulesHook.versions} fromVer={rulesHook.fromVer} toVer={rulesHook.toVer}
              rollbackVer={rulesHook.rollbackVer} diffJson={rulesHook.diffJson}
              onSelectRule={rulesHook.selectRule} onRollback={rulesHook.rollback} onComputeDiff={rulesHook.computeDiff}
              setFromVer={rulesHook.setFromVer} setToVer={rulesHook.setToVer} setRollbackVer={rulesHook.setRollbackVer}
              canPublish={can.publishRule} t={t}
            />
          )}

          {activeMenu === "playground" && (
            <PlaygroundPanel
              pgEntries={playgroundHook.pgEntries} forceVar={playgroundHook.forceVar}
              selectedRuleId={playgroundHook.selectedRuleId} busy={playgroundHook.busy}
              rules={rulesHook.rules} expr={expr} exprIn={exprIn} exprOut={exprOut}
              setPgEntries={playgroundHook.setPgEntries} setForceVar={playgroundHook.setForceVar}
              setSelectedRuleId={playgroundHook.setSelectedRuleId}
              addEntry={playgroundHook.addEntry} removeEntry={playgroundHook.removeEntry}
              onBatchTransform={playgroundHook.batchTransform}
              onTransformEntry={playgroundHook.transformEntry}
              setExpr={setExpr} setExprIn={setExprIn}
              onTestExpr={async () => {
                const result = await playgroundHook.evalExpression(expr, exprIn);
                setExprOut(result);
              }}
              canExecute={can.executeTransform} notifyError={notifyError} notifySucc={notifySucc} t={t}
            />
          )}

          {activeMenu === "api-builder" && (
            <ApiBuilderPanel
              rules={rulesHook.rules}
              abRuleId={apiBuilderHook.abRuleId} abRuleFields={apiBuilderHook.abRuleFields}
              abEntryCounter={apiBuilderHook.abEntryCounter} abEntries={apiBuilderHook.abEntries}
              abPresets={apiBuilderHook.abPresets}
              abName={apiBuilderHook.abName} abApiPath={apiBuilderHook.abApiPath}
              abStatus={apiBuilderHook.abStatus} abWhitelist={apiBuilderHook.abWhitelist}
              abRenamesList={apiBuilderHook.abRenamesList} abMasked={apiBuilderHook.abMasked}
              abRemoveNulls={apiBuilderHook.abRemoveNulls} abChangeKind={apiBuilderHook.abChangeKind}
              setAbEntries={apiBuilderHook.setAbEntries} setAbEntryCounter={apiBuilderHook.setAbEntryCounter}
              loadAbRuleFields={apiBuilderHook.loadAbRuleFields}
              setAbRuleId={apiBuilderHook.setAbRuleId} setAbRuleFields={apiBuilderHook.setAbRuleFields}
              setAbName={apiBuilderHook.setAbName} setAbApiPath={apiBuilderHook.setAbApiPath}
              setAbStatus={apiBuilderHook.setAbStatus} setAbWhitelist={apiBuilderHook.setAbWhitelist}
              setAbRenamesList={apiBuilderHook.setAbRenamesList} setAbMasked={apiBuilderHook.setAbMasked}
              setAbRemoveNulls={apiBuilderHook.setAbRemoveNulls} setAbChangeKind={apiBuilderHook.setAbChangeKind}
              resetAbCrud={apiBuilderHook.resetAbCrud}
              saveAbPreset={apiBuilderHook.saveAbPreset} loadAbPreset={apiBuilderHook.loadAbPreset}
              deleteAbPreset={apiBuilderHook.deleteAbPreset}
              abSaveRule={apiBuilderHook.abSaveRule} abDeleteRule={apiBuilderHook.abDeleteRule}
              transformAbEntry={apiBuilderHook.transformAbEntry}
              batchTransformAb={apiBuilderHook.batchTransformAb}
              abEntryToJson={apiBuilderHook.abEntryToJson}
              canWrite={can.writeRule}
              notifySucc={notifySucc} notifyError={notifyError}
              t={t}
            />
          )}

          {activeMenu === "openapi" && (
            <OpenApiPanel
              ruleForImport={{
                setRuleName: rulesHook.setRuleName,
                setApiPath: rulesHook.setApiPath,
                setWhitelist: rulesHook.setWhitelist,
                setRenames: rulesHook.setRenames,
                setMasked: rulesHook.setMasked,
                setComputed: rulesHook.setComputed,
                setConditional: rulesHook.setConditional,
                setGray: rulesHook.setGray,
                setRemoveNulls: rulesHook.setRemoveNulls,
                setRuleStatus: rulesHook.setRuleStatus,
                setSelectedRuleId: rulesHook.setSelectedRuleId,
                setActiveMenu,
              }}
              canWrite={can.writeRule}
              notifyError={notifyError} notifySucc={notifySucc} t={t}
            />
          )}

          {activeMenu === "apikeys" && (
            <ApiKeysPanel
              apiKeys={apiKeysHook.apiKeys} akName={apiKeysHook.akName} akScopes={apiKeysHook.akScopes}
              akExpires={apiKeysHook.akExpires} akMaxCalls={apiKeysHook.akMaxCalls}
              akCreatedKey={apiKeysHook.akCreatedKey} akBusy={apiKeysHook.akBusy}
              setAkName={apiKeysHook.setAkName} setAkScopes={apiKeysHook.setAkScopes}
              setAkExpires={apiKeysHook.setAkExpires} setAkMaxCalls={apiKeysHook.setAkMaxCalls}
              setAkCreatedKey={apiKeysHook.setAkCreatedKey}
              onCreateApiKey={apiKeysHook.createApiKey}
              onToggleApiKey={apiKeysHook.toggleApiKey} onDeleteApiKey={apiKeysHook.deleteApiKey}
              onRefresh={apiKeysHook.loadApiKeys} fmtExpiry={apiKeysHook.fmtRelativeExpiry}
              canWrite={can.writeApiKey} notifySucc={notifySucc} t={t}
            />
          )}

          {activeMenu === "ratelimits" && (
            <RateLimitsPanel
              rateLimits={rateLimitsHook.rateLimits}
              rlName={rateLimitsHook.rlName} rlApiPath={rateLimitsHook.rlApiPath}
              rlWindow={rateLimitsHook.rlWindow} rlMaxReq={rateLimitsHook.rlMaxReq}
              rlBurst={rateLimitsHook.rlBurst} rlQuotaDaily={rateLimitsHook.rlQuotaDaily}
              rlQuotaMonthly={rateLimitsHook.rlQuotaMonthly} rlPerKey={rateLimitsHook.rlPerKey}
              rlPerIp={rateLimitsHook.rlPerIp} rlBusy={rateLimitsHook.rlBusy}
              setRlName={rateLimitsHook.setRlName} setRlApiPath={rateLimitsHook.setRlApiPath}
              setRlWindow={rateLimitsHook.setRlWindow} setRlMaxReq={rateLimitsHook.setRlMaxReq}
              setRlBurst={rateLimitsHook.setRlBurst} setRlQuotaDaily={rateLimitsHook.setRlQuotaDaily}
              setRlQuotaMonthly={rateLimitsHook.setRlQuotaMonthly}
              setRlPerKey={rateLimitsHook.setRlPerKey} setRlPerIp={rateLimitsHook.setRlPerIp}
              onCreate={rateLimitsHook.createRateLimit} onToggle={rateLimitsHook.toggleRateLimit}
              onDelete={rateLimitsHook.deleteRateLimit} onRefresh={rateLimitsHook.loadRateLimits}
              canWrite={can.writeRateLimit} t={t}
            />
          )}

          {activeMenu === "approvals" && (
            <ApprovalsPanel
              approvals={approvals} myApprovals={myApprovals} myPending={myPending}
              approvalFilter={approvalFilter} approvalTab={approvalTab} apprBusy={apprBusy}
              approvalRuleId={approvalRuleId} approvalComment={approvalComment}
              approvalReviewer={approvalReviewer}
              rules={rulesHook.rules}
              onSetApprovalFilter={setApprovalFilter} onSetApprovalTab={setApprovalTab}
              onSetApprovalRuleId={setApprovalRuleId} onSetApprovalComment={setApprovalComment}
              onSetApprovalReviewer={setApprovalReviewer}
              onCreateApproval={handleCreateApproval}
              onReviewApproval={handleReviewApproval}
              onRefresh={loadApprovals} onLoadMyRequests={loadMyRequests} onLoadMyPending={loadMyPending}
              canReview={can.reviewApproval} t={t}
            />
          )}

          {activeMenu === "analytics" && (
            <AnalyticsPanel
              analytics={analytics} analyticsHours={analyticsHours} analyticsBusy={analyticsBusy}
              topApis={topApis} keyStats={keyStats}
              onSetAnalyticsHours={setAnalyticsHours} onRefresh={loadAnalytics}
              t={t}
            />
          )}

          {activeMenu === "audit" && (
            <AuditLogPanel auditItems={auditItems} onRefresh={loadAuditLogs} t={t} />
          )}

          {activeMenu === "llmgateway" && (
            <LlmGatewayPanel
              canManage={can.manageLlm}
              notifyError={notifyError}
              notifySucc={notifySucc}
              t={t}
            />
          )}

          {activeMenu === "advanced" && (
            <AdvancedPanel
              notifyError={notifyError}
              notifySucc={notifySucc}
              canWriteProducts={can.writeProducts}
              canWriteCircuitBreakers={can.writeCircuitBreakers}
              canWriteProtocols={can.writeProtocols}
              canWriteClassifications={can.writeClassifications}
              canWritePlugins={can.writePlugins}
              t={t}
            />
          )}

          {activeMenu === "portal" && (
            <PortalPanel
              rules={rulesHook.rules}
              akName={apiKeysHook.akName} akScopes={apiKeysHook.akScopes}
              akExpires={apiKeysHook.akExpires} akBusy={apiKeysHook.akBusy}
              akCreatedKey={apiKeysHook.akCreatedKey}
              setAkName={apiKeysHook.setAkName} setAkScopes={apiKeysHook.setAkScopes}
              setAkExpires={apiKeysHook.setAkExpires} setAkCreatedKey={apiKeysHook.setAkCreatedKey}
              onCreateApiKey={apiKeysHook.createApiKey}
              setActiveMenu={setActiveMenu}
              onSelectRule={rulesHook.selectRule}
              setOpenApiFilter={setOpenApiFilter}
              getDefaultExpiry={getDefaultExpiry}
              canRequestKey={can.writeApiKey}
              notifySucc={notifySucc}
              t={t}
            />
          )}

          {activeMenu === "manual" && <ManualPanel t={t} />}

          {activeMenu === "user-center" && (
            <UserCenterPanel
              notifyError={notifyError}
              notifySucc={notifySucc}
              t={t}
            />
          )}

          {activeMenu === "user-management" && (
            <UserManagementPanel
              canManage={can.manageUsers}
              notifyError={notifyError}
              notifySucc={notifySucc}
              t={t}
            />
          )}

          {activeMenu === "system-settings" && (
            <SystemSettingsPanel
              canWrite={can.writeSystem}
              notifyError={notifyError}
              notifySucc={notifySucc}
              t={t}
            />
          )}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
