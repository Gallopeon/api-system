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
├── lib.rs         ← module declarations + run() + router assembly + health checks
├── config.rs      ← Settings, AppState, AuthSettings, env parsing, CORS, tracing
├── db.rs          ← pool init, schema bootstrap, seed functions
├── auth.rs        ← AuthContext, middleware, RBAC, JWT, AppError
├── types/         ← Request/response structs, split by domain (rule, api_key, rate_limit, metrics, approval, llm, user, system, validation)
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

## Git Workflow (Production Grade)

This project follows a **trunk-based development with short-lived feature branches** model, optimized for a single-developer or small-team CI/CD pipeline.

### Branch strategy

```
main          ← Production-ready. Always deployable. Protected.
  └── dev     ← Integration branch. All feature work merges here first.
       └── feature/<slug>  ← One feature per branch. Short-lived (hours, not days).
       └── fix/<slug>      ← Bug fixes not urgent enough for hotfix.
       └── hotfix/<slug>   ← Critical production fixes. Branch off main, merge to both.
```

**Rules**:
- `main` is always green. Before merging to main, the full test suite + build must pass.
- `dev` is the default working branch. Start all feature work from `dev`.
- Feature branches are **short-lived** — merge back within the same coding session if possible.
- Never commit directly to `main`. Only merge from `dev` or `hotfix/*`.
- Branch naming: `feature/`, `fix/`, `hotfix/` prefix, lowercase, hyphens for spaces. Example: `feature/advanced-crud-panels`.

### Commit conventions

**Format**: `<type>(<scope>): <subject>`

| Type | Usage |
|------|-------|
| `feat` | New feature or panel |
| `fix` | Bug fix |
| `refactor` | Code restructuring, no behavior change |
| `perf` | Performance improvement |
| `docs` | Documentation or CLAUDE.md updates |
| `style` | Formatting, linting |
| `chore` | Build, CI, dependencies, config |

**Scope** examples: `backend`, `frontend`, `auth`, `gateway`, `docker`, `k8s`

**Subject rules**:
- English, imperative mood ("add" not "added")
- ≤ 72 characters
- No trailing period

**Examples**:
```
feat(backend): add user CRUD handlers with bcrypt auth
feat(frontend): create UserCenterPanel with profile and security tabs
fix(auth): resolve missing bearer token on dev-mode bypass
refactor(backend): split handlers.rs into per-domain modules
chore(docker): add ADMIN_DEFAULT_PASSWORD env variable
```

### Commit granularity

**One commit = one logical change.** A reviewer should understand the change from the commit message alone.

| Good (single concern) | Bad (mixed concerns) |
|-----------------------|----------------------|
| "add login handler and JWT creation" | "add login, user CRUD, refactor types, fix warnings" |
| "create AdvancedPanel with tabbed layout" | "advanced panel + sidebar fix + css tweaks + todo" |
| "fix circuit breaker macro type mismatch" | "fix bugs" |

**When to commit**:
- **After each completed step** in a multi-step feature. If the plan has 5 steps, that's at least 5 commits.
- **Before switching context** (e.g., moving from backend to frontend).
- **After fixing a bug discovered during testing.**
- **NOT mid-debugging** or with known-broken code. Every commit must build.

### What NOT to commit

Enforced via `.gitignore`. These must NEVER be staged:

| Category | Examples | Why |
|----------|----------|-----|
| Secrets/Credentials | `.env`, `*.local`, `credentials.json` | Security |
| Build artifacts | `target/`, `.next/`, `node_modules/`, `*.tsbuildinfo` | Reproducible from source |
| IDE files | `.idea/`, `.vscode/`, `*.swp` | Personal preference |
| OS files | `.DS_Store`, `Thumbs.db` | Noise |
| Temp scripts | `*.py` one-off migration scripts, `*.tmp` | Not source code |
| Claude runtime | `.claude/plans/`, `.claude/cache/`, `.claude/plugins/` | Auto-generated |
| Settings | `.claude/settings.local.json` | Per-developer |

### Pre-commit checklist

Before every commit, run:

