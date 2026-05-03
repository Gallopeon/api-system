# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is an **API Control Plane** — a system that applies transformation rules (whitelist/rename/mask/paginate) to HTTP API responses in transit. It has a Rust backend, a Next.js frontend dashboard, and an OpenResty reverse proxy gateway, all orchestrated via Docker Compose.

```
Gateway (OpenResty :80) ──► Frontend (Next.js :3000)
                        ──► Backend  (Rust :8080) ──► MySQL
                                                    ──► Redis
```

- **Backend** (`backend/`): Rust `axum` server. Source split across `main.rs` (entry), `lib.rs` (router/setup), `handlers.rs` (~55 handlers), `types.rs` (all structs/enums), `auth.rs` (middleware/RBAC). Three MySQL tables auto-created on startup (`rule_configs`, `rule_versions`, `audit_logs`). Redis caches rule detail reads (prefix `rule:`, TTL 300s by default).
- **Frontend** (`frontend/`): Next.js 14 App Router SPA. Auth via NextAuth credentials provider (hardcoded `admin/admin`). Uses Tailwind CSS 4, `lucide-react` icons, and a custom `i18n.tsx` context (zh/en).
- **Gateway** (`infra/openresty/`): OpenResty reverse proxy. Routes `/api/*` to backend, `/api/auth/*` to frontend, and `/` to frontend. Per-IP rate limiting at 120 r/s with burst 240 on `/api/` paths.
- **Infra**: MySQL init script at `infra/mysql/init/`, K8s base manifests at `deploy/k8s/base.yaml`.

---

## CRITICAL: Development Rules

These rules are non-negotiable. Violating them creates tech debt that blocks team productivity.

### File size limits

| Layer | Max per file | If exceeded |
|-------|-------------|-------------|
| Frontend component | **300 lines** | Split into sub-components or extract hook |
| Frontend hook | **300 lines** | Split by feature area |
| Backend handler module | **400 lines** | Split by domain entity |
| Backend types | **500 lines** | Split by domain (`types/rule.rs`, `types/api_key.rs`, etc.) |
| Any single file | **500 lines** | Must be justified in a code comment at the top |

**Rationale**: A file exceeding these limits is a God File — it cannot be reviewed, understood, or tested in isolation. Every such file we fixed in the past (frontend `page.tsx` at 3119 lines, backend `handlers.rs` at 4464 lines) cost hours to refactor. Do not create new ones.

### When to split

- **A component/handler does more than one thing** → split
- **Two developers might touch different parts of the file** → split
- **You can name a cohesive responsibility** (e.g. "rate limit handlers", "expression evaluator") → that's a new file
- **Business logic mixed with HTTP/I/O** → extract pure logic to an engine/service module

### Frontend rules

```
frontend/
├── app/           ← Page routes ONLY. No business logic beyond layout assembly.
├── components/
│   ├── ui/        ← Reusable generic UI (Modal, Toast, etc.)
│   ├── layout/    ← Shell: Navbar, Sidebar
│   └── features/  ← One component per tab/feature area
├── hooks/         ← One hook per feature area. Hook = state + API calls.
├── lib/           ← Pure functions, types, constants. NO React imports.
└── i18n/          ← Translation context
```

- `page.tsx` must stay under **200 lines**. It assembles layout + delegates to feature components.
- Feature components receive data via props, never fetch data directly.
- API calls live in hooks (`hooks/use*.ts`) or `lib/api.ts`. Components only render.
- New tabs/features get a new file in `components/features/`. Never inline into `page.tsx`.
- Shared UI patterns (modals, toasts, confirm dialogs) must be extracted to `components/ui/`.

### Backend rules

```
backend/src/
├── main.rs        ← #[tokio::main] entry point ONLY (<10 lines)
├── lib.rs         ← module declarations + run() + router assembly
├── config.rs      ← Settings, AppState, env parsing, CORS, tracing
├── db.rs          ← pool init, schema bootstrap
├── auth.rs        ← AuthContext, middleware, RBAC, JWT
├── cache.rs       ← Redis helpers
├── types/         ← Request/response structs, split by domain
├── handlers/      ← HTTP handlers, ONE file per domain entity
└── engine/        ← Pure business logic, ZERO HTTP dependencies
```

