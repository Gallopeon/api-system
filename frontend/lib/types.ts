// API Control Plane — shared TypeScript types

export type RuleSummary = {
  id: string;
  name: string;
  api_path: string;
  current_version: number;
  status: string;
  updated_at: string;
};

export type RuleListResponse = {
  items: RuleSummary[];
  limit: number;
  offset: number;
  total: number;
  next_cursor?: string;
};

export type TransformRuleConfig = {
  whitelist_fields?: string[];
  renames?: Record<string, string>;
  masked_fields?: string[];
  computed_literals?: Record<string, unknown>;
  remove_nulls?: boolean;
  conditional_rules?: Array<Record<string, unknown>>;
  gray_release?: Record<string, unknown> | null;
  request_validation?: {
    enabled: boolean;
    schema: unknown;
    strict: boolean;
    custom_error_message?: string;
  } | null;
  response_validation?: {
    enabled: boolean;
    schema: unknown;
    strict: boolean;
    custom_error_message?: string;
  } | null;
  cache_config?: {
    enabled: boolean;
    ttl_seconds: number;
    max_size_mb: number;
    cache_by_headers: string[];
    cache_by_query: string[];
    conditional_cache: string | null;
  } | null;
};

export type RuleDetail = {
  id: string;
  name: string;
  api_path: string;
  current_version: number;
  status: string;
  config: TransformRuleConfig;
  updated_at: string;
};

export type RuleVersion = {
  version: number;
  note: string | null;
  change_kind: string;
  created_at: string;
  config: unknown;
};

export type RuleVersionsResponse = {
  rule_id: string;
  items: RuleVersion[];
};

export type RuleDiffResponse = {
  rule_id: string;
  from: number;
  to: number;
  changes_count: number;
  changes: Array<{
    path: string;
    change_type: string;
    from: unknown;
    to: unknown;
  }>;
};

export type PreviewResponse = {
  output: unknown;
  selected_variant?: string | null;
};

export type ExprEvalResponse = {
  expression: string;
  matched: boolean;
};

export type MetricsOverview = {
  uptime_seconds: number;
  total_rules: number;
  total_versions: number;
  total_audit_events: number;
  audit_events_24h: number;
  preview_success_24h: number;
  top_actions_24h: Array<{ action: string; count: number }>;
};

export type AuditLogItem = {
  id: number;
  rule_id: string | null;
  action: string;
  actor: string;
  success: boolean;
  message: string | null;
  detail: unknown;
  created_at: string;
};

export type AuditLogResponse = {
  items: AuditLogItem[];
  limit: number;
  offset: number;
};

export type ExecuteResponse = {
  rule_id: string;
  selected_variant?: string | null;
  output: unknown;
};

