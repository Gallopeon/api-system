# API Control Plane (Rust + Next.js + Redis + MySQL)

This repository bootstraps a modern API control system with a visual panel to adjust response fields.

## Implemented

- Rust backend with low-overhead async stack (`axum + tokio + sqlx`)
- Redis cache for rule detail hot path
- MySQL persistence for rule config and version history
- Version-aware rule model with create/update/list/rollback APIs
- Rule version diff API and one-click rollback support in panel
- Response preview API with whitelist/rename/mask/pagination shaping
- Sandboxed conditional expression rules (`exists`, `contains`, `==`, `!=`, `>=`, `<=`, `>`, `<`, plus `&&` / `||`)
- Expression sandbox evaluation API for safe rule testing
- Gray release (A/B) variant selection with traffic context and force-variant override
- Execute API by `api_path` for runtime transformation
- Audit log persistence and query API with filter support
- Metrics overview API and frontend dashboard panel
- Optional JWT auth middleware with role-based permissions (admin/reviewer/editor/viewer)
- Configurable CORS origin allowlist
- Next.js control panel for rule editing, rule listing, and preview testing
- OpenResty gateway for reverse proxy and ingress rate limiting
- k6 load testing script and PowerShell SLO gate checker
- Rollout script with optional post-deploy SLO gate and auto rollback
- Kubernetes base templates, migration guide, progressive rollout script, and failover drill guide

## Project layout

- `backend`: Rust API service
- `frontend`: Next.js control panel (Node.js)
- `infra/openresty`: gateway config
- `infra/mysql/init`: MySQL init scripts

## Quick start

1. Build and run services:

```bash
docker compose up -d --build
docker compose up --build -d frontend
docker compose up --build -d backend
```

2. Open panel:

- `http://localhost/`

3. Health checks:

- `http://localhost/health/live`
- `http://localhost/health/ready`

## Auth and RBAC

Authentication is always enforced via JWT (HS256). No unauthenticated access.

Backend env vars:

- `JWT_SECRET`: HS256 secret (required)
- `ADMIN_DEFAULT_PASSWORD`: password for the default admin user (required on first run)
- `CORS_ALLOWED_ORIGINS`: comma-separated allowlist, e.g. `http://localhost,http://127.0.0.1:3000`

Frontend env vars:

- `NEXT_PUBLIC_API_BASE_URL`: optional API origin prefix
- `NEXT_PUBLIC_API_TOKEN`: optional bearer token used by panel requests

Role permissions:

- `admin`: all actions
- `reviewer`: read all, publish rules, review approvals, manage LLM, self-profile
- `editor`: read all, CRUD rules/API keys/rate limits/products/circuit breakers/protocols/classifications/plugins, transform, self-profile
- `viewer`: read-only across all domains, transform preview, LLM routing, self-profile

## Core API endpoints

- `POST /api/v1/rules`
- `PUT /api/v1/rules/:id`
- `GET /api/v1/rules`
- `GET /api/v1/rules/:id`
- `GET /api/v1/rules/:id/versions`
- `GET /api/v1/rules/:id/diff?from={v1}&to={v2}`
- `POST /api/v1/rules/:id/rollback`
- `GET /api/v1/audit/logs`
- `GET /api/v1/metrics/overview`
- `POST /api/v1/transform/preview`
- `POST /api/v1/transform/execute`
- `POST /api/v1/transform/expr-eval`

## Example payload: create rule

```json
{
  "name": "user-profile-slim",
  "api_path": "/api/v1/users",
  "status": "draft",
  "note": "first version",
  "config": {
    "whitelist_fields": ["id", "name", "email", "phone"],
    "renames": {
      "name": "display_name",
      "phone": "mobile"
    },
    "masked_fields": ["email", "phone"],
    "computed_literals": {
      "source": "control_panel"
    },
    "remove_nulls": true,
    "pagination": {
      "data_key": "data",
      "total_field": "total",
      "page_field": "page",
      "page_size_field": "page_size"
    }
  }
}
```

## 2C2G tuning defaults in this cut

- OpenResty ingress shaping (`120 r/s per IP`, burst 240)
- Redis constrained to `128MB` with `allkeys-lru`
- MySQL `innodb_buffer_pool_size=256M`
- Backend pool max defaults to `15`

## Expression examples

- `country == "CN" && level >= 3`
- `exists(vip) && vip == true`
- `contains(tags, "gold") || score > 90`

## Gray release sample

```json
{
  "enabled": true,
  "bucket_field": "user_id",
  "variants": [
    {
      "name": "expA",
      "weight": 30,
      "overrides": {
        "computed_literals": {
          "ab_tag": "A"
        }
      }
    },
    {
      "name": "expB",
      "weight": 70,
      "overrides": {
        "computed_literals": {
          "ab_tag": "B"
        }
      }
    }
  ]
}
```

## Load test and SLO gate

1. Run load test:

```powershell
pwsh tests/perf/run-k6.ps1 -BaseUrl http://localhost -Duration 60s -Vus 40 -Rps 800
```

2. Validate SLO:

```powershell
pwsh scripts/check-slo.ps1 -SummaryJson tests/perf/k6-summary.json -P95Ms 50 -P99Ms 150 -ErrRate 0.001
```

Detailed guide: `docs/slo-and-loadtest.md`

## Kubernetes and progressive rollout

- Base manifests: `deploy/k8s/`
- Migration guide: `docs/k8s-migration.md`
- Rollout script: `scripts/k8s-rollout.ps1`
- Failover drills: `docs/failover-drill.md`

Example with SLO gate + auto rollback:

```powershell
pwsh scripts/k8s-rollout.ps1 `
  -Namespace api-control-plane `
  -Service backend `
  -Image your-registry/backend:tag `
  -RunSloGate `
  -BaseUrl http://localhost `
  -Duration 60s -Vus 40 -Rps 800 `
  -P95Ms 50 -P99Ms 150 -ErrRate 0.001
```

## Optional future enhancements

- Policy approval workflow and release gating
- Cost/quota governance for tenant-level limits