- **Handlers** (`handlers/`) handle HTTP concerns: extract params, call engine/service, return response. They do NOT contain business logic.
- **Engine** (`engine/`) contains pure functions: transform pipeline, expression evaluator, gray release, validation. These must be unit-testable without HTTP or DB.
- A handler file over **400 lines** means the domain entity is too coarse or business logic has leaked in.
- When adding a new API endpoint, add it to the existing handler file for that domain. If no handler file exists for that domain, create one.

### Naming conventions

- **Files**: `kebab-case` for frontend (`api-keys-panel.tsx`), `snake_case` for backend (`api_keys.rs`)
- **React components**: `PascalCase` matching filename (`ApiKeysPanel.tsx` → `<ApiKeysPanel />`)
- **Hooks**: `use` prefix + camelCase (`useApiKeys.ts` → `useApiKeys()`)
- **Backend handlers**: `snake_case` matching CRUD action (`create_api_key`, `list_api_keys`)

### When adding a new feature

1. **Backend**: Does it touch an existing domain? Add to that handler file. New domain? Create `handlers/new_domain.rs` + `types/new_domain.rs` + register route in `lib.rs`.
2. **Frontend**: Create `components/features/NewFeaturePanel.tsx` + `hooks/useNewFeature.ts` + add tab entry in `components/layout/Sidebar.tsx` + wire in `page.tsx`.
3. **Never**: Add inline handlers to `lib.rs`, inline new tabs into `page.tsx`, or put business logic in components.

### Documentation update requirement

Every feature addition or structural change MUST update the relevant documentation files. This is not optional.

| Change type | Files to update |
|-------------|----------------|
| New backend endpoint | Add handler signature to "Backend handlers.rs sections" table in this file |
| New frontend tab/feature | Add to "Current Frontend Structure" tree in this file |
| New Rust module or file split | Update "Current Backend Structure" tree in this file |
| File exceeds size limit is fixed | Update the file's line count in this file |
| New directory created | Update the relevant structure tree in this file |
| New npm/cargo dependency | Document it in the relevant "patterns" section |
| New MySQL table or Redis key pattern | Add to the relevant patterns section |

**Why**: Without this rule, the CLAUDE.md structure trees and line counts drift from reality within 2-3 PRs. An outdated structure index is worse than none — it misleads future developers (human and AI) about where code lives.

**How to apply**: After any code change that touches file organization, re-read the CLAUDE.md structure sections and verify they match reality. Update line counts, add new files, rename moved modules. Do this in the same commit as the code change.

---

## Commands

### Full stack (Docker)

```bash
docker compose up -d --build              # start all services
docker compose up --build -d frontend     # rebuild frontend only
docker compose up --build -d backend      # rebuild backend only
```

Access the panel at `http://localhost/`. Health checks at `/health/live` and `/health/ready`.

### Frontend (local dev)

```bash
cd frontend
npm run dev          # starts Next.js dev server on port 3000
npm run build        # production build (output: standalone)
npm run lint         # ESLint
```

For local dev without gateway, set `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080` in `frontend/.env.local`.

### Backend (local dev)

```bash
cd backend
cargo build --release --locked   # build
cargo test                        # run tests
```

Requires MySQL and Redis running locally. Copy `backend/.env.example` to `backend/.env` and adjust connection strings.

### Load testing & SLO

```powershell
pwsh tests/perf/run-k6.ps1 -BaseUrl http://localhost -Duration 60s -Vus 40 -Rps 800
pwsh scripts/check-slo.ps1 -SummaryJson tests/perf/k6-summary.json -P95Ms 50 -P99Ms 150 -ErrRate 0.001
```

### K8s progressive rollout with SLO gate

```powershell
pwsh scripts/k8s-rollout.ps1 -Namespace api-control-plane -Service backend -Image your-registry/backend:tag -RunSloGate -BaseUrl http://localhost -Duration 60s -Vus 40 -Rps 800 -P95Ms 50 -P99Ms 150 -ErrRate 0.001
```

---

## Current Frontend Structure

