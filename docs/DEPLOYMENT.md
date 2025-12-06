# ObservAI Hub - Deployment Guide

This guide covers deploying the ObservAI Hub backend infrastructure, including database setup, Edge Functions, and production configuration.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Deployment](#database-deployment)
4. [Edge Functions Deployment](#edge-functions-deployment)
5. [Cron Jobs Setup](#cron-jobs-setup)
6. [Production Configuration](#production-configuration)
7. [Monitoring & Observability](#monitoring--observability)
8. [Scaling Guidelines](#scaling-guidelines)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

```bash
# Install Supabase CLI
npm install -g supabase

# Install Deno (for local Edge Function development)
curl -fsSL https://deno.land/install.sh | sh

# Verify installations
supabase --version
deno --version
```

### Accounts & Services

- [Supabase Account](https://supabase.com) - Database and Edge Functions
- [Upstash Account](https://upstash.com) - Redis caching
- Domain and SSL certificate for production
- Email service (SendGrid, Postmark, or AWS SES) for notifications

---

## Environment Setup

### 1. Create Supabase Project

```bash
# Login to Supabase
supabase login

# Link to existing project (or create new)
supabase link --project-ref <your-project-ref>
```

### 2. Configure Environment Variables

Create a `.env.local` file:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Redis (Upstash)
UPSTASH_REDIS_URL=https://your-redis.upstash.io
UPSTASH_REDIS_TOKEN=your-redis-token

# Application
VITE_API_BASE_URL=https://api.your-domain.com
VITE_APP_URL=https://app.your-domain.com

# Cron Jobs
CRON_SECRET=your-secure-cron-secret

# Notifications (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
PAGERDUTY_API_KEY=your-pagerduty-key
SENDGRID_API_KEY=your-sendgrid-key
```

### 3. Set Edge Function Secrets

```bash
# Set secrets for Edge Functions
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set UPSTASH_REDIS_URL=https://your-redis.upstash.io
supabase secrets set UPSTASH_REDIS_TOKEN=your-redis-token
supabase secrets set CRON_SECRET=your-secure-cron-secret
```

---

## Database Deployment

### 1. Run Migrations

```bash
# Apply all migrations
supabase db push

# Or run migrations individually (for more control)
supabase db reset  # Resets and applies all migrations
```

### 2. Verify Schema

```bash
# Check migration status
supabase db diff

# Connect to database directly
supabase db remote <command>
```

### 3. Seed Initial Data (Optional)

Create `supabase/seed.sql`:

```sql
-- Create default organization
INSERT INTO organizations (id, name, slug, tier)
VALUES (
  'default-org-uuid',
  'Default Organization',
  'default',
  'free'
) ON CONFLICT DO NOTHING;

-- Create admin user (after Supabase Auth signup)
-- INSERT INTO users ...
```

```bash
supabase db seed
```

### 4. Enable RLS

RLS policies are included in the migrations. Verify they're active:

```sql
-- Check RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

---

## Edge Functions Deployment

### 1. Deploy All Functions

```bash
# Deploy all Edge Functions
supabase functions deploy

# Or deploy individually
supabase functions deploy ingest
supabase functions deploy metrics
supabase functions deploy alerts
```

### 2. Deploy Cron Functions

```bash
supabase functions deploy cron/aggregate-metrics
supabase functions deploy cron/detect-anomalies
supabase functions deploy cron/cleanup
supabase functions deploy cron/check-alerts
```

### 3. Verify Deployment

```bash
# List deployed functions
supabase functions list

# Test a function
curl -X POST https://your-project.supabase.co/functions/v1/ingest \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"metrics": [{"name": "test", "value": 1}]}'
```

---

## Cron Jobs Setup

Supabase supports scheduled functions via pg_cron. Configure in the dashboard or via SQL:

### 1. Enable pg_cron Extension

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### 2. Schedule Jobs

```sql
-- Aggregate metrics every 5 minutes
SELECT cron.schedule(
  'aggregate-metrics',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    'https://your-project.supabase.co/functions/v1/cron/aggregate-metrics',
    '{}',
    '{"Authorization": "Bearer ' || current_setting('app.cron_secret') || '"}'::jsonb
  );
  $$
);

-- Detect anomalies every 15 minutes
SELECT cron.schedule(
  'detect-anomalies',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    'https://your-project.supabase.co/functions/v1/cron/detect-anomalies',
    '{}',
    '{"Authorization": "Bearer ' || current_setting('app.cron_secret') || '"}'::jsonb
  );
  $$
);

-- Check alerts every minute
SELECT cron.schedule(
  'check-alerts',
  '* * * * *',
  $$
  SELECT net.http_post(
    'https://your-project.supabase.co/functions/v1/cron/check-alerts',
    '{}',
    '{"Authorization": "Bearer ' || current_setting('app.cron_secret') || '"}'::jsonb
  );
  $$
);

-- Cleanup daily at 3 AM UTC
SELECT cron.schedule(
  'cleanup',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    'https://your-project.supabase.co/functions/v1/cron/cleanup',
    '{}',
    '{"Authorization": "Bearer ' || current_setting('app.cron_secret') || '"}'::jsonb
  );
  $$
);
```

### 3. Verify Cron Jobs

```sql
-- List scheduled jobs
SELECT * FROM cron.job;

-- View job run history
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;
```

---

## Production Configuration

### 1. Database Configuration

```sql
-- Optimize for production workload
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '1GB';
ALTER SYSTEM SET effective_cache_size = '3GB';
ALTER SYSTEM SET work_mem = '16MB';
ALTER SYSTEM SET maintenance_work_mem = '256MB';

-- Enable query performance insights
ALTER SYSTEM SET pg_stat_statements.track = 'all';
```

### 2. Connection Pooling

Configure PgBouncer for connection pooling:

```ini
# pgbouncer.ini
[databases]
observai = host=localhost dbname=observai

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
```

### 3. SSL/TLS Configuration

Ensure all connections use SSL:

```bash
# In Supabase, SSL is enabled by default
# For custom deployments, configure in postgresql.conf
ssl = on
ssl_cert_file = '/path/to/server.crt'
ssl_key_file = '/path/to/server.key'
```

### 4. CORS Configuration

Edge Functions handle CORS. For custom deployments:

```typescript
// Allowed origins for production
const ALLOWED_ORIGINS = [
  'https://app.your-domain.com',
  'https://your-domain.com',
];
```

---

## Monitoring & Observability

### 1. Database Monitoring

```sql
-- Create monitoring views
CREATE VIEW monitoring.slow_queries AS
SELECT 
  query,
  calls,
  mean_exec_time,
  total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 100;

-- Monitor table sizes
CREATE VIEW monitoring.table_sizes AS
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(tablename::regclass)) as total_size,
  pg_size_pretty(pg_indexes_size(tablename::regclass)) as index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename::regclass) DESC;
```

### 2. Metrics Export

Configure Prometheus metrics export:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'supabase'
    static_configs:
      - targets: ['your-metrics-endpoint:9090']
```

### 3. Alerting

Set up alerts for critical metrics:

```yaml
# alertmanager.yml
route:
  receiver: 'slack'
  
receivers:
  - name: 'slack'
    slack_configs:
      - api_url: 'https://hooks.slack.com/...'
        channel: '#observai-alerts'
```

### 4. Log Aggregation

Configure log shipping to your preferred service:

```bash
# Example: Ship logs to Datadog
DD_API_KEY=your-key DD_SITE=datadoghq.com \
  bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script.sh)"
```

---

## Scaling Guidelines

### Horizontal Scaling

1. **Edge Functions**: Automatically scaled by Supabase
2. **Database Read Replicas**: Configure for read-heavy workloads
3. **Redis Cluster**: Upgrade Upstash plan or self-host Redis Cluster

### Vertical Scaling

| Tier | Database | Connections | Storage | Recommended Users |
|------|----------|-------------|---------|-------------------|
| Free | 500MB | 50 | 500MB | < 1,000 |
| Pro | 8GB | 200 | 8GB | < 10,000 |
| Team | 16GB | 500 | 100GB | < 100,000 |
| Enterprise | Custom | Custom | Custom | > 100,000 |

### Data Partitioning

For high-volume metrics:

```sql
-- Partition metrics by month
CREATE TABLE metrics_y2024m01 PARTITION OF metrics
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### Archival Strategy

```sql
-- Archive old data to cold storage
CREATE TABLE metrics_archive (
  LIKE metrics INCLUDING ALL
);

-- Move old data
INSERT INTO metrics_archive
SELECT * FROM metrics
WHERE timestamp < NOW() - INTERVAL '90 days';

DELETE FROM metrics
WHERE timestamp < NOW() - INTERVAL '90 days';
```

---

## Troubleshooting

### Common Issues

#### 1. Connection Refused

```bash
# Check if database is accessible
psql "postgresql://user:pass@host:5432/db?sslmode=require"

# Verify Edge Functions are deployed
supabase functions list
```

#### 2. RLS Blocking Queries

```sql
-- Debug RLS policies
SET row_security = off;  -- Temporarily (admin only)
SELECT * FROM your_table LIMIT 1;
SET row_security = on;

-- Check current user context
SELECT current_user, session_user;
```

#### 3. Slow Queries

```sql
-- Identify slow queries
SELECT * FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Analyze query plan
EXPLAIN ANALYZE <your-query>;
```

#### 4. Memory Issues

```sql
-- Check memory usage
SELECT * FROM pg_stat_activity;

-- Kill long-running queries
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE duration > interval '5 minutes';
```

### Health Checks

```bash
# Database health
supabase db lint

# Function health
curl https://your-project.supabase.co/functions/v1/ingest \
  -X GET \
  -H "Authorization: Bearer YOUR_KEY"

# Full system check
./scripts/health-check.sh
```

### Backup & Recovery

```bash
# Create backup
supabase db dump -f backup.sql

# Restore from backup
psql -f backup.sql postgresql://...
```

---

## Security Checklist

- [ ] RLS policies enabled on all tables
- [ ] Service role key stored securely (never in frontend)
- [ ] API keys rotated regularly
- [ ] SSL/TLS enforced for all connections
- [ ] CORS configured for production domains only
- [ ] Rate limiting configured
- [ ] Audit logging enabled
- [ ] Data retention policies configured
- [ ] Backup schedule configured
- [ ] Incident response plan documented

---

## Support

For issues or questions:

1. Check the [Architecture Documentation](./ARCHITECTURE.md)
2. Review [OpenAPI Specification](./openapi.yaml)
3. Open an issue on GitHub
4. Contact support@observai.hub
