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

export function canAccessMenu(userGroup: string | null | undefined, menuId: string): boolean {
  if (!userGroup) return false;
  if (userGroup === "admin_group") return true;
  if (userGroup === "user_group") return USER_GROUP_MENUS.has(menuId);
  return false;
}
