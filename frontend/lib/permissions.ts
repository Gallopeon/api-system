// Permission constants — keep in sync with backend auth.rs Permission enum.
// Frontend UI gating is now user_group-based; backend enforces actual permissions.

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

const USER_GROUP_MENUS = new Set(["portal", "user-center", "manual", "dashboard"]);

const MENU_PERMISSIONS: Record<string, string> = {
  "dashboard": "metrics:read",
  "rules": "rule:read",
  "versions": "rule:read",
  "playground": "transform:preview",
  "api-builder": "rule:write",
  "openapi": "openapi:read",
  "apikeys": "apikey:read",
  "ratelimits": "ratelimit:read",
  "approvals": "approval:read",
  "analytics": "metrics:read",
  "audit": "audit:read",
  "advanced": "products:read",
  "user-management": "user:manage",
  "system-settings": "system:read",
};

export function canAccessMenu(userGroup: string | null | undefined, menuId: string, permissions?: string[]): boolean {
  if (!userGroup) return false;
  if (userGroup === "admin_group") {
    // When permissions are available (new login), use them for fine-grained control
    if (permissions && permissions.length > 0) {
      const required = MENU_PERMISSIONS[menuId];
      if (required) return permissions.includes(required);
      // Menus not in the map (portal, user-center, manual) are always accessible
      return true;
    }
    return true; // legacy: admin_group sees everything
  }
  if (userGroup === "user_group") return USER_GROUP_MENUS.has(menuId);
  return false;
}
