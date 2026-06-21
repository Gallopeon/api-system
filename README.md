<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0-blue" alt="version">
  <img src="https://img.shields.io/badge/Rust-2021-orange" alt="rust">
  <img src="https://img.shields.io/badge/Next.js-16.2-black" alt="nextjs">
  <img src="https://img.shields.io/badge/MySQL-8.4-4479a1" alt="mysql">
  <img src="https://img.shields.io/badge/Redis-7.4-red" alt="redis">
  <img src="https://img.shields.io/badge/OpenResty-1.27-green" alt="openresty">
</p>

<h1 align="center">API Control Plane</h1>

<p align="center">
  A declarative API transformation gateway that intercepts HTTP responses and applies rules in transit — whitelist, rename, mask, paginate, and conditionally transform API payloads without touching upstream services.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#features">Features</a> •
  <a href="docs/USER_MANUAL.md">User Manual</a>
</p>

---

## What It Does

Upstream APIs return data in formats you don't control. This system sits between your consumers and your APIs, applying **declarative transformation rules** to every response in transit:

- **Expose only the fields you want** (whitelist)
- **Rename fields** to match your schema (`user_name` → `name`)
- **Mask sensitive data** automatically (`email`, `phone`, `ssn`)
- **Paginate** any array response with a standard `{ data, meta }` envelope
- **Branch by condition** — different transforms when `vip == true`
- **A/B test variants** — gray release traffic splitting with SHA-256 stable hashing

All configured through a web dashboard. Zero code changes to your upstream services.

---

## Quick Start

```bash
# Clone
git clone https://github.com/Gallopeon/api-system.git
cd api-system

# Configure (edit .env for production secrets)
cp .env.example .env

# Start everything
docker compose up -d --build
```

| Service | URL | Credentials |
|---------|-----|-------------|
| Dashboard | `http://localhost/` | `admin` / `admin` |
| Backend API | `http://localhost:8080` | Bearer token |
| Health check | `http://localhost/health/live` | — |

Rebuild a single service without touching others:

```bash
docker compose up --build -d frontend
docker compose up --build -d backend
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Traffic                        │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  OpenResty Gateway (:80)                                     │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ /admin/*  → JWT auth → Backend Handlers                  │ │
│  │ /api/*    → API Key check → Rate Limit → Backend         │ │
│  │ /         → Frontend SPA (Next.js)                       │ │
│  └─────────────────────────────────────────────────────────┘ │
└───────────┬────────────────────────────────────┬────────────┘
            ▼                                    ▼
┌───────────────────────┐         ┌──────────────────────────┐
│  Next.js 16 Dashboard │         │  Rust Backend (Axum)     │
│  (:3000)              │         │  (:8080)                 │
│  - React 19 + SWR     │         │  - 25+ handler modules   │
│  - Tailwind CSS 4     │         │  - Transform engine      │
│  - NextAuth v4 (JWT)  │         │  - Background tasks      │
│  - i18n (zh / en)     │         │  - RBAC (31 permissions) │
└───────────────────────┘         └──────┬──────────┬────────┘
                                         ▼          ▼
                                  ┌──────────┐ ┌──────────┐
                                  │ MySQL 8.4│ │ Redis 7.4│
                                  │ (20+ tbl)│ │ (cache + │
                                  │          │ │  buffer)  │
                                  └──────────┘ └──────────┘
```

### Request lifecycle (data plane)

```
Client → Gateway
         ├── access_by_lua
         │     ├── API Key cache (L1 shdict) → miss? → subrequest to backend
         │     └── Rate limit check (L2 local counter + backend rule)
         ├── proxy_pass → Backend /api/v1/transform/execute
         │     ├── Load rule from Redis cache (L3, TTL 300s)
         │     ├── Gray release: SHA-256 bucket → pick variant
         │     ├── Apply pipeline: whitelist → rename → mask → conditional
         │     └── Return transformed JSON
         └── log_by_lua → fire-and-forget metrics ingest
```

---

## Features

### Transformation Engine
| Capability | Description |
|-----------|-------------|
| Field whitelist | Emit only declared fields |
| Field rename | `user_name` → `name` mapping |
| Data masking | Strings: `fi****st`, numbers: `***`, objects: `[MASKED]` |
| Computed literals | Inject static values into every response |
| Conditional rules | Branch on `exists()`, `contains()`, `==`/`!=`/`>`/`<` + `&&`/`||` |
| Gray release | SHA-256 stable hashing, weighted variants, per-variant overrides |
| Pagination template | Wrap any array in `{ data: [...], meta: { total, page, page_size } }` |

### API Governance
- **Rule versioning** — every edit creates a new version; diff any two versions; rollback to any point in history
- **Approval workflow** — rule publishing requires reviewer sign-off (create → review → approve/reject)
- **OpenAPI auto-generation** — derive a standard OpenAPI 3.0 spec from a rule's whitelist + rename config
- **Cursor-based pagination** — list rules with `cursor`, filter by `status`, `name`, `api_path`

### Security & RBAC
- **JWT authentication** — HS256, always-on, JTI revocation via Redis
- **31 granular permissions** across 4 roles:

| Role | Scope |
|------|-------|
| Admin | Full CRUD + user management + system settings |
| Reviewer | Read all + publish rules + review approvals |
| Editor | Read all + write rules/keys/limits — no publish or approve |
| Viewer | Read-only everywhere |