```
frontend/
├── app/
│   ├── page.tsx                    ← 420 lines, route entry + login
│   ├── layout.tsx                  ← Root layout
│   ├── providers.tsx               ← NextAuth SessionProvider
│   ├── i18n.tsx                    ← useI18n() context hook
│   ├── globals.css
│   └── api/auth/[...nextauth]/route.ts
├── lib/
│   ├── api.ts                      ← endpoint(), apiFetch(), getApiToken()
│   ├── constants.ts                ← cardClass, inputClass, btnPrimary, etc.
│   ├── types.ts                    ← All shared TypeScript interfaces
│   └── utils.ts                    ← parseJson, formatRenames, fmtRelativeExpiry, etc.
├── hooks/
│   ├── useNotification.ts          ← Toast notification state (27 lines)
│   ├── useRules.ts                 ← Rules CRUD + versions + diff (286 lines)
│   ├── usePlayground.ts            ← Playground entries + transform (149 lines)
│   ├── useApiKeys.ts               ← API Keys CRUD + toggle/delete (117 lines)
│   ├── useRateLimits.ts            ← Rate Limits CRUD (143 lines)
│   ├── useApiBuilder.ts            ← API Builder: rule CRUD + data entries + presets (216 lines)
│   ├── useDashboard.ts             ← Metrics, AuditLog, Approvals, Analytics hooks (188 lines)
│   ├── useUserProfile.ts           ← User profile hook (257 lines)
│   └── useUsers.ts                 ← User management CRUD hook (138 lines)
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx              ← Top bar: health status + lang + user (117 lines)
│   │   └── Sidebar.tsx             ← Menu + quick stats (98 lines)
│   ├── ui/
│   │   └── Toast.tsx               ← Notification toast with auto-dismiss (52 lines)
│   └── features/
│       ├── DashboardPanel.tsx      ← KPI cards (51 lines)
│       ├── RulesPanel.tsx          ← Rule library + editor form (181 lines)
│       ├── VersionsPanel.tsx       ← Rollback + diff visualizer (106 lines)
│       ├── PlaygroundPanel.tsx     ← Data entries + batch transform + expr eval (176 lines)
│       ├── ApiBuilderPanel.tsx     ← No-code rule CRUD + data entries (354 lines)
│       ├── ApiKeysPanel.tsx        ← API key create/list/toggle/delete (159 lines)
│       ├── RateLimitsPanel.tsx     ← Rate limit create/list/toggle/delete (103 lines)
│       ├── ApprovalsPanel.tsx      ← Approval workflow (172 lines)
│       ├── AnalyticsPanel.tsx      ← KPI + bar chart + top APIs + status dist (159 lines)
│       ├── AuditLogPanel.tsx       ← Audit log table (71 lines)
│       ├── OpenApiPanel.tsx        ← Generate + import OpenAPI specs (165 lines)
│       ├── LlmGatewayPanel.tsx     ← LLM route + prompt templates (64 lines)
│       ├── AdvancedPanel.tsx       ← Products/circuit breakers/plugins (64 lines)
│       ├── PortalPanel.tsx         ← API catalog + self-service key request (136 lines)
│       ├── ManualPanel.tsx         ← Full user manual (404 lines)
│       ├── UserCenterPanel.tsx     ← User profile/settings (431 lines)
│       └── UserManagementPanel.tsx ← Admin user management (280 lines)
```

### Frontend patterns

- **API calls**: `lib/api.ts` exports `apiFetch(path, init, accessToken?)` and `endpoint(path)`. All hooks use these; components never call fetch directly.
- **i18n**: `useI18n()` hook from `app/i18n.tsx`. The `t(en, zh)` helper returns the value matching current language. Every user-facing string uses it.
- **Auth**: NextAuth credentials provider with JWT sessions. `useSession()` hook gates the dashboard. Login form renders when unauthenticated.
- **Types**: All TypeScript interfaces in `lib/types.ts`. Mirrors backend Rust serialization structs exactly.

---

## Current Backend Structure

```
backend/src/
├── main.rs              ← 4 lines. #[tokio::main] entry point.
├── lib.rs               ← ~420 lines. AppState, Settings, run(), bootstrap_schema(), router assembly.
├── auth.rs              ← 308 lines. AuthContext, middleware, JWT, RBAC, permissions. Also defines AppError.
├── types.rs             ← ~880 lines. All request/response structs, enums, FromRow impls. ⚠️ Candidate for types/ split.
├── handlers.rs          ← ~4600 lines. ALL ~70 HTTP handlers + DB helpers + shared utilities. ⚠️ NEXT TO SPLIT.
├── engine/              ← Pure business logic. Zero HTTP/DB dependencies. Unit-testable.
│   ├── mod.rs
│   ├── transform.rs     ← apply_transform, transform_payload, transform_object, apply_conditional_rules, mask_value
│   ├── expression.rs    ← eval_expression, validate_expression_syntax, parse_compare_predicate, get_value_by_path
│   ├── gray_release.rs  ← resolve_effective_rule, choose_variant, stable_bucket, apply_gray_overrides
│   ├── diff.rs          ← diff_value (recursive JSON diff)
│   ├── validation.rs    ← validate_json, validate_rule_request, validate_transform_rule
│   ├── openapi.rs       ← build_openapi_spec, build_overlay_spec, derive_schemas_from_rule
│   └── crypto.rs        ← generate_api_key, key_hash
├── handlers/            ← Directory ready for handler split (empty, handlers.rs still in root)
└── types/               ← Directory ready for type split (empty, types.rs still in root)
```

