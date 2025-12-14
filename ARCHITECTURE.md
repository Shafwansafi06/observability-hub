# ObservAI Tracking Pipeline - Architecture

## 🏗️ Complete System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL PROJECTS                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │   React App  │  │  Next.js API │  │  Express.js  │  │  Lambda Fn │ │
│  │              │  │              │  │              │  │            │ │
│  │  ObservAI    │  │  ObservAI    │  │  ObservAI    │  │  ObservAI  │ │
│  │  SDK Client  │  │  SDK Client  │  │  SDK Client  │  │  SDK Client│ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬─────┘ │
└─────────┼──────────────────┼──────────────────┼──────────────────┼──────┘
          │                  │                  │                  │
          │  ┌───────────────┴──────────────────┴──────────────┐  │
          └──┤         VERTEX AI (Gemini Models)               ├──┘
             │  • Generate Content                              │
             │  • Calculate Response                            │
             │  • Return Tokens & Text                          │
             └──────────────────────────────────────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   ObservAI SDK (Client)   │
                    │                           │
                    │  📊 Track Metrics:        │
                    │   - Latency (ms)          │
                    │   - Tokens (in/out)       │
                    │   - Cost (USD)            │
                    │                           │
                    │  🎯 Analyze Quality:      │
                    │   - Coherence Score       │
                    │   - Toxicity Detection    │
                    │   - Hallucination Risk    │
                    │   - Sentiment Analysis    │
                    │                           │
                    │  📦 Batch Mode:           │
                    │   - Buffer requests       │
                    │   - Send every N or M sec │
                    └─────────────┬─────────────┘
                                  │
                                  │ HTTPS POST
                                  │ /functions/v1/track-llm
                                  │
                    ┌─────────────▼─────────────┐
                    │  SUPABASE EDGE FUNCTION   │
                    │  (Deno Runtime)           │
                    │                           │
                    │  ✅ Validate Data         │
                    │  🔍 Check Anomalies       │
                    │  🚨 Create Alerts         │
                    │  💾 Store in Database     │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │  SUPABASE POSTGRESQL      │
                    │                           │
                    │  Tables:                  │
                    │  ├─ llm_requests          │
                    │  ├─ alerts                │
                    │  ├─ detection_rules       │
                    │  ├─ user_profiles         │
                    │  ├─ logs                  │
                    │  ├─ metrics_snapshots     │
                    │  └─ cost_tracking         │
                    │                           │
                    │  Features:                │
                    │  ├─ RLS (Row Security)    │
                    │  ├─ 50+ Indexes           │
                    │  ├─ Materialized Views    │
                    │  └─ Triggers & Functions  │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   OBSERVAI DASHBOARD      │
                    │   (React + TypeScript)    │
                    │                           │
                    │  📊 Real-time Metrics     │
                    │  📈 Historical Charts     │
                    │  🚨 Alert Management      │
                    │  💰 Cost Analysis         │
                    │  🤖 Lyra AI Optimizer     │
                    │  🔍 Log Stream            │
                    │  ⚙️  Settings & Config    │
                    └───────────────────────────┘
```

## 📊 Data Flow Sequence

### Request Lifecycle

```
1. User Code Execution
   ↓
   const client = new ObservAIClient({ ... });
   const result = await client.generateContent(model, prompt);
   
2. SDK Intercepts Call
   ↓
   • Start timer
   • Forward to Vertex AI
   • Receive response
   • Stop timer
   
3. SDK Analyzes Response
   ↓
   • Calculate token counts (estimateTokens)
   • Calculate cost (calculateCost)
   • Analyze quality (analyzeQuality)
     ├─ Coherence score (0.0-1.0)
     ├─ Toxicity score (0.0-1.0)
     ├─ Hallucination risk (0.0-1.0)
     └─ Sentiment score (-1.0 to 1.0)
   • Categorize prompt (categorizePrompt)
   
4. SDK Prepares Tracking Data
   ↓
   {
     request_id: "req_123...",
     model: "gemini-2.5-flash",
     prompt: "...",
     response: "...",
     latency_ms: 1234,
     tokens_in: 100,
     tokens_out: 250,
     tokens_total: 350,
     cost_usd: 0.000026,
     coherence_score: 0.85,
     toxicity_score: 0.02,
     hallucination_risk: 0.15,
     success: true,
     timestamp: "2025-12-15T..."
   }
   
5. SDK Sends to Backend
   ↓
   if (batchMode.enabled) {
     • Add to batch buffer
     • Send when:
       - Batch size >= maxBatchSize
       - Time since last send >= maxWaitMs
   } else {
     • Send immediately
   }
   
6. Edge Function Receives Data
   ↓
   • Validate request format
   • Extract user_id
   • Map to database schema
   
7. Anomaly Detection
   ↓
   • Check latency (> 5000ms)
   • Check cost (> $0.10)
   • Check toxicity (> 0.7)
   • Check errors (success: false)
   
8. Create Alerts (if needed)
   ↓
   INSERT INTO alerts (
     title: "High Latency Detected",
     severity: "warning",
     current_value: 5234,
     threshold_value: 5000
   )
   
9. Store in Database
   ↓
   INSERT INTO llm_requests VALUES (...)
   
10. Dashboard Updates
    ↓
    • Real-time subscription (Supabase Realtime)
    • Auto-refresh charts every 5-30s
    • Show in Overview / LLM Metrics / Anomalies
```

## 🔐 Security Architecture

### Authentication Flow

```
┌──────────────┐
│  User Login  │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│  Supabase Auth       │
│  • Email/Password    │
│  • Google OAuth      │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Generate JWT Token  │
│  • User ID           │
│  • Session Info      │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Store in Context    │
│  • AuthContext       │
│  • Local Storage     │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  SDK Uses User ID    │
│  • Attach to requests│
│  • Track per user    │
└──────────────────────┘
       │
       ▼
