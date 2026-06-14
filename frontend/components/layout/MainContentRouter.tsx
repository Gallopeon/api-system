"use client";

import React from "react";
import dynamic from "next/dynamic";
import ErrorBoundary from "@/components/ui/ErrorBoundary";

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
const AdvancedPanel = dynamic(() => import("@/components/features/AdvancedPanel"), { ssr: false });
const PortalPanel = dynamic(() => import("@/components/features/PortalPanel"), { ssr: false });
const UserCenterPanel = dynamic(() => import("@/components/features/UserCenterPanel"), { ssr: false });
const UserManagementPanel = dynamic(() => import("@/components/features/UserManagementPanel"), { ssr: false });
const SystemSettingsPanel = dynamic(() => import("@/components/features/SystemSettingsPanel"), { ssr: false });

interface MainContentRouterProps {
  activeMenu: string;
  t: (en: any, zh: any) => any;
  session: any;
  can: any;
  hooks: {
    rules: any;
    apiKeys: any;
    rateLimits: any;
    playground: any;
    apiBuilder: any;
    portal: any;
    dashboard: any;
    auditLog: any;
    approvals: any;
    analytics: any;
  };
  state: {
    expr: string;
    setExpr: (v: string) => void;
    exprIn: string;
    setExprIn: (v: string) => void;
    exprOut: string;
    setExprOut: (v: string) => void;
    setOpenApiFilter: (v: string) => void;
    setActiveMenu: (v: string) => void;
  };
  handlers: {
    handleCreateApproval: () => void;
    handleReviewApproval: (id: string, action: string) => Promise<void>;
    notifyError: (msg: string) => void;
    notifySucc: (msg: string) => void;
    getDefaultExpiry: (hours?: number) => string;
  };
}

