# ObservAI Hub - Security Documentation

This document outlines the security measures implemented in the ObservAI Hub backend.

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [Row-Level Security (RLS)](#row-level-security-rls)
3. [API Security](#api-security)
4. [Data Protection](#data-protection)
5. [Compliance](#compliance)

---

## Authentication & Authorization

### JWT-Based Authentication

All authenticated requests use JWT tokens issued by Supabase Auth:

```
Authorization: Bearer <jwt_token>
```

**Token Structure:**
- `aud`: Audience (authenticated)
- `sub`: User ID (UUID)
- `email`: User email
- `role`: User role
- `org_id`: Organization ID
- `exp`: Expiration timestamp

### API Key Authentication

For programmatic access (SDKs, CI/CD, etc.):

```
X-API-Key: observai_live_xxxx
```

**API Key Features:**
- Scoped permissions (read, write, ingest)
- Configurable rate limits
- Automatic expiration
- Revocation support
- Usage tracking

### Role Hierarchy

| Role | Level | Permissions |
|------|-------|-------------|
| `viewer` | 1 | Read-only access to assigned resources |
| `member` | 2 | Read + limited write access |
| `admin` | 3 | Full access within organization |
| `owner` | 4 | Full access + billing + user management |

---

## Row-Level Security (RLS)

### Overview

All database tables have RLS enabled, ensuring users can only access data they're authorized to see.

### Policy Examples

**Organizations Table:**
```sql
-- Users can only view their own organization
CREATE POLICY "Users can view own organization"
ON organizations FOR SELECT
USING (
  id = (SELECT organization_id FROM users WHERE id = auth.uid())
);
```

**Projects Table:**
```sql
-- Users can view projects in their organization
CREATE POLICY "Organization members can view projects"
ON projects FOR SELECT
USING (
  organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
);

-- Only admins can create projects
CREATE POLICY "Admins can create projects"
ON projects FOR INSERT
WITH CHECK (
  organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  AND (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'owner')
);
```

**Metrics/Logs Tables:**
```sql
-- Users can view metrics for projects in their organization
CREATE POLICY "Org members can view metrics"
ON metrics FOR SELECT
USING (
  project_id IN (
    SELECT id FROM projects
    WHERE organization_id = (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
);
```

### API Key RLS

```sql
-- API keys bypass auth.uid() and use custom context
CREATE POLICY "API key access"
ON metrics FOR SELECT
USING (
  project_id = current_setting('app.project_id', true)::uuid
  OR project_id IN (
    SELECT id FROM projects
    WHERE organization_id = (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
);
```

---

## API Security

### Input Validation

All inputs are validated using Zod schemas:

```typescript
const IngestPayloadSchema = z.object({
  metrics: z.array(MetricSchema).max(1000).optional(),
  logs: z.array(LogSchema).max(1000).optional(),
  llm_metrics: z.array(LLMMetricSchema).max(1000).optional(),
});
```

**Validation Rules:**
- Max batch size: 1000 items
- Max string length: 10,000 characters
- Timestamp validation (not in future)
- UUID format validation
- SQL injection prevention

### Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/ingest` | 1000/min | 60 seconds |
| `/metrics` | 100/min | 60 seconds |
| `/auth/*` | 10/min | 60 seconds |
| Default | 100/min | 60 seconds |

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699876543
Retry-After: 30
```

### CORS Configuration

```typescript
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://app.observai.hub',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
  'Access-Control-Max-Age': '86400',
};
```

### Request Signing (Optional)

For enhanced security, requests can be signed:

```typescript
const signature = crypto
  .createHmac('sha256', secretKey)
  .update(JSON.stringify(payload) + timestamp)
  .digest('hex');

headers['X-Signature'] = signature;
headers['X-Timestamp'] = timestamp;
```

---

## Data Protection

### Encryption

| Data Type | At Rest | In Transit |
|-----------|---------|------------|
| Database | AES-256 | TLS 1.3 |
| Backups | AES-256 | TLS 1.3 |
| API Traffic | N/A | TLS 1.3 |
| Secrets | AES-256 | TLS 1.3 |

### PII Masking

Sensitive data is automatically masked:

```typescript
const PII_PATTERNS = [
  /\b[\w.-]+@[\w.-]+\.\w{2,}\b/gi,  // Email
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,  // Phone
  /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,  // Credit card
  /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,  // SSN
];

function maskPII(text: string): string {
  return PII_PATTERNS.reduce(
    (masked, pattern) => masked.replace(pattern, '[REDACTED]'),
    text
  );
}
```

### Data Retention

| Data Type | Retention Period |
|-----------|-----------------|
| Raw Metrics | 30 days |
| Aggregated Metrics | 1 year |
| Debug Logs | 7 days |
| Info Logs | 30 days |
| Error Logs | 1 year |
| Audit Logs | 7 years |

### Audit Logging

All sensitive operations are logged:

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Compliance

### GDPR Compliance

**Data Subject Rights Implementation:**

1. **Right to Access (Article 15)**
   ```sql
   -- Export user data
   SELECT * FROM export_user_data(user_id);
   ```

2. **Right to Erasure (Article 17)**
   ```sql
   -- Delete user data
   SELECT delete_user_data(user_id);
   ```

3. **Right to Portability (Article 20)**
   ```sql
   -- Export in standard format
   SELECT export_user_data_json(user_id);
   ```

4. **Right to Rectification (Article 16)**
   - Users can update their data via API
   - Audit trail maintained

### SOC 2 Type II Considerations

| Control | Implementation |
|---------|---------------|
| Access Control | RBAC with RLS |
| Encryption | AES-256, TLS 1.3 |
| Audit Logging | Comprehensive audit trail |
| Monitoring | Real-time alerting |
| Incident Response | Documented procedures |

### Security Headers

```typescript
const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': "default-src 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};
```

---

## Security Checklist

### Development
- [ ] No secrets in code or version control
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] CSRF protection

### Deployment
- [ ] TLS certificates valid
- [ ] Secrets rotated regularly
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Security headers set

### Monitoring
- [ ] Failed auth attempts logged
- [ ] Rate limit breaches alerted
- [ ] Anomalous activity detected
- [ ] Audit logs reviewed

### Incident Response
- [ ] Incident response plan documented
- [ ] Contact list maintained
- [ ] Backup/recovery tested
- [ ] Post-incident review process

---

## Reporting Security Issues

If you discover a security vulnerability, please report it to:

**Email:** security@observai.hub

**Do NOT:**
- Open a public GitHub issue
- Disclose publicly before fix is available

**We will:**
- Acknowledge receipt within 24 hours
- Provide regular updates on fix progress
- Credit you in security advisory (if desired)