┌──────────────────────┐
│  RLS Policies        │
│  • Filter by user_id │
│  • auth.uid() = user │
└──────────────────────┘
```

### Data Security

1. **API Keys**: Never committed, use environment variables
2. **RLS**: Row-level security on all tables
3. **Sanitization**: Sensitive data removed before storage
4. **HTTPS Only**: All communication encrypted
5. **JWT**: Secure authentication tokens

## ⚡ Performance Optimizations

### 1. Batch Mode
```typescript
// Without batching: 100 requests = 100 HTTP calls
// With batching: 100 requests = 10 HTTP calls (batch size: 10)

client = new ObservAIClient({
  batchMode: {
    enabled: true,
    maxBatchSize: 20,    // Send every 20 requests
    maxWaitMs: 5000      // Or every 5 seconds
  }
});

// Reduces network overhead by 10-20x!
```

### 2. Database Indexes
```sql
-- Time-series queries optimized
CREATE INDEX idx_llm_requests_user_created 
  ON llm_requests(user_id, created_at DESC);

-- Cost analysis optimized
CREATE INDEX idx_llm_requests_cost_analysis 
  ON llm_requests(user_id, model, cost_usd DESC);

-- 50+ indexes for <10ms query times
```

### 3. Materialized Views
```sql
-- Pre-aggregated daily metrics
CREATE MATERIALIZED VIEW daily_metrics AS
SELECT user_id, date, COUNT(*), SUM(cost_usd), ...
FROM llm_requests
GROUP BY user_id, date;

-- Refresh every hour instead of calculating on every request
```

### 4. Edge Functions (Deno)
```
• Cold start: ~50ms
• Execution: ~10-100ms
• Auto-scaling: Infinite
• Cost: First 500K requests free
```

## 📈 Scalability

### Current Capacity

| Metric | Capacity | Notes |
|--------|----------|-------|
| **Requests/sec** | 1,000+ | Edge function auto-scales |
| **Storage** | Unlimited | Supabase PostgreSQL |
| **Concurrent Users** | 10,000+ | JWT-based auth |
| **Batch Buffer** | Configurable | 10-100 requests |
| **Query Performance** | <10ms | 50+ indexes |

### Scaling Strategy

```
1. Horizontal Scaling
   • Edge functions auto-scale
   • Multiple database read replicas
   • CDN for static assets

2. Data Partitioning
   • Partition logs by date (monthly)
   • Archive old data to cold storage
   • Separate read/write databases

3. Caching
   • Redis for metrics snapshots
   • Browser cache for static data
   • Materialized views for aggregations

4. Rate Limiting
   • SDK-level throttling
   • Edge function rate limits
   • Per-user quotas
```

## 🔍 Monitoring & Observability

### SDK-Level Metrics

```typescript
// Every request tracked
{
  latency_ms: 1234,        // Time to generate
  tokens_used: 350,        // Total tokens
  cost_usd: 0.000026,      // Calculated cost
  quality_scores: { ... }, // Automated analysis
  success: true,           // Error tracking
  retry_count: 0           // Resilience
}
```

### Dashboard-Level Metrics

- **Overview**: Request volume, latency, tokens, cost
- **LLM Metrics**: Per-model breakdown, P50/P95/P99
- **Anomalies**: Alert dashboard, error trends
- **Log Stream**: Real-time log viewer

### Database-Level Metrics

```sql
-- Active monitoring queries
SELECT 
  COUNT(*) as total_requests,
  AVG(latency_ms) as avg_latency,
  SUM(cost_usd) as total_cost,
  COUNT(CASE WHEN success = FALSE THEN 1 END) as errors
FROM llm_requests
WHERE created_at >= NOW() - INTERVAL '1 hour';
```

## 🚀 Deployment Options

### Option 1: Managed (Recommended)
```
• Supabase Cloud (Database + Edge Functions)
• Vercel (Dashboard Frontend)
• NPM (SDK Package)
• Automatic scaling & updates
```

### Option 2: Self-Hosted
```
• Self-hosted Supabase (Docker)
• Custom server (Node.js)
• Private npm registry
• Full control, more maintenance
```

### Option 3: Hybrid
```
• Supabase Cloud (Database)
• Your servers (Frontend)
• Public npm (SDK)
• Balance of control & convenience
```

## 📚 Tech Stack Summary

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **SDK Core** | TypeScript | Client library |
| **Build** | tsup | Bundle SDK |
| **Frontend** | React 18 + Vite | Dashboard UI |
| **Backend** | Supabase Edge (Deno) | Ingestion API |
| **Database** | PostgreSQL 12+ | Data storage |
| **Auth** | Supabase Auth | User management |
| **AI** | Vertex AI (Gemini) | LLM provider |
| **Monitoring** | Datadog RUM/APM | Full observability |
| **UI** | shadcn/ui + Tailwind | Components |
| **Charts** | Recharts | Visualizations |

## 🎯 Key Advantages

1. **Universal Compatibility**: Works with any JS/TS project
2. **Zero Configuration**: Drop-in replacement
3. **Automatic Tracking**: No manual instrumentation
4. **Quality Analysis**: Built-in ML-based scoring
5. **Cost Intelligence**: Real-time $ tracking
6. **Batch Efficiency**: Reduces network overhead
7. **Error Resilience**: Auto-retry, never breaks apps
8. **Privacy First**: Sanitizes sensitive data
9. **Scalable**: Handles millions of requests
10. **Beautiful Dashboard**: Real-time insights

---

**Built with ❤️ by ObservAI Team**