### Engine module

The `engine/` module contains pure business logic functions extracted from `handlers.rs`. These functions:
- Have ZERO dependencies on HTTP (axum), database (sqlx), or Redis
- Only depend on `serde_json`, `std`, and crate types
- Can be unit-tested without mocking any infrastructure
- Are imported via `use crate::engine::*;`

When adding new transform/validation/expression logic, add it to the appropriate engine file, NOT to handlers.

### Backend patterns

- **Router**: Defined in `lib.rs` `run()`. All `/api/v1/*` routes pass through `auth_middleware` (except health/live, health/ready).
- **Auth**: `AuthContext` extraction via `auth_middleware`. JWT validation (HS256). RBAC with 4 roles (admin/reviewer/editor/viewer). When `AUTH_ENABLED=false`, all requests get `Role::Admin` with no checks.
- **Database**: Three MySQL tables auto-created on startup: `rule_configs`, `rule_versions`, `audit_logs`. Redis caches rule detail reads (prefix `rule:`, TTL 300s default).
- **Error handling**: `AppError` enum in `types.rs` implements `IntoResponse`, mapped to appropriate HTTP status codes.
- **Audit**: All mutating operations write to `audit_logs` table via `write_audit_log()`.

### Handlers.rs sections (for reference when splitting)

| Lines (approx) | Section | Functions |
|----------------|---------|-----------|
| 21-274 | Rule CRUD | `create_rule`, `update_rule`, `get_rule`, `delete_rule`, `list_rules` |
| 275-380 | Versions | `list_rule_versions`, `get_rule_diff`, `rollback_rule_version` |
| 382-446 | Expression eval | `eval_expression_handler` |
| 447-773 | Audit logs | `list_audit_logs` |
| 774-899 | API Keys | `create_api_key`, `list_api_keys`, `get_api_key`, `update_api_key`, `delete_api_key`, `validate_api_key` |
| 900-1248 | Rate Limits | `create_rate_limit`, `list_rate_limits`, `update_rate_limit`, `delete_rate_limit`, `check_rate_limit` |
| 1249-1357 | Validation | `validate_request`, `validate_response`, `validate_against_rule`, `validate_json` |
| 1358-1560 | Metrics | `ingest_metrics`, `get_analytics`, `get_top_apis`, `get_api_key_stats`, `get_metrics_overview` |
| 1561-1736 | Approvals | `create_approval`, `get_approval`, `list_approvals`, `review_approval` |
| 1737-1977 | LLM Gateway | `create_llm_provider`, `list_llm_providers`, `create_prompt_template`, `list_prompt_templates`, `llm_route` |
| 1978-2049 | Products | `create_product`, `list_products`, `create_subscription`, `list_subscriptions` |
| 2050-2124 | Circuit Breakers | `create_circuit_breaker`, `list_circuit_breakers` |
| 2125-2205 | Protocols/Plugins | `create_protocol_config`, `list_protocols`, `create_data_classification`, `list_classifications`, `create_plugin_config`, `list_plugins` |
| 2206-2442 | Transform | `execute_transform`, `preview_transform`, transform engine internals |
| 2443+ | Helpers/private | `load_rule_detail`, `cache_rule`, `write_audit_log`, `validate_rule_request`, `validate_transform_rule`, etc. |

### Transform rule configuration model

A `TransformRule` has: `whitelist_fields`, `renames`, `masked_fields`, `computed_literals`, `remove_nulls`, `conditional_rules` (expression + actions), `gray_release` (optional A/B variants with override configs), and `pagination` (data key mapping). All are optional/empty by default.