```bash
# Backend changes
cd backend && cargo build --release    # MUST pass with zero errors
cargo test                             # MUST pass

# Frontend changes
cd frontend && npm run build           # MUST pass
npm run lint                           # MUST pass (warnings OK, errors NOT)
```

**Do NOT commit code that fails to build.** If you discover a build error, fix it before committing.

### Release tags

Production releases are tagged on `main`:

```bash
git tag -a v0.2.0 -m "Release v0.2.0: user center, TOTP, advanced CRUD"
```

**Semantic versioning**: `MAJOR.MINOR.PATCH`
- **MAJOR**: Breaking API changes, database schema renames
- **MINOR**: New features, new endpoints, new panels
- **PATCH**: Bug fixes, performance, docs

### Rollback

To roll back a file to its state at a previous commit:

```bash
git log --oneline -- <file>          # Find the target commit
git checkout <commit> -- <file>      # Restore single file
git checkout <commit> -- .           # Restore entire working tree (DANGER — confirm first)
```

To revert an entire commit (preserves history):

```bash
git revert <commit>                  # Creates a new commit that undoes the target
```

### Mandatory commit after every change

**Every code modification MUST be followed by a git commit.** This is non-negotiable.

- Commit immediately after completing a logical unit of work — do NOT batch multiple unrelated changes into one commit.
- Before committing, verify the change compiles/builds (`cargo build --release` or `npm run build`).
- If a change spans backend + frontend, commit each side separately with the appropriate scope prefix.
- Commit messages follow the `type(scope): subject` format defined above.
- After committing, verify `git status` shows a clean working tree.

**Why**: Uncommitted changes accumulate and become impossible to review or rollback independently. A dirty working tree at the end of a session means lost context. Every commit is a save point.

