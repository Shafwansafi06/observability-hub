# ObservAI Hub - Enterprise Backend Architecture

## 1. High-Level Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Next.js/React Frontend  │  SDK Clients  │  CLI Tools  │  External Integrations │
└────────────────┬────────────────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY LAYER                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Rate Limiter  │  Auth Middleware  │  Request Validation  │  API Key Management │
└────────────────┬────────────────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           SUPABASE EDGE FUNCTIONS                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │  Ingestion   │  │   Metrics    │  │    Logs      │  │   Alerts     │        │
│  │   Service    │  │   Service    │  │   Service    │  │   Service    │        │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘        │
│                                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   Anomaly    │  │    Auth      │  │   Billing    │  │   Webhooks   │        │
│  │   Detector   │  │   Service    │  │   Service    │  │   Service    │        │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘        │
│                                                                                  │
└────────────────┬────────────────────────────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌───────────────┐  ┌───────────────┐
│  Redis Cache  │  │  PostgreSQL   │
│   (Upstash)   │  │  (Supabase)   │
└───────────────┘  └───────────────┘
        │                 │
        └────────┬────────┘
                 ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           BACKGROUND JOBS                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Cron Aggregator  │  Anomaly Scanner  │  Alert Dispatcher  │  Retention Cleaner │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 2. Core Components

### 2.1 Data Ingestion Pipeline
- **High-throughput telemetry ingestion** (100K+ events/sec)
- **Batch processing** with configurable flush intervals
- **Schema validation** using Zod
- **Deduplication** using Redis bloom filters
- **Backpressure handling** with circuit breaker pattern

### 2.2 Metrics System
- **Time-series data model** optimized for PostgreSQL
- **Pre-aggregated rollups** (1min, 5min, 1hr, 1day)
- **Cardinality management** with tag indexing
- **P50/P95/P99 percentile calculations**
- **Custom metric definitions** per organization

### 2.3 Log Management
- **Structured log ingestion** with JSON schema
- **Full-text search** using PostgreSQL GIN indexes
- **Log correlation** with trace IDs
- **Retention policies** per log level
- **Export capabilities** (S3, BigQuery)

### 2.4 Anomaly Detection
- **Statistical anomaly detection** (Z-score, MAD)
- **ML-based pattern recognition** (optional)
- **Configurable thresholds** per metric
- **Automatic baselining** with sliding windows
- **Alert correlation** to reduce noise

### 2.5 Alert System
- **Multi-channel notifications** (Email, Slack, PagerDuty, Webhook)
- **Alert grouping** and deduplication
- **Escalation policies**
- **On-call scheduling**
- **Alert acknowledgment** and resolution tracking

## 3. Data Flow

```
                    ┌─────────────────┐
                    │  SDK/Client     │
                    │  Application    │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Ingestion API  │
                    │  /api/ingest    │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
       ┌────────────┐ ┌────────────┐ ┌────────────┐
       │   Metrics  │ │    Logs    │ │   Traces   │
       │   Buffer   │ │   Buffer   │ │   Buffer   │
       └──────┬─────┘ └──────┬─────┘ └──────┬─────┘
              │              │              │
              ▼              ▼              ▼
       ┌────────────┐ ┌────────────┐ ┌────────────┐
       │  metrics   │ │    logs    │ │   traces   │
       │   table    │ │   table    │ │   table    │
       └──────┬─────┘ └──────┬─────┘ └──────┬─────┘
              │              │              │
              └──────────────┼──────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Aggregation    │
                    │  Cron Job       │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Anomaly        │
                    │  Detection      │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Alert          │
                    │  Dispatcher     │
                    └─────────────────┘
```

## 4. Security Architecture

### 4.1 Authentication Layers
1. **API Key Authentication** - For SDK/programmatic access
2. **JWT Authentication** - For web application users
3. **Service Account** - For internal service-to-service communication

