"use client";

import React, { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useI18n } from "./i18n";
import { Check, Network, ShieldAlert } from "lucide-react";

// ---- Foundation ----
import { endpoint, apiFetch, getApiToken } from "@/lib/api";
import { parseJson, getDefaultExpiry } from "@/lib/utils";
import type { ExprEvalResponse } from "@/lib/types";

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

// ---- Feature Panels ----
import DashboardPanel from "@/components/features/DashboardPanel";
import RulesPanel from "@/components/features/RulesPanel";
import VersionsPanel from "@/components/features/VersionsPanel";
import PlaygroundPanel from "@/components/features/PlaygroundPanel";
import ApiKeysPanel from "@/components/features/ApiKeysPanel";
import RateLimitsPanel from "@/components/features/RateLimitsPanel";
import ApprovalsPanel from "@/components/features/ApprovalsPanel";
import AnalyticsPanel from "@/components/features/AnalyticsPanel";
import AuditLogPanel from "@/components/features/AuditLogPanel";
import ManualPanel from "@/components/features/ManualPanel";
import ApiBuilderPanel from "@/components/features/ApiBuilderPanel";
import OpenApiPanel from "@/components/features/OpenApiPanel";
import LlmGatewayPanel from "@/components/features/LlmGatewayPanel";
import AdvancedPanel from "@/components/features/AdvancedPanel";
import PortalPanel from "@/components/features/PortalPanel";
import UserCenterPanel from "@/components/features/UserCenterPanel";
import UserManagementPanel from "@/components/features/UserManagementPanel";
import SystemSettingsPanel from "@/components/features/SystemSettingsPanel";