**How to apply**: After any `Edit`, `Write`, or `Bash` that changes source code, immediately stage and commit before moving to the next task. If the user asks you to do multiple things, commit after each one.

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
│   ├── useLlmGateway.ts            ← LLM Gateway: providers, templates, routing (177 lines)
│   ├── useUserProfile.ts           ← User profile hook (257 lines)
│   └── useUsers.ts                 ← User management CRUD hook (138 lines)
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx              ← Top bar: health status + lang + user (117 lines)
│   │   └── Sidebar.tsx             ← Menu + quick stats (98 lines)
│   ├── ui/
│   │   └── Toast.tsx               ← Notification toast with auto-dismiss (52 lines)
│   └── features/
│       ├── DashboardPanel.tsx      ← KPI cards (89 lines)
│       ├── RulesPanel.tsx          ← Rule library + editor form (181 lines)
│       ├── VersionsPanel.tsx       ← Rollback + diff visualizer (106 lines)
│       ├── PlaygroundPanel.tsx     ← Data entries + batch transform + expr eval (176 lines)
│       ├── ApiBuilderPanel.tsx     ← No-code rule CRUD + data entries (354 lines)
│       ├── ApiKeysPanel.tsx        ← API key create/list/toggle/delete (326 lines)
│       ├── RateLimitsPanel.tsx     ← Rate limit create/list/toggle/delete (103 lines)
│       ├── ApprovalsPanel.tsx      ← Approval workflow (172 lines)
│       ├── AnalyticsPanel.tsx      ← KPI + bar chart + top APIs + status dist (159 lines)
│       ├── AuditLogPanel.tsx       ← Audit log table (71 lines)
│       ├── OpenApiPanel.tsx        ← Generate + import OpenAPI specs (165 lines)
│       ├── LlmGatewayPanel.tsx     ← LLM route + providers + templates (267 lines)
│       ├── AdvancedPanel.tsx       ← Tab router for advanced features (95 lines)
│       ├── AdvancedProductsTab.tsx      ← Products CRUD (108 lines)
│       ├── AdvancedSubscriptionsTab.tsx ← Subscriptions CRUD (84 lines)
│       ├── AdvancedCircuitBreakersTab.tsx ← Circuit breakers CRUD (93 lines)
│       ├── AdvancedProtocolsTab.tsx    ← Protocols CRUD (80 lines)
│       ├── AdvancedClassificationsTab.tsx ← Data classifications CRUD (85 lines)
│       ├── AdvancedPluginsTab.tsx      ← Plugins CRUD (84 lines)
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
├── lib.rs               ← 174 lines. Module declarations, pub use, run(), router assembly, health checks.
├── config.rs            ← 85 lines. AppState, Settings, AuthSettings, env parsing, CORS, tracing.
├── db.rs                ← 248 lines. MySQL pool init, bootstrap_schema(), seed_settings(), seed_admin().
├── auth.rs              ← 325 lines. AuthContext, middleware, JWT, RBAC, permissions. Also defines AppError.
├── types/               ← Request/response structs, split by domain. All under 500 lines.
│   ├── mod.rs           ← Re-exports all sub-modules.
│   ├── rule.rs          ← TransformRule, GrayRelease, ConditionalRule, Pagination, all rule request/response types (350 lines).
│   ├── api_key.rs       ← API key types (80 lines).
│   ├── validation.rs    ← ValidateRequest, ValidationResult, ValidationErrorDetail (29 lines).
│   ├── rate_limit.rs    ← Rate limit types + defaulters (106 lines).
│   ├── metrics.rs       ← IngestMetrics, Analytics, TopApi, MetricsOverview types (91 lines).
│   ├── approval.rs      ← Approval types (60 lines).
│   ├── llm.rs           ← LLM Gateway types + defaulters (87 lines).
│   ├── user.rs          ← Login, User, Session, LoginHistory, TOTP, Preferences types (161 lines).
│   └── system.rs        ← SystemSettingItem, UpdateSettingRequest (17 lines).
├── engine/              ← Pure business logic. Zero HTTP/DB dependencies. Unit-testable.
│   ├── mod.rs
│   ├── transform.rs     ← apply_transform, transform_payload, transform_object, apply_conditional_rules, mask_value
│   ├── expression.rs    ← eval_expression, validate_expression_syntax, parse_compare_predicate, get_value_by_path
│   ├── gray_release.rs  ← resolve_effective_rule, choose_variant, stable_bucket, apply_gray_overrides
│   ├── diff.rs          ← diff_value (recursive JSON diff)
│   ├── validation.rs    ← validate_json, validate_rule_request, validate_transform_rule
│   ├── openapi.rs       ← build_openapi_spec, build_overlay_spec, derive_schemas_from_rule
│   └── crypto.rs        ← generate_api_key, key_hash
└── handlers/             ← HTTP handlers, one file per domain entity
    ├── mod.rs
    ├── common.rs         ← Shared: write_audit_log, load_rule_detail, cache_rule, row_to_json, crud_handlers! macro
    ├── rules.rs          ← create_rule, update_rule, get_rule, delete_rule, list_rules
    ├── versions.rs       ← list_rule_versions, get_rule_diff, rollback_rule_version
    ├── transform_handlers.rs ← preview_transform, execute_transform, eval_expression_handler
    ├── api_keys.rs       ← create/list/get/update/delete/validate_api_key
    ├── rate_limits.rs    ← create/list/update/delete/check_rate_limit
    ├── approvals.rs      ← create/list/get/review_approval
    ├── metrics.rs        ← ingest_metrics, get_analytics, get_top_apis, get_api_key_stats, get_metrics_overview
    ├── audit.rs          ← list_audit_logs
    ├── auth_user.rs      ← login, get_my_profile, update_my_profile, change_my_password, list_users, create_user, get_user, update_user, delete_user, session/login_history handlers, TOTP handlers, preferences handlers
    ├── products.rs       ← create/list/get/update/delete_product, create/list/get/update/delete_subscription
    ├── circuit_breakers.rs ← create/list/get/update/delete_circuit_breaker
    ├── protocols.rs      ← create/list/get/update/delete_protocol_config
    ├── classifications.rs ← create/list/get/update/delete_data_classification
    ├── plugins.rs        ← create/list/get/update/delete_plugin_config
    ├── llm.rs            ← llm_route (real API call+failover), providers full CRUD, templates full CRUD (316 lines)
    ├── openapi.rs        ← get_openapi_spec
    ├── validation_handlers.rs ← validate_request, validate_response
    ├── system.rs         ← list_system_settings, update_system_setting
    └── all_remaining.rs  ← Unclassified/legacy handlers pending categorization
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
- **Permissions**: 30 granular permissions defined in `auth.rs`. Each handler calls `ensure_permission()` with the appropriate permission. Data plane endpoints (`/api/v1/*`) skip permission checks — they are authenticated by the gateway via API keys.