export default function MainContentRouter({
  activeMenu,
  t,
  session,
  can,
  hooks,
  state,
  handlers,
}: MainContentRouterProps) {
  const { rules, apiKeys, rateLimits, playground, apiBuilder, portal, dashboard, auditLog, approvals, analytics } = hooks;

  return (
    <ErrorBoundary>
      {activeMenu === "dashboard" && (
        <DashboardPanel metrics={dashboard.metrics} onRefresh={dashboard.loadMetrics} t={t} />
      )}

      {activeMenu === "rules" && (
        <RulesPanel
          rules={rules.rules}
          selectedRuleId={rules.selectedRuleId}
          ruleName={rules.ruleName} apiPath={rules.apiPath} ruleStatus={rules.ruleStatus}
          whitelist={rules.whitelist} renames={rules.renames} masked={rules.masked}
          computed={rules.computed} conditional={rules.conditional} gray={rules.gray}
          removeNulls={rules.removeNulls} changeKind={rules.changeKind} busy={rules.busy}
          onRuleSelect={rules.selectRule} onCreateBlank={rules.resetForm}
          onSaveRule={rules.saveRule} onDeleteRule={rules.deleteRule}
          setRuleName={rules.setRuleName} setApiPath={rules.setApiPath} setRuleStatus={rules.setRuleStatus}
          setWhitelist={rules.setWhitelist} setRenames={rules.setRenames} setMasked={rules.setMasked}
          setComputed={rules.setComputed} setConditional={rules.setConditional} setGray={rules.setGray}
          setRemoveNulls={rules.setRemoveNulls} setChangeKind={rules.setChangeKind}
          canWrite={can.writeRule} canPublish={can.publishRule}
          t={t}
        />
      )}

      {activeMenu === "versions" && (
        <VersionsPanel
          selectedRuleId={rules.selectedRuleId} rules={rules.rules}
          versions={rules.versions} fromVer={rules.fromVer} toVer={rules.toVer}
          rollbackVer={rules.rollbackVer} diffJson={rules.diffJson}
          diffResult={rules.diffResult}
          onSelectRule={rules.selectRule} onRollback={rules.rollback} onComputeDiff={rules.computeDiff}
          setFromVer={rules.setFromVer} setToVer={rules.setToVer} setRollbackVer={rules.setRollbackVer}
          canPublish={can.publishRule} t={t}
        />
      )}

      {activeMenu === "playground" && (
        <PlaygroundPanel
          pgEntries={playground.pgEntries} forceVar={playground.forceVar}
          selectedRuleId={playground.selectedRuleId} busy={playground.busy}
          rules={rules.rules} expr={state.expr} exprIn={state.exprIn} exprOut={state.exprOut}
          setPgEntries={playground.setPgEntries} setForceVar={playground.setForceVar}
          setSelectedRuleId={playground.setSelectedRuleId}
          addEntry={playground.addEntry} removeEntry={playground.removeEntry}
          onBatchTransform={playground.batchTransform}
          onTransformEntry={playground.transformEntry}
          setExpr={state.setExpr} setExprIn={state.setExprIn}
          onTestExpr={async () => {
            const result = await playground.evalExpression(state.expr, state.exprIn);
            state.setExprOut(result);
          }}
          canExecute={can.executeTransform} notifyError={handlers.notifyError} notifySucc={handlers.notifySucc} t={t}
        />
      )}

      {activeMenu === "api-builder" && (
        <ApiBuilderPanel
          rules={rules.rules}
          abRuleId={apiBuilder.abRuleId} abRuleFields={apiBuilder.abRuleFields}
          abEntryCounter={apiBuilder.abEntryCounter} abEntries={apiBuilder.abEntries}
          abPresets={apiBuilder.abPresets}
          abName={apiBuilder.abName} abApiPath={apiBuilder.abApiPath}
          abStatus={apiBuilder.abStatus} abWhitelist={apiBuilder.abWhitelist}
          abRenamesList={apiBuilder.abRenamesList} abMasked={apiBuilder.abMasked}
          abRemoveNulls={apiBuilder.abRemoveNulls} abChangeKind={apiBuilder.abChangeKind}
          setAbEntries={apiBuilder.setAbEntries} setAbEntryCounter={apiBuilder.setAbEntryCounter}
          loadAbRuleFields={apiBuilder.loadAbRuleFields}
          setAbRuleId={apiBuilder.setAbRuleId} setAbRuleFields={apiBuilder.setAbRuleFields}
          setAbName={apiBuilder.setAbName} setAbApiPath={apiBuilder.setAbApiPath}
          setAbStatus={apiBuilder.setAbStatus} setAbWhitelist={apiBuilder.setAbWhitelist}
          setAbRenamesList={apiBuilder.setAbRenamesList} setAbMasked={apiBuilder.setAbMasked}
          setAbRemoveNulls={apiBuilder.setAbRemoveNulls} setAbChangeKind={apiBuilder.setAbChangeKind}
          resetAbCrud={apiBuilder.resetAbCrud}
          saveAbPreset={apiBuilder.saveAbPreset} loadAbPreset={apiBuilder.loadAbPreset}
          deleteAbPreset={apiBuilder.deleteAbPreset}
          abSaveRule={apiBuilder.abSaveRule} abDeleteRule={apiBuilder.abDeleteRule}
          transformAbEntry={apiBuilder.transformAbEntry}
          batchTransformAb={apiBuilder.batchTransformAb}
          abEntryToJson={apiBuilder.abEntryToJson}
          canWrite={can.writeRule}
          notifySucc={handlers.notifySucc} notifyError={handlers.notifyError}
          t={t}
        />
      )}

      {activeMenu === "openapi" && (
        <OpenApiPanel
          ruleForImport={{
            setRuleName: rules.setRuleName,
            setApiPath: rules.setApiPath,
            setWhitelist: rules.setWhitelist,
            setRenames: rules.setRenames,
            setMasked: rules.setMasked,
            setComputed: rules.setComputed,
            setConditional: rules.setConditional,
            setGray: rules.setGray,
            setRemoveNulls: rules.setRemoveNulls,
            setRuleStatus: rules.setRuleStatus,
            setSelectedRuleId: rules.setSelectedRuleId,
            setActiveMenu: state.setActiveMenu,
          }}
          canWrite={can.writeRule}
          notifyError={handlers.notifyError} notifySucc={handlers.notifySucc} t={t}
        />
      )}

      {activeMenu === "apikeys" && (
        <ApiKeysPanel
          apiKeys={apiKeys.apiKeys} akName={apiKeys.akName} akScopes={apiKeys.akScopes}
          akExpires={apiKeys.akExpires} akMaxCalls={apiKeys.akMaxCalls}
          akCreatedKey={apiKeys.akCreatedKey} akBusy={apiKeys.akBusy}
          setAkName={apiKeys.setAkName} setAkScopes={apiKeys.setAkScopes}
          setAkExpires={apiKeys.setAkExpires} setAkMaxCalls={apiKeys.setAkMaxCalls}
          setAkCreatedKey={apiKeys.setAkCreatedKey}
          onCreateApiKey={apiKeys.createApiKey}
          onToggleApiKey={apiKeys.toggleApiKey} onDeleteApiKey={apiKeys.deleteApiKey}
          onRefresh={apiKeys.loadApiKeys} fmtExpiry={apiKeys.fmtRelativeExpiry}
          canWrite={can.writeApiKey} notifySucc={handlers.notifySucc} t={t}
        />
      )}

      {activeMenu === "ratelimits" && (
        <RateLimitsPanel
          rateLimits={rateLimits.rateLimits}
          rlName={rateLimits.rlName} rlApiPath={rateLimits.rlApiPath}
          rlWindow={rateLimits.rlWindow} rlMaxReq={rateLimits.rlMaxReq}
          rlBurst={rateLimits.rlBurst} rlQuotaDaily={rateLimits.rlQuotaDaily}
          rlQuotaMonthly={rateLimits.rlQuotaMonthly} rlPerKey={rateLimits.rlPerKey}
          rlPerIp={rateLimits.rlPerIp} rlBusy={rateLimits.rlBusy}
          setRlName={rateLimits.setRlName} setRlApiPath={rateLimits.setRlApiPath}
          setRlWindow={rateLimits.setRlWindow} setRlMaxReq={rateLimits.setRlMaxReq}
          setRlBurst={rateLimits.setRlBurst} setRlQuotaDaily={rateLimits.setRlQuotaDaily}
          setRlQuotaMonthly={rateLimits.setRlQuotaMonthly}
          setRlPerKey={rateLimits.setRlPerKey} setRlPerIp={rateLimits.setRlPerIp}
          onCreate={rateLimits.createRateLimit} onToggle={rateLimits.toggleRateLimit}
          onDelete={rateLimits.deleteRateLimit} onRefresh={rateLimits.loadRateLimits}
          canWrite={can.writeRateLimit} t={t}
        />
      )}

      {activeMenu === "approvals" && (
        <ApprovalsPanel
          approvals={approvals.approvals} myApprovals={approvals.myApprovals} myPending={approvals.myPending}
          approvalFilter={approvals.approvalFilter} approvalTab={approvals.approvalTab} apprBusy={approvals.apprBusy}
          approvalRuleId={approvals.approvalRuleId} approvalComment={approvals.approvalComment}
          approvalReviewer={approvals.approvalReviewer}
          rules={rules.rules}
          onSetApprovalFilter={approvals.setApprovalFilter} onSetApprovalTab={approvals.setApprovalTab}
          onSetApprovalRuleId={approvals.setApprovalRuleId} onSetApprovalComment={approvals.setApprovalComment}
          onSetApprovalReviewer={approvals.setApprovalReviewer}
          onCreateApproval={handlers.handleCreateApproval}
          onReviewApproval={handlers.handleReviewApproval}
          onDeleteApproval={approvals.deleteApproval}
          onRefresh={approvals.loadApprovals} onLoadMyRequests={approvals.loadMyRequests} onLoadMyPending={approvals.loadMyPending}
          canReview={can.reviewApproval} canDelete={can.writeRule} t={t}
        />
      )}

      {activeMenu === "analytics" && (
        <AnalyticsPanel
          analytics={analytics.analytics} analyticsHours={analytics.analyticsHours} analyticsBusy={analytics.analyticsBusy}
          topApis={analytics.topApis} keyStats={analytics.keyStats}
          onSetAnalyticsHours={analytics.setAnalyticsHours} onRefresh={analytics.loadAnalytics}
          t={t}
        />
      )}

      {activeMenu === "audit" && (
        <AuditLogPanel auditItems={auditLog.auditItems} onRefresh={auditLog.loadAuditLogs} t={t} />
      )}

      {activeMenu === "advanced" && (
        <AdvancedPanel
          notifyError={handlers.notifyError}
          notifySucc={handlers.notifySucc}
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
          products={portal.products}
          allTags={portal.allTags}
          catalogBusy={portal.catalogBusy}
          searchQuery={portal.searchQuery}
          selectedTags={portal.selectedTags}
          onSearchChange={portal.setSearchQuery}
          onTagToggle={portal.toggleTag}
          myKeys={portal.myKeys}
          mySubscriptions={portal.mySubscriptions}
          usageMap={portal.usageMap}
          getProduct={portal.getProduct}
          akName={portal.akName} akScopes={portal.akScopes}
          akExpires={portal.akExpires} akCreatedKey={portal.akCreatedKey}
          akBusy={portal.akBusy}
          onAkNameChange={portal.setAkName}
          onAkScopesChange={portal.setAkScopes}
          onAkExpiresChange={portal.setAkExpires}
          onAkCreatedKeyChange={portal.setAkCreatedKey}
          onCreateKey={portal.createPortalKey}
          getDefaultExpiry={handlers.getDefaultExpiry}
          portalTab={portal.portalTab}
          onPortalTabChange={portal.setPortalTab}
          onNavigateToMenu={state.setActiveMenu}
          onSelectRule={rules.selectRule}
          onSetOpenApiFilter={state.setOpenApiFilter}
          canRequestKey={can.writeApiKey}
          notifySucc={handlers.notifySucc}
          docsProductId={portal.docsProductId}
          onViewProductDocs={portal.viewProductDocs}
          allProducts={portal.allProducts}
          subscribeToProduct={portal.subscribeToProduct}
          subBusy={portal.subBusy}
          t={t}
        />
      )}

      {activeMenu === "manual" && <ManualPanel t={t} />}

      {activeMenu === "user-center" && (
        <UserCenterPanel
          accessToken={(session as any)?.accessToken}
          notifyError={handlers.notifyError}
          notifySucc={handlers.notifySucc}
          t={t}
        />
      )}

      {activeMenu === "user-management" && (
        <UserManagementPanel
          canManage={can.manageUsers}
          notifyError={handlers.notifyError}
          notifySucc={handlers.notifySucc}
          t={t}
        />
      )}

      {activeMenu === "system-settings" && (
        <SystemSettingsPanel
          canWrite={can.writeSystem}
          notifyError={handlers.notifyError}
          notifySucc={handlers.notifySucc}
          t={t}
        />
      )}
    </ErrorBoundary>
  );
}