// ================================================================
export default function APIControlCenter() {
  const { lang, setLang } = useI18n();
  const t = <T,>(en: T, zh: T): T => (lang === "zh" ? zh : en);
  const { data: session, status } = useSession();
  const [activeMenu, setActiveMenu] = useState("dashboard");

  // Auth form
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // Cross-tab state
  const [openApiFilter, setOpenApiFilter] = useState("");

  // ---- Hooks ----
  const { notif, notifyError, notifySucc, clearNotif } = useNotification();
  const { metrics, liveState, readyState, loadHealthStatus, loadMetrics } = useDashboard();
  const { auditItems, loadAuditLogs } = useAuditLog();
  const { approvals, myApprovals, myPending, approvalFilter, approvalTab, apprBusy,
    approvalRuleId, approvalComment, approvalReviewer,
    setApprovalFilter, setApprovalTab, setApprovalRuleId, setApprovalComment, setApprovalReviewer,
    loadApprovals, loadMyRequests, loadMyPending, createApproval, reviewApproval } =
    useApprovals(notifyError, notifySucc, getApiToken(session));
  const { analytics, analyticsHours, analyticsBusy, topApis, keyStats,
    setAnalyticsHours, loadAnalytics } = useAnalytics();

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

  // Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    const res = await signIn("credentials", { redirect: false, username, password });
    if (res?.error) setLoginError(t("Invalid username or password", "用户名或密码无效"));
    else if (res?.ok) window.location.reload();
  };

  // Dev-mode bypass: when env token is set, skip login entirely
  const ENV_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN ?? "";

  // ====================== Render ======================
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-gray-100 font-sans">
        <p className="text-gray-500 animate-pulse text-lg">{t("Checking authentication...", "身份验证检查中...")}</p>
      </div>
    );
  }

  if (!session && !ENV_TOKEN) {
    return (
      <div className="min-h-screen flex bg-white dark:bg-zinc-950 font-sans text-gray-900 dark:text-gray-100">
        <div className="hidden md:flex w-1/2 lg:w-3/5 flex-col justify-between bg-gradient-to-br from-blue-900 to-black p-12 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-cover bg-center opacity-20 mix-blend-overlay" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2670&auto=format&fit=crop')" }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          <div className="relative z-10 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Network className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold tracking-tight text-xl">{t("API Control Center", "API 控制中心")}</span>
          </div>
          <div className="relative z-10 max-w-lg">
            <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight mb-6 leading-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-300">
              {t("Control, filter, and observe your APIs at scale.", "大规模控制、过滤和观察您的 API。")}
            </h1>
            <p className="text-blue-200 text-lg mb-8 leading-relaxed font-light">
              {t("Log in to access the control plane dashboard, orchestrate rules instantly, and monitor global latency—all in one secured place.", "登录以访问控制平面仪表板，即时编排规则并监控全球延迟——所有操作都在一个安全的平台上完成。")}
            </p>
            <div className="flex flex-wrap gap-4 text-sm text-blue-300 font-medium">
              <span className="flex items-center bg-white/5 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10"><Check className="w-4 h-4 mr-1.5 text-emerald-400" /> {t("Enterprise Grade", "企业级")}</span>
              <span className="flex items-center bg-white/5 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10"><Check className="w-4 h-4 mr-1.5 text-emerald-400" /> {t("Zero Trust Built-in", "内置零信任")}</span>
              <span className="flex items-center bg-white/5 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10"><Check className="w-4 h-4 mr-1.5 text-emerald-400" /> {t("Real-time Config Propagation", "实时配置同步")}</span>
            </div>
          </div>
        </div>
        <div className="w-full md:w-1/2 lg:w-2/5 flex flex-col items-center justify-center p-8 bg-zinc-50 dark:bg-zinc-950 relative border-l border-white/10">
          <div className="w-full max-w-md">
            <div className="md:hidden flex items-center space-x-3 mb-10 justify-center">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20"><Network className="w-6 h-6 text-white" /></div>
              <span className="font-bold tracking-tight text-2xl">{t("API Control", "API 控制")}</span>
            </div>
            <div className="mb-10 text-center md:text-left">
              <h2 className="text-3xl font-bold tracking-tight mb-2">{t("Welcome Back", "欢迎回来")}</h2>
              <p className="text-gray-500 dark:text-gray-400">{t("Please enter your credentials to access the workspace.", "请输入您的凭据即可访问控制台。")}</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{t("Work Email / Username", "工作邮箱 / 用户名")}</label>
                <input type="text" className="w-full pl-4 pr-4 py-3 bg-white dark:bg-black/50 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all shadow-sm" placeholder={t("admin", "admin")} value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{t("Password", "登录密码")}</label>
                <input type="password" className="w-full pl-4 pr-4 py-3 bg-white dark:bg-black/50 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all shadow-sm" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              {loginError && (
                <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl flex items-start space-x-2">
                  <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-red-700 dark:text-red-400 text-sm font-medium">{loginError}</p>
                </div>
              )}
              <button type="submit" className="w-full inline-flex items-center justify-center rounded-xl px-4 py-3.5 font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/20 transition-all shadow-lg shadow-blue-600/30 mt-4">
                {t("Sign In to Dashboard", "登录到控制台")}
              </button>
            </form>
            <div className="mt-8 text-center text-sm font-medium text-gray-400 dark:text-gray-500">{t("Authorized personnel only.", "仅限授权人员访问。")}</div>
          </div>
        </div>
      </div>
    );
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
        <Sidebar activeMenu={activeMenu} onMenuSelect={setActiveMenu} metrics={metrics} t={t} />

        <main className="flex-1 overflow-y-auto p-6 lg:p-10 relative">
          <Toast msg={notif.msg} type={notif.type} onClose={clearNotif} />

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
              t={t}
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
              setExpr={setExpr} setExprIn={setExprIn}
              onTestExpr={async () => {
                try {
                  const body = { expression: expr, input: parseJson(exprIn, {}), actor: "panel" };
                  const r = await apiFetch("/api/v1/transform/expr-eval", { method: "POST", body: JSON.stringify(body) });
                  if (!r.ok) throw new Error("Eval failed");
                  const d = (await r.json()) as ExprEvalResponse;
                  setExprOut(d.matched ? "TRUE" : "FALSE");
                } catch (e) { setExprOut("ERROR: " + (e as Error).message); }
              }}
              notifyError={notifyError} notifySucc={notifySucc} t={t}
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
              notifySucc={notifySucc} t={t}
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
              t={t}
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
              t={t}
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
            <LlmGatewayPanel notifyError={notifyError} notifySucc={notifySucc} t={t} />
          )}

          {activeMenu === "advanced" && (
            <AdvancedPanel
              accessToken={getApiToken(session)}
              notifyError={notifyError}
              notifySucc={notifySucc}
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
              notifySucc={notifySucc}
              t={t}
            />
          )}

          {activeMenu === "manual" && <ManualPanel t={t} />}

          {activeMenu === "user-center" && (
            <UserCenterPanel
              accessToken={getApiToken(session)}
              notifyError={notifyError}
              notifySucc={notifySucc}
              t={t}
            />
          )}

          {activeMenu === "user-management" && (
            <UserManagementPanel
              accessToken={getApiToken(session)}
              notifyError={notifyError}
              notifySucc={notifySucc}
              t={t}
            />
          )}

          {activeMenu === "system-settings" && (
            <SystemSettingsPanel
              accessToken={getApiToken(session)}
              notifyError={notifyError}
              notifySucc={notifySucc}
              t={t}
            />
          )}
        </main>
      </div>
    </div>
  );
}