| Role | Capabilities |
|------|-------------|
| **Admin** | All permissions (full CRUD, user management, system settings) |
| **Reviewer** | Read all, publish rules, review approvals, manage LLM, self-profile |
| **Editor** | Read all, write rules/API keys/rate limits/products/circuit breakers/protocols/classifications/plugins, transform, self-profile. Cannot publish or approve. |
| **Viewer** | Read-only: rules, API keys, rate limits, approvals, metrics, audit, products, circuit breakers, LLM routing, self-profile. Cannot write, publish, or approve. |
- **Database**: MySQL tables auto-created on startup in `db::bootstrap_schema()`: `rule_configs`, `rule_versions`, `audit_logs`, `api_keys`, `rate_limit_configs`, `metrics_ingest`, `approvals`, `llm_providers`, `prompt_templates`, `llm_usage_logs`, `api_products`, `subscriptions`, `circuit_breakers`, `protocol_configs`, `data_classifications`, `plugin_configs`, `users`, `user_sessions`, `login_history`, `user_totp`, `system_settings`. Redis caches rule detail reads (prefix `rule:`, TTL 300s default).
- **Error handling**: `AppError` enum in `auth.rs` implements `IntoResponse`, mapped to appropriate HTTP status codes.
- **Audit**: All mutating operations write to `audit_logs` table via `write_audit_log()`.

### Handler reference by domain

The old `handlers.rs` monolith (~4600 lines) has been split into per-domain files under `handlers/`. When adding a new endpoint, add it to the existing handler file for that domain. If no handler file exists, create one and add `pub mod` to `handlers/mod.rs`.

| Domain | File | Key handlers |
|--------|------|-------------|
| Rules | `handlers/rules.rs` | create_rule, update_rule, get_rule, delete_rule, list_rules |
| Versions | `handlers/versions.rs` | list_rule_versions, get_rule_diff, rollback_rule_version |
| Transform | `handlers/transform_handlers.rs` | preview_transform, execute_transform, eval_expression_handler |
| API Keys | `handlers/api_keys.rs` | create/list/get/update/delete/validate_api_key |
| Rate Limits | `handlers/rate_limits.rs` | create/list/update/delete/check_rate_limit |
| Approvals | `handlers/approvals.rs` | create/list/get/review_approval |
| Metrics | `handlers/metrics.rs` | ingest_metrics, get_analytics, get_top_apis, get_api_key_stats, get_metrics_overview |
| Audit | `handlers/audit.rs` | list_audit_logs |
| Auth & Users | `handlers/auth_user.rs` | login, CRUD users, profile, password, sessions, login history, TOTP, preferences |
| Products | `handlers/products.rs` | products CRUD, subscriptions CRUD |
| Circuit Breakers | `handlers/circuit_breakers.rs` | circuit breaker CRUD |
| Protocols | `handlers/protocols.rs` | protocol config CRUD |
| Classifications | `handlers/classifications.rs` | data classification CRUD |
| Plugins | `handlers/plugins.rs` | plugin config CRUD |
| LLM | `handlers/llm.rs` | llm_route (real API call with failover), providers full CRUD, prompt templates full CRUD |
| OpenAPI | `handlers/openapi.rs` | get_openapi_spec |
| Validation | `handlers/validation_handlers.rs` | validate_request, validate_response |
| System | `handlers/system.rs` | list_system_settings, update_system_setting |
| Common | `handlers/common.rs` | write_audit_log, load_rule_detail, cache_rule, row_to_json, crud_handlers! macro |

### Transform rule configuration model

A `TransformRule` has: `whitelist_fields`, `renames`, `masked_fields`, `computed_literals`, `remove_nulls`, `conditional_rules` (expression + actions), `gray_release` (optional A/B variants with override configs), and `pagination` (data key mapping). All are optional/empty by default.
