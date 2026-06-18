# API 控制平面 — 使用说明书

> **版本**: v0.x · **最后更新**: 2026-06-18 · **语言**: 简体中文

---

## 目录

1. [系统概述](#1-系统概述)
2. [部署与启动](#2-部署与启动)
3. [环境变量参考](#3-环境变量参考)
4. [认证与权限体系](#4-认证与权限体系)
5. [前端功能面板指南](#5-前端功能面板指南)
6. [后端 API 接口参考](#6-后端-api-接口参考)
7. [数据转换规则配置](#7-数据转换规则配置)
8. [基础设施详解](#8-基础设施详解)
9. [数据库表结构](#9-数据库表结构)
10. [Redis 缓存策略](#10-redis-缓存策略)
11. [后台任务说明](#11-后台任务说明)
12. [前端技术栈与开发](#12-前端技术栈与开发)
13. [后端技术栈与开发](#13-后端技术栈与开发)

---

## 1. 系统概述

**API 控制平面** 是一个全栈 API 管理平台，用于对 HTTP API 响应实施 **变换规则**（白名单/重命名/掩码/分页），并提供完整的 API 密钥管理、速率限制、熔断器、LLM 网关、产品订阅等企业级功能。

### 架构总览

```
互联网用户
    │
    ▼
┌─────────────────────────────────────────────┐
│            Gateway（OpenResty :80）           │
│  · 反向代理                                    │
│  · 每 IP 速率限制（120 r/s, burst 240）         │
│  · API Key 验证（Lua 缓存 + 后端子请求）         │
│  · 遥测数据自动采集                              │
└──────┬──────────────────┬──────────┬─────────┘
       │ /admin/*         │ /api/*   │ /*
       ▼                  ▼          ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Backend     │  │   Backend    │  │  Frontend    │
│  Rust :8080  │  │   Rust :8080 │  │  Next.js:3000│
│  (JWT 认证)   │  │  (API Key)   │  │  (管理员面板) │
└──┬────┬──────┘  └──┬────┬──────┘  └──────────────┘
   │    │             │    │
   ▼    ▼             ▼    ▼
┌─────────┐    ┌──────────┐
│  MySQL  │    │  Redis   │
│  :3306  │    │  :6379   │
└─────────┘    └──────────┘
```

**核心技术栈**:

| 层级 | 技术 |
|------|------|
| 后端 | Rust + Axum（Web 框架）+ sqlx（MySQL）+ redis-rs + JWT（HS256） |
| 前端 | Next.js 16 + React 19 + Tailwind CSS 4 + NextAuth + SWR |
| 网关 | OpenResty（Nginx + LuaJIT） |
| 数据库 | MySQL 8.4 |
| 缓存 | Redis 7.4 |
| 部署 | Docker Compose（单机全栈） |

---

## 2. 部署与启动

### 2.1 前置条件

- **Docker** + **Docker Compose** v2+
- 主机端口 **80** 可用（网关使用）

### 2.2 快速启动

```bash
# 1. 克隆仓库
git clone <repo-url> && cd <repo-dir>

# 2. 配置环境变量（首次使用从模板复制）
cp .env.example .env
# 编辑 .env，修改 JWT_SECRET, ADMIN_DEFAULT_PASSWORD 等关键配置

# 3. 启动全部服务
docker compose up -d --build

# 4. 访问管理面板
# 浏览器打开 http://localhost
# 默认管理员账号: admin / 密码见 .env 中 ADMIN_DEFAULT_PASSWORD
```

### 2.3 常用命令

```bash
# 查看所有服务状态
docker compose ps

# 查看日志
docker compose logs -f backend      # 后端日志
docker compose logs -f frontend     # 前端日志
docker compose logs -f gateway      # 网关日志

# 仅重建某个服务
docker compose up -d --build backend
docker compose up -d --build frontend

# 停止所有服务
docker compose down

# 停止并删除数据卷（⚠️ 清空数据库和缓存）
docker compose down -v

# 后端健康检查
curl http://localhost/health/live    # 存活检查
curl http://localhost/health/ready   # 就绪检查（含 MySQL + Redis）
```

### 2.4 本地开发模式

**后端本地开发**（需要本地 MySQL + Redis）:

```bash
cd backend
# 复制环境变量
cp .env.example .env
# 编辑 .env 设置本地 MySQL/Redis 连接串

cargo build --release --locked   # 编译
cargo run                         # 启动（监听 8080 端口）
cargo test                        # 运行测试
```

**前端本地开发**（可配合本地后端或 Docker 后端）:

```bash
cd frontend
# 创建本地环境配置
echo 'NEXT_PUBLIC_API_BASE_URL=http://localhost:8080' > .env.local

npm install
npm run dev        # Next.js 开发服务器（端口 3000）
npm run build      # 生产构建
npm run lint       # 代码检查
```

---

## 3. 环境变量参考

### 3.1 后端环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `APP_BIND` | `0.0.0.0:8080` | 后端监听地址 |
| `MYSQL_URL` | `mysql://root:root@127.0.0.1:3306/apictrl` | MySQL 连接串（Docker 环境用服务名 `mysql`） |
| `REDIS_URL` | `redis://127.0.0.1:6379` | Redis 连接串（Docker 环境用 `redis`） |
| `MYSQL_MAX_CONNECTIONS` | `15` | MySQL 连接池大小 |
| `CACHE_TTL_SECONDS` | `300` | 默认 Redis 缓存过期时间（秒） |
| `JWT_SECRET` | (开发默认值) | JWT 签名密钥（**生产环境必须修改**） |
| `CORS_ALLOWED_ORIGINS` | `*` | 允许的跨域来源（逗号分隔） |
| `DEV_MODE` | (未设置) | 设为 `true` 允许使用开发 JWT 密钥 |
| `RUST_LOG` | `info,api_control_backend=debug,sqlx=warn` | 日志级别 |
| `ADMIN_DEFAULT_PASSWORD` | (首次启动必需) | 默认 admin 用户初始密码 |

### 3.2 前端环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `NEXT_PUBLIC_API_BASE_URL` | (空，使用 `/api/proxy` 路径) | 后端 API 基础 URL |
| `NEXTAUTH_URL` | `http://localhost` | NextAuth 回调地址 |
| `NEXTAUTH_SECRET` | `change-me` | NextAuth 会话加密密钥 |
| `BACKEND_URL` | `http://backend:8080` | Docker 环境中的后端地址 |
| `NEXT_PUBLIC_ENV_LABEL` | (空) | 环境标签（显示在导航栏中） |

### 3.3 基础设施环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `MYSQL_ROOT_PASSWORD` | `root` | MySQL root 密码 |
| `MYSQL_DATABASE` | `apictrl` | 数据库名称 |

---

## 4. 认证与权限体系

### 4.1 JWT 认证

- **算法**: HS256
- **有效期**: 24 小时（86400 秒）
- **载荷**: `sub`（用户名）、`role`、`permissions`、`user_group`、`exp`、`iat`、`jti`
- **吊销机制**: Redis 黑名单 key `jti:revoked:<jti>`
- **请求头**: `Authorization: Bearer <token>`

### 4.2 四种角色及权限

| 角色 | 能力 | 权限数量 |
|------|------|---------|
| **Admin（管理员）** | 全部权限：CRUD、用户管理、系统设置 | 全部 31 项 |
| **Reviewer（审核员）** | 读取全部 + 发布规则 + 审核审批 + LLM 管理 + 查看用户目录 + 个人资料 | ~15 项 |
| **Editor（编辑员）** | 读取全部 + 写入规则/API密钥/速率限制/熔断器/协议/分类/插件 + 查看用户目录 + 个人资料 | ~20 项 |
| **Viewer（观察员）** | 只读全部 + 查看用户目录 + 个人资料 | ~15 项 |

### 4.3 细粒度权限清单（共 27 项）

```
规则      rule:read     rule:write     rule:publish
变换      transform:preview   transform:execute
API密钥   apikey:read   apikey:write
速率限制  ratelimit:read ratelimit:write
审批      approval:read approval:review
指标      metrics:read
审计      audit:read
LLM       llm:route     llm:manage
产品      products:read products:write
熔断器    circuit_breakers:read circuit_breakers:write
协议      protocols:read protocols:write
分类      classifications:read classifications:write
插件      plugins:read  plugins:write
OpenAPI   openapi:read
验证      validation:read
系统      system:read   system:write
用户      user:read     user:manage   user:self
```

### 4.4 权限模板

系统预置了 7 个内置权限模板，对应不同的角色预设：

| 模板名称 | 对应角色 | 说明 |
|----------|---------|------|
| `super_admin` | Admin | 全部权限 |
| `ops_admin` | Admin | 运维管理（无 LLM 管理） |
| `security_auditor` | Reviewer | 安全审计（侧重审计+审批） |
| `api_developer` | Editor | API 开发（侧重规则+变换） |
| `product_manager` | Editor | 产品管理（侧重产品+订阅） |
| `portal_user` | Viewer | 门户用户（只读） |
| `viewer` | Viewer | 观察员 |

用户的最终权限 = 权限模板权限 ∪ 自定义权限 − 排除权限（以 `!` 前缀表示）。

### 4.5 密码策略

- 最少 **8 个字符**
- 必须包含大小写字母和数字
- 连续 5 次登录失败后锁定 15 分钟
- 密码使用 bcrypt（cost=12）哈希存储

### 4.6 零信任登录风险评估

登录时会评估以下风险信号：

| 信号 | 风险分数 |
|------|---------|
| 新设备（未识别的设备指纹） | +35 |
| IP 地址变化（不同子网） | +20 |
| 暴力破解模式（10 分钟内 ≥5 次失败） | +30 |
| 高频登录（5 分钟内 ≥5 次） | +15 |
| 异常时段登录 | +15 |

- **分数 ≥ 40**: 视为可疑登录，若未启用 TOTP 则强制返回受限令牌（15 分钟有效期 + 必须设置双因素认证）
- **分数 < 40**: 正常登录

---

## 5. 前端功能面板指南

前端为单页应用（SPA），通过左侧边栏菜单切换功能面板。菜单项根据用户权限动态显示。

### 5.1 导航栏（Navbar）

- **左上角**: 品牌图标 + "API Control Center" 标题
- **环境标签**: 显示 `NEXT_PUBLIC_ENV_LABEL`（如 "staging"、"production"）
- **健康指示灯**:
  - 🟢 绿色: 服务正常
  - 🟡 黄色: 部分就绪
  - 🔴 红色: 服务异常
- **语言切换**: 点击切换中文/English
- **通知铃铛**: 显示未读通知数量，下拉查看通知列表
- **用户菜单**: 显示名称/邮箱，可进入用户中心或退出登录

### 5.2 功能面板一览

#### 📊 Dashboard（仪表盘）
- 显示 4 个 KPI 卡片：运行时间、活跃规则数、版本数、审计事件数
- 数据来源: `GET /admin/v1/metrics/overview`
- 可手动刷新

#### 📋 Rules（规则管理）
- **左侧**: 规则列表（支持按名称/API路径/状态搜索）
- **右侧**: 规则编辑器，支持配置：
  - 规则名称、API 路径、状态（草稿/已发布/已归档）
  - 变更类型（create/update/patch/delete）
  - 字段白名单、重命名映射、掩码字段
  - 计算字面量（JSON）、条件规则（JSON数组）
  - 灰度发布配置（JSON）、分页模板
  - 移除空值开关
- 操作: 创建/更新/删除规则

#### 🔄 Versions（版本管理）
- **左侧**: 版本时间线，支持选择回滚目标版本
- **右侧**: 差异对比器 —— 选择两个版本，查看字段级别的增/删/改
- 操作: 版本回滚（创建新版本并标记为 `rollback`）

#### 🧪 Playground（变换沙箱）
- **左侧 (3/5)**: 数据条目区 —— 添加多条测试数据，填入模拟 JSON 和流量上下文，一键执行变换
- **右侧 (2/5)**:
  - 全局设置（强制指定灰度变体）
  - 表达式求值器 —— 输入条件表达式和模拟 JSON，测试 TRUE/FALSE
- 支持单条变换和批量变换

#### 🔧 API Builder（API 构建器）
- **规则选择区**: 从已有规则中选择或新建
- **规则编辑区**: 可视化 CRUD 表单（白名单、重命名、掩码等）
- **数据条目区**: 键值对形式添加数据，支持 JSON 导出
- **预设栏**: 将当前配置保存为预设（localStorage），支持快速加载

#### 📄 OpenAPI（OpenAPI 规范）
- **生成**: 从规则自动生成 OpenAPI 3.1 规范（支持路径过滤和叠加模式）
- **导入**: 解析 OpenAPI JSON，提取响应 schema 并填充到规则表单

#### 🔑 API Keys（API 密钥管理）
- **创建**: 名称 + 过期时间（快捷预设: 7天/30天/90天/1年/自定义日期时间）
- **列表**: 显示前缀（前8位）、状态、权限范围、过期时间、用量条、创建者
- **操作**: 启用/禁用/删除
- ⚠️ 完整密钥仅在创建时显示一次

#### 🚦 Rate Limits（速率限制）
- 创建/编辑速率限制配置：
  - 名称、API 路径
  - 时间窗口（秒）、最大请求数、突发容量
  - 日/月配额上限
  - 按密钥/按 IP 限制开关
- 列表支持启用/禁用/删除

#### ✅ Approvals（审批工作流）
- **三个选项卡**: 全部 / 我的请求 / 待我审批
- **统计卡片**: 总计、待审批、已批准、已拒绝数量
- 操作: 创建审批请求、批准/拒绝、删除
- 审批通过后规则状态变为 `published`

#### 📈 Analytics（数据分析）
- **时间范围选择器**: 1/6/12/24/48/168 小时
- **KPI 卡片**: 总请求数、平均延迟、P95、P99、错误率
- **按小时柱状图**: 每小时的请求量分布
- **Top API 排行**: 按调用量排序的 API 列表
- **状态码分布**: 各 HTTP 状态码占比
- **API Key 统计**: 每个密钥的调用量/延迟/错误

#### 📝 Audit Log（审计日志）
- 表格展示：时间戳、操作者、操作类型标签、规则 ID、成功/失败状态
- 支持手动刷新

#### ⚙️ Advanced（高级管理）
子选项卡：

| 子选项卡 | 功能 |
|---------|------|
| **API Products（产品）** | API 产品 CRUD + 定价层级编辑 + 状态管理 |
| **Subscriptions（订阅）** | 订阅 CRUD + 升级/取消/续期 + 用量查询 |
| **Circuit Breakers（熔断器）** | 创建/编辑熔断器（故障阈值、恢复超时、半开限制等） |
| **Protocols（协议）** | 协议扩展配置（GraphQL/gRPC/SSE/WebSocket/REST） |
| **Classifications（分类）** | 数据分类配置（PII/GDPR 标记、保留天数、目标表） |
| **Plugins（插件）** | 插件配置（类型、钩子点、优先级） |

#### 🌐 Portal（开发者门户）
子选项卡：

| 子选项卡 | 功能 |
|---------|------|
| **API Catalog（目录）** | 产品搜索 + 标签过滤 + 定价卡片 + 订阅流程 |
| **My Apps（我的应用）** | API 密钥管理 + 订阅列表 + 用量仪表板 + 密钥创建 |
| **Quick Start（快速入门）** | 5 步集成指南 + 代码示例（curl/Python/JS/Go） |

#### 👤 User Center（用户中心）
子选项卡：

| 子选项卡 | 功能 |
|---------|------|
| **Profile（个人资料）** | 编辑显示名称、邮箱、头像 URL |
| **Security（安全）** | 修改密码（需输入当前密码） |
| **2FA（双因素认证）** | TOTP 设置/验证/禁用（扫码绑定） |
| **Sessions（会话）** | 查看活跃会话 + 远程撤销 |
| **History（历史）** | 最近 50 条登录尝试记录 |
| **Preferences（偏好）** | 主题/语言/通知偏好设置 |

#### 👥 User Management（用户管理）
子选项卡：

| 子选项卡 | 功能 |
|---------|------|
| **Users（用户）** | 用户 CRUD + 按组/状态/搜索过滤 + 会话全部撤销 |
| **Permission Templates（权限模板）** | 模板 CRUD + 权限复选框选择 |

#### ⚡ System Settings（系统设置）
分组管理：

| 分组 | 包含设置 |
|------|---------|
| **SMTP 邮件** | 主机、端口、用户名、密码、发件人、加密方式、超时 + 验证连接 + 发送测试邮件 |
| **安全** | jwt_secret、jwt_ttl、login_max_attempts、login_lockout、password_policy |
| **基础设施** | log_level、cors_origins、cache_ttl |

> 敏感设置（`smtp_password`、`jwt_secret`）在 API 响应中显示为 `****`。

#### 📖 Manual（使用手册）
内嵌的完整文档，涵盖：
1. Dashboard KPI 解释
2. 规则配置参数详解（每种配置附输入/输出示例）
3. 表达式语法参考（运算符、内置函数、示例）
4. 版本与差异对比说明
5. Playground 变换流水线（7 步骤顺序）
6. API Builder 操作指南
7. 审计日志字段说明

---

## 6. 后端 API 接口参考

### 6.1 通用说明

- **基础路径**: `/admin/v1/*`（管理接口，需要 JWT）、`/api/v1/*`（数据面接口，需要 API Key 或匿名）
- **认证头**: `Authorization: Bearer <token>`
- **Content-Type**: `application/json`
- **分页**: 支持 `offset` + `limit` 或 `cursor` + `limit`（取决于端点）
- **错误响应格式**:
  ```json
  { "error": "BadRequest", "message": "具体错误描述" }
  ```

### 6.2 认证与用户

| 方法 | 端点 | 权限 | 说明 |
|------|------|------|------|
| POST | `/admin/v1/auth/login` | (公开) | 用户登录，返回 JWT + 用户信息 + 权限列表 |
| GET | `/admin/v1/users/me` | `user:self` | 获取当前用户资料 |
| PUT | `/admin/v1/users/me` | `user:self` | 更新当前用户资料（display_name, email, avatar_url） |
| PUT | `/admin/v1/users/me/password` | `user:self` | 修改密码（需 current_password + new_password） |
| GET | `/admin/v1/users/me/sessions` | `user:self` | 列出活跃会话 |
| DELETE | `/admin/v1/users/me/sessions/:id` | `user:self` | 撤销指定会话（JTI 加入 Redis 黑名单） |
| GET | `/admin/v1/users/me/login-history` | `user:self` | 查看登录历史（最近 50 条） |
| GET | `/admin/v1/users/me/totp` | `user:self` | 查询 TOTP 启用状态 |
| GET\|POST | `/admin/v1/users/me/totp/setup` | `user:self` | 生成 TOTP 密钥 + QR 码 |
| POST | `/admin/v1/users/me/totp/verify` | `user:self` | 验证 TOTP 码并启用 |
| DELETE | `/admin/v1/users/me/totp` | `user:self` | 禁用 TOTP（需当前验证码） |
| GET | `/admin/v1/users/me/preferences` | `user:self` | 获取偏好设置 |
| PUT | `/admin/v1/users/me/preferences` | `user:self` | 更新偏好设置（部分合并） |
| GET | `/admin/v1/users/me/notifications` | `user:self` | 列出通知（可按已读/未读/渠道过滤） |
| POST | `/admin/v1/users/me/notifications/read` | `user:self` | 标记通知已读（指定 ID 或全部） |
| DELETE | `/admin/v1/users/me/notifications` | `user:self` | 删除所有通知 |
| DELETE | `/admin/v1/users/me/notifications/:id` | `user:self` | 删除指定通知 |
| GET | `/admin/v1/users/me/notifications/unread-count` | `user:self` | 获取未读通知数量 |
| GET | `/admin/v1/users/me/devices` | `user:self` | 列出受信任设备 |
| POST | `/admin/v1/users/me/devices/:id/trust` | `user:self` | 信任设备 |
| DELETE | `/admin/v1/users/me/devices/:id` | `user:self` | 移除设备 |

### 6.3 用户管理（Admin）

| 方法 | 端点 | 权限 | 说明 |
|------|------|------|------|
| GET | `/admin/v1/users` | `user:read` | 列出用户（支持 group/status/search 过滤） |
| POST | `/admin/v1/users` | `user:manage` | 创建用户（自动设置默认偏好） |
| GET | `/admin/v1/users/:id` | `user:read` | 获取用户详情 |
| PUT | `/admin/v1/users/:id` | `user:manage` | 更新用户（权限/状态变更时撤销会话） |
| DELETE | `/admin/v1/users/:id` | `user:manage` | 删除用户（内置 admin 不可删除） |

### 6.4 规则引擎

| 方法 | 端点 | 权限 | 说明 |
|------|------|------|------|
| POST | `/admin/v1/rules` | `rule:write` | 创建规则（含初始版本） |
| GET | `/admin/v1/rules` | `rule:read` | 列出规则（游标分页 + 状态/名称/路径过滤 + Redis 缓存） |
| GET | `/admin/v1/rules/:id` | `rule:read` | 获取规则详情（缓存击穿保护） |
| PUT | `/admin/v1/rules/:id` | `rule:write` | 更新规则（自动递增版本号） |
| DELETE | `/admin/v1/rules/:id` | `rule:write` | 删除规则及所有版本 |
| GET | `/admin/v1/rules/:id/versions` | `rule:read` | 列出规则的所有版本 |
| GET | `/admin/v1/rules/:id/diff` | `rule:read` | 版本差异对比（查询参数: `from`, `to`） |
| POST | `/admin/v1/rules/:id/rollback` | `rule:write` | 回滚到指定版本（创建新版本，change_kind=rollback） |

### 6.5 变换

| 方法 | 端点 | 权限 | 说明 |
|------|------|------|------|
| POST | `/admin/v1/transform/preview` | `transform:preview` | 预览变换效果（支持临时规则或引用已有规则） |
| POST | `/admin/v1/transform/expr-eval` | `transform:preview` | 测试表达式求值 |
| POST | `/api/v1/transform/execute` | (数据面) | 执行已发布规则的变换 |

### 6.6 API 密钥

| 方法 | 端点 | 权限 | 说明 |
|------|------|------|------|
| POST | `/admin/v1/api-keys` | `apikey:write` | 创建 API 密钥（返回完整密钥一次） |
| GET | `/admin/v1/api-keys` | `apikey:read` | 列出密钥（无 `user:manage` 仅显示自己的） |
| GET | `/admin/v1/api-keys/:id` | `apikey:read` | 获取密钥详情（仅返回前缀） |
| PUT | `/admin/v1/api-keys/:id` | `apikey:write` | 更新密钥（名称/状态/权限范围） |
| DELETE | `/admin/v1/api-keys/:id` | `apikey:write` | 删除密钥 |
| POST | `/api/v1/api-keys/validate` | (数据面) | 通过 SHA-256 哈希验证 API 密钥 |

### 6.7 速率限制

| 方法 | 端点 | 权限 | 说明 |
|------|------|------|------|
| POST | `/admin/v1/rate-limits` | `ratelimit:write` | 创建速率限制配置 |
| GET | `/admin/v1/rate-limits` | `ratelimit:read` | 列出所有速率限制 |
| GET | `/admin/v1/rate-limits/:id` | `ratelimit:read` | 获取单个速率限制 |
| PUT | `/admin/v1/rate-limits/:id` | `ratelimit:write` | 更新速率限制 |
| DELETE | `/admin/v1/rate-limits/:id` | `ratelimit:write` | 删除速率限制 |
| POST | `/api/v1/rate-limits/check` | (数据面) | 检查/滑动窗口速率限制（Redis INCR + EXPIRE） |

### 6.8 审批

| 方法 | 端点 | 权限 | 说明 |
|------|------|------|------|
| POST | `/admin/v1/approvals` | `rule:write` | 创建审批请求 |
| GET | `/admin/v1/approvals` | `approval:read` | 列出所有审批（可按状态过滤） |
| GET | `/admin/v1/approvals/my-pending` | `user:self` | 列出待我审批 |
| GET | `/admin/v1/approvals/my-requests` | `user:self` | 列出我的审批请求 |
| GET | `/admin/v1/approvals/:id` | `approval:read` | 获取审批详情 |
| POST | `/admin/v1/approvals/:id/review` | `approval:review` | 审批（action: "approve" \| "reject"） |
| DELETE | `/admin/v1/approvals/:id` | `rule:write` | 删除审批 |

### 6.9 指标与分析

| 方法 | 端点 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/v1/metrics/ingest` | (数据面) | 推送指标到 Redis 缓冲区 |
| GET | `/admin/v1/metrics/overview` | `metrics:read` | 系统概览计数（规则、版本、审计事件） |
| GET | `/admin/v1/metrics/analytics` | `metrics:read` | 详细分析（总请求、延迟、错误率、按小时分布、状态分布、P95/P99） |
| GET | `/admin/v1/metrics/top-apis` | `metrics:read` | Top 10 API 排行榜 |
| GET | `/admin/v1/metrics/api-key-stats` | `metrics:read` | 按 API 密钥统计 |
| GET | `/admin/v1/metrics/dashboard` | `metrics:read` | 聚合仪表板（analytics + top_apis + api_key_stats） |

### 6.10 审计日志

| 方法 | 端点 | 权限 | 说明 |
|------|------|------|------|
| GET | `/admin/v1/audit/logs` | `audit:read` | 列出审计日志（可按 rule_id/action/actor/success 过滤） |

### 6.11 验证

| 方法 | 端点 | 权限 | 说明 |
|------|------|------|------|
| POST | `/admin/v1/validate/request` | `validation:read` | 按规则验证请求体 |
| POST | `/admin/v1/validate/response` | `validation:read` | 按规则验证响应体 |
| POST | `/admin/v1/validate/rule/:rule_id` | `validation:read` | 按指定规则验证数据 |

### 6.12 OpenAPI

| 方法 | 端点 | 权限 | 说明 |
|------|------|------|------|
| GET | `/admin/v1/openapi.json` | `openapi:read` | 生成 OpenAPI 3.1 规范（可选叠加模式） |

### 6.13 产品与订阅

| 方法 | 端点 | 权限 | 说明 |
|------|------|------|------|
| POST | `/admin/v1/products` | `products:write` | 创建 API 产品 |
| GET | `/admin/v1/products` | `products:read` | 列出产品（支持搜索，无 `user:manage` 仅显示自己的） |
| GET | `/admin/v1/products/:id` | `products:read` | 获取产品（含订阅数量） |
| PUT | `/admin/v1/products/:id` | `products:write` | 更新产品 |
| DELETE | `/admin/v1/products/:id` | `products:write` | 删除产品（取消活跃订阅） |
| GET | `/admin/v1/products/:id/subscriptions` | `products:read` | 列出产品的订阅 |
| POST | `/admin/v1/subscriptions` | `products:write` | 创建订阅 |
| GET | `/admin/v1/subscriptions` | `products:read` | 列出订阅 |
| GET | `/admin/v1/subscriptions/:id` | `products:read` | 获取订阅详情 |
| PUT | `/admin/v1/subscriptions/:id` | `products:write` | 更新订阅 |
| DELETE | `/admin/v1/subscriptions/:id` | `products:write` | 删除订阅 |
| GET | `/admin/v1/subscriptions/:id/usage` | `products:read` | 获取用量（24h + 当日调用量 + 配额百分比） |
| POST | `/admin/v1/subscriptions/:id/upgrade` | `products:write` | 升级套餐（从产品定价层级解析） |
| POST | `/admin/v1/subscriptions/:id/cancel` | `products:write` | 取消订阅 |
| POST | `/admin/v1/subscriptions/:id/renew` | `products:write` | 续期订阅 |
| POST | `/admin/v1/me/subscriptions` | `user:self` | 自主订阅（用户自行订阅产品） |

> 默认定价层级: enterprise（1000 RPS/10万日配额）、pro（100 RPS/1万日配额）、free（10 RPS/1千日配额）

### 6.14 基础设施管理

| 领域 | 端点前缀 | 读权限 | 写权限 |
|------|---------|--------|--------|
| Circuit Breakers | `/admin/v1/circuit-breakers` | `circuit_breakers:read` | `circuit_breakers:write` |
| Protocol Configs | `/admin/v1/protocols` | `protocols:read` | `protocols:write` |
| Data Classifications | `/admin/v1/data-classifications` | `classifications:read` | `classifications:write` |
| Plugin Configs | `/admin/v1/plugins` | `plugins:read` | `plugins:write` |

> 以上四种资源均支持标准 CRUD（POST/GET/GET:id/PUT:id/DELETE:id）

### 6.15 系统设置

| 方法 | 端点 | 权限 | 说明 |
|------|------|------|------|
| GET | `/admin/v1/system/settings` | `system:read` | 列出所有设置（敏感值遮蔽） |
| PUT | `/admin/v1/system/settings/batch` | `system:write` | 批量更新设置 |
| PUT | `/admin/v1/system/settings/:key` | `system:write` | 更新单个设置（smtp_password 自动加密） |
| POST | `/admin/v1/system/smtp/test` | `system:write` | 发送测试邮件 |
| POST | `/admin/v1/system/smtp/verify` | `system:write` | 验证 SMTP 连接（不发送邮件） |

### 6.16 权限模板

| 方法 | 端点 | 权限 | 说明 |
|------|------|------|------|
| GET | `/admin/v1/permission-templates` | `system:read` | 列出模板（可搜索） |
| GET | `/admin/v1/permission-templates/:id` | `system:read` | 获取模板详情 |
| POST | `/admin/v1/permission-templates` | `system:write` | 创建模板 |
| PUT | `/admin/v1/permission-templates/:id` | `system:write` | 更新模板（内置不可修改） |
| DELETE | `/admin/v1/permission-templates/:id` | `system:write` | 删除模板（内置/使用中不可删除） |

### 6.17 健康检查

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/health/live` | 存活检查（始终返回 200 `{"status":"ok"}`） |
| GET | `/health/ready` | 就绪检查（MySQL + Redis 可达返回 200，否则 503） |

---

## 7. 数据转换规则配置

### 7.1 变换流水线顺序

当请求命中 `/api/v1/transform/execute` 时，按以下顺序执行变换：

1. **灰度发布解析** → 如果是灰度规则，确定使用哪个变体
2. **白名单过滤** → 仅保留 `whitelist_fields` 中的字段
3. **字段重命名** → 按 `renames` 映射转换字段名
4. **字段掩码** → 对 `masked_fields` 中的字段部分遮盖（如 `ab****cd`）
5. **计算字面量** → 注入常量值（`computed_literals`）
6. **条件规则** → 对匹配表达式的数据执行额外变换
7. **移除空值** → 如果 `remove_nulls` 为 true
8. **分页重构** → 按 `pagination` 模板包装输出

### 7.2 规则配置字段说明

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `name` | string | 规则名称 | `"用户信息API"` |
| `api_path` | string | 匹配的 API 路径 | `"/api/users"` |
| `status` | string | 状态: `draft` / `published` / `archived` | `"published"` |
| `change_kind` | string | 变更类型 | `"create"` / `"update"` / `"patch"` / `"delete"` |
| `whitelist_fields` | string[] | 仅允许通过的字段 | `["id", "name", "email"]` |
| `renames` | object | 字段重命名映射 | `{"old_name": "new_name"}` |
| `masked_fields` | string[] | 需要部分遮盖的字段 | `["phone", "id_card"]` |
| `computed_literals` | object | 注入固定值 | `{"api_version": "v2"}` |
| `remove_nulls` | boolean | 移除 null 值字段 | `true` / `false` |
| `conditional_rules` | array | 条件变换规则 | 见下方 |
| `gray_release` | object | 灰度发布配置 | 见下方 |
| `pagination` | object | 分页模板 | `{"data_key": "items", "total_key": "total"}` |
| `request_validation` | object | 请求 JSON Schema 验证 | `{"type": "object", "required": ["name"]}` |
| `response_validation` | object | 响应 JSON Schema 验证 | 同上格式 |
| `cache_config` | object | 缓存配置 | `{"enabled": true, "ttl_seconds": 300}` |

### 7.3 条件规则格式

```json
{
  "expression": "user.vip == true && user.level >= 3",
  "actions": {
    "whitelist_fields": ["id", "name", "vip_data"],
    "renames": {"vip_data": "exclusive_content"},
    "computed_literals": {"tier": "premium"}
  }
}
```

### 7.4 表达式语法

**比较运算符**: `==` `!=` `>=` `<=` `>` `<`

**逻辑运算符**: `&&`（与） `||`（或）

**内置函数**:
- `exists(path)` — 检查路径是否存在
- `contains(path, value)` — 检查数组/字符串是否包含值

**路径访问**: 点号表示法，可选 `$.` 前缀（如 `user.name` 或 `$.user.name`）

**示例**:
```
vip == true
user.age >= 18 && user.verified == true
exists(address.city)
contains(tags, "premium")
```

### 7.5 灰度发布配置

```json
{
  "enabled": true,
  "bucket_key": "user_id",
  "variants": [
    {
      "name": "variant-a",
      "weight": 80,
      "overrides": {
        "renames": {"data": "result"},
        "computed_literals": {"version": "A"}
      }
    },
    {
      "name": "variant-b",
      "weight": 20,
      "overrides": {
        "renames": {"data": "response"},
        "computed_literals": {"version": "B"}
      }
    }
  ]
}
```

变体选择通过 SHA-256 哈希 `bucket_key` 值确定，按权重分配流量。

---

## 8. 基础设施详解

### 8.1 Docker Compose 服务总览

| 服务 | 镜像 | 端口 | 健康检查 |
|------|------|------|---------|
| mysql | `mysql:8.4` | 内部 3306 | `mysqladmin ping` 每 10s |
| redis | `redis:7.4-alpine` | 内部 6379 | `redis-cli ping` 每 10s |
| backend | 自定义 (Rust) | 内部 8080 | `curl /health/live` 每 15s |
| frontend | 自定义 (Next.js) | 内部 3000 | 依赖 backend healthy |
| gateway | `openresty:1.27.1.2-0-bookworm` | **宿主机 80** | - |

### 8.2 Gateway（OpenResty）配置详解

**路由规则**:

| 路径 | 目标 | 认证方式 | 特性 |
|------|------|---------|------|
| `/health/live`, `/health/ready` | backend:8080 | 无 | 缓存 10s |
| `/admin/*` | backend:8080 | JWT（后端验证） | 管理面速率限制 10r/m |
| `/admin/v1/metrics/dashboard` | backend:8080 | JWT | **缓存 30s**（按 auth header 分 key） |
| `/api/auth/*` | frontend:3000 | NextAuth | 认证流程 |
| `/api/proxy/*` | frontend:3000 | JWT（服务端注入） | Next.js 代理认证 |
| `/api/*` | backend:8080 | API Key + 速率限制 | 数据面（含 Lua 认证层） |
| `/*` | frontend:3000 | 无 | SPA 前端（支持 WebSocket） |

**数据面请求处理流程（`/api/*`）**:

1. **跳过内部请求**: `/api/v1/api-keys/validate`、`/rate-limits/check`、`/metrics/ingest`
2. **提取 API Key**: 从 `X-API-Key` 头或 `api_key` 查询参数
3. **JWT 绕过**: 如果有 `Authorization: Bearer` 头则跳过 API Key 验证（面板用户）
4. **缓存优先验证**: 检查本地 `apikey_cache` 共享字典（有效=60s TTL，无效=10s TTL）
5. **后端子请求**: 未命中缓存时 POST 到后端 `/api/v1/api-keys/validate`
6. **本地速率限制**: 每 IP 计数器（`ratelimit_counters` 字典），1000次/60s
7. **后端速率检查**: POST 到后端 `/api/v1/rate-limits/check`
8. **响应头**: 添加 `X-RateLimit-Limit`、`X-RateLimit-Remaining`、`X-RateLimit-Reset`
9. **遥测**: `log_by_lua_block` 异步推送指标到后端

**性能调优**:
- worker_processes: 1, worker_connections: 4096
- epoll + multi_accept + sendfile + tcp_nodelay
- 磁盘缓存: `/tmp/nginx_cache` (50MB)
- Lua 共享字典: apikey_cache (10MB), ratelimit_counters (20MB), response_cache (50MB)

**安全头**:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 0`
- `Referrer-Policy: strict-origin-when-cross-origin`

### 8.3 MySQL 配置

- **版本**: 8.4
- **字符集**: utf8mb4 / utf8mb4_0900_ai_ci
- **性能**: `innodb-buffer-pool-size=256M`, `max_connections=120`
- **数据持久化**: Docker 卷 `mysql_data`
- **初始化脚本**: `infra/mysql/init/00-bootstrap.sql`（创建 `apictrl` 数据库）
- **时区**: `Asia/Shanghai`

### 8.4 Redis 配置

- **版本**: 7.4 Alpine
- **持久化**: 关闭（`--save "" --appendonly no`）
- **淘汰策略**: LRU
- **最大内存**: 128MB
- **用途**: 规则缓存、速率限制计数、指标缓冲、JWT 黑名单、分析缓存

---

## 9. 数据库表结构

### 9.1 规则域

| 表名 | 用途 | 关键字段 |
|------|------|---------|
| `rule_configs` | 变换规则配置 | name, api_path, status, whitelist_fields(JSON), renames(JSON), masked_fields(JSON), computed_literals(JSON), conditional_rules(JSON), gray_release(JSON), pagination(JSON), request_validation(JSON), response_validation(JSON), cache_config(JSON), current_version |
| `rule_versions` | 规则版本历史 | rule_id, version_number, change_kind, 完整的规则配置快照 |
| `approvals` | 审批工作流 | rule_id, version_id, requester, reviewer, status(pending/approved/rejected), comment |

### 9.2 认证/用户域

| 表名 | 用途 | 关键字段 |
|------|------|---------|
| `users` | 用户账户 | username, password_hash(bcrypt), email, display_name, role, status, user_group, permission_template_id, custom_permissions(JSON), failed_login_attempts, locked_until |
| `permission_templates` | 权限角色模板 | name, description, permissions(JSON数组), is_builtin |
| `user_sessions` | 活跃会话 | user_id, token_jti, token_expires_at, client_ip, user_agent |
| `login_history` | 登录尝试记录 | user_id, username_attempt, success, device_fingerprint, risk_score, is_suspicious, failure_reason |
| `user_totp` | 双因素认证 | user_id, secret, enabled, qr_code_uri |
| `user_devices` | 受信任设备 | user_id, device_fingerprint, trusted |

### 9.3 基础设施域

| 表名 | 用途 | 关键字段 |
|------|------|---------|
| `api_keys` | API 密钥 | name, key_hash(SHA-256), key_prefix(sk_xxx), status, scopes, quota_limit, expires_at |
| `rate_limit_configs` | 速率限制配置 | api_path, window_seconds, max_requests, burst, daily_quota, monthly_quota, per_key, per_ip |
| `circuit_breakers` | 熔断器 | api_path, failure_threshold, recovery_timeout_sec, half_open_max, retry_count, retry_delay_ms, timeout_ms |
| `protocol_configs` | 协议扩展 | name, protocol_type(graphql/grpc/sse/ws/rest), config(JSON) |
| `data_classifications` | 数据分类 | data_category, contains_pii, gdpr_relevant, retention_days, target_table |
| `plugin_configs` | 插件 | name, plugin_type, hook_point(pre_auth/post_auth/pre_transform/post_transform/pre_cache/post_cache), priority, config(JSON) |

### 9.4 产品/订阅域

| 表名 | 用途 | 关键字段 |
|------|------|---------|
| `api_products` | API 产品目录 | name, description, tags, pricing_tiers(JSON), rules(JSON关联规则), status |
| `subscriptions` | 用户订阅 | user_id, product_id, api_key_id, plan, status(active/cancelled/expired), quota_limit, expires_at |

### 9.5 指标域

| 表名 | 用途 | 关键字段 |
|------|------|---------|
| `metrics_ingest` | 原始指标数据（30天保留） | api_path, method, status_code, latency_ms, client_ip, api_key_id, timestamp |
| `metrics_hourly_summary` | 小时聚合数据 | hour_bucket, api_path, total_requests, avg_latency, p95_latency, p99_latency, error_count, status_distribution(JSON) |

### 9.6 系统域

| 表名 | 用途 | 关键字段 |
|------|------|---------|
| `system_settings` | 系统配置键值对 | setting_key, setting_value, category, is_sensitive |
| `audit_logs` | 审计日志 | rule_id, action, actor, success, message, detail(JSON) |
| `notifications` | 用户通知 | user_id, type, title, message, channel(in_app/email/both), is_read |
| `llm_providers` | LLM 提供商配置 | name, provider_type, endpoint, model, api_key_env_var, cost_per_1k, priority |
| `prompt_templates` | LLM 提示模板 | name, template_text, variables(JSON), version |
| `llm_usage_logs` | LLM 调用日志 | provider_id, template_id, prompt_tokens, completion_tokens, latency_ms, cost |

---

## 10. Redis 缓存策略

| 缓存项 | Redis Key 模式 | TTL | 说明 |
|--------|---------------|-----|------|
| 规则详情 | `rule:{id}` | 300s | 单个规则详情缓存，写操作时失效 |
| 规则元数据 | `rules:meta` | 持久 | Hash 类型，用于 list_rules 快速查询 |
| 分析聚合 | `analytics:agg` | 300s | 仪表板分析结果缓存 |
| 指标缓冲 | `metrics:buffer` | 持久 | List 类型，后台任务每 30s 清空写入 MySQL |
| 缓存锁 | `lock:rule:{id}` | 5s | SET NX 互斥锁，防止缓存击穿 |
| JWT 吊销 | `jti:revoked:{jti}` | 24h | 会话撤销后加入黑名单 |
| 速率限制 | `rate:{path}:{window}` | 窗口长度 | 滑动窗口计数器 |

---

## 11. 后台任务说明

后端启动时派生 4 个后台任务：

| 任务 | 周期 | 功能 |
|------|------|------|
| **Metrics Flusher** | 每 30s | 从 Redis `metrics:buffer` 列表中取出数据，批量 INSERT 到 `metrics_ingest` 表（批量大小 1000） |
| **Metrics Aggregator** | 每 5min | 将上一个完整小时的原始指标聚合到 `metrics_hourly_summary` 表 |
| **Metrics Retention** | 每 6h | 删除 `metrics_ingest` 中超过 30 天的原始数据（批量大小 5000） |
| **Classification Retention** | 每 6h | 读取 `data_classifications` 中设置了 `target_table` 的分类，从白名单表中删除超过 `retention_days` 的行（白名单: notifications, audit_logs, login_history, user_sessions, metrics_ingest, metrics_hourly_summary） |

所有后台任务在 `Ctrl+C` 时优雅关闭。

---

## 12. 前端技术栈与开发

### 12.1 技术选型

| 类别 | 技术 | 说明 |
|------|------|------|
| 框架 | Next.js 16.2.6 (App Router) | 服务端渲染 + 客户端组件 |
| UI | React 19.2.6 | `"use client"` 模式 |
| 样式 | Tailwind CSS 4.2.4 | 类驱动样式 + 暗色模式 |
| 图标 | lucide-react 1.12.0 | SVG 图标库 |
| 认证 | next-auth 4.24.14 | Credentials Provider + JWT 会话 |
| 数据获取 | SWR 2.4.1 | 缓存 + 重新验证 |
| 类型 | TypeScript 5.6.2 | 严格类型检查 |

### 12.2 目录结构

```
frontend/
├── app/                    # Next.js App Router 页面
│   ├── page.tsx            # 主 SPA 入口（221行，路由组装）
│   ├── layout.tsx          # 根布局
│   ├── providers.tsx       # Session + Theme + I18n Provider
│   ├── i18n.tsx            # 中英文切换 Context
│   ├── theme.tsx           # 亮色/暗色主题 Context
│   ├── globals.css         # Tailwind + CSS 变量 + 动画
│   └── api/                # Next.js API 路由
│       ├── auth/[...nextauth]/route.ts  # NextAuth 配置
│       └── proxy/[...path]/route.ts     # 后端 API 代理
├── components/
│   ├── layout/             # 壳组件（Navbar/Sidebar/MainContentRouter）
│   ├── ui/                 # 可复用 UI（Toast/CodeBlock/ErrorBoundary）
│   └── features/           # 功能面板（每个面板一个文件/目录）
├── hooks/                  # 自定义 Hook（每功能一个文件）
├── lib/                    # 工具函数和类型
│   ├── api.ts              # 统一 API 调用（缓存+去重+401处理）
│   ├── swr.ts              # SWR 封装
│   ├── types.ts            # TypeScript 类型定义
│   ├── constants.ts        # CSS 类名常量
│   ├── permissions.ts      # 前端权限门控
│   └── utils.ts            # 工具函数
├── types/
│   └── next-auth.d.ts      # NextAuth 类型扩展
└── public/                 # 静态资源
```

### 12.3 API 调用模式

所有前端 API 调用通过 `lib/api.ts` 中的 `apiFetch()` 统一处理：

- **代理路径**: 请求自动走 `/api/proxy/<后端路径>`，JWT 由服务端注入
- **GET 缓存**: 成功响应缓存 30s，同类路径的 POST/PUT/DELETE 自动失效缓存
- **去重**: 相同方法+路径+请求体的并发请求自动去重
- **401 处理**: JWT 过期时触发 `signOut()`

### 12.4 权限前端门控

- `lib/permissions.ts` 定义了 36 个权限常量（与后端 `auth.rs` 一一对应）
- `canAccessMenu(userGroup, menuId, permissions?)` 控制菜单可见性
- `admin_group` 无 permissions 数组时显示全部；有数组时按具体权限检查
- `user_group` 仅显示 portal、user-center、manual、dashboard
- 功能面板通过 `can` props 控制操作按钮的显示（如 UserManagementPanel 的"删除用户"按钮仅管理员可见）

### 12.5 国际化

- 简单 Context 实现（非第三方库）
- `useI18n()` → `{ lang, setLang, t(en, zh) }`
- 语言偏好保存在 localStorage key `app_lang`
- 每一个面向用户的字符串都包裹在 `t("english", "中文")` 中
- 支持中文（zh）和 English（en）

### 12.6 主题

- 三种模式: system / light / dark
- 暗色模式通过 `<html>` 上的 `dark` class 触发（Tailwind `dark:` 变体）
- 偏好保存在 localStorage key `app_theme`
- CSS 变量定义在 `globals.css` 中的 `:root` 和 `.dark` 选择器下

---

## 13. 后端技术栈与开发

### 13.1 技术选型

| 类别 | 技术 | 说明 |
|------|------|------|
| 框架 | Axum 0.8 | 异步 Web 框架 |
| 运行时 | Tokio | 异步运行时 |
| 数据库 | sqlx 0.8 + MySQL | 编译时查询检查 |
| 缓存 | redis-rs | Redis 客户端 |
| 认证 | jsonwebtoken | JWT HS256 |
| 密码 | bcrypt | cost=12 |
| 2FA | totp-rs | TOTP 标准实现 |
| 邮件 | lettre | SMTP 客户端 |
| 验证 | jsonschema | JSON Schema Draft 7 |
| 日志 | tracing + tracing-subscriber | 结构化 JSON 日志 |
| 序列化 | serde + serde_json | JSON 处理 |

### 13.2 目录结构

```
backend/src/
├── main.rs               # 4行，tokio::main 入口
├── lib.rs                # 模块声明 + run() + 路由组装 + 健康检查 + 后台任务启动
├── config.rs             # AppState/Settings/AuthSettings/环境变量解析/CORS/日志
├── auth.rs               # AuthContext/AuthMiddleware/JWT/RBAC/AppError
├── types/                # 请求/响应结构体
│   ├── rule.rs           # TransformRule 及相关类型
│   ├── api_key.rs        # API Key 类型
│   ├── rate_limit.rs     # 速率限制类型
│   ├── metrics.rs        # 指标/分析类型
│   ├── approval.rs       # 审批类型
│   ├── llm.rs            # LLM 类型
│   ├── user.rs           # 用户/会话/登录历史/TOTP/偏好
│   ├── system.rs         # 系统设置类型
│   ├── notification.rs   # 通知类型
│   ├── validation.rs     # 验证类型
│   └── permission_template.rs
├── handlers/             # HTTP 处理器（每领域一个文件）
│   ├── rules.rs          # 规则 CRUD + 列表（游标分页 + Redis Hash 缓存）
│   ├── versions.rs       # 版本列表 + diff + 回滚
│   ├── transform_handlers.rs  # 变换预览/执行/表达式求值
│   ├── api_keys.rs       # API 密钥 CRUD + 验证
│   ├── rate_limits.rs    # 速率限制 CRUD + 检查
│   ├── approvals.rs      # 审批工作流
│   ├── metrics.rs        # 指标摄取 + 分析 + 仪表板
│   ├── audit.rs          # 审计日志
│   ├── notifications.rs  # 通知管理
│   ├── auth_user.rs      # 登录 + 个人资料 + 密码修改
│   ├── user_management.rs # 用户管理 CRUD
│   ├── totp.rs           # TOTP 设置/验证/禁用
│   ├── user_sessions.rs  # 会话/登录历史/设备管理
│   ├── user_preferences.rs # 用户偏好
│   ├── products.rs       # API 产品 CRUD
│   ├── subscriptions.rs  # 订阅 CRUD + 用量 + 升级/取消/续期
│   ├── circuit_breakers.rs # 熔断器 CRUD
│   ├── protocols.rs      # 协议配置 CRUD
│   ├── classifications.rs # 数据分类 CRUD
│   ├── plugins.rs        # 插件 CRUD
│   ├── llm.rs            # LLM 路由 + 提供商/模板 CRUD
│   ├── openapi.rs        # OpenAPI 规范生成
│   ├── validation_handlers.rs # 请求/响应验证
│   ├── system.rs         # 系统设置管理 + SMTP 测试
│   ├── permission_templates.rs # 权限模板 CRUD
│   └── common.rs         # 共享工具（审计日志、缓存辅助、宏）
├── engine/               # 纯业务逻辑（零 HTTP 依赖）
│   ├── transform.rs      # 变换流水线
│   ├── expression.rs     # 表达式求值器
│   ├── gray_release.rs   # 灰度发布/金丝雀
│   ├── diff.rs           # JSON 差异对比
│   ├── validation.rs     # JSON Schema 验证
│   ├── openapi.rs        # OpenAPI 规范生成
│   ├── crypto.rs         # API Key 生成/哈希
│   ├── email.rs          # SMTP 传输（构建/发送/验证/密码加密）
│   ├── metrics.rs        # 后台指标任务
│   ├── notify.rs         # 通知分发
│   ├── retention.rs      # 数据保留清理
│   └── risk.rs           # 零信任登录风险评估
└── db/                   # 数据库引导
    ├── mod.rs            # bootstrap_schema() 入口
    ├── auth.rs           # 用户/会话/历史/TOTP/设备/模板表
    ├── infrastructure.rs # API Key/速率限制/LLM/熔断器/协议/分类/插件表
    ├── metrics.rs        # 指标表
    ├── products.rs       # 产品/订阅表
    ├── rules.rs          # 规则/版本/审批表
    ├── system.rs         # 系统设置/审计/通知表
    └── seeds.rs          # 初始数据填充
```

### 13.3 关键架构约定

- **Handler 不包含业务逻辑**: 所有 handler 只处理 HTTP 层面（提取参数 → 调用 engine → 返回响应）
- **Engine 零 HTTP 依赖**: 所有 engine 文件可脱离 HTTP/DB 进行单元测试
- **审计日志**: 所有修改操作通过 `spawn_audit_log()` 异步写入（fire-and-forget，不阻塞请求）
- **错误处理**: `AppError` 枚举统一映射 HTTP 状态码：
  - `BadRequest` → 400
  - `Unauthorized` → 401
  - `Forbidden` → 403
  - `NotFound` → 404
  - `Conflict` → 409
  - `Db/Redis/Json/Internal` → 500
- **API Key**: 生成格式 `sk_<UUIDv4>`，存储 SHA-256 哈希，仅在创建时返回完整密钥
- **SMTP 密码**: XOR 加密存储（密钥流由 JWT Secret 经 SHA-256 派生），存储格式 `enc:v1:<base64>`
- **通知触发**: 审计事件自动匹配通知类型 → 检查用户偏好 → 插入 `notifications` 表

---
> **文档维护**: 本文件应随代码变更同步更新。每次新增功能、修改 API 或调整架构时，请更新对应章节。
