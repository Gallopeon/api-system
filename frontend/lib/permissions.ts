// Permission helpers for role-based UI gating.
// Keep in sync with backend auth.rs Permission enum.

export type Role = "admin" | "reviewer" | "editor" | "viewer";

export const PERMISSIONS = {
  RuleRead: "rule:read",
  RuleWrite: "rule:write",
  RulePublish: "rule:publish",
  TransformPreview: "transform:preview",
  TransformExecute: "transform:execute",
  ApiKeyRead: "apikey:read",
  ApiKeyWrite: "apikey:write",
  RateLimitRead: "ratelimit:read",
  RateLimitWrite: "ratelimit:write",
  ApprovalRead: "approval:read",
  ApprovalReview: "approval:review",
  MetricsRead: "metrics:read",
  AuditRead: "audit:read",
  LlmRoute: "llm:route",
  LlmManage: "llm:manage",
  ProductsRead: "products:read",
  ProductsWrite: "products:write",
  CircuitBreakersRead: "circuit_breakers:read",
  CircuitBreakersWrite: "circuit_breakers:write",
  ProtocolsRead: "protocols:read",
  ProtocolsWrite: "protocols:write",
  ClassificationsRead: "classifications:read",
  ClassificationsWrite: "classifications:write",
  PluginsRead: "plugins:read",
  PluginsWrite: "plugins:write",
  OpenApiRead: "openapi:read",
  ValidationRead: "validation:read",
  SystemRead: "system:read",
  SystemWrite: "system:write",
  UserRead: "user:read",
  UserManage: "user:manage",
  UserSelf: "user:self",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

function rolePermissions(role: Role): Set<Permission> {
  const p = new Set<Permission>();
  switch (role) {
    case "admin":
      Object.values(PERMISSIONS).forEach((perm) => p.add(perm));
      break;
    case "reviewer":
      [
        PERMISSIONS.RuleRead,
        PERMISSIONS.RulePublish,
        PERMISSIONS.TransformPreview,
        PERMISSIONS.TransformExecute,
        PERMISSIONS.ApiKeyRead,
        PERMISSIONS.RateLimitRead,
        PERMISSIONS.ApprovalRead,
        PERMISSIONS.ApprovalReview,
        PERMISSIONS.MetricsRead,
        PERMISSIONS.AuditRead,
        PERMISSIONS.LlmRoute,
        PERMISSIONS.ProductsRead,
        PERMISSIONS.CircuitBreakersRead,
        PERMISSIONS.ProtocolsRead,
        PERMISSIONS.ClassificationsRead,
        PERMISSIONS.PluginsRead,
        PERMISSIONS.OpenApiRead,
        PERMISSIONS.ValidationRead,
        PERMISSIONS.SystemRead,
        PERMISSIONS.UserRead,
        PERMISSIONS.UserSelf,
      ].forEach((perm) => p.add(perm));
      break;
    case "editor":
      [
        PERMISSIONS.RuleRead,
        PERMISSIONS.RuleWrite,
        PERMISSIONS.TransformPreview,
        PERMISSIONS.TransformExecute,
        PERMISSIONS.ApiKeyRead,
        PERMISSIONS.ApiKeyWrite,
        PERMISSIONS.RateLimitRead,
        PERMISSIONS.RateLimitWrite,
        PERMISSIONS.ApprovalRead,
        PERMISSIONS.MetricsRead,
        PERMISSIONS.AuditRead,
        PERMISSIONS.LlmRoute,
        PERMISSIONS.LlmManage,
        PERMISSIONS.ProductsRead,
        PERMISSIONS.CircuitBreakersRead,
        PERMISSIONS.CircuitBreakersWrite,
        PERMISSIONS.ProtocolsRead,
        PERMISSIONS.ProtocolsWrite,
        PERMISSIONS.ClassificationsRead,
        PERMISSIONS.ClassificationsWrite,
        PERMISSIONS.PluginsRead,
        PERMISSIONS.PluginsWrite,
        PERMISSIONS.OpenApiRead,
        PERMISSIONS.ValidationRead,
        PERMISSIONS.SystemRead,
        PERMISSIONS.UserRead,
        PERMISSIONS.UserSelf,
      ].forEach((perm) => p.add(perm));
      break;
    case "viewer":
      [
        PERMISSIONS.RuleRead,
        PERMISSIONS.TransformPreview,
        PERMISSIONS.ApiKeyRead,
        PERMISSIONS.RateLimitRead,
        PERMISSIONS.ApprovalRead,
        PERMISSIONS.MetricsRead,
        PERMISSIONS.AuditRead,
        PERMISSIONS.LlmRoute,
        PERMISSIONS.ProductsRead,
        PERMISSIONS.CircuitBreakersRead,
        PERMISSIONS.ProtocolsRead,
        PERMISSIONS.ClassificationsRead,
        PERMISSIONS.PluginsRead,
        PERMISSIONS.OpenApiRead,
        PERMISSIONS.ValidationRead,
        PERMISSIONS.SystemRead,
        PERMISSIONS.UserRead,
        PERMISSIONS.UserSelf,
      ].forEach((perm) => p.add(perm));
      break;
  }
  return p;
}

export function hasPermission(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return rolePermissions(role).has(permission);
}

export function canAccessMenu(role: Role | undefined | null, menuId: string): boolean {
  if (!role) return false;
  const map: Record<string, Permission[]> = {
    dashboard: [PERMISSIONS.MetricsRead],
    rules: [PERMISSIONS.RuleRead],
    versions: [PERMISSIONS.RuleRead],
    playground: [PERMISSIONS.TransformPreview],
    "api-builder": [PERMISSIONS.RuleRead, PERMISSIONS.RuleWrite],
    openapi: [PERMISSIONS.OpenApiRead],
    apikeys: [PERMISSIONS.ApiKeyRead, PERMISSIONS.ApiKeyWrite],
    approvals: [PERMISSIONS.ApprovalRead],
    analytics: [PERMISSIONS.MetricsRead],
    ratelimits: [PERMISSIONS.RateLimitRead, PERMISSIONS.RateLimitWrite],
    audit: [PERMISSIONS.AuditRead],
    llmgateway: [PERMISSIONS.LlmRoute],
    advanced: [
      PERMISSIONS.ProductsRead, PERMISSIONS.ProductsWrite,
      PERMISSIONS.CircuitBreakersRead, PERMISSIONS.CircuitBreakersWrite,
      PERMISSIONS.ProtocolsRead, PERMISSIONS.ProtocolsWrite,
      PERMISSIONS.ClassificationsRead, PERMISSIONS.ClassificationsWrite,
      PERMISSIONS.PluginsRead, PERMISSIONS.PluginsWrite,
    ],
    portal: [PERMISSIONS.OpenApiRead],
    manual: [],
    "user-center": [PERMISSIONS.UserSelf],
    "user-management": [PERMISSIONS.UserManage],
    "permission-templates": [PERMISSIONS.SystemRead, PERMISSIONS.SystemWrite],
    "system-settings": [PERMISSIONS.SystemRead, PERMISSIONS.SystemWrite],
  };
  const required = map[menuId];
  if (!required || required.length === 0) return true;
  return required.some((p) => hasPermission(role, p));
}