- **TOTP 2FA** — setup / verify / disable with QR code
- **Login risk engine** — device fingerprint + IP change + brute-force + time anomaly scoring
- **Brute-force protection** — `/admin/v1/auth/login` rate-limited to 10 requests/minute at the gateway
- **Password policy** — ≥8 chars, uppercase, lowercase, digit

### API Product & Subscription Model
- Package rules as sellable **API Products** with tiered pricing
- **Subscription lifecycle** — create, upgrade (tier-aware), cancel, renew
- **Developer Portal** — product catalog, self-service key request, usage dashboard, integration docs

### Observability & Operations
- **Metrics pipeline** — Redis list buffer → 30s batch flush → MySQL → 5min hourly rollup → 30-day retention
- **Fire-and-forget audit logs** — all mutations logged async via `tokio::spawn`, zero latency on the hot path
- **Notification system** — 12 event types × 2 channels (email + in-app), user-preference filtered
- **Health endpoints** — `/health/live` (liveness) and `/health/ready` (MySQL + Redis deep check)

### Multi-layered Caching

| Layer | Location | TTL | Purpose |
|-------|----------|-----|---------|
| L1 | Gateway Lua shdict | 60s / 10s | API key valid/invalid verdict cache |
| L2 | Gateway proxy disk | 30s | Metrics dashboard query dedup |
| L3 | Redis rule detail | 300s | `rule:{id}` JSON cache |
| L4 | Redis Hash | persistent | `rules:meta` — HGETALL for list_rules |
| L5 | Redis analytics | 300s | `analytics:agg` pre-computed aggregates |
| L6 | Browser SWR | 30s | In-memory + in-flight dedup |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Gateway | OpenResty 1.27 (Nginx + LuaJIT) |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, SWR, NextAuth v4 |
| Backend | Rust 2021, Axum 0.7, SQLx 0.8 (async MySQL), Redis 0.28, JWT (HS256) |
| Database | MySQL 8.4 (utf8mb4), Redis 7.4-alpine |
| Containerization | Docker Compose, multi-stage Dockerfiles with BuildKit cache mounts |

### Key Rust dependencies

```
axum 0.7          sqlx 0.8 (mysql)     redis 0.28 (tokio-comp)
jsonwebtoken 9.3  bcrypt 0.15          totp-rs 5
reqwest 0.12      lettre 0.11 (SMTP)   jsonschema 0.18
```

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Default | Description |
|----------|---------|-------------|
| `MYSQL_ROOT_PASSWORD` | `root` | MySQL root password |
| `MYSQL_URL` | `mysql://root:root@mysql:3306/apictrl` | Backend MySQL connection string |
| `REDIS_URL` | `redis://redis:6379` | Backend Redis connection string |
| `JWT_SECRET` | *(must set)* | HS256 signing key — **change in production** |
| `ADMIN_DEFAULT_PASSWORD` | `admin` | Initial admin account password |
| `CACHE_TTL_SECONDS` | `300` | Redis rule detail cache TTL |
| `NEXTAUTH_SECRET` | *(must set)* | NextAuth session encryption key |
| `CORS_ALLOWED_ORIGINS` | `http://localhost` | Comma-separated allowed origins |

---

## Project Structure

```
.
├── backend/
│   └── src/
│       ├── main.rs          ← entry point (<10 lines)
│       ├── lib.rs           ← router + run()
│       ├── config.rs        ← env parsing, CORS, tracing
│       ├── auth.rs          ← JWT middleware, RBAC, AppError
│       ├── db/              ← MySQL bootstrap + seeding (by domain)
│       ├── types/           ← request/response structs (by domain)
│       ├── engine/          ← pure business logic (transform, expression, gray release, validation)
│       └── handlers/        ← HTTP handlers, one file per domain
├── frontend/
│   ├── app/                 ← Next.js routes + auth proxy
│   ├── lib/                 ← api.ts, types.ts, permissions.ts, utils
│   ├── hooks/               ← one useXxx.ts per feature area
│   └── components/
│       ├── layout/          ← Navbar, Sidebar, MainContentRouter
│       ├── ui/              ← Toast, CodeBlock, ErrorBoundary
│       └── features/        ← one panel per dashboard tab
├── infra/
│   ├── openresty/nginx.conf ← gateway routing + Lua scripts
│   └── mysql/init/          ← database bootstrap SQL
├── docs/                    ← USER_MANUAL.md
├── examples/                ← demo.html + healthcare/social JSON examples
└── docker-compose.yml       ← 5-service orchestration
```

---

## Development

### Backend

```bash
cd backend
cargo build --release --locked   # compile
cargo test                        # run tests
cargo run --release               # run locally (requires MySQL + Redis)
```

### Frontend

```bash
cd frontend
npm run dev     # dev server at http://localhost:3000
npm run build   # production build (standalone output)
npm run lint    # ESLint
```

For frontend-only local dev (without gateway), create `frontend/.env.local`:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

### Adding a new endpoint

1. **Backend**: add handler to `handlers/<domain>.rs` + register route in `lib.rs`
2. **Frontend**: create `components/features/<Name>Panel.tsx` + `hooks/use<Name>.ts` + register in `MainContentRouter.tsx`

---

## Documentation

- **[CLAUDE.md](CLAUDE.md)** — Architecture guide for AI assistants and developers (full handler reference, DB schema, permission matrix)
- **[User Manual](docs/USER_MANUAL.md)** — End-user guide for operating the dashboard

---

## License

*This project does not currently include an open-source license.*