export type ApiKeyItem = {
  id: string;
  key?: string | null;
  key_prefix: string;
  name: string;
  status: string;
  scopes: string[] | null;
  expires_at: string | null;
  max_calls: number | null;
  call_count: number;
  tenant_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ApiKeyListResponse = {
  items: ApiKeyItem[];
  limit: number;
  offset: number;
};

export type RateLimitItem = {
  id: string;
  name: string;
  api_path: string;
  window_seconds: number;
  max_requests: number;
  burst_size: number;
  quota_daily: number | null;
  quota_monthly: number | null;
  per_api_key: boolean;
  per_ip: boolean;
  status: string;
  created_at: string;
  updated_at: string;
};

export type RateLimitListResponse = {
  items: RateLimitItem[];
  limit: number;
  offset: number;
};

export type RateLimitCheckResponse = {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset_seconds: number;
  quota_daily_remaining: number | null;
  quota_monthly_remaining: number | null;
  reason: string | null;
};

export type AnalyticsData = {
  total_requests: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  error_rate: number;
  requests_by_hour: Array<{ hour: string; count: number; avg_latency: number }>;
  top_apis: Array<{ api_path: string; count: number; avg_latency: number }>;
  status_distribution: Array<{ status_code: number; count: number }>;
};

export type TopApisResponse = {
  items: Array<{ api_path: string; count: number; avg_latency: number }>;
  hours: number;
};

export type ApiKeyStatsResponse = {
  items: Array<{
    key_id: string;
    key_name: string;
    total_calls: number;
    avg_latency: number;
    error_count: number;
  }>;
  hours: number;
};

export type ApprovalItem = {
  id: string;
  rule_id: string;
  version: number;
  requestor: string;
  reviewer: string | null;
  status: string;
  comment: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type ApprovalListResponse = {
  items: ApprovalItem[];
  limit: number;
  offset: number;
};

export type PlaygroundEntry = {
  id: number;
  name: string;
  body: string;
  traffic: string;
  output: string;
  busy: boolean;
};

export type ApiBuilderEntry = {
  id: number;
  name: string;
  fields: Array<{ key: string; value: string }>;
  output: string;
  busy: boolean;
};

export type ApiProduct = {
  id: string;
  name: string;
  description: string | null;
  rule_ids: string[] | null;
  status: string;
  tags: string[] | null;
  documentation_url: string | null;
  pricing_tiers: PricingTier[] | null;
  owner: string;
  created_at: string;
  updated_at: string;
};

export type PricingTier = {
  name: string;
  rate_limit_rps: number;
  quota_daily: number;
  quota_monthly: number;
  price_monthly: number;
};

export type Subscription = {
  id: string;
  api_key_id: string;
  product_id: string;
  plan: string;
  rate_limit_rps: number | null;
  quota_daily: number | null;
  status: string;
  expires_at: string | null;
  created_at: string;
};

export type SubscriptionUsage = {
  subscription_id: string;
  api_key_id: string;
  calls_24h: number;
  calls_today: number;
  quota_daily: number | null;
  quota_used_pct: number | null;
};

export type CircuitBreaker = {
  id: string;
  api_path: string;
  failure_threshold: number;
  recovery_timeout_sec: number;
  half_open_max: number;
  retry_count: number;
  retry_delay_ms: number;
  timeout_ms: number;
  status: string;
  created_at: string;
};

export type ProtocolConfig = {
  id: string;
  api_path: string;
  protocol: string;
  description: string | null;
  config_json: string | null;
  status: string;
  created_at: string;
};

export type DataClassification = {
  id: string;
  api_path: string;
  data_category: string;
  contains_pii: boolean;
  gdpr_relevant: boolean;
  retention_days: number;
  notes: string | null;
  classified_by: string | null;
  created_at: string;
};

export type PluginConfig = {
  id: string;
  name: string;
  plugin_type: string;
  hook_point: string;
  config_json: string | null;
  priority: number;
  status: string;
  created_at: string;
};

export type ApiProductListResponse = { items: ApiProduct[]; limit: number; offset: number };
export type SubscriptionListResponse = { items: Subscription[]; limit: number; offset: number };
export type CircuitBreakerListResponse = { items: CircuitBreaker[]; limit: number; offset: number };
export type ProtocolConfigListResponse = { items: ProtocolConfig[]; limit: number; offset: number };
export type DataClassificationListResponse = { items: DataClassification[]; limit: number; offset: number };
export type PluginConfigListResponse = { items: PluginConfig[]; limit: number; offset: number };

// ---- User & Auth types ----

export type UserResponse = {
  id: string;
  username: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  status: string;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UserListResponse = {
  items: UserResponse[];
  limit: number;
  offset: number;
};

export type LoginResponse = {
  token: string;
  user: UserResponse;
};

export type SessionResponse = {
  id: string;
  client_ip: string | null;
  user_agent: string | null;
  expires_at: string;
  created_at: string;
  current: boolean;
};

export type NotificationItem = {
  id: string;
  type: string;
  channel: string;
  title: string;
  message: string;
  read: boolean;
  email_sent: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type LoginHistoryItem = {
  id: number;
  username_attempt: string;
  client_ip: string | null;
  user_agent: string | null;
  success: boolean;
  failure_reason: string | null;
  created_at: string;
};

// LLM Gateway types
export type LlmProvider = {
  id: string;
  name: string;
  provider_type: string;
  endpoint_url: string;
  api_key_env: string | null;
  model_name: string;
  cost_per_1k_input: number;
  cost_per_1k_output: number;
  max_tokens: number;
  priority: number;
  status: string;
};

export type LlmProviderListResponse = { items: LlmProvider[] };

export type PromptTemplate = {
  id: string;
  name: string;
  template_text: string;
  variables: string[] | null;
  version: number;
  status: string;
  created_at: string;
};

export type PromptTemplateListResponse = { items: PromptTemplate[] };

export type LlmRouteResponse = {
  provider: string;
  model: string;
  response: string;
  input_tokens: number;
  output_tokens: number;
  cost: number;
  latency_ms: number;
};