### 4.2 Authorization Model
- **Organization-based multi-tenancy**
- **Role-Based Access Control (RBAC)**
  - `owner` - Full access, billing, member management
  - `admin` - Full access except billing
  - `member` - Read/write access to assigned projects
  - `viewer` - Read-only access

### 4.3 Row Level Security (RLS)
- All tables protected by organization-scoped RLS
- Audit logging for sensitive operations
- Data isolation guaranteed at database level

## 5. Performance Targets

| Metric | Target | Strategy |
|--------|--------|----------|
| API Response Time | < 150ms P95 | Redis caching, connection pooling |
| Ingestion Throughput | 100K events/sec | Batch processing, async writes |
| Query Latency | < 500ms P95 | Materialized views, proper indexing |
| Uptime | 99.9% | Multi-region, health checks |
| Data Retention | 90 days (default) | Automated cleanup, tiered storage |

## 6. Technology Stack

| Layer | Technology |
|-------|------------|
| Database | PostgreSQL 15 (Supabase) |
| Cache | Redis (Upstash) |
| Edge Functions | Deno (Supabase Edge Functions) |
| Authentication | Supabase Auth |
| Real-time | Supabase Realtime |
| Storage | Supabase Storage |
| Monitoring | Built-in + External (Grafana) |

## 7. Folder Structure

```
/
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 00001_initial_schema.sql
│   │   ├── 00002_metrics_tables.sql
│   │   ├── 00003_logs_tables.sql
│   │   ├── 00004_alerts_tables.sql
│   │   ├── 00005_rls_policies.sql
│   │   └── 00006_indexes_and_functions.sql
│   └── functions/
│       ├── _shared/
│       │   ├── cors.ts
│       │   ├── auth.ts
│       │   ├── cache.ts
│       │   ├── validation.ts
│       │   └── types.ts
│       ├── ingest/
│       │   └── index.ts
│       ├── metrics/
│       │   └── index.ts
│       ├── logs/
│       │   └── index.ts
│       ├── alerts/
│       │   └── index.ts
│       ├── anomalies/
│       │   └── index.ts
│       ├── api-keys/
│       │   └── index.ts
│       ├── webhooks/
│       │   └── index.ts
│       └── cron/
│           ├── aggregate-metrics/
│           │   └── index.ts
│           ├── detect-anomalies/
│           │   └── index.ts
│           └── cleanup-retention/
│               └── index.ts
├── src/
│   ├── server/
│   │   ├── api/
│   │   │   ├── metrics.ts
│   │   │   ├── logs.ts
│   │   │   ├── alerts.ts
│   │   │   └── projects.ts
│   │   ├── actions/
│   │   │   ├── auth.ts
│   │   │   ├── organizations.ts
│   │   │   └── settings.ts
│   │   └── utils/
│   │       ├── cache.ts
│   │       └── db.ts
│   ├── lib/
│   │   ├── supabaseClient.ts
│   │   ├── supabaseServer.ts
│   │   └── supabaseAdmin.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── rateLimit.ts
│   │   └── logging.ts
│   └── types/
│       ├── database.ts
│       ├── api.ts
│       └── schemas.ts
└── docs/
    ├── ARCHITECTURE.md
    ├── API.md
    └── DEPLOYMENT.md
```

## 8. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRODUCTION                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │   Vercel    │     │  Supabase   │     │   Upstash   │       │
│  │  (Frontend) │────▶│  (Backend)  │────▶│   (Redis)   │       │
│  └─────────────┘     └─────────────┘     └─────────────┘       │
│         │                   │                                    │
│         │                   ▼                                    │
│         │            ┌─────────────┐                            │
│         │            │  Supabase   │                            │
│         │            │  Realtime   │                            │
│         │            └─────────────┘                            │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────┐                                                │
│  │ CloudFlare  │                                                │
│  │    CDN      │                                                │
│  └─────────────┘                                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```
